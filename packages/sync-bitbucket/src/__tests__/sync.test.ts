import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConflictStrategy, Epic, Milestone, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCheckpoint, saveCheckpoint } from '../checkpoint.js';
import type { BitbucketClient } from '../client.js';
import { createDefaultConfig } from '../config.js';
import type { SyncState } from '../state.js';
import { computeContentHash, loadState, saveState } from '../state.js';
import { syncWithBitbucket } from '../sync.js';
import type { BbIssue, CreateIssueParams } from '../types.js';

const SYNCED_AT = '2026-10-01T00:00:00.000Z';
const BEFORE_SYNC = '2026-09-30T00:00:00.000000+00:00';
const AFTER_SYNC = '2026-10-02T00:00:00.000000+00:00';

let metaDir: string;

/** In-memory Bitbucket: updates merge into the stored issue like the API does. */
function fakeBitbucket() {
  const issues = new Map<number, BbIssue>();
  let nextId = 500;

  function apply(issue: BbIssue, params: Partial<CreateIssueParams>): BbIssue {
    return {
      ...issue,
      ...(params.title !== undefined && { title: params.title }),
      ...(params.content !== undefined && {
        content: { raw: params.content.raw, markup: 'markdown' },
      }),
      ...(params.kind !== undefined && { kind: params.kind }),
      ...(params.priority !== undefined && { priority: params.priority }),
      ...(params.state !== undefined && { state: params.state }),
      ...(params.component !== undefined && {
        component: params.component,
      }),
      ...(params.milestone !== undefined && { milestone: params.milestone }),
      updated_on: new Date().toISOString(),
    };
  }

  const client = {
    getRepository: vi.fn(),
    listIssues: vi.fn(async () => ({
      ok: true as const,
      value: [...issues.values()],
    })),
    getIssue: vi.fn(async (_w: string, _r: string, id: number) => {
      const issue = issues.get(id);
      return issue
        ? { ok: true as const, value: issue }
        : {
            ok: false as const,
            error: { status: 404, message: 'Bitbucket API error 404' },
          };
    }),
    createIssue: vi.fn(
      async (_w: string, _r: string, params: CreateIssueParams) => {
        const issue = apply(remoteIssue(nextId++, {}), params);
        issues.set(issue.id, issue);
        return { ok: true as const, value: issue };
      },
    ),
    updateIssue: vi.fn(
      async (
        _w: string,
        _r: string,
        id: number,
        params: Partial<CreateIssueParams>,
      ) => {
        const current = issues.get(id);
        if (!current) {
          return {
            ok: false as const,
            error: { status: 404, message: 'Bitbucket API error 404' },
          };
        }
        const updated = apply(current, params);
        issues.set(id, updated);
        return { ok: true as const, value: updated };
      },
    ),
    listMilestones: vi.fn(async () => ({ ok: true as const, value: [] })),
    listComponents: vi.fn(async () => ({
      ok: true as const,
      value: [{ id: 1, name: 'Checkout redesign' }],
    })),
    listIssueComments: vi.fn(),
    createIssueComment: vi.fn(),
  } satisfies Record<keyof BitbucketClient, unknown>;

  return { client, issues };
}

let bb: ReturnType<typeof fakeBitbucket>;

function remoteIssue(id: number, overrides: Partial<BbIssue>): BbIssue {
  return {
    id,
    title: 'Untitled',
    content: { raw: '', markup: 'markdown' },
    state: 'new',
    kind: 'task',
    priority: 'major',
    assignee: null,
    reporter: null,
    milestone: null,
    component: null,
    version: null,
    votes: 0,
    created_on: BEFORE_SYNC,
    updated_on: BEFORE_SYNC,
    ...overrides,
  };
}

function config() {
  const parsed = createDefaultConfig('acme', 'widgets');
  if (!parsed.ok) throw parsed.error;
  return parsed.value;
}

function run(strategy: ConflictStrategy = 'ask', dryRun = false) {
  return syncWithBitbucket({
    auth: { kind: 'bearer', token: 'test-token' },
    workspace: 'acme',
    repoSlug: 'widgets',
    metaDir,
    config: config(),
    strategy,
    dryRun,
    client: bb.client as unknown as BitbucketClient,
  });
}

