import {
  writeFile as fsWriteFile,
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importFromLinear } from '../import.js';
import { syncWithLinear } from '../sync.js';

const API_KEY = 'lin_api_test_key';
const TEAM_ID = 'team-1';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function graphqlResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function statesResponse() {
  return graphqlResponse({
    team: {
      states: {
        nodes: [
          { id: 'state-unstarted', name: 'Todo', type: 'unstarted' },
          { id: 'state-started', name: 'In Progress', type: 'started' },
          { id: 'state-completed', name: 'Done', type: 'completed' },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  });
}

function baseIssue(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'issue-1',
    identifier: 'ENG-1',
    title: 'Existing Story',
    description: 'Body',
    priority: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    state: { id: 'state-unstarted', name: 'Todo', type: 'unstarted' },
    assignee: null,
    labels: { nodes: [] },
    parent: null,
    children: { nodes: [] },
    cycle: null,
    project: null,
    ...overrides,
  };
}

async function seedTree(
  metaDir: string,
  issues: ReturnType<typeof baseIssue>[] = [],
): Promise<void> {
  mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    if (body.query.includes('query Cycles')) {
      return graphqlResponse({
        team: {
          cycles: {
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });
    }
    if (body.query.includes('query Issues')) {
      return graphqlResponse({
        team: {
          issues: {
            nodes: issues,
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });
    }
    return graphqlResponse({});
  });

  const result = await importFromLinear({
    apiKey: API_KEY,
    teamId: TEAM_ID,
    metaDir,
  });
  if (!result.ok) throw result.error;
  mockFetch.mockReset();
}

describe('syncWithLinear', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-linear-sync-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns an error when no sync state exists', async () => {
    const result = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('No Linear sync state found');
    }
  });

  it('reports zero changes when syncing right after an import', async () => {
    const remote = baseIssue({
      labels: { nodes: [{ name: 'b' }, { name: 'a' }] },
      assignee: { id: 'u1', name: 'Alice' },
      priority: 2,
    });
    await seedTree(metaDir, [remote]);

    const mutations: string[] = [];
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('mutation')) mutations.push(body.query);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({ issue: remote });
      }
      return graphqlResponse({});
    });

    const result = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBe(0);
    expect(result.value.pulled.issues).toBe(0);
    expect(result.value.conflicts).toHaveLength(0);
    expect(result.value.resolved).toBe(0);
    expect(mutations).toHaveLength(0);
  });

  it('pushes a local-only edit without a conflict, then settles', async () => {
    await seedTree(metaDir, [baseIssue()]);

    const { parseTree, writeFile } = await import('@gitpm/core');
    const tree = await parseTree(metaDir);
    if (!tree.ok) throw tree.error;
    const story = tree.value.stories[0];
    story.title = 'Local Edit';
    await writeFile(story, story.filePath);

    let remote = baseIssue();
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('IssueUpdate')) {
        remote = baseIssue({ title: body.variables.input.title });
        return graphqlResponse({
          issueUpdate: { success: true, issue: remote },
        });
      }
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({ issue: remote });
      }
      return graphqlResponse({});
    });

    const first = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.pushed.issues).toBe(1);
    expect(first.value.conflicts).toHaveLength(0);

    const second = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.pushed.issues).toBe(0);
    expect(second.value.pulled.issues).toBe(0);
    expect(second.value.conflicts).toHaveLength(0);
  });

  it('pushes cleared labels, body and assignee as explicit clears', async () => {
    const remote = baseIssue({
      labels: { nodes: [{ name: 'api' }] },
      assignee: { id: 'u1', name: 'Alice' },
    });
    await seedTree(metaDir, [remote]);

    const { parseTree, writeFile } = await import('@gitpm/core');
    const tree = await parseTree(metaDir);
    if (!tree.ok) throw tree.error;
    const story = tree.value.stories[0];
    story.labels = [];
    story.body = '';
    story.assignee = null;
    await writeFile(story, story.filePath);

    let updateInput: Record<string, unknown> | undefined;
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('IssueUpdate')) {
        updateInput = body.variables.input;
        return graphqlResponse({
          issueUpdate: { success: true, issue: baseIssue({ description: '' }) },
        });
      }
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({ issue: remote });
      }
      return graphqlResponse({});
    });

    const result = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });
    expect(result.ok).toBe(true);
    expect(updateInput).toMatchObject({
      description: '',
      labelIds: [],
      assigneeId: null,
    });
  });

  it('aborts without cancelling entities when getIssue hits a network error', async () => {
    await seedTree(metaDir, [baseIssue()]);
    const { parseTree } = await import('@gitpm/core');
    const before = await parseTree(metaDir);
    if (!before.ok) throw before.error;
    const storyPath = before.value.stories[0].filePath;
    const statePath = join(metaDir, 'sync', 'linear-state.json');
    const originalStory = await readFile(storyPath, 'utf-8');
    const originalState = await readFile(statePath, 'utf-8');

    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('query Issue(')) {
        throw new TypeError('fetch failed');
      }
      return graphqlResponse({});
    });

    const result = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(false);
    expect(await readFile(storyPath, 'utf-8')).toBe(originalStory);
    expect(await readFile(statePath, 'utf-8')).toBe(originalState);
    const after = await parseTree(metaDir);
    if (!after.ok) throw after.error;
    expect(after.value.stories[0].status).not.toBe('cancelled');
  });

  it('aborts without cancelling entities on an auth failure', async () => {
    await seedTree(metaDir, [baseIssue()]);

    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      return new Response('Unauthorized', { status: 401 });
    });

    const result = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(false);
    const { parseTree } = await import('@gitpm/core');
    const after = await parseTree(metaDir);
    if (!after.ok) throw after.error;
    expect(after.value.stories[0].status).not.toBe('cancelled');
  });

  it('reconciles an entity with linear.issue_id but no state entry instead of duplicating it', async () => {
    await seedTree(metaDir, [baseIssue()]);
    const statePath = join(metaDir, 'sync', 'linear-state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    state.entities = {};
    await fsWriteFile(statePath, JSON.stringify(state), 'utf-8');

    let createCalled = false;
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('IssueCreate')) createCalled = true;
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({ issue: baseIssue() });
      }
      return graphqlResponse({});
    });

    const result = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    expect(createCalled).toBe(false);
    const saved = JSON.parse(await readFile(statePath, 'utf-8'));
    const entries = Object.values(saved.entities) as Array<{
      linear_issue_id: string;
    }>;
    expect(entries).toHaveLength(1);
    expect(entries[0].linear_issue_id).toBe('issue-1');
  });

  it('parents stories created by sync under their synced epic', async () => {
    const epicIssue = baseIssue({
      id: 'epic-issue',
      identifier: 'ENG-9',
      title: 'Epic',
      children: { nodes: [{ id: 'child' }] },
    });
    await seedTree(metaDir, [epicIssue]);
    const { createStory, parseTree } = await import('@gitpm/core');
    const tree = await parseTree(metaDir);
    if (!tree.ok) throw tree.error;
    const epic = tree.value.epics[0];
    const created = await createStory(metaDir, {
      title: 'New Child',
      epicId: epic.id,
    });
    if (!created.ok) throw created.error;

    let createInput: Record<string, unknown> | undefined;
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('IssueCreate')) {
        createInput = body.variables.input;
        return graphqlResponse({
          issueCreate: {
            success: true,
            issue: baseIssue({ id: 'new-issue', identifier: 'ENG-10' }),
          },
        });
      }
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({ issue: epicIssue });
      }
      return graphqlResponse({});
    });

    const result = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    expect(createInput?.parentId).toBe('epic-issue');
  });

  it('pulls remote changes into the local file', async () => {
    await seedTree(metaDir, [baseIssue()]);

    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({
          issue: baseIssue({ title: 'Renamed On Linear' }),
        });
      }
      return graphqlResponse({});
    });

    const result = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pulled.issues).toBe(1);
      expect(result.value.pulledPaths.length).toBe(1);
    }
  });

  it('handles remote deletion by cancelling the local entity', async () => {
    await seedTree(metaDir, [baseIssue()]);

    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({ issue: null });
      }
      return graphqlResponse({});
    });

    const result = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pulled.issues).toBe(1);
    }
  });

  it('records a conflict when both sides changed and strategy is ask', async () => {
    await seedTree(metaDir, [baseIssue()]);

    const { parseTree, writeFile } = await import('@gitpm/core');
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) throw treeResult.error;
    const story = treeResult.value.stories[0];
    story.title = 'Local Edit';
    // `story.filePath` from parseTree is already an absolute path.
    await writeFile(story, story.filePath);

    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({
          issue: baseIssue({ title: 'Remote Edit' }),
        });
      }
      return graphqlResponse({});
    });

    const result = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
      strategy: 'ask',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.conflicts.length).toBeGreaterThan(0);
      expect(result.value.skipped).toBeGreaterThan(0);
    }
  });
});
