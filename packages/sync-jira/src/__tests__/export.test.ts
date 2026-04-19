import { mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Epic, Prd, Story } from '@gitpm/core';
import { writeFile as coreWriteFile, parseTree } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportToJira } from '../export.js';
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

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

function notFoundResponse(): Response {
  return new Response('Not found', { status: 404 });
}

interface MockIssue {
  id?: string;
  key: string;
  summary?: string;
  statusName?: string;
  issueType?: string;
  description?: string | null;
  labels?: string[];
  parentKey?: string;
}

function mockIssue(opts: MockIssue) {
  return {
    id: opts.id ?? '999',
    key: opts.key,
    fields: {
      summary: opts.summary ?? 'Issue',
      description: opts.description ?? null,
      status: { name: opts.statusName ?? 'To Do', id: '1' },
      issuetype: { name: opts.issueType ?? 'Story', id: '10001' },
      assignee: null,
      labels: opts.labels ?? [],
      priority: null,
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

describe('exportToJira', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-jira-export-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns error when tree cannot be parsed (non-existent metaDir)', async () => {
    const result = await exportToJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(false);
  });

  it('returns no-op success when tree is in sync with Jira', async () => {
    await seedTree(metaDir, {
      issues: [
        mockIssue({
          id: '10',
          key: 'TEST-10',
          summary: 'Epic',
          issueType: 'Epic',
        }),
        mockIssue({
          id: '11',
          key: 'TEST-11',
          summary: 'Story',
          parentKey: 'TEST-10',
        }),
      ],
    });

    mockFetch.mockImplementation(async () => notFoundResponse());

    const result = await exportToJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created.issues).toBe(0);
    expect(result.value.updated.issues).toBe(0);
    // no fetch calls because nothing changed
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('creates new Jira issues for local entities without an issue key', async () => {
    await seedTree(metaDir);

    // Add a new story without jira metadata
    const newStory: Story = {
      type: 'story',
      id: 'new-story-1',
      title: 'Brand New Task',
      status: 'in_progress',
      priority: 'medium',
      assignee: null,
      labels: ['test'],
      estimate: null,
      epic_ref: null,
      body: 'Body of the new task.',
      filePath: '.meta/stories/brand-new-task.md',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    };
    const newPath = join(metaDir, 'stories', 'brand-new-task.md');
    const w = await coreWriteFile(newStory, newPath);
    expect(w.ok).toBe(true);

    // Record fetch calls
    const createCalls: Array<{ url: string; init: RequestInit }> = [];
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/rest/api/3/issue') && init?.method === 'POST') {
        createCalls.push({ url, init });
        return jsonResponse(
          mockIssue({ id: '50', key: 'TEST-50', summary: 'Brand New Task' }),
        );
      }
      if (url.includes('/issue/TEST-50/transitions')) {
        if (init?.method === 'POST') return emptyResponse();
        return jsonResponse({
          transitions: [
            { id: '21', name: 'Start', to: { name: 'In Progress', id: '3' } },
          ],
        });
      }
      return notFoundResponse();
    });

    const result = await exportToJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created.issues).toBe(1);
    expect(createCalls).toHaveLength(1);
    const createBody = JSON.parse(createCalls[0].init.body as string);
    expect(createBody.fields.summary).toBe('Brand New Task');
    expect(createBody.fields.project.key).toBe(PROJECT_KEY);
  });

  it('updates existing Jira issues when local content changed', async () => {
    await seedTree(metaDir, {
      issues: [
        mockIssue({
          id: '11',
          key: 'TEST-11',
          summary: 'Original Title',
          issueType: 'Story',
        }),
      ],
    });

    // Mutate a story title on disk. parseTree yields an absolute filePath,
    // so write directly to that path rather than re-joining with metaDir.
    const treeResult = await parseTree(metaDir);
    expect(treeResult.ok).toBe(true);
    if (!treeResult.ok) return;
    const story = treeResult.value.stories[0];
    expect(story).toBeDefined();
    story.title = 'Updated Title';
    await coreWriteFile(story, story.filePath);

    const updateCalls: Array<{ url: string; body: unknown }> = [];
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/issue/TEST-11') && init?.method === 'PUT') {
        updateCalls.push({ url, body: JSON.parse(init.body as string) });
        return emptyResponse();
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

    const result = await exportToJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.updated.issues).toBe(1);
    expect(updateCalls).toHaveLength(1);
    expect(
      (updateCalls[0].body as { fields: { summary: string } }).fields.summary,
    ).toBe('Updated Title');
  });

  it('dry run does not call the API nor write files', async () => {
    await seedTree(metaDir);

    const newStory: Story = {
      type: 'story',
      id: 'dry-1',
      title: 'Dry Story',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: '.meta/stories/dry-story.md',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    };
    await coreWriteFile(newStory, join(metaDir, 'stories', 'dry-story.md'));

    mockFetch.mockImplementation(async () => {
      throw new Error('fetch should not be called in dry run');
    });

    const result = await exportToJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
      dryRun: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created.issues).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('transitions to Done when a synced entity is deleted locally', async () => {
    await seedTree(metaDir, {
      issues: [
        mockIssue({
          id: '12',
          key: 'TEST-12',
          summary: 'Will Delete',
          issueType: 'Story',
        }),
      ],
    });

    // Delete the story file from disk
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) throw treeResult.error;
    const story = treeResult.value.stories[0];
    await unlink(story.filePath);

    const postTransitionCalls: string[] = [];
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/issue/TEST-12/transitions')) {
        if (init?.method === 'POST') {
          postTransitionCalls.push(url);
          return emptyResponse();
        }
        return jsonResponse({
          transitions: [
            { id: '41', name: 'Finish', to: { name: 'Done', id: '4' } },
          ],
        });
      }
      return notFoundResponse();
    });

    const result = await exportToJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalChanges).toBeGreaterThan(0);
    expect(postTransitionCalls).toHaveLength(1);
  });

  it('silently ignores transition errors', async () => {
    await seedTree(metaDir);

    const newStory: Story = {
      type: 'story',
      id: 'trans-err-1',
      title: 'Skip Transition',
      status: 'in_progress',
      priority: 'medium',
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: '.meta/stories/skip-transition.md',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    };
    await coreWriteFile(
      newStory,
      join(metaDir, 'stories', 'skip-transition.md'),
    );

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/rest/api/3/issue') && init?.method === 'POST') {
        return jsonResponse(mockIssue({ id: '60', key: 'TEST-60' }));
      }
      if (url.includes('/issue/TEST-60/transitions')) {
        return new Response('boom', { status: 500 });
      }
      return notFoundResponse();
    });

    const result = await exportToJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
  });

  it('creates new Jira Epic and registers it in the epic key map', async () => {
    await seedTree(metaDir);

    const newEpic: Epic = {
      type: 'epic',
      id: 'epic-new-1',
      title: 'Shiny Feature',
      status: 'todo',
      priority: 'medium',
      owner: null,
      labels: [],
      milestone_ref: null,
      body: '',
      filePath: '.meta/epics/shiny-feature/epic.md',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    };
    await coreWriteFile(
      newEpic,
      join(metaDir, 'epics', 'shiny-feature', 'epic.md'),
    );

    const childStory: Story = {
      type: 'story',
      id: 'story-child-1',
      title: 'Child Task',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: { id: 'epic-new-1' },
      body: '',
      filePath: '.meta/epics/shiny-feature/stories/child-task.md',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    };
    await coreWriteFile(
      childStory,
      join(metaDir, 'epics', 'shiny-feature', 'stories', 'child-task.md'),
    );

    const createBodies: Array<Record<string, unknown>> = [];
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/rest/api/3/issue') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        createBodies.push(body);
        const isEpic = body.fields.issuetype.name === 'Epic';
        return jsonResponse({
          id: isEpic ? '70' : '71',
          key: isEpic ? 'TEST-70' : 'TEST-71',
          fields: {
            summary: body.fields.summary,
            description: null,
            status: { name: 'To Do', id: '1' },
            issuetype: body.fields.issuetype,
            assignee: null,
            labels: [],
            priority: null,
            project: { key: PROJECT_KEY },
            created: '2026-01-01T00:00:00Z',
            updated: '2026-01-01T00:00:00Z',
          },
        });
      }
      if (url.includes('/transitions')) {
        if (init?.method === 'POST') return emptyResponse();
        return jsonResponse({ transitions: [] });
      }
      return notFoundResponse();
    });

    const result = await exportToJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created.issues).toBe(2);
    expect(createBodies).toHaveLength(2);

    // The child story's create request should include the parent key resolved
    // from the freshly-created epic.
    const storyBody = createBodies.find(
      (b) =>
        (b as { fields: { summary: string } }).fields.summary === 'Child Task',
    );
    expect(storyBody).toBeDefined();
    expect(
      (
        storyBody as {
          fields: { parent?: { key: string } };
        }
      ).fields.parent?.key,
    ).toBe('TEST-70');
  });

  it('considers milestones and PRDs when computing the current entity set', async () => {
    await seedTree(metaDir, {
      issues: [],
      sprints: [{ id: 1, name: 'Sprint 1', state: 'active' }],
    });

    const prd: Prd = {
      type: 'prd',
      id: 'prd-1',
      title: 'Product Requirements',
      status: 'draft',
      owner: null,
      epic_refs: [],
      body: 'PRD body',
      filePath: '.meta/prds/prd-1.md',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    };
    await coreWriteFile(prd, join(metaDir, 'prds', 'prd-1.md'));

    mockFetch.mockImplementation(async () => notFoundResponse());

    const result = await exportToJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(true);
  });

  it('wraps non-Error throwables from the pipeline', async () => {
    await seedTree(metaDir);

    // Add a new story
    const newStory: Story = {
      type: 'story',
      id: 'err-1',
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
      throw 'non-error-throwable';
    });

    const result = await exportToJira({
      email: EMAIL,
      apiToken: TOKEN,
      site: SITE,
      projectKey: PROJECT_KEY,
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Jira export failed');
    }
  });
});
