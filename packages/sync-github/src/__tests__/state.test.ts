import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Epic, Milestone, Story } from '@gitpm/core';
import { writeFile } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeContentHash,
  createInitialState,
  loadState,
  reconstructState,
  saveState,
} from '../state.js';

const makeStory = (overrides?: Partial<Story>): Story => ({
  type: 'story',
  id: 'test-story-01',
  title: 'Test Story',
  status: 'todo',
  priority: 'medium',
  assignee: null,
  labels: ['backend'],
  estimate: null,
  epic_ref: null,
  github: null,
  body: 'Story body content.',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  filePath: '.meta/stories/test-story.md',
  ...overrides,
});

const makeEpic = (overrides?: Partial<Epic>): Epic => ({
  type: 'epic',
  id: 'test-epic-001',
  title: 'Test Epic',
  status: 'in_progress',
  priority: 'high',
  owner: 'alice',
  labels: ['frontend'],
  milestone_ref: null,
  github: null,
  body: 'Epic body content.',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  filePath: '.meta/epics/test-epic/epic.md',
  ...overrides,
});

const makeMilestone = (overrides?: Partial<Milestone>): Milestone => ({
  type: 'milestone',
  id: 'test-ms-0001',
  title: 'Q2 Launch',
  status: 'in_progress',
  target_date: '2026-06-30T00:00:00Z',
  github: null,
  body: 'Milestone body.',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  filePath: '.meta/roadmap/milestones/q2-launch.md',
  ...overrides,
});

