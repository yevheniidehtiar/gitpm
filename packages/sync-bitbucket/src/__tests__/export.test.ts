import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Epic, Milestone, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import milestonesPage from '../__fixtures__/bitbucket-milestones.json';
import componentsPage from '../__fixtures__/export-components.json';
import duplicateIssue from '../__fixtures__/export-issue-duplicate.json';
import type { BitbucketClient } from '../client.js';
import type { BitbucketConfig } from '../config.js';
import { createDefaultConfig } from '../config.js';
import { exportToBitbucket } from '../export.js';
import type { SyncState } from '../state.js';
import { computeContentHash, loadState, saveState } from '../state.js';
import type { BbIssue, CreateIssueParams } from '../types.js';

let metaDir: string;
let nextIssueId: number;

function issueFrom(id: number, params: Partial<CreateIssueParams>): BbIssue {
  return {
    ...(duplicateIssue as BbIssue),
    id,
    title: params.title ?? duplicateIssue.title,
  };
}

function fakeClient() {
  return {
    getRepository: vi.fn(),
    listIssues: vi.fn(),
    getIssue: vi.fn(async (_w: string, _r: string, id: number) => ({
      ok: true as const,
      value: { ...(duplicateIssue as BbIssue), id },
    })),
    createIssue: vi.fn(
      async (_w: string, _r: string, params: CreateIssueParams) => ({
        ok: true as const,
        value: issueFrom(nextIssueId++, params),
      }),
    ),
    updateIssue: vi.fn(
      async (
        _w: string,
        _r: string,
        id: number,
        params: CreateIssueParams,
      ) => ({
        ok: true as const,
        value: issueFrom(id, params),
      }),
    ),
    listMilestones: vi.fn(async () => ({
      ok: true as const,
      value: milestonesPage.values,
    })),
    listComponents: vi.fn(async () => ({
      ok: true as const,
      value: componentsPage.values,
    })),
    listIssueComments: vi.fn(),
    createIssueComment: vi.fn(),
  } satisfies Record<keyof BitbucketClient, unknown>;
}

let client: ReturnType<typeof fakeClient>;

function config(overrides: Parameters<typeof createDefaultConfig>[2] = {}) {
  const parsed = createDefaultConfig('acme', 'widgets', overrides);
  if (!parsed.ok) throw parsed.error;
  return parsed.value;
}

function run(opts: { dryRun?: boolean; config?: BitbucketConfig } = {}) {
  return exportToBitbucket({
    auth: { kind: 'bearer', token: 'test-token' },
    workspace: 'acme',
    repoSlug: 'widgets',
    metaDir,
    config: opts.config ?? config(),
    dryRun: opts.dryRun,
    client: client as unknown as BitbucketClient,
  });
}

function milestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    type: 'milestone',
    id: 'ms_1',
    title: 'v1.0',
    status: 'in_progress',
    body: '',
    filePath: join(metaDir, 'roadmap/milestones/v1.md'),
    ...overrides,
  };
}

function epic(overrides: Partial<Epic> = {}): Epic {
  return {
    type: 'epic',
    id: 'ep_1',
    title: 'Checkout redesign',
    status: 'in_progress',
    priority: 'high',
    labels: [],
    milestone_ref: { id: 'ms_1' },
    body: 'Epic body',
    filePath: join(metaDir, 'epics/checkout/epic.md'),
    ...overrides,
  };
}

function story(overrides: Partial<Story> = {}): Story {
  return {
    type: 'story',
    id: 'st_1',
    title: 'Card form validation',
    status: 'todo',
    priority: 'medium',
    labels: ['kind:enhancement'],
    epic_ref: { id: 'ep_1' },
    body: 'Validate PAN and CVC',
    filePath: join(metaDir, 'epics/checkout/stories/card-form.md'),
    ...overrides,
  };
}

async function writeEntities(
  ...entities: (Milestone | Epic | Story)[]
): Promise<void> {
  for (const entity of entities) {
    const written = await writeFile(entity, entity.filePath);
    if (!written.ok) throw written.error;
  }
}

async function loadTree() {
  const tree = await parseTree(metaDir);
  if (!tree.ok) throw tree.error;
  return tree.value;
}

function state(entities: SyncState['entities']): SyncState {
  return {
    workspace: 'acme',
    repo_slug: 'widgets',
    last_sync: '2026-10-01T00:00:00.000Z',
    entities,
  };
}

beforeEach(async () => {
  metaDir = await mkdtemp(join(tmpdir(), 'gitpm-bb-export-'));
  nextIssueId = 100;
  client = fakeClient();
});

afterEach(async () => {
  await rm(metaDir, { recursive: true, force: true });
});

