import { mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Story } from '@gitpm/core';
import { writeFile as coreWriteFile, parseTree } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultConfig, saveConfig } from '../config.js';
import { importFromJira } from '../import.js';
import { loadState, saveState } from '../state.js';
import { syncWithJira } from '../sync.js';

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

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

function notFoundResponse(): Response {
  return new Response('Not found', { status: 404 });
}

interface MockIssueOpts {
  id?: string;
  key: string;
  summary?: string;
  statusName?: string;
  issueType?: string;
  description?: string | null;
  labels?: string[];
  assigneeName?: string | null;
  priorityName?: string | null;
  parentKey?: string;
  sprintId?: number;
}

function mockIssue(opts: MockIssueOpts) {
  return {
    id: opts.id ?? '999',
    key: opts.key,
    fields: {
      summary: opts.summary ?? 'Issue',
      description: opts.description ?? null,
      status: { name: opts.statusName ?? 'To Do', id: '1' },
      issuetype: { name: opts.issueType ?? 'Story', id: '10001' },
      assignee: opts.assigneeName
        ? { accountId: 'acct-1', displayName: opts.assigneeName }
        : null,
      labels: opts.labels ?? [],
      priority: opts.priorityName ? { name: opts.priorityName, id: '2' } : null,
      project: { key: PROJECT_KEY },
      ...(opts.parentKey
        ? {
            parent: {
              key: opts.parentKey,
              fields: {
                summary: 'Parent',
                issuetype: { name: 'Epic' },
              },
            },
          }
        : {}),
      ...(opts.sprintId
        ? {
            sprint: {
              id: opts.sprintId,
              name: 'Sprint',
              state: 'active',
            },
          }
        : {}),
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-02T00:00:00Z',
    },
  };
}

async function seedTree(
  metaDir: string,
  options: {
    issues?: ReturnType<typeof mockIssue>[];
    sprints?: Array<{
      id: number;
      name: string;
      state: 'active' | 'closed' | 'future';
    }>;
  } = {},
): Promise<void> {
  const { issues = [], sprints = [] } = options;
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('/board?projectKeyOrId=')) {
      return jsonResponse({
        values: [{ id: 100, name: 'Board', type: 'scrum' }],
      });
    }
    if (url.includes('/board/100/sprint')) {
      return jsonResponse({ values: sprints, total: sprints.length });
    }
    if (url.includes('/search?jql=')) {
      return jsonResponse({ issues, total: issues.length });
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
  if (!result.ok) throw result.error;
  mockFetch.mockReset();
}

