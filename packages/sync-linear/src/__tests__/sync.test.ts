import { mkdtemp, rm } from 'node:fs/promises';
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
      return graphqlResponse({ team: { cycles: { nodes: [] } } });
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

  it('reaches in_sync state after a settling second sync', async () => {
    await seedTree(metaDir, [baseIssue()]);

    // getIssue returns an unchanged remote for both runs.
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('WorkflowStates')) return statesResponse();
      if (body.query.includes('query Issue(')) {
        return graphqlResponse({ issue: baseIssue() });
      }
      return graphqlResponse({});
    });

    // First sync settles the remote_hash in state (the imported hash is
    // computed from local fields so it diverges from the remote-field-based
    // hash until a real sync pass recomputes it consistently).
    const first = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
      strategy: 'remote-wins',
    });
    expect(first.ok).toBe(true);

    const second = await syncWithLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
      strategy: 'local-wins',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.conflicts).toHaveLength(0);
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