describe('exportToBitbucket: create', () => {
  it('creates issues for epics and stories and writes the bitbucket block', async () => {
    await writeEntities(milestone(), epic(), story());

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created.issues).toBe(2);
    expect(result.value.updated.milestones).toBe(1);
    expect(result.value.totalChanges).toBe(3);
    expect(result.value.warnings).toEqual([]);

    const [epicCall, storyCall] = client.createIssue.mock.calls;
    expect(epicCall?.[2]).toEqual({
      title: 'Checkout redesign',
      content: { raw: 'Epic body' },
      kind: 'task',
      priority: 'critical',
      state: 'open',
      milestone: { name: 'v1.0' },
    });
    expect(storyCall?.[2]).toEqual({
      title: 'Card form validation',
      content: { raw: 'Validate PAN and CVC\n\n<!-- gitpm:epic=ep_1 -->' },
      kind: 'enhancement',
      priority: 'major',
      state: 'new',
      component: { name: 'Checkout redesign' },
    });

    const tree = await loadTree();
    expect(tree.epics[0]?.bitbucket).toMatchObject({
      issue_id: 100,
      workspace: 'acme',
      repo_slug: 'widgets',
    });
    expect(tree.stories[0]?.bitbucket?.issue_id).toBe(101);
    expect(tree.stories[0]?.bitbucket?.last_sync_hash).toBe(
      computeContentHash(tree.stories[0] as Story),
    );
    expect(tree.milestones[0]?.bitbucket?.milestone_name).toBe('v1.0');

    const saved = await loadState(metaDir);
    expect(saved.ok && saved.value.entities.st_1?.bitbucket_issue_id).toBe(101);
    expect(
      saved.ok && saved.value.entities.ms_1?.bitbucket_milestone_name,
    ).toBe('v1.0');
    expect(result.value.exportedPaths).toHaveLength(3);
  });

  it('is idempotent: a second run changes nothing', async () => {
    await writeEntities(milestone(), epic(), story());
    await run();
    client.createIssue.mockClear();

    const result = await run();

    expect(result.ok && result.value.totalChanges).toBe(0);
    expect(client.createIssue).not.toHaveBeenCalled();
    expect(client.updateIssue).not.toHaveBeenCalled();
  });

  it('ignores a bitbucket block that points at another repository', async () => {
    await writeEntities(
      story({
        epic_ref: null,
        bitbucket: {
          issue_id: 9,
          workspace: 'other',
          repo_slug: 'repo',
          synced_at: '2026-01-01T00:00:00Z',
        },
      }),
    );

    const result = await run();

    expect(result.ok && result.value.created.issues).toBe(1);
    expect(client.updateIssue).not.toHaveBeenCalled();
    const tree = await loadTree();
    expect(tree.stories[0]?.bitbucket).toMatchObject({
      issue_id: 100,
      workspace: 'acme',
    });
  });
});

describe('exportToBitbucket: milestones and components', () => {
  it('warns about milestones missing on Bitbucket and does not link them', async () => {
    await writeEntities(milestone({ title: 'v9.9' }), epic());

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toEqual([
      expect.stringContaining('Milestone "v9.9" does not exist'),
    ]);
    expect(result.value.updated.milestones).toBe(0);
    expect(client.createIssue.mock.calls[0]?.[2].milestone).toBeUndefined();
  });

  it('omits unknown components and warns once per component', async () => {
    await writeEntities(
      epic({ title: 'Payments', milestone_ref: null }),
      story(),
      story({ id: 'st_2', filePath: join(metaDir, 'epics/checkout/s2.md') }),
    );

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toEqual([
      expect.stringContaining('Component "Payments" does not exist'),
    ]);
    const storyParams = client.createIssue.mock.calls[1]?.[2];
    expect(storyParams).not.toHaveProperty('component');
    expect(storyParams?.content?.raw).toContain('<!-- gitpm:epic=ep_1 -->');
  });

  it('does not list components with body-marker linkage', async () => {
    await writeEntities(epic({ milestone_ref: null }), story());

    const result = await run({
      config: config({ epic_linkage: 'body-marker' }),
    });

    expect(result.ok).toBe(true);
    expect(client.listComponents).not.toHaveBeenCalled();
    expect(client.listMilestones).not.toHaveBeenCalled();
    expect(client.createIssue.mock.calls[1]?.[2].component).toBeNull();
  });

  it('writes the component but no marker with component linkage', async () => {
    await writeEntities(epic({ milestone_ref: null }), story());

    await run({ config: config({ epic_linkage: 'component' }) });

    const storyParams = client.createIssue.mock.calls[1]?.[2];
    expect(storyParams?.component).toEqual({ name: 'Checkout redesign' });
    expect(storyParams?.content?.raw).toBe('Validate PAN and CVC');
  });
});

