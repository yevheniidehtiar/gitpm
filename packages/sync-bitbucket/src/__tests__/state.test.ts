import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Epic, Milestone, ParsedEntity, Story } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeContentHash,
  createInitialState,
  loadState,
  saveState,
} from '../state.js';

let metaDir: string;

beforeEach(async () => {
  metaDir = await mkdtemp(join(tmpdir(), 'gitpm-bb-state-'));
});

afterEach(async () => {
  await rm(metaDir, { recursive: true, force: true });
});

const story: Story = {
  type: 'story',
  id: 'story-1',
  title: 'Fix login',
  status: 'todo',
  priority: 'medium',
  assignee: null,
  labels: ['b', 'a'],
  estimate: null,
  epic_ref: { id: 'ep-1' },
  body: 'Body',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  filePath: '.meta/stories/fix-login.md',
};

const epic: Epic = {
  type: 'epic',
  id: 'ep-1',
  title: 'Checkout',
  status: 'todo',
  priority: 'high',
  owner: 'ada',
  labels: [],
  milestone_ref: null,
  body: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  filePath: '.meta/epics/checkout/epic.md',
};

const milestone: Milestone = {
  type: 'milestone',
  id: 'ms-1',
  title: 'v1',
  status: 'in_progress',
  body: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  filePath: '.meta/roadmap/milestones/v1.md',
};

describe('computeContentHash', () => {
  it('is stable across label order and trailing whitespace', () => {
    const a = computeContentHash(story);
    const b = computeContentHash({
      ...story,
      labels: ['a', 'b'],
      body: 'Body  \r\n',
    });
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });

  it('changes when a synced field changes', () => {
    const base = computeContentHash(story);
    expect(computeContentHash({ ...story, status: 'done' })).not.toBe(base);
    expect(computeContentHash({ ...story, epic_ref: null })).not.toBe(base);
    expect(computeContentHash({ ...epic, owner: null })).not.toBe(
      computeContentHash(epic),
    );
    expect(
      computeContentHash({ ...milestone, target_date: '2026-12-01' }),
    ).not.toBe(computeContentHash(milestone));
  });
});

describe('createInitialState', () => {
  it('records hashes and remote ids, skipping roadmaps', () => {
    const roadmap = {
      type: 'roadmap',
      id: 'rm',
      title: 'Roadmap',
      milestones: [],
      updated_at: '2026-01-01T00:00:00Z',
      filePath: '.meta/roadmap/roadmap.yaml',
    } as unknown as ParsedEntity;
    const state = createInitialState(
      'acme',
      'web',
      [story, epic, milestone, roadmap],
      { 'story-1': { issueId: 7 }, 'ms-1': { milestoneName: 'v1' } },
    );
    expect(state.workspace).toBe('acme');
    expect(state.repo_slug).toBe('web');
    expect(Object.keys(state.entities).sort()).toEqual([
      'ep-1',
      'ms-1',
      'story-1',
    ]);
    expect(state.entities['story-1'].bitbucket_issue_id).toBe(7);
    expect(state.entities['ms-1'].bitbucket_milestone_name).toBe('v1');
    expect(state.entities['ep-1'].bitbucket_issue_id).toBeUndefined();
    expect(state.entities['story-1'].local_hash).toBe(
      computeContentHash(story),
    );
  });
});

describe('loadState / saveState', () => {
  it('round-trips', async () => {
    const state = createInitialState('acme', 'web', [story], {
      'story-1': { issueId: 7 },
    });
    expect((await saveState(metaDir, state)).ok).toBe(true);
    const loaded = await loadState(metaDir);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value).toEqual(state);
  });

  it('fails when missing', async () => {
    expect((await loadState(metaDir)).ok).toBe(false);
  });

  it('fails on an invalid shape', async () => {
    await mkdir(join(metaDir, 'sync'), { recursive: true });
    await writeFile(
      join(metaDir, 'sync', 'bitbucket-state.json'),
      JSON.stringify({ workspace: 'acme' }),
    );
    const loaded = await loadState(metaDir);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.message).toContain('Invalid Bitbucket sync state');
  });
});
