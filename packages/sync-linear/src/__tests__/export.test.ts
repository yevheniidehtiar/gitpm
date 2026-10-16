import { access, mkdtemp, readFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportToLinear } from '../export.js';
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

describe('exportToLinear', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-linear-export-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns error when tree cannot be parsed (non-existent metaDir)', async () => {
    const result = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });
    expect(result.ok).toBe(false);
  });

  it('returns no-op success when tree is in sync with Linear', async () => {
    await seedTree(metaDir, [baseIssue()]);

    mockFetch.mockResolvedValue(statesResponse());

    const result = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalChanges).toBe(0);
    }
  });

  it('creates a new Linear issue for a locally-created story', async () => {
    await seedTree(metaDir, []);

    // Manually add a new story not yet known to Linear by writing it via
    // the same writer helpers the adapter uses internally.
    const { createStory } = await import('@gitpm/core');
    const created = await createStory(metaDir, { title: 'Brand New Story' });
    if (!created.ok) throw created.error;

    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('IssueCreate')) {
        return graphqlResponse({
          issueCreate: {
            success: true,
            issue: baseIssue({
              id: 'issue-100',
              identifier: 'ENG-100',
              title: 'Brand New Story',
            }),
          },
        });
      }
      return graphqlResponse({});
    });

    const result = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created.issues).toBe(1);
    expect(result.value.exportedPaths.length).toBe(1);

    const stateContent = JSON.parse(
      await readFile(join(metaDir, 'sync', 'linear-state.json'), 'utf-8'),
    );
    const entry = Object.values(stateContent.entities).find(
      (e: unknown): e is { linear_issue_id: string } =>
        (e as { linear_issue_id?: string }).linear_issue_id === 'issue-100',
    );
    expect(entry).toBeDefined();
  });

  it('leaves nothing to sync right after a push', async () => {
    await seedTree(metaDir, []);
    const { createStory } = await import('@gitpm/core');
    const created = await createStory(metaDir, {
      title: 'Pushed Story',
      labels: ['api'],
    });
    if (!created.ok) throw created.error;

    const remote = baseIssue({
      id: 'issue-200',
      identifier: 'ENG-200',
      title: 'Pushed Story',
      description: '',
      state: { id: 'state-backlog', name: 'Backlog', type: 'backlog' },
      labels: { nodes: [{ name: 'api' }] },
    });
    const mutations: string[] = [];
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('mutation')) mutations.push(body.query);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('IssueLabels')) {
        return graphqlResponse({
          issueLabels: {
            nodes: [{ id: 'label-api', name: 'api' }],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        });
      }
      if (body.query.includes('IssueCreate')) {
        return graphqlResponse({
          issueCreate: { success: true, issue: remote },
        });
      }
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({ issue: remote });
      }
      return graphqlResponse({});
    });

    const pushed = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });
    expect(pushed.ok).toBe(true);
    expect(mutations).toHaveLength(1);

    const synced = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });
    expect(synced.ok).toBe(true);
    if (!synced.ok) return;
    expect(synced.value.pushed.issues).toBe(0);
    expect(synced.value.pulled.issues).toBe(0);
    expect(synced.value.conflicts).toHaveLength(0);
    expect(mutations).toHaveLength(1);
  });

  it('does not call the create/update mutations in dry-run mode', async () => {
    await seedTree(metaDir, []);
    const { createStory } = await import('@gitpm/core');
    const created = await createStory(metaDir, { title: 'Dry Run Story' });
    if (!created.ok) throw created.error;

    let mutationCalled = false;
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('mutation')) {
        mutationCalled = true;
      }
      return graphqlResponse({});
    });

    const result = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
      dryRun: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.created.issues).toBe(1);
      expect(result.value.exportedPaths).toHaveLength(0);
    }
    expect(mutationCalled).toBe(false);
  });

  it('updates an existing Linear issue when local content changed', async () => {
    await seedTree(metaDir, [baseIssue()]);

    const { parseTree, writeFile } = await import('@gitpm/core');
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) throw treeResult.error;
    const story = treeResult.value.stories[0];
    story.title = 'Updated Title';
    // `story.filePath` from parseTree is already an absolute path.
    await writeFile(story, story.filePath);

    let updateCalledWith: unknown;
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('IssueUpdate')) {
        updateCalledWith = body.variables;
        return graphqlResponse({
          issueUpdate: { success: true, issue: baseIssue() },
        });
      }
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({ issue: baseIssue() });
      }
      return graphqlResponse({});
    });

    const result = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.updated.issues).toBe(1);
    }
    expect(updateCalledWith).toMatchObject({
      id: 'issue-1',
      input: { title: 'Updated Title' },
    });
  });

  it('resolves label names to Linear label IDs and pushes them on create', async () => {
    await seedTree(metaDir, []);
    const { createStory } = await import('@gitpm/core');
    const created = await createStory(metaDir, {
      title: 'Labelled Story',
      labels: ['api', 'urgent'],
    });
    if (!created.ok) throw created.error;

    let createInput: Record<string, unknown> | undefined;
    let createdLabelName: string | undefined;
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('IssueLabels')) {
        return graphqlResponse({
          issueLabels: {
            nodes: [{ id: 'label-api', name: 'api' }],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        });
      }
      if (body.query.includes('IssueLabelCreate')) {
        createdLabelName = body.variables.input.name;
        return graphqlResponse({
          issueLabelCreate: {
            success: true,
            issueLabel: { id: 'label-urgent', name: 'urgent' },
          },
        });
      }
      if (body.query.includes('IssueCreate')) {
        createInput = body.variables.input;
        return graphqlResponse({
          issueCreate: {
            success: true,
            issue: baseIssue({
              id: 'issue-300',
              identifier: 'ENG-300',
              title: 'Labelled Story',
              labels: {
                nodes: [{ name: 'api' }, { name: 'urgent' }],
              },
            }),
          },
        });
      }
      return graphqlResponse({});
    });

    const result = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    // The 'urgent' label didn't exist on the team yet, so it must be
    // created before being referenced by ID.
    expect(createdLabelName).toBe('urgent');
    expect(createInput?.labelIds).toEqual(['label-api', 'label-urgent']);
  });

  it('writes sync metadata back to the real entity file, not a doubled nested path', async () => {
    await seedTree(metaDir, []);
    const { createStory } = await import('@gitpm/core');
    const created = await createStory(metaDir, {
      title: 'Path Regression Story',
    });
    if (!created.ok) throw created.error;

    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('IssueCreate')) {
        return graphqlResponse({
          issueCreate: {
            success: true,
            issue: baseIssue({
              id: 'issue-400',
              identifier: 'ENG-400',
              title: 'Path Regression Story',
            }),
          },
        });
      }
      return graphqlResponse({});
    });

    const result = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });
    expect(result.ok).toBe(true);

    // The real story file (an absolute path under metaDir, as returned by
    // `parseTree`/`createStory`) must contain the linear sync metadata.
    const content = await readFile(created.value.filePath, 'utf-8');
    expect(content).toContain('issue_id: issue-400');

    // A buggy `join(metaDir, '..', absoluteFilePath)` would have written the
    // file into a garbage doubled path nested under the repo root instead.
    const doubledPath = join(metaDir, '..', created.value.filePath);
    await expect(access(doubledPath)).rejects.toThrow();
  });

  it('keeps Linear "No priority" when pushing an unrelated edit', async () => {
    await seedTree(metaDir, [baseIssue({ priority: 0 })]);

    const { parseTree, writeFile } = await import('@gitpm/core');
    const tree = await parseTree(metaDir);
    if (!tree.ok) throw tree.error;
    const story = tree.value.stories[0];
    story.title = 'Renamed';
    await writeFile(story, story.filePath);

    let updateInput: Record<string, unknown> | undefined;
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('IssueUpdate')) {
        updateInput = body.variables.input;
        return graphqlResponse({
          issueUpdate: {
            success: true,
            issue: baseIssue({ priority: 0, title: 'Renamed' }),
          },
        });
      }
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({ issue: baseIssue({ priority: 0 }) });
      }
      return graphqlResponse({});
    });

    const result = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    expect(updateInput?.title).toBe('Renamed');
    expect(updateInput).not.toHaveProperty('priority');
  });

  it('tolerates an already-deleted issue when closing a locally deleted entity', async () => {
    await seedTree(metaDir, [baseIssue()]);
    const { parseTree } = await import('@gitpm/core');
    const tree = await parseTree(metaDir);
    if (!tree.ok) throw tree.error;
    await unlink(tree.value.stories[0].filePath);

    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('IssueUpdate')) {
        return new Response(
          JSON.stringify({ errors: [{ message: 'Entity not found: Issue' }] }),
          { status: 400 },
        );
      }
      return graphqlResponse({});
    });

    const result = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    const state = JSON.parse(
      await readFile(join(metaDir, 'sync', 'linear-state.json'), 'utf-8'),
    );
    expect(Object.keys(state.entities)).toHaveLength(0);
  });

  it('does not recreate an issue that sync tombstoned after a remote deletion', async () => {
    await seedTree(metaDir, [baseIssue()]);

    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({ issue: null });
      }
      return graphqlResponse({});
    });
    const synced = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });
    expect(synced.ok).toBe(true);

    // Edit the cancelled entity and drop its file-level link, so neither the
    // hash nor `linear.issue_id` keeps export away from it.
    const { parseTree, writeFile } = await import('@gitpm/core');
    const tree = await parseTree(metaDir);
    if (!tree.ok) throw tree.error;
    const story = tree.value.stories[0];
    expect(story.status).toBe('cancelled');
    story.body = 'Edited after the remote deletion';
    story.linear = undefined;
    await writeFile(story, story.filePath);

    const calls: string[] = [];
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      calls.push(body.query);
      return graphqlResponse({});
    });
    const pushed = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(pushed.ok).toBe(true);
    if (pushed.ok) expect(pushed.value.totalChanges).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('does not parent new stories to an epic that sync tombstoned', async () => {
    await seedTree(metaDir, [
      baseIssue({
        id: 'epic-issue',
        identifier: 'ENG-10',
        title: 'Deleted Epic',
        children: { nodes: [{ id: 'issue-1' }] },
      }),
      baseIssue({ parent: { id: 'epic-issue' } }),
    ]);

    // The epic is deleted on Linear; its child story still exists.
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({
          issue:
            body.variables.id === 'epic-issue'
              ? null
              : baseIssue({ parent: { id: 'epic-issue' } }),
        });
      }
      return graphqlResponse({});
    });
    const synced = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });
    expect(synced.ok).toBe(true);

    // Add a brand-new story under the (now cancelled) epic.
    const { parseTree, writeFile } = await import('@gitpm/core');
    const tree = await parseTree(metaDir);
    if (!tree.ok) throw tree.error;
    const epic = tree.value.epics[0];
    expect(epic.status).toBe('cancelled');
    const existing = tree.value.stories[0];
    const fresh = {
      ...existing,
      id: 'new-story',
      title: 'New Story',
      epic_ref: { id: epic.id },
      linear: undefined,
      filePath: existing.filePath.replace(/[^/]+\.md$/, 'new-story.md'),
    };
    await writeFile(fresh, fresh.filePath);

    const creates: Array<Record<string, unknown>> = [];
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('issueCreate')) {
        creates.push(body.variables.input);
        return graphqlResponse({
          issueCreate: {
            success: true,
            issue: baseIssue({ id: 'issue-new', title: 'New Story' }),
          },
        });
      }
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({
          issue: baseIssue({ parent: { id: 'epic-issue' } }),
        });
      }
      return graphqlResponse({
        issueLabels: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
        users: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
      });
    });
    const pushed = await exportToLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(pushed.ok).toBe(true);
    expect(creates).toHaveLength(1);
    expect(creates[0].parentId).toBeUndefined();
  });
});
