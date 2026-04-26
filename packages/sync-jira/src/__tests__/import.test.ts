import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importFromJira } from '../import.js';

const EMAIL = 'user@example.com';
const TOKEN = 'secret-token';
const SITE = 'test.atlassian.net';
const PROJECT_KEY = 'TEST';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function notFoundResponse(): Response {
  return new Response('Not found', { status: 404 });
}

interface IssueFixture {
  id: string;
  key: string;
  summary: string;
  description?: string | null;
  statusName?: string;
  issueType?: string;
  assigneeName?: string | null;
  labels?: string[];
  priorityName?: string | null;
  parentKey?: string;
  sprintId?: number;
}

function buildIssue(f: IssueFixture) {
  return {
    id: f.id,
    key: f.key,
    fields: {
      summary: f.summary,
      description: f.description ?? null,
      status: { name: f.statusName ?? 'To Do', id: '1' },
      issuetype: { name: f.issueType ?? 'Story', id: '10001' },
      assignee: f.assigneeName
        ? { accountId: 'acct-1', displayName: f.assigneeName }
        : null,
      labels: f.labels ?? [],
      priority: f.priorityName ? { name: f.priorityName, id: '2' } : null,
      project: { key: PROJECT_KEY },
      ...(f.parentKey
        ? {
            parent: {
              key: f.parentKey,
              fields: {
                summary: 'Parent',
                issuetype: { name: 'Epic' },
              },
            },
          }
        : {}),
      ...(f.sprintId
        ? { sprint: { id: f.sprintId, name: 'Sprint', state: 'active' } }
        : {}),
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-02T00:00:00Z',
    },
  };
}

describe('importFromJira', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-jira-import-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('imports sprints, epics, and stories from Jira', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/board?projectKeyOrId=')) {
        return jsonResponse({
          values: [{ id: 100, name: 'Scrum Board', type: 'scrum' }],
        });
      }
      if (url.includes('/board/100/sprint')) {
        return jsonResponse({
          values: [
            {
              id: 1,
              name: 'Sprint 1',
              state: 'active',
              startDate: '2026-01-01T00:00:00Z',
              endDate: '2026-01-14T00:00:00Z',
              goal: 'Launch MVP',
            },
          ],
          total: 1,
        });
      }
      if (url.includes('/search?jql=')) {
        return jsonResponse({
          issues: [
            buildIssue({
              id: '10',
              key: 'TEST-10',
              summary: 'Auth Epic',
              description: 'Epic desc',
              statusName: 'In Progress',
              issueType: 'Epic',
              assigneeName: 'Alice',
              labels: ['backend'],
              priorityName: 'High',
              sprintId: 1,
            }),
            buildIssue({
              id: '11',
              key: 'TEST-11',
              summary: 'Login Form',
              issueType: 'Story',
              parentKey: 'TEST-10',
              sprintId: 1,
            }),
          ],
          total: 2,
        });
      }
      return notFoundResponse();
    });

    const result = await importFromJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.milestones).toBe(1);
    expect(result.value.epics).toBe(1);
    expect(result.value.stories).toBe(1);
    expect(result.value.totalFiles).toBe(1 + 1 + 1 + 1 + 1 + 1);
    expect(result.value.writtenPaths).toHaveLength(4);
    expect(result.value.writtenPaths).toContain(
      '.meta/epics/auth-epic/epic.md',
    );
    expect(result.value.writtenPaths).toContain(
      '.meta/epics/auth-epic/stories/login-form.md',
    );

    const epicPath = join(metaDir, 'epics', 'auth-epic', 'epic.md');
    await expect(stat(epicPath)).resolves.toBeDefined();
    const epicContent = await readFile(epicPath, 'utf-8');
    expect(epicContent).toContain('issue_key: TEST-10');

    const storyPath = join(
      metaDir,
      'epics',
      'auth-epic',
      'stories',
      'login-form.md',
    );
    const storyContent = await readFile(storyPath, 'utf-8');
    expect(storyContent).toContain('issue_key: TEST-11');
    expect(storyContent).toContain('sprint_id: 1');

    const msPath = join(metaDir, 'roadmap', 'milestones', 'sprint-1.md');
    await expect(stat(msPath)).resolves.toBeDefined();

    const configPath = join(metaDir, 'sync', 'jira-config.yaml');
    const config = await readFile(configPath, 'utf-8');
    expect(config).toContain(`site: ${SITE}`);
    expect(config).toContain(`project_key: ${PROJECT_KEY}`);
    expect(config).toContain('board_id: 100');

    const statePath = join(metaDir, 'sync', 'jira-state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(state.site).toBe(SITE);
    expect(state.project_key).toBe(PROJECT_KEY);
    expect(state.board_id).toBe(100);
  });

  it('works without a board (getBoard returns null)', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/board?projectKeyOrId=')) {
        return notFoundResponse();
      }
      if (url.includes('/search?jql=')) {
        return jsonResponse({ issues: [], total: 0 });
      }
      return notFoundResponse();
    });

    const result = await importFromJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.milestones).toBe(0);
    expect(result.value.epics).toBe(0);
    expect(result.value.stories).toBe(0);
  });

  it('uses explicit boardId option without calling getBoard', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/board?projectKeyOrId=')) {
        throw new Error('getBoard should not be called when boardId provided');
      }
      if (url.includes('/board/42/sprint')) {
        return jsonResponse({ values: [], total: 0 });
      }
      if (url.includes('/search?jql=')) {
        return jsonResponse({ issues: [], total: 0 });
      }
      return notFoundResponse();
    });

    const result = await importFromJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
      boardId: 42,
    });
    expect(result.ok).toBe(true);
  });

  it('returns error when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await importFromJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Network error');
    }
  });

  it('wraps non-Error throwables with a descriptive message', async () => {
    mockFetch.mockImplementation(async () => {
      // Throw a non-Error value — import.ts catches and wraps these.
      throw 'string-level failure';
    });

    const result = await importFromJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Jira import failed');
    }
  });

  it('creates orphan story when issue has no parent', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/board?projectKeyOrId=')) {
        return notFoundResponse();
      }
      if (url.includes('/search?jql=')) {
        return jsonResponse({
          issues: [
            buildIssue({
              id: '12',
              key: 'TEST-12',
              summary: 'Orphan Story',
              issueType: 'Story',
            }),
          ],
          total: 1,
        });
      }
      return notFoundResponse();
    });

    const result = await importFromJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stories).toBe(1);

    const orphanPath = join(metaDir, 'stories', 'orphan-story.md');
    await expect(stat(orphanPath)).resolves.toBeDefined();
  });

  it('accepts a custom statusMapping option', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/board?projectKeyOrId=')) {
        return notFoundResponse();
      }
      if (url.includes('/search?jql=')) {
        return jsonResponse({
          issues: [
            buildIssue({
              id: '13',
              key: 'TEST-13',
              summary: 'QA Story',
              statusName: 'In QA',
              issueType: 'Story',
            }),
          ],
          total: 1,
        });
      }
      return notFoundResponse();
    });

    const result = await importFromJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
      statusMapping: { 'In QA': 'in_review' },
    });
    expect(result.ok).toBe(true);

    const storyPath = join(metaDir, 'stories', 'qa-story.md');
    const body = await readFile(storyPath, 'utf-8');
    expect(body).toContain('status: in_review');
  });
});
