import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importFromLinear } from '../import.js';

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

function graphqlResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface IssueFixture {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  stateType?: string;
  stateName?: string;
  assigneeName?: string | null;
  labels?: string[];
  priority?: number;
  parentId?: string;
  childIds?: string[];
  cycleId?: number;
}

function buildIssue(f: IssueFixture) {
  return {
    id: f.id,
    identifier: f.identifier,
    title: f.title,
    description: f.description ?? null,
    priority: f.priority ?? 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    state: {
      id: 'state-1',
      name: f.stateName ?? 'Todo',
      type: f.stateType ?? 'unstarted',
    },
    assignee: f.assigneeName ? { id: 'user-1', name: f.assigneeName } : null,
    labels: { nodes: (f.labels ?? []).map((name) => ({ name })) },
    parent: f.parentId
      ? { id: f.parentId, identifier: 'ENG-parent', title: 'Parent' }
      : null,
    children: { nodes: (f.childIds ?? []).map((id) => ({ id })) },
    cycle: f.cycleId ? { id: `cycle-${f.cycleId}`, number: f.cycleId } : null,
    project: null,
  };
}

function issuesResponse(issues: unknown[]) {
  return graphqlResponse({
    team: {
      issues: {
        nodes: issues,
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  });
}

function cyclesResponse(cycles: unknown[]) {
  return graphqlResponse({
    team: {
      cycles: {
        nodes: cycles,
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  });
}

describe('importFromLinear', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-linear-import-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('imports cycles, epics, and stories from Linear', async () => {
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('query Cycles')) {
        return cyclesResponse([
          {
            id: 'cycle-1',
            number: 1,
            name: 'Cycle 1',
            startsAt: '2026-01-01T00:00:00Z',
            endsAt: '2026-01-14T00:00:00Z',
          },
        ]);
      }
      if (body.query.includes('query Issues')) {
        return issuesResponse([
          buildIssue({
            id: 'issue-1',
            identifier: 'ENG-1',
            title: 'User Authentication',
            description: 'Epic for auth',
            childIds: ['issue-2'],
            stateType: 'started',
          }),
          buildIssue({
            id: 'issue-2',
            identifier: 'ENG-2',
            title: 'Login Page',
            parentId: 'issue-1',
            cycleId: 1,
            assigneeName: 'Bob',
            labels: ['frontend'],
          }),
        ]);
      }
      return graphqlResponse({});
    });

    const result = await importFromLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.milestones).toBe(1);
    expect(result.value.epics).toBe(1);
    expect(result.value.stories).toBe(1);

    const epicPath = join(metaDir, 'epics/user-authentication/epic.md');
    const storyPath = join(
      metaDir,
      'epics/user-authentication/stories/login-page.md',
    );
    await expect(stat(epicPath)).resolves.toBeTruthy();
    await expect(stat(storyPath)).resolves.toBeTruthy();

    const storyContent = await readFile(storyPath, 'utf-8');
    expect(storyContent).toContain('assignee: Bob');

    const configContent = await readFile(
      join(metaDir, 'sync', 'linear-config.yaml'),
      'utf-8',
    );
    expect(configContent).toContain('team_id: team-1');

    const stateContent = await readFile(
      join(metaDir, 'sync', 'linear-state.json'),
      'utf-8',
    );
    const state = JSON.parse(stateContent);
    expect(state.team_id).toBe(TEAM_ID);
  });

  it('imports orphan stories without a parent epic', async () => {
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('query Cycles')) return cyclesResponse([]);
      if (body.query.includes('query Issues')) {
        return issuesResponse([
          buildIssue({
            id: 'issue-1',
            identifier: 'ENG-1',
            title: 'Standalone task',
          }),
        ]);
      }
      return graphqlResponse({});
    });

    const result = await importFromLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stories).toBe(1);
    expect(result.value.epics).toBe(0);

    const storyPath = join(metaDir, 'stories/standalone-task.md');
    await expect(stat(storyPath)).resolves.toBeTruthy();
  });

  it('gives issues with duplicate titles distinct files', async () => {
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes('query Cycles')) return cyclesResponse([]);
      if (body.query.includes('query Issues')) {
        return issuesResponse([
          buildIssue({ id: 'issue-1', identifier: 'ENG-1', title: 'Fix bug' }),
          buildIssue({ id: 'issue-2', identifier: 'ENG-2', title: 'Fix bug' }),
        ]);
      }
      return graphqlResponse({});
    });

    const result = await importFromLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.value.writtenPaths).size).toBe(
      result.value.writtenPaths.length,
    );
    expect(result.value.writtenPaths).toContain('.meta/stories/fix-bug.md');
    expect(result.value.writtenPaths).toContain(
      '.meta/stories/fix-bug-eng-2.md',
    );

    const { parseTree } = await import('@gitpm/core');
    const tree = await parseTree(metaDir);
    if (!tree.ok) throw tree.error;
    expect(tree.value.stories.map((s) => s.linear?.identifier).sort()).toEqual([
      'ENG-1',
      'ENG-2',
    ]);
  });

  it('returns an error result when the Linear API call fails', async () => {
    mockFetch.mockResolvedValue(
      new Response('Server error', { status: 500, statusText: 'Error' }),
    );

    const result = await importFromLinear({
      apiKey: API_KEY,
      teamId: TEAM_ID,
      metaDir,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Linear API error 500');
    }
  });
});
