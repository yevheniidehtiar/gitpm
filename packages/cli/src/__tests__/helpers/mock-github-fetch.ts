/**
 * Wire-level GitHub API mock for CLI integration tests.
 *
 * Why fetch-level and not `vi.mock('@octokit/rest', ...)`: `gitpm import|push|pull|sync`
 * resolve the real `@gitpm/sync-github` adapter dynamically at runtime via
 * `@gitpm/core`'s `loadAdapters` (a bare `import()` that, under this repo's
 * Bun workspace layout, falls back to loading the package by an absolute
 * `file://` URL rather than a bare specifier). Vitest's `vi.mock` intercepts
 * module graphs it transforms; imports resolved that way are not guaranteed
 * to share a module identity with the specifier used inside a test file, so
 * `vi.mock('@octokit/rest', ...)` does not reliably apply to the copy of
 * `@octokit/rest` loaded from inside the dynamically-resolved adapter
 * package (confirmed empirically — the real Octokit client got constructed
 * and issued a real HTTP request that failed with "Bad credentials").
 *
 * `@octokit/request` (which underlies every `@octokit/rest` call) resolves
 * its HTTP implementation as `requestOptions.request?.fetch || globalThis.fetch`.
 * `GitHubClient` never sets `request.fetch`, so stubbing the process-global
 * `fetch` — a single object shared by every module realm in this process,
 * regardless of which physical `node_modules` copy of `@octokit/*` loaded it
 * — reliably intercepts every GitHub API call the real adapter code makes.
 * This is the "mock at the fetch level" escape hatch anticipated by the
 * story: it still exercises the real `@gitpm/sync-github` adapter, `mapper`,
 * `import`/`export`/`sync` orchestration, and `GitHubClient` pagination /
 * rate-limit logic — only the actual network call is stubbed.
 */
import { vi } from 'vitest';

