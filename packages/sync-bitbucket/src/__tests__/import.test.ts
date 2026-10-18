import {
  writeFile as fsWriteFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Epic, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import importIssues from '../__fixtures__/import-issues.json';
import importMilestones from '../__fixtures__/import-milestones.json';
import type { BitbucketClient } from '../client.js';
import { createBitbucketClient } from '../client.js';
import { createDefaultConfig, loadConfig } from '../config.js';
import type { BitbucketImportOptions } from '../import.js';
import { importFromBitbucket } from '../import.js';
import { epicMarker } from '../mapper.js';
import { loadState, saveState } from '../state.js';
import type { BbIssue, BbMilestone } from '../types.js';

const fixtureIssues = importIssues as BbIssue[];
const fixtureMilestones = importMilestones as BbMilestone[];

let tmp: string;
let metaDir: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'gitpm-bb-import-'));
  metaDir = join(tmp, '.meta');
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(tmp, { recursive: true, force: true });
});

function fakeClient(
  issues: BbIssue[] = fixtureIssues,
  milestones: BbMilestone[] = fixtureMilestones,
): BitbucketClient {
  return {
    listIssues: vi.fn(async () => ({ ok: true as const, value: issues })),
    listMilestones: vi.fn(async () => ({
      ok: true as const,
      value: milestones,
    })),
  } as unknown as BitbucketClient;
}

function run(overrides: Partial<BitbucketImportOptions> = {}) {
  return importFromBitbucket({
    auth: { kind: 'bearer', token: 'tok' },
    workspace: 'acme',
    repoSlug: 'widgets',
    metaDir,
    client: fakeClient(),
    ...overrides,
  });
}

async function snapshot(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(dir, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files[path] = await readFile(path, 'utf-8');
  }
  return files;
}

async function tree() {
  const result = await parseTree(metaDir);
  if (!result.ok) throw result.error;
  return result.value;
}

function byTitle<T extends { title: string }>(items: T[], title: string): T {
  const found = items.find((item) => item.title === title);
  if (!found) throw new Error(`No entity titled ${title}`);
  return found;
}

function relPath(entity: { filePath: string }): string {
  return entity.filePath.slice(tmp.length + 1);
}