describe('computeContentHash', () => {
  it('produces consistent hash for same content', () => {
    const story = makeStory();
    const hash1 = computeContentHash(story);
    const hash2 = computeContentHash(story);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('changes hash when title changes', () => {
    const story1 = makeStory({ title: 'Title A' });
    const story2 = makeStory({ title: 'Title B' });
    expect(computeContentHash(story1)).not.toBe(computeContentHash(story2));
  });

  it('changes hash when status changes', () => {
    const story1 = makeStory({ status: 'todo' });
    const story2 = makeStory({ status: 'done' });
    expect(computeContentHash(story1)).not.toBe(computeContentHash(story2));
  });

  it('changes hash when body changes', () => {
    const story1 = makeStory({ body: 'Body A' });
    const story2 = makeStory({ body: 'Body B' });
    expect(computeContentHash(story1)).not.toBe(computeContentHash(story2));
  });

  it('changes hash when labels change', () => {
    const story1 = makeStory({ labels: ['a', 'b'] });
    const story2 = makeStory({ labels: ['a', 'c'] });
    expect(computeContentHash(story1)).not.toBe(computeContentHash(story2));
  });

  it('produces same hash regardless of label order', () => {
    const story1 = makeStory({ labels: ['a', 'b'] });
    const story2 = makeStory({ labels: ['b', 'a'] });
    expect(computeContentHash(story1)).toBe(computeContentHash(story2));
  });

  it('ignores metadata fields (filePath, created_at, updated_at)', () => {
    const story1 = makeStory({
      filePath: '/path/a.md',
      created_at: '2026-01-01T00:00:00Z',
    });
    const story2 = makeStory({
      filePath: '/path/b.md',
      created_at: '2026-12-31T23:59:59Z',
    });
    expect(computeContentHash(story1)).toBe(computeContentHash(story2));
  });

  it('normalizes whitespace in body', () => {
    const story1 = makeStory({ body: 'Hello  \nworld' });
    const story2 = makeStory({ body: 'Hello\nworld' });
    expect(computeContentHash(story1)).toBe(computeContentHash(story2));
  });

  it('works for epics', () => {
    const epic = makeEpic();
    const hash = computeContentHash(epic);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('works for milestones', () => {
    const ms = makeMilestone();
    const hash = computeContentHash(ms);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

describe('createInitialState', () => {
  it('creates state with entries for all non-roadmap entities', () => {
    const story = makeStory({
      github: {
        issue_number: 3,
        repo: 'org/repo',
        last_sync_hash: '',
        synced_at: '',
      },
    });
    const epic = makeEpic({
      github: {
        issue_number: 1,
        repo: 'org/repo',
        last_sync_hash: '',
        synced_at: '',
      },
    });
    const ms = makeMilestone({
      github: {
        milestone_id: 1,
        repo: 'org/repo',
        last_sync_hash: '',
        synced_at: '',
      },
    });

    const state = createInitialState('org/repo', [story, epic, ms], 5);

    expect(state.repo).toBe('org/repo');
    expect(state.project_number).toBe(5);
    expect(Object.keys(state.entities)).toHaveLength(3);
    expect(state.entities['test-story-01']).toBeDefined();
    expect(state.entities['test-story-01'].github_issue_number).toBe(3);
    expect(state.entities['test-epic-001']).toBeDefined();
    expect(state.entities['test-epic-001'].github_issue_number).toBe(1);
    expect(state.entities['test-ms-0001']).toBeDefined();
    expect(state.entities['test-ms-0001'].github_milestone_number).toBe(1);
  });

  it('hashes match between local and remote for freshly imported', () => {
    const story = makeStory();
    const state = createInitialState('org/repo', [story]);
    const entry = state.entities['test-story-01'];
    expect(entry.local_hash).toBe(entry.remote_hash);
    expect(entry.local_hash).toMatch(/^sha256:/);
  });
});

describe('saveState / loadState', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-state-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('round-trips state through save and load', async () => {
    const state = createInitialState('org/repo', [makeStory(), makeEpic()], 5);

    const saveResult = await saveState(tmpDir, state);
    expect(saveResult.ok).toBe(true);

    const loadResult = await loadState(tmpDir);
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.value.repo).toBe('org/repo');
      expect(loadResult.value.project_number).toBe(5);
      expect(Object.keys(loadResult.value.entities)).toHaveLength(2);
    }
  });

  it('returns empty state when JSON missing and no entities exist', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'gitpm-empty-'));
    try {
      const result = await loadState(emptyDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.repo).toBe('');
        expect(Object.keys(result.value.entities)).toHaveLength(0);
      }
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});

describe('reconstructState', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-reconstruct-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('builds correct entries from entity frontmatter', async () => {
    const story: Story = {
      type: 'story',
      id: 'story-abc',
      title: 'A synced story',
      status: 'in_progress',
      priority: 'high',
      assignee: null,
      labels: ['bug'],
      estimate: null,
      epic_ref: null,
      github: {
        issue_number: 42,
        repo: 'owner/repo',
        last_sync_hash: 'sha256:aaa111',
        synced_at: '2026-03-01T00:00:00Z',
      },
      body: 'Some body.',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      filePath: join(tmpDir, 'stories', 'story-abc.md'),
    };

    const epic: Epic = {
      type: 'epic',
      id: 'epic-xyz',
      title: 'A synced epic',
      status: 'todo',
      priority: 'medium',
      owner: null,
      labels: [],
      milestone_ref: null,
      github: {
        issue_number: 10,
        project_item_id: 'PVTI_123',
        repo: 'owner/repo',
        last_sync_hash: 'sha256:bbb222',
        synced_at: '2026-03-02T00:00:00Z',
      },
      body: 'Epic body.',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      filePath: join(tmpDir, 'epics', 'epic-xyz', 'epic.md'),
    };

    const milestone: Milestone = {
      type: 'milestone',
      id: 'ms-001',
      title: 'Q3 Release',
      status: 'in_progress',
      target_date: '2026-09-30',
      github: {
        milestone_id: 5,
        repo: 'owner/repo',
        last_sync_hash: 'sha256:ccc333',
        synced_at: '2026-03-03T00:00:00Z',
      },
      body: 'Milestone body.',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      filePath: join(tmpDir, 'roadmap', 'milestones', 'ms-001.md'),
    };

    await writeFile(story, story.filePath);
    await writeFile(epic, epic.filePath);
    await writeFile(milestone, milestone.filePath);

    const result = await reconstructState(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const state = result.value;
    expect(state.repo).toBe('owner/repo');
    expect(Object.keys(state.entities)).toHaveLength(3);

    // Story entry
    const storyEntry = state.entities['story-abc'];
    expect(storyEntry).toBeDefined();
    expect(storyEntry.local_hash).toBe('sha256:aaa111');
    expect(storyEntry.remote_hash).toBe('sha256:aaa111');
    expect(storyEntry.github_issue_number).toBe(42);
    // YAML round-trip may normalize ISO timestamps (e.g. adding .000Z)
    expect(new Date(storyEntry.synced_at).toISOString()).toBe(
      new Date('2026-03-01T00:00:00Z').toISOString(),
    );

    // Epic entry
    const epicEntry = state.entities['epic-xyz'];
    expect(epicEntry).toBeDefined();
    expect(epicEntry.local_hash).toBe('sha256:bbb222');
    expect(epicEntry.remote_hash).toBe('sha256:bbb222');
    expect(epicEntry.github_issue_number).toBe(10);
    expect(epicEntry.github_project_item_id).toBe('PVTI_123');

    // Milestone entry
    const msEntry = state.entities['ms-001'];
    expect(msEntry).toBeDefined();
    expect(msEntry.local_hash).toBe('sha256:ccc333');
    expect(msEntry.remote_hash).toBe('sha256:ccc333');
    expect(msEntry.github_milestone_number).toBe(5);
  });

  it('loadState returns reconstructed state when JSON missing but entities have github metadata', async () => {
    const story: Story = {
      type: 'story',
      id: 'recon-story',
      title: 'Reconstructed story',
      status: 'done',
      priority: 'low',
      assignee: 'bob',
      labels: [],
      estimate: null,
      epic_ref: null,
      github: {
        issue_number: 99,
        repo: 'test/repo',
        last_sync_hash: 'sha256:ddd444',
        synced_at: '2026-04-01T00:00:00Z',
      },
      body: 'Body text.',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      filePath: join(tmpDir, 'stories', 'recon-story.md'),
    };

    await writeFile(story, story.filePath);

    // loadState should reconstruct since github-state.json doesn't exist
    const result = await loadState(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.repo).toBe('test/repo');
    expect(result.value.entities['recon-story']).toBeDefined();
    expect(result.value.entities['recon-story'].github_issue_number).toBe(99);
    expect(result.value.entities['recon-story'].local_hash).toBe(
      'sha256:ddd444',
    );
  });

  it('returns empty state when entities have no github metadata', async () => {
    const story: Story = {
      type: 'story',
      id: 'no-gh-story',
      title: 'No github metadata',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      github: null,
      body: 'Body.',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      filePath: join(tmpDir, 'stories', 'no-gh-story.md'),
    };

    await writeFile(story, story.filePath);

    const result = await reconstructState(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.repo).toBe('');
    expect(Object.keys(result.value.entities)).toHaveLength(0);
  });

  it('persists reconstructed state as github-state.json', async () => {
    const story: Story = {
      type: 'story',
      id: 'persist-story',
      title: 'Persisted story',
      status: 'todo',
      priority: 'high',
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      github: {
        issue_number: 7,
        repo: 'org/proj',
        last_sync_hash: 'sha256:eee555',
        synced_at: '2026-02-01T00:00:00Z',
      },
      body: '',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      filePath: join(tmpDir, 'stories', 'persist-story.md'),
    };

    await writeFile(story, story.filePath);
    await reconstructState(tmpDir);

    // Second call should load from the persisted JSON file
    const result = await loadState(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.repo).toBe('org/proj');
    expect(result.value.entities['persist-story']).toBeDefined();
  });
});