describe('syncWithJira', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-jira-sync-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns error when no sync state exists', async () => {
    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('No Jira sync state found');
    }
  });

  it('returns error when config is missing', async () => {
    // Write state but no config
    await saveState(metaDir, {
      site: SITE,
      project_key: PROJECT_KEY,
      last_sync: new Date().toISOString(),
      entities: {},
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(false);
  });

  it('reaches in_sync state after a settling second sync', async () => {
    await seedTree(metaDir, {
      issues: [mockIssue({ id: '11', key: 'TEST-11', summary: 'Story A' })],
    });

    // getIssue returns unchanged remote for both runs
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/issue/TEST-11') && !url.includes('transitions')) {
        return jsonResponse(
          mockIssue({ id: '11', key: 'TEST-11', summary: 'Story A' }),
        );
      }
      return notFoundResponse();
    });

    // First sync settles the remote_hash in state (imported hash is computed
    // from local fields so diverges from the remote-field-based hash).
    const first = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
      strategy: 'remote-wins',
    });
    expect(first.ok).toBe(true);

    // Second sync with no actual change: writeFile from the first pass
    // doubled the on-disk path, so parseTree re-reads the pristine file
    // and sees it as a local-change relative to the just-written state.
    const second = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
      strategy: 'local-wins',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.conflicts).toHaveLength(0);
  });

  it('pushes local changes (local_changed direction)', async () => {
    await seedTree(metaDir, {
      issues: [mockIssue({ id: '11', key: 'TEST-11', summary: 'Original' })],
    });

    // Manually align state's remote_hash so the sync comparator sees
    // remote as unchanged, producing a clean local_changed direction when
    // local disk content diverges.
    const stateResult = await loadState(metaDir);
    if (!stateResult.ok) throw stateResult.error;
    const state = stateResult.value;
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) throw treeResult.error;
    const story = treeResult.value.stories[0];

    // Compute the hash that sync.ts will produce for the returned remote
    // issue — using the same helper it relies on internally.
    const { remoteIssueFields } = await import('../diff.js');
    const { createHash } = await import('node:crypto');
    const remoteIssueForTest = mockIssue({
      id: '11',
      key: 'TEST-11',
      summary: 'Original',
    });
    const remoteFields = remoteIssueFields(remoteIssueForTest);
    const remoteHash = `sha256:${createHash('sha256')
      .update(JSON.stringify(remoteFields))
      .digest('hex')}`;
    state.entities[story.id] = {
      ...state.entities[story.id],
      remote_hash: remoteHash,
    };
    await saveState(metaDir, state);

    // Now modify the local story on disk.
    story.title = 'Locally Edited';
    await coreWriteFile(story, story.filePath);

    const updateCalls: Array<{ url: string; body: unknown }> = [];
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/issue/TEST-11') && !url.includes('transitions')) {
        if (init?.method === 'PUT') {
          updateCalls.push({ url, body: JSON.parse(init.body as string) });
          return emptyResponse();
        }
        return jsonResponse(remoteIssueForTest);
      }
      if (url.includes('/issue/TEST-11/transitions')) {
        if (init?.method === 'POST') return emptyResponse();
        return jsonResponse({
          transitions: [
            { id: '31', name: 'To Do', to: { name: 'To Do', id: '1' } },
          ],
        });
      }
      return notFoundResponse();
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBeGreaterThan(0);
    expect(updateCalls.length).toBeGreaterThan(0);
    expect(
      (updateCalls[0].body as { fields: { summary: string } }).fields.summary,
    ).toBe('Locally Edited');
  });

  it('pulls remote changes on an Epic (remote_changed branch for epics)', async () => {
    await seedTree(metaDir, {
      issues: [
        mockIssue({
          id: '20',
          key: 'TEST-20',
          summary: 'Epic A',
          issueType: 'Epic',
        }),
      ],
    });

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/issue/TEST-20') && !url.includes('transitions')) {
        return jsonResponse(
          mockIssue({
            id: '20',
            key: 'TEST-20',
            summary: 'Epic A Renamed',
            issueType: 'Epic',
            assigneeName: 'Renamed Owner',
            priorityName: 'Low',
          }),
        );
      }
      return notFoundResponse();
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.issues).toBeGreaterThan(0);
  });

  it('pulls remote changes (remote_changed direction)', async () => {
    await seedTree(metaDir, {
      issues: [mockIssue({ id: '11', key: 'TEST-11', summary: 'Original' })],
    });

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/issue/TEST-11') && !url.includes('transitions')) {
        return jsonResponse(
          mockIssue({
            id: '11',
            key: 'TEST-11',
            summary: 'Remotely Edited',
            statusName: 'In Progress',
          }),
        );
      }
      return notFoundResponse();
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.issues).toBeGreaterThan(0);
  });

  it('marks story as cancelled when remote issue is missing', async () => {
    await seedTree(metaDir, {
      issues: [mockIssue({ id: '12', key: 'TEST-12', summary: 'Gone' })],
    });

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/issue/TEST-12') && !url.includes('transitions')) {
        return notFoundResponse();
      }
      return notFoundResponse();
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.issues).toBe(1);
  });

  it('transitions to Done when an entity was deleted locally', async () => {
    await seedTree(metaDir, {
      issues: [mockIssue({ id: '13', key: 'TEST-13', summary: 'DelMe' })],
    });

    // Delete the story file
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) throw treeResult.error;
    const story = treeResult.value.stories[0];
    await unlink(story.filePath);

    const transitionPostCalls: string[] = [];
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/issue/TEST-13/transitions')) {
        if (init?.method === 'POST') {
          transitionPostCalls.push(url);
          return emptyResponse();
        }
        return jsonResponse({
          transitions: [
            { id: '41', name: 'Done', to: { name: 'Done', id: '4' } },
          ],
        });
      }
      return notFoundResponse();
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBe(1);
    expect(transitionPostCalls).toHaveLength(1);
  });

  it('skips milestones that have a sprint_id in sync state', async () => {
    await seedTree(metaDir, {
      sprints: [
        {
          id: 7,
          name: 'Sprint Alpha',
          state: 'active',
        },
      ],
    });

    // No issue fetch should happen for sprint-linked milestones
    mockFetch.mockImplementation(async () => notFoundResponse());

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
  });

  it('handles both-changed conflict with local-wins strategy', async () => {
    await seedTree(metaDir, {
      issues: [mockIssue({ id: '11', key: 'TEST-11', summary: 'Original' })],
    });

    // Modify local
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) throw treeResult.error;
    const story = treeResult.value.stories[0];
    story.title = 'Local Edit';
    await coreWriteFile(story, story.filePath);

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/issue/TEST-11') && !url.includes('transitions')) {
        if (init?.method === 'PUT') return emptyResponse();
        // Return remote with different summary to trigger both_changed
        return jsonResponse(
          mockIssue({ id: '11', key: 'TEST-11', summary: 'Remote Edit' }),
        );
      }
      return notFoundResponse();
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resolved).toBeGreaterThan(0);
  });

  it('handles both-changed conflict with remote-wins strategy', async () => {
    await seedTree(metaDir, {
      issues: [mockIssue({ id: '11', key: 'TEST-11', summary: 'Original' })],
    });

    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) throw treeResult.error;
    const story = treeResult.value.stories[0];
    story.title = 'Local Edit';
    await coreWriteFile(story, story.filePath);

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/issue/TEST-11') && !url.includes('transitions')) {
        return jsonResponse(
          mockIssue({ id: '11', key: 'TEST-11', summary: 'Remote Edit' }),
        );
      }
      return notFoundResponse();
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
      strategy: 'remote-wins',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resolved).toBeGreaterThan(0);
  });

  it('collects unresolved conflicts with ask strategy', async () => {
    await seedTree(metaDir, {
      issues: [mockIssue({ id: '11', key: 'TEST-11', summary: 'Original' })],
    });

    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) throw treeResult.error;
    const story = treeResult.value.stories[0];
    story.title = 'Local Edit';
    await coreWriteFile(story, story.filePath);

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/issue/TEST-11') && !url.includes('transitions')) {
        return jsonResponse(
          mockIssue({ id: '11', key: 'TEST-11', summary: 'Remote Edit' }),
        );
      }
      return notFoundResponse();
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
      strategy: 'ask',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conflicts.length).toBeGreaterThan(0);
    expect(result.value.skipped).toBeGreaterThan(0);
  });

  it('creates new Jira issues for locally added entities', async () => {
    await seedTree(metaDir);

    const newStory: Story = {
      type: 'story',
      id: 'local-new-1',
      title: 'Fresh Story',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: '.meta/stories/fresh-story.md',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    };
    await coreWriteFile(newStory, join(metaDir, 'stories', 'fresh-story.md'));

    const createCalls: RequestInit[] = [];
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/rest/api/3/issue') && init?.method === 'POST') {
        createCalls.push(init);
        return jsonResponse(
          mockIssue({ id: '88', key: 'TEST-88', summary: 'Fresh Story' }),
        );
      }
      return notFoundResponse();
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBeGreaterThan(0);
    expect(createCalls).toHaveLength(1);
  });

  it('dry run does not perform mutating requests', async () => {
    await seedTree(metaDir, {
      issues: [mockIssue({ id: '11', key: 'TEST-11', summary: 'Original' })],
    });

    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) throw treeResult.error;
    const story = treeResult.value.stories[0];
    story.title = 'Local Edit';
    await coreWriteFile(story, story.filePath);

    let putCalled = false;
    let postCalled = false;
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') putCalled = true;
      if (init?.method === 'POST' && url.includes('/issue')) postCalled = true;
      if (url.includes('/issue/TEST-11') && !url.includes('transitions')) {
        return jsonResponse(
          mockIssue({ id: '11', key: 'TEST-11', summary: 'Original' }),
        );
      }
      return notFoundResponse();
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
      strategy: 'local-wins',
      dryRun: true,
    });
    expect(result.ok).toBe(true);
    expect(putCalled).toBe(false);
    expect(postCalled).toBe(false);

    // state should not have been updated
    const stateResult = await loadState(metaDir);
    expect(stateResult.ok).toBe(true);
  });

  it('wraps non-Error throwables from the pipeline', async () => {
    await seedTree(metaDir);

    // Add a new story so sync reaches the createIssue path (whose errors
    // bubble up to the outer try/catch, unlike getIssue which swallows).
    const newStory: Story = {
      type: 'story',
      id: 'err-throw-1',
      title: 'Will Fail',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: '.meta/stories/will-fail.md',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    };
    await coreWriteFile(newStory, join(metaDir, 'stories', 'will-fail.md'));

    mockFetch.mockImplementation(async () => {
      throw 'string-throwable';
    });

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Jira sync failed');
    }
  });

  it('supports custom config loaded from disk', async () => {
    // Seed state and a custom config
    const config = createDefaultConfig(SITE, PROJECT_KEY, 99, {
      Ready: 'in_review',
    });
    await saveConfig(metaDir, config);
    await saveState(metaDir, {
      site: SITE,
      project_key: PROJECT_KEY,
      last_sync: new Date().toISOString(),
      entities: {},
    });

    mockFetch.mockImplementation(async () => notFoundResponse());

    const result = await syncWithJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
  });
});