function block(issueId: number, entity: Story | Epic) {
  return {
    issue_id: issueId,
    workspace: 'acme',
    repo_slug: 'widgets',
    last_sync_hash: computeContentHash(entity),
    synced_at: SYNCED_AT,
  };
}

function epic(overrides: Partial<Epic> = {}): Epic {
  return {
    type: 'epic',
    id: 'ep_1',
    title: 'Checkout redesign',
    status: 'in_progress',
    priority: 'high',
    labels: ['kind:task'],
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
    assignee: null,
    labels: ['kind:enhancement'],
    epic_ref: null,
    body: 'Validate PAN and CVC',
    filePath: join(metaDir, 'stories/card-form.md'),
    ...overrides,
  };
}

/**
 * Write the entity and a matching remote issue, linked as an import or
 * export leaves them: hashes equal and the issue untouched since the sync.
 */
async function seedLinked(
  entity: Story | Epic,
  issueId: number,
  remote: Partial<BbIssue>,
  options: { state?: boolean } = {},
): Promise<void> {
  const linked = { ...entity, bitbucket: block(issueId, entity) };
  const written = await writeFile(linked, linked.filePath);
  if (!written.ok) throw written.error;
  bb.issues.set(issueId, remoteIssue(issueId, remote));
  if (options.state === false) return;
  const loaded = await loadState(metaDir);
  const state: SyncState = loaded.ok
    ? loaded.value
    : {
        workspace: 'acme',
        repo_slug: 'widgets',
        last_sync: SYNCED_AT,
        entities: {},
      };
  const hash = computeContentHash(entity);
  state.entities[entity.id] = {
    bitbucket_issue_id: issueId,
    local_hash: hash,
    remote_hash: hash,
    synced_at: SYNCED_AT,
  };
  const saved = await saveState(metaDir, state);
  if (!saved.ok) throw saved.error;
}

/** The default story's remote twin, as export would have written it. */
const storyRemote: Partial<BbIssue> = {
  title: 'Card form validation',
  content: { raw: 'Validate PAN and CVC' },
  state: 'new',
  kind: 'enhancement',
  priority: 'major',
};

async function editLocal<T extends Story | Epic>(
  id: string,
  edit: (entity: T) => void,
): Promise<void> {
  const tree = await loadTree();
  const entity = [...tree.epics, ...tree.stories].find((e) => e.id === id) as
    | T
    | undefined;
  if (!entity) throw new Error(`no entity ${id}`);
  edit(entity);
  const written = await writeFile(entity, entity.filePath);
  if (!written.ok) throw written.error;
}

function editRemote(id: number, changes: Partial<BbIssue>): void {
  const issue = bb.issues.get(id);
  if (!issue) throw new Error(`no issue ${id}`);
  bb.issues.set(id, { ...issue, ...changes, updated_on: AFTER_SYNC });
}

async function loadTree() {
  const tree = await parseTree(metaDir);
  if (!tree.ok) throw tree.error;
  return tree.value;
}

async function localStory(id = 'st_1'): Promise<Story> {
  const found = (await loadTree()).stories.find((s) => s.id === id);
  if (!found) throw new Error(`no story ${id}`);
  return found;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  metaDir = await mkdtemp(join(tmpdir(), 'gitpm-bb-sync-'));
  bb = fakeBitbucket();
});

afterEach(async () => {
  await rm(metaDir, { recursive: true, force: true });
});

