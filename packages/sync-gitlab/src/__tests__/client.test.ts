import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GlEpic, GlIssue, GlMilestone, GlProject } from '../client.js';
import { GitLabClient } from '../client.js';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(
  data: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(init?.headers ?? {}),
  });
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers,
  });
}

describe('GitLabClient', () => {
  describe('constructor', () => {
    it('strips trailing slash from baseUrl', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      const client = new GitLabClient('tok', 'https://gl.example.com/');
      await client.listLabels(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://gl.example.com/api/v4/projects/1/labels?per_page=100&page=1',
      );
    });

    it('defaults to gitlab.com', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      const client = new GitLabClient('tok');
      await client.listLabels(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('https://gitlab.com/api/v4/');
    });
  });

  describe('getProject', () => {
    it('returns project and encodes namespace/path', async () => {
      const project: GlProject = {
        id: 42,
        name: 'proj',
        path_with_namespace: 'ns/proj',
        namespace: { id: 10, kind: 'group', full_path: 'ns' },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(project));

      const client = new GitLabClient('tok');
      const result = await client.getProject('ns/proj');
      expect(result.id).toBe(42);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://gitlab.com/api/v4/projects/ns%2Fproj');
      expect(init.headers['PRIVATE-TOKEN']).toBe('tok');
    });

    it('uses numeric project id without encoding', async () => {
      const project: GlProject = {
        id: 42,
        name: 'proj',
        path_with_namespace: 'ns/proj',
        namespace: { id: 10, kind: 'user', full_path: 'ns' },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(project));

      const client = new GitLabClient('tok');
      await client.getProject(42);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://gitlab.com/api/v4/projects/42');
    });
  });

  describe('listMilestones', () => {
    it('concatenates active and closed milestones', async () => {
      const activeMs: GlMilestone = {
        id: 1,
        iid: 1,
        title: 'v1',
        description: null,
        state: 'active',
        due_date: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      const closedMs: GlMilestone = { ...activeMs, id: 2, state: 'closed' };

      mockFetch
        .mockResolvedValueOnce(jsonResponse([activeMs]))
        .mockResolvedValueOnce(jsonResponse([closedMs]));

      const client = new GitLabClient('tok');
      const result = await client.listMilestones(1);
      expect(result).toHaveLength(2);
      expect(result[0].state).toBe('active');
      expect(result[1].state).toBe('closed');

      const [, active] = mockFetch.mock.calls[0][0].match(/state=(\w+)/) ?? [];
      expect(active).toBe('active');
    });
  });

  describe('getMilestone', () => {
    it('returns milestone when found', async () => {
      const ms: GlMilestone = {
        id: 1,
        iid: 1,
        title: 'v1',
        description: null,
        state: 'active',
        due_date: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(ms));

      const client = new GitLabClient('tok');
      const result = await client.getMilestone(1, 1);
      expect(result?.id).toBe(1);
    });

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('not found', { status: 404 }),
      );
      const client = new GitLabClient('tok');
      const result = await client.getMilestone(1, 999);
      expect(result).toBeNull();
    });
  });

  describe('createMilestone', () => {
    it('POSTs body and returns created', async () => {
      const ms: GlMilestone = {
        id: 5,
        iid: 1,
        title: 'v2',
        description: 'desc',
        state: 'active',
        due_date: '2026-10-01',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(ms));

      const client = new GitLabClient('tok');
      const result = await client.createMilestone(7, {
        title: 'v2',
        description: 'desc',
        due_date: '2026-10-01',
      });
      expect(result.id).toBe(5);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://gitlab.com/api/v4/projects/7/milestones?per_page=100&page=1'.replace(
          '?per_page=100&page=1',
          '',
        ),
      );
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body).title).toBe('v2');
    });
  });

  describe('updateMilestone', () => {
    it('PUTs body', async () => {
      const ms: GlMilestone = {
        id: 5,
        iid: 1,
        title: 'v2',
        description: 'updated',
        state: 'closed',
        due_date: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(ms));

      const client = new GitLabClient('tok');
      const result = await client.updateMilestone(7, 5, {
        state_event: 'close',
      });
      expect(result.id).toBe(5);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://gitlab.com/api/v4/projects/7/milestones/5');
      expect(init.method).toBe('PUT');
    });
  });

  describe('listIssues', () => {
    it('paginates with x-next-page', async () => {
      const page1: GlIssue[] = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        iid: i,
        title: `t${i}`,
        description: null,
        state: 'opened' as const,
        assignee: null,
        labels: [],
        milestone: null,
        weight: null,
        epic_iid: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }));
      const page2: GlIssue[] = [
        {
          id: 100,
          iid: 100,
          title: 't100',
          description: null,
          state: 'opened',
          assignee: null,
          labels: [],
          milestone: null,
          weight: null,
          epic_iid: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse(page1, { headers: { 'x-next-page': '2' } }),
        )
        .mockResolvedValueOnce(jsonResponse(page2));

      const client = new GitLabClient('tok');
      const result = await client.listIssues(1);
      expect(result).toHaveLength(101);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [firstUrl] = mockFetch.mock.calls[0];
      expect(firstUrl).toContain('state=all');
      expect(firstUrl).toContain('order_by=created_at');
    });

    it('respects state option', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      const client = new GitLabClient('tok');
      await client.listIssues(1, { state: 'opened' });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('state=opened');
    });
  });

  describe('getIssue', () => {
    it('returns issue when found', async () => {
      const issue: GlIssue = {
        id: 1,
        iid: 1,
        title: 't',
        description: null,
        state: 'opened',
        assignee: null,
        labels: [],
        milestone: null,
        weight: null,
        epic_iid: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(issue));

      const client = new GitLabClient('tok');
      const result = await client.getIssue(1, 1);
      expect(result?.iid).toBe(1);
    });

    it('returns null on error', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('forbidden', { status: 403 }),
      );
      const client = new GitLabClient('tok');
      const result = await client.getIssue(1, 99);
      expect(result).toBeNull();
    });
  });

  describe('createIssue', () => {
    it('POSTs body', async () => {
      const created: GlIssue = {
        id: 10,
        iid: 10,
        title: 'new',
        description: 'd',
        state: 'opened',
        assignee: null,
        labels: [],
        milestone: null,
        weight: null,
        epic_iid: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(created));

      const client = new GitLabClient('tok');
      const result = await client.createIssue(1, {
        title: 'new',
        description: 'd',
      });
      expect(result.iid).toBe(10);
      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body).title).toBe('new');
    });
  });

  describe('updateIssue', () => {
    it('PUTs body', async () => {
      const updated: GlIssue = {
        id: 10,
        iid: 10,
        title: 't',
        description: null,
        state: 'closed',
        assignee: null,
        labels: [],
        milestone: null,
        weight: null,
        epic_iid: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(updated));

      const client = new GitLabClient('tok');
      const result = await client.updateIssue(1, 10, { state_event: 'close' });
      expect(result.state).toBe('closed');
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://gitlab.com/api/v4/projects/1/issues/10');
      expect(init.method).toBe('PUT');
    });
  });

  describe('group epics', () => {
    it('listGroupEpics returns epics on success', async () => {
      const epic: GlEpic = {
        id: 1,
        iid: 1,
        group_id: 10,
        title: 'Epic',
        description: null,
        state: 'opened',
        labels: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(jsonResponse([epic]));

      const client = new GitLabClient('tok');
      const result = await client.listGroupEpics(10);
      expect(result).toHaveLength(1);
    });

    it('listGroupEpics returns [] when Premium forbidden', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('forbidden', { status: 403 }),
      );
      const client = new GitLabClient('tok');
      const result = await client.listGroupEpics(10);
      expect(result).toEqual([]);
    });

    it('getGroupEpic returns epic or null', async () => {
      const epic: GlEpic = {
        id: 1,
        iid: 1,
        group_id: 10,
        title: 'Epic',
        description: null,
        state: 'opened',
        labels: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mockFetch
        .mockResolvedValueOnce(jsonResponse(epic))
        .mockResolvedValueOnce(new Response('not found', { status: 404 }));

      const client = new GitLabClient('tok');
      expect((await client.getGroupEpic(10, 1))?.iid).toBe(1);
      expect(await client.getGroupEpic(10, 999)).toBeNull();
    });

    it('createGroupEpic POSTs body', async () => {
      const epic: GlEpic = {
        id: 2,
        iid: 2,
        group_id: 10,
        title: 'New',
        description: null,
        state: 'opened',
        labels: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(epic));

      const client = new GitLabClient('tok');
      const result = await client.createGroupEpic(10, { title: 'New' });
      expect(result.iid).toBe(2);
      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe('POST');
    });

    it('updateGroupEpic PUTs body', async () => {
      const epic: GlEpic = {
        id: 2,
        iid: 2,
        group_id: 10,
        title: 'updated',
        description: null,
        state: 'closed',
        labels: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(epic));

      const client = new GitLabClient('tok');
      const result = await client.updateGroupEpic(10, 2, {
        state_event: 'close',
      });
      expect(result.state).toBe('closed');
      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe('PUT');
    });

    it('listEpicIssues returns [] on error', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('forbidden', { status: 403 }),
      );
      const client = new GitLabClient('tok');
      const result = await client.listEpicIssues(10, 1);
      expect(result).toEqual([]);
    });

    it('listEpicIssues returns issues on success', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      const client = new GitLabClient('tok');
      const result = await client.listEpicIssues(10, 1);
      expect(result).toEqual([]);
    });
  });

  describe('listLabels', () => {
    it('paginates labels', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, name: 'bug' }]));
      const client = new GitLabClient('tok');
      const result = await client.listLabels(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('paginate params', () => {
    it('skips undefined params', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      const client = new GitLabClient('tok');
      await client.listIssues(1);
      const [url] = mockFetch.mock.calls[0];
      // state=all sort=asc order_by=created_at — no undefined keys
      expect(url).not.toContain('undefined');
    });
  });

  describe('retry behavior', () => {
    it('retries after 429 using Retry-After', async () => {
      const retryResp = new Response('rate limited', {
        status: 429,
        headers: { 'Retry-After': '0' },
      });
      mockFetch
        .mockResolvedValueOnce(retryResp)
        .mockResolvedValueOnce(jsonResponse([]));

      const client = new GitLabClient('tok');
      const result = await client.listLabels(1);
      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 5xx then succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('err', { status: 500 }))
        .mockResolvedValueOnce(jsonResponse([]));

      const client = new GitLabClient('tok');
      const result = await client.listLabels(1);
      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws after 3 consecutive 5xx failures', async () => {
      mockFetch.mockResolvedValue(new Response('err', { status: 500 }));

      const client = new GitLabClient('tok');
      await expect(client.listLabels(1)).rejects.toThrow(
        /GitLab API error 500/,
      );
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 20000);

    it('throws on 4xx non-handled (e.g. 400)', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('bad request', { status: 400 }),
      );

      const client = new GitLabClient('tok');
      await expect(client.listLabels(1)).rejects.toThrow(
        /GitLab API error 400/,
      );
    });

    it('warns when remaining rate limit is low', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce(
        jsonResponse([], { headers: { 'RateLimit-Remaining': '5' } }),
      );

      const client = new GitLabClient('tok');
      await client.listLabels(1);
      expect(warn).toHaveBeenCalled();
    });
  });
});