describe('exportToBitbucket: update and close', () => {
  it('updates changed issues and keeps an equivalent remote state', async () => {
    const original = story({
      epic_ref: null,
      status: 'cancelled',
      priority: 'low',
      bitbucket: {
        issue_id: 41,
        workspace: 'acme',
        repo_slug: 'widgets',
        synced_at: '2026-10-01T00:00:00Z',
      },
    });
    const staleHash = computeContentHash(original);
    await writeEntities({ ...original, title: 'Card form validation v2' });
    await saveState(
      metaDir,
      state({
        st_1: {
          bitbucket_issue_id: 41,
          local_hash: staleHash,
          remote_hash: staleHash,
          synced_at: '2026-10-01T00:00:00Z',
        },
      }),
    );

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.updated.issues).toBe(1);
    expect(client.getIssue).toHaveBeenCalledWith('acme', 'widgets', 41);
    const [, , id, params] = client.updateIssue.mock.calls[0] ?? [];
    expect(id).toBe(41);
    // `duplicate` and `trivial` already map to cancelled/low, so they stay.
    expect(params).toMatchObject({
      title: 'Card form validation v2',
      state: 'duplicate',
      priority: 'trivial',
      component: null,
    });

    const saved = await loadState(metaDir);
    const tree = await loadTree();
    expect(saved.ok && saved.value.entities.st_1?.local_hash).toBe(
      computeContentHash(tree.stories[0] as Story),
    );
  });

  it('closes issues of entities deleted locally and forgets them', async () => {
    await saveState(
      metaDir,
      state({
        st_gone: {
          bitbucket_issue_id: 55,
          local_hash: 'sha256:x',
          remote_hash: 'sha256:x',
          synced_at: '2026-10-01T00:00:00Z',
        },
      }),
    );

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.updateIssue).toHaveBeenCalledWith('acme', 'widgets', 55, {
      state: 'closed',
    });
    expect(result.value.changes).toEqual([
      { action: 'close', entityId: 'st_gone', issueId: 55 },
    ]);
    expect(result.value.totalChanges).toBe(1);
    const saved = await loadState(metaDir);
    expect(saved.ok && saved.value.entities.st_gone).toBeUndefined();
  });
});

describe('exportToBitbucket: dry run', () => {
  it('reports planned changes without writing anywhere', async () => {
    await writeEntities(milestone(), epic(), story());
    const before = await readFile(join(metaDir, 'epics/checkout/epic.md'));

    const result = await run({ dryRun: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.changes).toEqual([
      {
        action: 'link',
        entityId: 'ms_1',
        entityType: 'milestone',
        title: 'v1.0',
        milestoneName: 'v1.0',
      },
      {
        action: 'create',
        entityId: 'ep_1',
        entityType: 'epic',
        title: 'Checkout redesign',
      },
      {
        action: 'create',
        entityId: 'st_1',
        entityType: 'story',
        title: 'Card form validation',
      },
    ]);
    expect(result.value.totalChanges).toBe(3);
    expect(result.value.exportedPaths).toEqual([]);
    expect(client.createIssue).not.toHaveBeenCalled();
    expect(client.updateIssue).not.toHaveBeenCalled();
    expect(await readFile(join(metaDir, 'epics/checkout/epic.md'))).toEqual(
      before,
    );
    expect((await loadState(metaDir)).ok).toBe(false);
  });

  it('still reports warnings in dry run', async () => {
    await writeEntities(
      epic({ title: 'Payments', milestone_ref: null }),
      story(),
    );

    const result = await run({ dryRun: true });

    expect(result.ok && result.value.warnings).toEqual([
      expect.stringContaining('Component "Payments"'),
    ]);
  });
});

describe('exportToBitbucket: errors', () => {
  it('rejects sync state from another repository', async () => {
    await saveState(metaDir, { ...state({}), workspace: 'other' });

    const result = await run();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('other/widgets');
  });

  it('returns an error and keeps already-created issues in state', async () => {
    await writeEntities(epic({ milestone_ref: null }), story());
    client.createIssue
      .mockResolvedValueOnce({
        ok: true,
        value: issueFrom(100, { title: 'Checkout redesign' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        error: { status: 400, message: 'Bitbucket API error 400: bad' },
      } as never);

    const result = await run();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain(
      'Failed to create Bitbucket issue for st_1',
    );
    const saved = await loadState(metaDir);
    expect(saved.ok && saved.value.entities.ep_1?.bitbucket_issue_id).toBe(100);
    expect(saved.ok && saved.value.entities.st_1).toBeUndefined();
  });

  it('returns an error when milestones cannot be listed', async () => {
    await writeEntities(milestone());
    client.listMilestones.mockResolvedValueOnce({
      ok: false,
      error: { status: 403, message: 'forbidden' },
    } as never);

    const result = await run();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe(
      'Failed to list Bitbucket milestones: forbidden',
    );
  });

  it('returns the parse error for a missing .meta directory', async () => {
    metaDir = join(metaDir, 'missing');
    const result = await run();
    expect(result.ok).toBe(false);
  });
});