describe('syncWithBitbucket: field-level diff', () => {
  it('does nothing when neither side changed', async () => {
    await seedLinked(story(), 41, storyRemote);

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBe(0);
    expect(result.value.pulled.issues).toBe(0);
    expect(bb.client.updateIssue).not.toHaveBeenCalled();
  });

  it('pushes a local change', async () => {
    await seedLinked(story(), 41, storyRemote);
    await editLocal<Story>('st_1', (s) => {
      s.title = 'Validate the card form';
    });

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBe(1);
    expect(result.value.pulled.issues).toBe(0);
    expect(bb.issues.get(41)?.title).toBe('Validate the card form');

    const state = await loadState(metaDir);
    expect(state.ok && state.value.entities.st_1?.field_hashes).toBeTruthy();
  });

  it('pulls a remote change', async () => {
    await seedLinked(story(), 41, storyRemote);
    editRemote(41, { state: 'resolved', assignee: { display_name: 'Ada' } });

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.issues).toBe(1);
    expect(result.value.pushed.issues).toBe(0);
    const local = await localStory();
    expect(local.status).toBe('done');
    expect(local.assignee).toBe('Ada');
    expect(local.bitbucket?.issue_id).toBe(41);
    expect(bb.client.updateIssue).not.toHaveBeenCalled();
  });

  it('merges changes to different fields on both sides', async () => {
    await seedLinked(story(), 41, storyRemote);
    expect((await run()).ok).toBe(true);
    await editLocal<Story>('st_1', (s) => {
      s.title = 'Validate the card form';
    });
    editRemote(41, { priority: 'blocker' });

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conflicts).toEqual([]);
    expect(result.value.pushed.issues).toBe(1);
    expect(result.value.pulled.issues).toBe(1);
    expect((await localStory()).priority).toBe('critical');
    expect((await localStory()).title).toBe('Validate the card form');
    expect(bb.issues.get(41)?.title).toBe('Validate the card form');
    expect(bb.issues.get(41)?.priority).toBe('blocker');
  });

  it('treats every differing field as a conflict before the first per-field baseline', async () => {
    await seedLinked(story(), 41, storyRemote);
    await editLocal<Story>('st_1', (s) => {
      s.title = 'Validate the card form';
    });
    editRemote(41, { priority: 'blocker' });

    const result = await run('ask');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conflicts.map((c) => c.field)).toEqual([
      'title',
      'priority',
    ]);
    expect(result.value.skipped).toBe(1);
  });

  it('reports a same-field conflict with ask and leaves both sides alone', async () => {
    await seedLinked(story(), 41, storyRemote);
    await editLocal<Story>('st_1', (s) => {
      s.title = 'Local title';
    });
    editRemote(41, { title: 'Remote title' });

    const result = await run('ask');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.skipped).toBe(1);
    expect(result.value.conflicts).toEqual([
      {
        entityId: 'st_1',
        entityTitle: 'Local title',
        entityType: 'story',
        field: 'title',
        baseValue: null,
        localValue: 'Local title',
        remoteValue: 'Remote title',
      },
    ]);
    expect((await localStory()).title).toBe('Local title');
    expect(bb.issues.get(41)?.title).toBe('Remote title');
  });

  it.each([
    ['local-wins', 'Local title'],
    ['remote-wins', 'Remote title'],
  ] as const)('resolves a conflict with %s', async (strategy, expected) => {
    await seedLinked(story(), 41, storyRemote);
    await editLocal<Story>('st_1', (s) => {
      s.title = 'Local title';
    });
    editRemote(41, { title: 'Remote title' });

    const result = await run(strategy);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resolved).toBe(1);
    expect(result.value.conflicts).toEqual([]);
    expect((await localStory()).title).toBe(expected);
    expect(bb.issues.get(41)?.title).toBe(expected);
  });

  it('is stable for lossy status mappings once synced', async () => {
    await seedLinked(story({ status: 'in_review' }), 41, {
      ...storyRemote,
      state: 'open',
    });

    const first = await run();
    const second = await run();

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.pulled.issues + first.value.pushed.issues).toBe(0);
    expect(second.value.pulled.issues + second.value.pushed.issues).toBe(0);
    expect((await localStory()).status).toBe('in_review');
  });

  it('uses per-field baselines after the first sync', async () => {
    await seedLinked(story(), 41, storyRemote);
    await editLocal<Story>('st_1', (s) => {
      s.body = 'Local body';
    });
    expect((await run()).ok).toBe(true);

    // Remote edits a different field than the one local pushed.
    editRemote(41, { kind: 'bug' });
    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.issues).toBe(1);
    expect(result.value.pushed.issues).toBe(0);
    const local = await localStory();
    expect(local.labels).toEqual(['kind:bug']);
    expect(local.body).toBe('Local body');
  });
});