export interface GhMilestoneFixture {
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  due_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface GhIssueFixture {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  assignee: { login: string } | null;
  labels: Array<{ name: string } | string>;
  milestone: { number: number; title: string } | null;
  pull_request?: unknown;
  created_at: string;
  updated_at: string;
}

export interface MockGithubFetchController {
  /** Spies for the write endpoints so tests can assert on request payloads. */
  createIssue: ReturnType<typeof vi.fn>;
  updateIssue: ReturnType<typeof vi.fn>;
  createMilestone: ReturnType<typeof vi.fn>;
  updateMilestone: ReturnType<typeof vi.fn>;
  /** Configure the fixture data returned by the read endpoints. */
  setMilestones(milestones: GhMilestoneFixture[]): void;
  setIssues(issues: GhIssueFixture[]): void;
  setIssueByNumber(issue: GhIssueFixture | null, number?: number): void;
  setMilestoneByNumber(
    milestone: GhMilestoneFixture | null,
    number?: number,
  ): void;
  /** Make every request fail (simulates an API outage). */
  failAllRequestsWith(message: string): void;
  reset(): void;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Installs a `globalThis.fetch` stub that understands the small subset of
 * the GitHub REST API that `GitHubClient` calls. Call `reset()` (or rely on
 * `vi.unstubAllGlobals()` in an `afterEach`) to remove it.
 */
export function installMockGithubFetch(): MockGithubFetchController {
  let milestones: GhMilestoneFixture[] = [];
  let issues: GhIssueFixture[] = [];
  const issueByNumber = new Map<number, GhIssueFixture | null>();
  const milestoneByNumber = new Map<number, GhMilestoneFixture | null>();
  let forcedFailure: string | null = null;

  const createIssue = vi.fn(
    (body: { title: string }, number: number): GhIssueFixture => ({
      number,
      title: body.title,
      body: null,
      state: 'open',
      assignee: null,
      labels: [],
      milestone: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    }),
  );
  const updateIssue = vi.fn(
    (number: number, body: Record<string, unknown>): GhIssueFixture => ({
      number,
      title: (body.title as string) ?? 'Updated',
      body: (body.body as string) ?? null,
      state: (body.state as 'open' | 'closed') ?? 'open',
      assignee: null,
      labels: [],
      milestone: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    }),
  );
  const createMilestone = vi.fn(
    (body: { title: string }, number: number): GhMilestoneFixture => ({
      number,
      title: body.title,
      description: null,
      state: 'open',
      due_on: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    }),
  );
  const updateMilestone = vi.fn(
    (number: number, body: Record<string, unknown>): GhMilestoneFixture => ({
      number,
      title: (body.title as string) ?? 'Updated',
      description: (body.description as string) ?? null,
      state: (body.state as 'open' | 'closed') ?? 'open',
      due_on: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    }),
  );

  let nextIssueNumber = 1000;
  let nextMilestoneNumber = 100;

  async function handler(
    input: string | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (forcedFailure) {
      throw new Error(forcedFailure);
    }

    const url = new URL(typeof input === 'string' ? input : input.toString());
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname;
    const body = init?.body ? JSON.parse(init.body as string) : {};

    // /repos/{owner}/{repo}/milestones
    let m = path.match(/^\/repos\/[^/]+\/[^/]+\/milestones$/);
    if (m) {
      if (method === 'GET') {
        const state = url.searchParams.get('state');
        const page = Number(url.searchParams.get('page') ?? '1');
        if (page > 1) return jsonResponse([]);
        const filtered = milestones.filter((ms) =>
          state === 'all' || state === null ? true : ms.state === state,
        );
        return jsonResponse(filtered);
      }
      if (method === 'POST') {
        const number = nextMilestoneNumber++;
        return jsonResponse(createMilestone(body, number), 201);
      }
    }

    // /repos/{owner}/{repo}/milestones/{number}
    m = path.match(/^\/repos\/[^/]+\/[^/]+\/milestones\/(\d+)$/);
    if (m) {
      const number = Number(m[1]);
      if (method === 'GET') {
        const found = milestoneByNumber.has(number)
          ? milestoneByNumber.get(number)
          : (milestones.find((ms) => ms.number === number) ?? null);
        if (!found) return jsonResponse({ message: 'Not Found' }, 404);
        return jsonResponse(found);
      }
      if (method === 'PATCH') {
        return jsonResponse(updateMilestone(number, body));
      }
    }

    // /repos/{owner}/{repo}/issues/{number}/sub_issues
    m = path.match(/^\/repos\/[^/]+\/[^/]+\/issues\/(\d+)\/sub_issues$/);
    if (m && method === 'GET') {
      return jsonResponse([]);
    }

    // /repos/{owner}/{repo}/issues/{number}
    m = path.match(/^\/repos\/[^/]+\/[^/]+\/issues\/(\d+)$/);
    if (m) {
      const number = Number(m[1]);
      if (method === 'GET') {
        const found = issueByNumber.has(number)
          ? issueByNumber.get(number)
          : (issues.find((i) => i.number === number) ?? null);
        if (!found) return jsonResponse({ message: 'Not Found' }, 404);
        return jsonResponse(found);
      }
      if (method === 'PATCH') {
        return jsonResponse(updateIssue(number, body));
      }
    }

    // /repos/{owner}/{repo}/issues
    m = path.match(/^\/repos\/[^/]+\/[^/]+\/issues$/);
    if (m) {
      if (method === 'GET') {
        const page = Number(url.searchParams.get('page') ?? '1');
        if (page > 1) return jsonResponse([]);
        return jsonResponse(issues);
      }
      if (method === 'POST') {
        const number = nextIssueNumber++;
        return jsonResponse(createIssue(body, number), 201);
      }
    }

    throw new Error(`Unhandled mock fetch request: ${method} ${path}`);
  }

  vi.stubGlobal('fetch', vi.fn(handler));

  return {
    createIssue,
    updateIssue,
    createMilestone,
    updateMilestone,
    setMilestones(next) {
      milestones = next;
    },
    setIssues(next) {
      issues = next;
    },
    setIssueByNumber(issue, number) {
      issueByNumber.set(number ?? issue?.number ?? 0, issue);
    },
    setMilestoneByNumber(milestone, number) {
      milestoneByNumber.set(number ?? milestone?.number ?? 0, milestone);
    },
    failAllRequestsWith(message) {
      forcedFailure = message;
    },
    reset() {
      milestones = [];
      issues = [];
      issueByNumber.clear();
      milestoneByNumber.clear();
      forcedFailure = null;
      createIssue.mockClear();
      updateIssue.mockClear();
      createMilestone.mockClear();
      updateMilestone.mockClear();
    },
  };
}