describe('importFromBitbucket', () => {
  it('writes milestones, epics, stories, roadmap, config and state', async () => {
    const result = await run();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toMatchObject({
      milestones: 2,
      epics: 2,
      stories: 4,
      totalFiles: 11,
    });
    expect(result.value.writtenPaths).toHaveLength(9);
    expect(result.value.writtenPaths).toContain('.meta/roadmap/roadmap.yaml');

    const t = await tree();
    expect(t.errors).toEqual([]);
    expect(t.milestones.map((m) => m.title).sort()).toEqual(['v1.0', 'v1.1']);
    expect(t.epics.map((e) => e.title).sort()).toEqual([
      'Payments',
      '[Epic] Checkout redesign',
    ]);
    expect(t.roadmaps[0].milestones).toHaveLength(2);

    const config = await loadConfig(metaDir);
    expect(config.ok && config.value.workspace).toBe('acme');
    const state = await loadState(metaDir);
    expect(state.ok).toBe(true);
    if (state.ok) {
      expect(Object.keys(state.value.entities)).toHaveLength(8);
    }
  });

  it('maps issue fields through the mapper', async () => {
    await run();
    const t = await tree();

    const epic = byTitle(t.epics, '[Epic] Checkout redesign');
    const v10 = byTitle(t.milestones, 'v1.0');
    expect(epic).toMatchObject({
      status: 'todo',
      priority: 'medium',
      owner: 'ada',
      labels: ['kind:task'],
      milestone_ref: { id: v10.id },
      body: 'Rebuild the checkout flow.',
      created_at: '2026-09-01T10:00:00.000Z',
      updated_at: '2026-09-02T10:00:00.000Z',
    });
    expect(relPath(epic)).toBe('.meta/epics/epic-checkout-redesign/epic.md');

    const refunds = byTitle(t.stories, 'Refunds API');
    expect(refunds).toMatchObject({
      status: 'todo',
      priority: 'low',
      assignee: 'Linus',
      labels: ['kind:task'],
      body: 'Expose refunds.',
    });

    const crash = t.stories.filter((s) => s.title === 'Crash on empty cart');
    expect(crash.map((s) => s.status).sort()).toEqual(['cancelled', 'done']);
  });

  it('links stories to epics by component and falls back from a dangling marker', async () => {
    await run();
    const t = await tree();
    const checkout = byTitle(t.epics, '[Epic] Checkout redesign');
    const payments = byTitle(t.epics, 'Payments');

    // Component shared with the epic issue itself.
    const card = byTitle(t.stories, 'Card form validation');
    expect(card.epic_ref).toEqual({ id: checkout.id });
    expect(relPath(card)).toBe(
      '.meta/epics/epic-checkout-redesign/stories/card-form-validation.md',
    );

    // Marker names an unknown epic; the component named after "Payments" wins.
    const refunds = byTitle(t.stories, 'Refunds API');
    expect(refunds.epic_ref).toEqual({ id: payments.id });
    expect(relPath(refunds)).toBe(
      '.meta/epics/payments/stories/refunds-api.md',
    );
  });

  it('suffixes the issue id when two stories share a slug', async () => {
    await run();
    const paths = (await tree()).stories.map(relPath).sort();
    expect(paths).toContain('.meta/stories/crash-on-empty-cart.md');
    expect(paths).toContain('.meta/stories/crash-on-empty-cart-6.md');
  });

  it('links by body marker to an existing local epic', async () => {
    const local: Epic = {
      type: 'epic',
      id: 'ep_local',
      title: 'Local epic',
      status: 'todo',
      priority: 'medium',
      owner: null,
      labels: [],
      milestone_ref: null,
      body: '',
      filePath: '.meta/epics/local-epic/epic.md',
    };
    await writeFile(local, join(metaDir, 'epics/local-epic/epic.md'));

    const issue: BbIssue = {
      ...fixtureIssues[2],
      id: 50,
      title: 'Marked story',
      content: { raw: `Body\n\n${epicMarker('ep_local')}` },
    };
    const result = await run({ client: fakeClient([issue], []) });
    expect(result.ok).toBe(true);

    const story = byTitle((await tree()).stories, 'Marked story');
    expect(story.epic_ref).toEqual({ id: 'ep_local' });
    expect(story.body).toBe('Body');
    expect(relPath(story)).toBe(
      '.meta/epics/local-epic/stories/marked-story.md',
    );
  });

  it('honours the epicLinkage override', async () => {
    await run({ epicLinkage: 'body-marker' });
    const t = await tree();
    // Without component linkage "Payments" is no longer an epic.
    expect(t.epics.map((e) => e.title)).toEqual(['[Epic] Checkout redesign']);
    expect(byTitle(t.stories, 'Card form validation').epic_ref).toBeNull();

    const config = await loadConfig(metaDir);
    expect(config.ok && config.value.epic_linkage).toBe('both');
  });

  it('keeps config mapping overrides', async () => {
    const config = createDefaultConfig('acme', 'widgets', {
      status_mapping: { new: 'backlog' },
    });
    if (!config.ok) throw config.error;
    await run({ config: config.value });

    const card = byTitle((await tree()).stories, 'Card form validation');
    expect(card.status).toBe('backlog');
    const saved = await loadConfig(metaDir);
    expect(saved.ok && saved.value.status_mapping).toEqual({ new: 'backlog' });
  });

  it('is idempotent: a second import changes no file', async () => {
    const first = await run();
    expect(first.ok).toBe(true);
    const before = await snapshot(metaDir);

    const second = await run();
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.writtenPaths).toEqual([]);
      expect(second.value.stories).toBe(4);
    }
    expect(await snapshot(metaDir)).toEqual(before);
  });

  it('updates changed issues in place and keeps local-only fields', async () => {
    await run();
    const card = byTitle((await tree()).stories, 'Card form validation');
    await writeFile(
      { ...card, estimate: 5, labels: ['frontend', 'kind:enhancement'] },
      card.filePath,
    );

    const changed = fixtureIssues.map((issue) =>
      issue.id === 3
        ? {
            ...issue,
            state: 'resolved' as const,
            kind: 'bug' as const,
            updated_on: '2026-09-10T10:00:00.000000+00:00',
          }
        : issue,
    );
    const result = await run({ client: fakeClient(changed) });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.writtenPaths).toEqual([relPath(card)]);
    }

    const updated = byTitle((await tree()).stories, 'Card form validation');
    expect(updated).toMatchObject({
      id: card.id,
      status: 'done',
      estimate: 5,
      labels: ['frontend', 'kind:bug'],
      updated_at: '2026-09-10T10:00:00.000Z',
      created_at: card.created_at,
    });
  });

  it('appends new milestones to an existing roadmap', async () => {
    await run({ client: fakeClient(fixtureIssues, [fixtureMilestones[0]]) });
    const roadmapId = (await tree()).roadmaps[0].id;

    await run();
    const roadmap = (await tree()).roadmaps[0];
    expect(roadmap.id).toBe(roadmapId);
    expect(roadmap.milestones).toHaveLength(2);
  });

  it('ignores sync state that belongs to another repository', async () => {
    await saveState(metaDir, {
      workspace: 'other',
      repo_slug: 'repo',
      last_sync: '2026-01-01T00:00:00.000Z',
      entities: {
        foreign: {
          bitbucket_issue_id: 3,
          local_hash: 'x',
          remote_hash: 'x',
          synced_at: '2026-01-01T00:00:00.000Z',
        },
      },
    });
    await run();

    const card = byTitle((await tree()).stories, 'Card form validation');
    expect(card.id).not.toBe('foreign');
    const state = await loadState(metaDir);
    expect(state.ok && state.value.workspace).toBe('acme');
  });

  it('fails on an invalid state file', async () => {
    await mkdir(join(metaDir, 'sync'), { recursive: true });
    await fsWriteFile(
      join(metaDir, 'sync', 'bitbucket-state.json'),
      '{"workspace": 1}',
    );
    const result = await run();
    expect(result.ok).toBe(false);
  });

  it('returns API errors as a failed result', async () => {
    const client = {
      ...fakeClient(),
      listIssues: vi.fn(async () => ({
        ok: false as const,
        error: { status: 404, message: 'Repository not found' },
      })),
    } as unknown as BitbucketClient;
    const result = await run({ client });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Repository not found');
  });

  it('imports a large repository across many pages', async () => {
    const total = 230;
    const pageLen = 50;
    const issues: BbIssue[] = Array.from({ length: total }, (_, i) => ({
      ...fixtureIssues[4],
      id: i + 1,
      title: `Issue ${i + 1}`,
      content: { raw: `Body ${i + 1}` },
    }));
    const base = 'https://api.bitbucket.org/2.0/repositories/acme/widgets';
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const body = parsed.pathname.endsWith('/milestones')
        ? { values: fixtureMilestones }
        : (() => {
            const page = Number(parsed.searchParams.get('page') ?? '1');
            const values = issues.slice((page - 1) * pageLen, page * pageLen);
            const next =
              page * pageLen < total
                ? `${base}/issues?pagelen=${pageLen}&page=${page + 1}`
                : undefined;
            return { values, next };
          })();
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createBitbucketClient({
      auth: { kind: 'bearer', token: 'tok' },
    });
    const result = await run({ client });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stories).toBe(total);
    // 1 milestones request + 5 issue pages.
    expect(fetchMock).toHaveBeenCalledTimes(6);

    const stories: Story[] = (await tree()).stories;
    expect(stories).toHaveLength(total);
    expect(new Set(stories.map((s) => s.id)).size).toBe(total);

    const again = await run({ client });
    expect(again.ok && again.value.writtenPaths).toEqual([]);
  });
});