describe('syncWithBitbucket: epics', () => {
  it('pulls a story moved to another epic by body marker', async () => {
    await seedLinked(epic(), 10, {
      title: 'Checkout redesign',
      content: { raw: 'Epic body' },
      state: 'open',
      priority: 'critical',
    });
    await seedLinked(
      epic({
        id: 'ep_2',
        title: 'Payments',
        filePath: join(metaDir, 'epics/payments/epic.md'),
      }),
      11,
      {
        title: 'Payments',
        content: { raw: 'Epic body' },
        state: 'open',
        priority: 'critical',
      },
    );
    await seedLinked(story({ epic_ref: { id: 'ep_1' } }), 41, {
      ...storyRemote,
      content: { raw: 'Validate PAN and CVC\n\n<!-- gitpm:epic=ep_1 -->' },
      component: { name: 'Checkout redesign' },
    });
    editRemote(41, {
      content: { raw: 'Validate PAN and CVC\n\n<!-- gitpm:epic=ep_2 -->' },
    });

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await localStory()).epic_ref).toEqual({ id: 'ep_2' });
  });
});

describe('syncWithBitbucket: lifecycle', () => {
  it('creates issues for new local entities', async () => {
    await seedLinked(story(), 41, storyRemote);
    const fresh = story({
      id: 'st_2',
      title: 'Saved cards',
      filePath: join(metaDir, 'stories/saved-cards.md'),
    });
    const written = await writeFile(fresh, fresh.filePath);
    if (!written.ok) throw written.error;

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBe(1);
    expect(bb.client.createIssue).toHaveBeenCalledTimes(1);
    expect((await localStory('st_2')).bitbucket?.issue_id).toBe(500);
    const state = await loadState(metaDir);
    expect(state.ok && state.value.entities.st_2?.bitbucket_issue_id).toBe(500);
  });

  it('closes the issue of a locally deleted entity', async () => {
    await seedLinked(story(), 41, storyRemote);
    await rm(story().filePath);

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBe(1);
    expect(bb.issues.get(41)?.state).toBe('closed');
    const state = await loadState(metaDir);
    expect(state.ok && state.value.entities.st_1).toBeUndefined();
  });

  it('cancels an entity whose issue was deleted on Bitbucket', async () => {
    await seedLinked(story(), 41, storyRemote);
    bb.issues.delete(41);

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.issues).toBe(1);
    expect((await localStory()).status).toBe('cancelled');
  });

  it('writes nothing with dryRun', async () => {
    await seedLinked(story(), 41, storyRemote);
    expect((await run()).ok).toBe(true);
    await editLocal<Story>('st_1', (s) => {
      s.title = 'Local title';
    });
    editRemote(41, { priority: 'blocker' });
    const before = await loadState(metaDir);

    const result = await run('ask', true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBe(1);
    expect(result.value.pulled.issues).toBe(1);
    expect(bb.client.updateIssue).not.toHaveBeenCalled();
    expect((await localStory()).priority).toBe('medium');
    expect(await loadState(metaDir)).toEqual(before);
  });

  it('rejects state that belongs to another repository', async () => {
    await saveState(metaDir, {
      workspace: 'other',
      repo_slug: 'repo',
      last_sync: SYNCED_AT,
      entities: {},
    });

    const result = await run();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('other/repo');
  });

  it('fails when the issue list cannot be read', async () => {
    await seedLinked(story(), 41, storyRemote);
    bb.client.listIssues.mockResolvedValueOnce({
      ok: false,
      error: { status: 500, message: 'boom' },
    } as never);

    const result = await run();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('boom');
  });
});

