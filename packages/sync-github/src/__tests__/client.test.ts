import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type OctokitInstance = {
  issues: {
    listMilestones: ReturnType<typeof vi.fn>;
    listForRepo: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    getMilestone: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    createMilestone: ReturnType<typeof vi.fn>;
    updateMilestone: ReturnType<typeof vi.fn>;
  };
  request: ReturnType<typeof vi.fn>;
};

const octokitInstance: OctokitInstance = {
  issues: {
    listMilestones: vi.fn(),
    listForRepo: vi.fn(),
    get: vi.fn(),
    getMilestone: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    createMilestone: vi.fn(),
    updateMilestone: vi.fn(),
  },
  request: vi.fn(),
};

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    issues = octokitInstance.issues;
    request = octokitInstance.request;
  },
}));

import { GitHubClient } from '../client.js';

function okResponse<T>(data: T, headers: Record<string, string> = {}) {
  return {
    data,
    headers: {
      'x-ratelimit-remaining': '4999',
      'x-ratelimit-reset': '0',
      ...headers,
    },
    status: 200,
    url: '',
  };
}

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    // Reset every mock method on the instance but keep identity
    for (const fn of Object.values(octokitInstance.issues)) {
      fn.mockReset();
    }
    octokitInstance.request.mockReset();
    client = new GitHubClient('test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listMilestones', () => {
    it('fetches open and closed milestones and combines them', async () => {
      octokitInstance.issues.listMilestones
        .mockResolvedValueOnce(okResponse([{ number: 1, title: 'Open MS' }]))
        .mockResolvedValueOnce(okResponse([{ number: 2, title: 'Closed MS' }]));

      const result = await client.listMilestones('owner', 'repo');
      expect(result).toEqual([
        { number: 1, title: 'Open MS' },
        { number: 2, title: 'Closed MS' },
      ]);
      expect(octokitInstance.issues.listMilestones).toHaveBeenCalledTimes(2);
    });

    it('paginates until fewer than perPage results are returned', async () => {
      const firstPage = Array.from({ length: 100 }, (_, i) => ({
        number: i + 1,
        title: `MS ${i + 1}`,
      }));
      const secondPage = [{ number: 101, title: 'MS 101' }];

      octokitInstance.issues.listMilestones
        .mockResolvedValueOnce(okResponse(firstPage))
        .mockResolvedValueOnce(okResponse(secondPage))
        .mockResolvedValueOnce(okResponse([])); // closed

      const result = await client.listMilestones('owner', 'repo');
      expect(result).toHaveLength(101);
      expect(octokitInstance.issues.listMilestones).toHaveBeenCalledTimes(3);
    });
  });

  describe('listIssues', () => {
    it('filters out pull requests', async () => {
      octokitInstance.issues.listForRepo.mockResolvedValueOnce(
        okResponse([
          { number: 1, title: 'issue' },
          { number: 2, title: 'pr', pull_request: { url: 'http://x' } },
        ]),
      );

      const result = await client.listIssues('owner', 'repo');
      expect(result).toEqual([{ number: 1, title: 'issue' }]);
    });

    it('passes state option through', async () => {
      octokitInstance.issues.listForRepo.mockResolvedValueOnce(okResponse([]));
      await client.listIssues('owner', 'repo', { state: 'open' });
      expect(octokitInstance.issues.listForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'open' }),
      );
    });

    it('defaults state to "all" when no option given', async () => {
      octokitInstance.issues.listForRepo.mockResolvedValueOnce(okResponse([]));
      await client.listIssues('owner', 'repo');
      expect(octokitInstance.issues.listForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'all' }),
      );
    });
  });

  describe('getProject / getProjectItems (GraphQL stubs)', () => {
    it('returns null for getProject', async () => {
      const r = await client.getProject('o', 'r', 1);
      expect(r).toBeNull();
    });
    it('returns [] for getProjectItems', async () => {
      const r = await client.getProjectItems('PVT_1');
      expect(r).toEqual([]);
    });
  });

  describe('listSubIssues', () => {
    it('returns sub-issue list when API succeeds', async () => {
      octokitInstance.request.mockResolvedValueOnce(
        okResponse([{ id: 10, number: 10, title: 'Sub A' }]),
      );
      const result = await client.listSubIssues('o', 'r', 1);
      expect(result).toEqual([{ id: 10, number: 10, title: 'Sub A' }]);
    });

    it('returns [] when the API call throws (endpoint unavailable)', async () => {
      octokitInstance.request.mockRejectedValueOnce(new Error('not found'));
      const result = await client.listSubIssues('o', 'r', 1);
      expect(result).toEqual([]);
    });
  });

  describe('getIssue', () => {
    it('returns issue when found', async () => {
      octokitInstance.issues.get.mockResolvedValueOnce(
        okResponse({ number: 1, title: 'Found' }),
      );
      const result = await client.getIssue('o', 'r', 1);
      expect(result).toEqual({ number: 1, title: 'Found' });
    });

    it('returns null when the API throws', async () => {
      octokitInstance.issues.get.mockRejectedValueOnce(new Error('not found'));
      const result = await client.getIssue('o', 'r', 999);
      expect(result).toBeNull();
    });
  });

  describe('getMilestone', () => {
    it('returns milestone when found', async () => {
      octokitInstance.issues.getMilestone.mockResolvedValueOnce(
        okResponse({ number: 1, title: 'Found' }),
      );
      const result = await client.getMilestone('o', 'r', 1);
      expect(result).toEqual({ number: 1, title: 'Found' });
    });

    it('returns null when the API throws', async () => {
      octokitInstance.issues.getMilestone.mockRejectedValueOnce(
        new Error('not found'),
      );
      const result = await client.getMilestone('o', 'r', 999);
      expect(result).toBeNull();
    });
  });

  describe('createIssue / updateIssue', () => {
    it('creates an issue and returns data', async () => {
      octokitInstance.issues.create.mockResolvedValueOnce(
        okResponse({ number: 42, title: 'Hello' }),
      );
      const result = await client.createIssue('o', 'r', { title: 'Hello' });
      expect(result).toEqual({ number: 42, title: 'Hello' });
      expect(octokitInstance.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'o', repo: 'r', title: 'Hello' }),
      );
    });

    it('updates an issue and returns data', async () => {
      octokitInstance.issues.update.mockResolvedValueOnce(
        okResponse({ number: 42, title: 'Updated' }),
      );
      const result = await client.updateIssue('o', 'r', 42, {
        state: 'closed',
      });
      expect(result).toEqual({ number: 42, title: 'Updated' });
      expect(octokitInstance.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({ issue_number: 42, state: 'closed' }),
      );
    });
  });

  describe('createMilestone / updateMilestone', () => {
    it('creates a milestone', async () => {
      octokitInstance.issues.createMilestone.mockResolvedValueOnce(
        okResponse({ number: 3, title: 'New MS' }),
      );
      const result = await client.createMilestone('o', 'r', {
        title: 'New MS',
      });
      expect(result).toEqual({ number: 3, title: 'New MS' });
    });

    it('updates a milestone', async () => {
      octokitInstance.issues.updateMilestone.mockResolvedValueOnce(
        okResponse({ number: 3, title: 'Updated MS' }),
      );
      const result = await client.updateMilestone('o', 'r', 3, {
        title: 'Updated MS',
      });
      expect(result).toEqual({ number: 3, title: 'Updated MS' });
      expect(octokitInstance.issues.updateMilestone).toHaveBeenCalledWith(
        expect.objectContaining({ milestone_number: 3 }),
      );
    });
  });

  describe('rate limit handling', () => {
    it('warns when remaining is low', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      octokitInstance.issues.get.mockResolvedValueOnce(
        okResponse({ number: 1, title: 'x' }, { 'x-ratelimit-remaining': '5' }),
      );
      await client.getIssue('o', 'r', 1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('rate limit low'),
      );
    });

    it('sleeps and warns when remaining is 0 and reset is in the future', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(((
        cb: () => void,
      ) => {
        cb();
        return 0 as unknown as NodeJS.Timeout;
      }) as typeof setTimeout);

      const futureReset = Math.floor(Date.now() / 1000) + 60;
      octokitInstance.issues.get.mockResolvedValueOnce(
        okResponse(
          { number: 1, title: 'x' },
          {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(futureReset),
          },
        ),
      );
      await client.getIssue('o', 'r', 1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exhausted'),
      );
      setTimeoutSpy.mockRestore();
    });

    it('does not sleep when reset is in the past', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      const pastReset = Math.floor(Date.now() / 1000) - 60;
      octokitInstance.issues.get.mockResolvedValueOnce(
        okResponse(
          { number: 1, title: 'x' },
          {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(pastReset),
          },
        ),
      );
      await client.getIssue('o', 'r', 1);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    });
  });
});
