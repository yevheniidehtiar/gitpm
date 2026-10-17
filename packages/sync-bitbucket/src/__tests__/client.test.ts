import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import issuesPage1 from '../__fixtures__/bitbucket-issues-page1.json';
import issuesPage2 from '../__fixtures__/bitbucket-issues-page2.json';
import milestonesPage from '../__fixtures__/bitbucket-milestones.json';
import type { BitbucketClientOptions } from '../client.js';
import { createBitbucketClient, DEFAULT_BASE_URL } from '../client.js';

const mockFetch = vi.fn();
const sleep = vi.fn(async (_ms: number) => {});

beforeEach(() => {
  mockFetch.mockReset();
  sleep.mockClear();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(
  data: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
}

function client(overrides: Partial<BitbucketClientOptions> = {}) {
  return createBitbucketClient({
    auth: { kind: 'bearer', token: 'tok' },
    sleep,
    ...overrides,
  });
}

function call(index = 0): { url: string; init: RequestInit } {
  const [url, init] = mockFetch.mock.calls[index];
  return { url, init };
}

function header(index: number, name: string): string | undefined {
  const headers = call(index).init.headers as Record<string, string>;
  return headers[name];
}

describe('createBitbucketClient', () => {
  describe('auth', () => {
    it('sends a Bearer header for access tokens', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ slug: 'widgets' }));
      await client().getRepository('acme', 'widgets');
      expect(header(0, 'Authorization')).toBe('Bearer tok');
    });

    it('sends Basic email:token for Atlassian API tokens', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ slug: 'widgets' }));
      await client({
        auth: { kind: 'basic', email: 'ada@example.com', token: 'secret' },
      }).getRepository('acme', 'widgets');
      const expected = Buffer.from('ada@example.com:secret').toString('base64');
      expect(header(0, 'Authorization')).toBe(`Basic ${expected}`);
    });
  });

  describe('urls', () => {
    it('defaults to api.bitbucket.org and encodes path segments', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ slug: 'w' }));
      await client().getRepository('my team', 'repo/x');
      expect(call().url).toBe(
        `${DEFAULT_BASE_URL}/repositories/my%20team/repo%2Fx`,
      );
    });

    it('strips a trailing slash from a custom baseUrl', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: 5 }));
      await client({ baseUrl: 'https://bb.example.com/2.0/' }).getIssue(
        'acme',
        'widgets',
        5,
      );
      expect(call().url).toBe(
        'https://bb.example.com/2.0/repositories/acme/widgets/issues/5',
      );
    });
  });

  describe('pagination', () => {
    it('follows next links and concatenates values', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(issuesPage1))
        .mockResolvedValueOnce(jsonResponse(issuesPage2));

      const result = await client().listIssues('acme', 'widgets');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.map((i) => i.id)).toEqual([1, 2, 3]);
      expect(call(0).url).toBe(
        `${DEFAULT_BASE_URL}/repositories/acme/widgets/issues?pagelen=50&sort=created_on`,
      );
      expect(call(1).url).toBe(issuesPage1.next);
    });

    it('passes a BBQL filter and custom sort', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(issuesPage2));
      await client().listIssues('acme', 'widgets', {
        q: 'state="open"',
        sort: '-updated_on',
      });
      const url = new URL(call().url);
      expect(url.searchParams.get('q')).toBe('state="open"');
      expect(url.searchParams.get('sort')).toBe('-updated_on');
    });

    it('refuses to follow a next link to another host', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ...issuesPage1, next: 'https://evil.example.com/p2' }),
      );
      const result = await client().listIssues('acme', 'widgets');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('evil.example.com');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('lists milestones and components', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(milestonesPage))
        .mockResolvedValueOnce(
          jsonResponse({ values: [{ id: 3, name: 'x' }] }),
        );
      const c = client();

      const milestones = await c.listMilestones('acme', 'widgets');
      const components = await c.listComponents('acme', 'widgets');

      expect(milestones.ok && milestones.value.map((m) => m.name)).toEqual([
        'v1.0',
        'v1.1',
      ]);
      expect(components.ok && components.value).toEqual([{ id: 3, name: 'x' }]);
      expect(call(0).url).toContain('/repositories/acme/widgets/milestones?');
      expect(call(1).url).toContain('/repositories/acme/widgets/components?');
    });

    it('stops and returns the error when a later page fails', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(issuesPage1))
        .mockResolvedValueOnce(jsonResponse({}, { status: 403 }));
      const result = await client().listIssues('acme', 'widgets');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.status).toBe(403);
    });
  });

  describe('writes', () => {
    it('creates an issue with a JSON body', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: 9, title: 'New' }));
      const result = await client().createIssue('acme', 'widgets', {
        title: 'New',
        content: { raw: 'body' },
        kind: 'task',
        priority: 'major',
        component: { name: 'checkout' },
      });

      expect(result.ok && result.value.id).toBe(9);
      expect(call().init.method).toBe('POST');
      expect(JSON.parse(call().init.body as string)).toEqual({
        title: 'New',
        content: { raw: 'body' },
        kind: 'task',
        priority: 'major',
        component: { name: 'checkout' },
      });
    });

    it('updates an issue with PUT', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: 9, state: 'resolved' }),
      );
      const result = await client().updateIssue('acme', 'widgets', 9, {
        state: 'resolved',
      });
      expect(result.ok).toBe(true);
      expect(call().init.method).toBe('PUT');
      expect(call().url).toBe(
        `${DEFAULT_BASE_URL}/repositories/acme/widgets/issues/9`,
      );
    });

    it('lists and creates issue comments', async () => {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({ values: [{ id: 1, content: { raw: 'hi' } }] }),
        )
        .mockResolvedValueOnce(jsonResponse({ id: 2, content: { raw: 'yo' } }));
      const c = client();

      const list = await c.listIssueComments('acme', 'widgets', 9);
      const created = await c.createIssueComment('acme', 'widgets', 9, 'yo');

      expect(list.ok && list.value).toHaveLength(1);
      expect(created.ok && created.value.id).toBe(2);
      expect(JSON.parse(call(1).init.body as string)).toEqual({
        content: { raw: 'yo' },
      });
    });
  });

  describe('errors and retries', () => {
    it('returns the Bitbucket error message on 4xx without retrying', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          {
            type: 'error',
            error: { message: 'Repository has no issue tracker.' },
          },
          { status: 404 },
        ),
      );
      const result = await client().listIssues('acme', 'widgets');
      expect(result).toEqual({
        ok: false,
        error: {
          status: 404,
          message: 'Bitbucket API error 404: Repository has no issue tracker.',
        },
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to the raw body for non-JSON errors', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Forbidden', { status: 403 }),
      );
      const result = await client().getIssue('acme', 'widgets', 1);
      expect(!result.ok && result.error.message).toBe(
        'Bitbucket API error 403: Forbidden',
      );
    });

    it('waits for Retry-After on 429 and then succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({}, { status: 429, headers: { 'Retry-After': '7' } }),
        )
        .mockResolvedValueOnce(jsonResponse({ id: 1 }));
      const result = await client().getIssue('acme', 'widgets', 1);
      expect(result.ok).toBe(true);
      expect(sleep).toHaveBeenCalledWith(7000);
    });

    it('backs off exponentially on 5xx and gives up after maxRetries', async () => {
      mockFetch.mockImplementation(async () =>
        jsonResponse({ error: { message: 'boom' } }, { status: 503 }),
      );
      const result = await client({ maxRetries: 2 }).getIssue(
        'acme',
        'widgets',
        1,
      );
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
      expect(result).toEqual({
        ok: false,
        error: { status: 503, message: 'Bitbucket API error 503: boom' },
      });
    });

    it('retries network errors and reports them without throwing', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNRESET'));
      const result = await client({ maxRetries: 1 }).getRepository(
        'acme',
        'widgets',
      );
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        ok: false,
        error: {
          status: null,
          message: 'Bitbucket request failed: ECONNRESET',
        },
      });
    });

    it('reports invalid JSON on a 2xx response', async () => {
      mockFetch.mockResolvedValueOnce(new Response('<html>', { status: 200 }));
      const result = await client().getRepository('acme', 'widgets');
      expect(!result.ok && result.error.message).toBe(
        'Bitbucket API returned invalid JSON',
      );
    });
  });
});