describe('syncWithBitbucket: state reconstruction', () => {
  it('rebuilds the state from frontmatter when the state file is missing', async () => {
    await seedLinked(story(), 41, storyRemote, { state: false });
    editRemote(41, { title: 'Renamed remotely' });

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.issues).toBe(1);
    expect((await localStory()).title).toBe('Renamed remotely');
    const state = await loadState(metaDir);
    expect(state.ok && state.value.entities.st_1?.bitbucket_issue_id).toBe(41);
  });

  it('fails when there is neither a state file nor a linked entity', async () => {
    const written = await writeFile(story(), story().filePath);
    if (!written.ok) throw written.error;

    const result = await run();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('No Bitbucket sync state');
  });
});

describe('syncWithBitbucket: checkpoints', () => {
  async function seedTwo(): Promise<void> {
    await seedLinked(story(), 41, storyRemote);
    await seedLinked(
      story({
        id: 'st_2',
        title: 'Saved cards',
        filePath: join(metaDir, 'stories/saved-cards.md'),
      }),
      42,
      { ...storyRemote, title: 'Saved cards' },
    );
    await editLocal<Story>('st_1', (s) => {
      s.title = 'First, edited';
    });
    await editLocal<Story>('st_2', (s) => {
      s.title = 'Second, edited';
    });
  }

  it('records a failed entity, keeps going and saves a checkpoint', async () => {
    await seedTwo();
    bb.client.updateIssue.mockResolvedValueOnce({
      ok: false,
      error: { status: 400, message: 'bad request' },
    } as never);

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.failedEntities).toHaveLength(1);
    expect(result.value.failedEntities[0]?.entityId).toBe('st_1');
    expect(bb.issues.get(42)?.title).toBe('Second, edited');

    const checkpoint = await loadCheckpoint(metaDir);
    expect(checkpoint.ok && checkpoint.value).toMatchObject({
      workspace: 'acme',
      repo_slug: 'widgets',
      processedEntityIds: [],
      lastError: { entityId: 'st_1' },
    });
  });

  it('resumes from the checkpoint and clears it on success', async () => {
    await seedTwo();
    await saveCheckpoint(metaDir, {
      startedAt: SYNCED_AT,
      workspace: 'acme',
      repo_slug: 'widgets',
      processedEntityIds: ['st_2'],
    });

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resumedFromCheckpoint).toBe(true);
    expect(result.value.pushed.issues).toBe(1);
    expect(bb.issues.get(41)?.title).toBe('First, edited');
    // st_2 was marked done by the earlier run, so it is skipped.
    expect(bb.issues.get(42)?.title).toBe('Saved cards');
    expect(
      await exists(join(metaDir, '.gitpm/bitbucket-sync-checkpoint.json')),
    ).toBe(false);
  });

  it('ignores a checkpoint from another repository', async () => {
    await seedTwo();
    await saveCheckpoint(metaDir, {
      startedAt: SYNCED_AT,
      workspace: 'other',
      repo_slug: 'repo',
      processedEntityIds: ['st_2'],
    });

    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resumedFromCheckpoint).toBe(false);
    expect(result.value.pushed.issues).toBe(2);
  });
});

// Milestones are linked by name and cannot be written over REST 2.0.
describe('syncWithBitbucket: milestones', () => {
  it('leaves linked milestones and their state alone', async () => {
    const ms: Milestone = {
      type: 'milestone',
      id: 'ms_1',
      title: 'v1.0',
      status: 'in_progress',
      body: '',
      filePath: join(metaDir, 'roadmap/milestones/v1.md'),
    };
    await writeFile(ms, ms.filePath);
    await seedLinked(story(), 41, storyRemote);
    const state = await loadState(metaDir);
    if (!state.ok) throw state.error;
    state.value.entities.ms_1 = {
      bitbucket_milestone_name: 'v1.0',
      local_hash: 'x',
      remote_hash: 'x',
      synced_at: SYNCED_AT,
    };
    await saveState(metaDir, state.value);

    const result = await run();

    expect(result.ok).toBe(true);
    const after = await loadState(metaDir);
    expect(
      after.ok && after.value.entities.ms_1?.bitbucket_milestone_name,
    ).toBe('v1.0');
  });
});
