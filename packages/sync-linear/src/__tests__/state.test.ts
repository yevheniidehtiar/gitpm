import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Epic, Story } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeContentHash,
  createInitialState,
  loadState,
  saveState,
} from '../state.js';

const TEST_DIR = join(import.meta.dirname, '__tmp_state_test__');
const META_DIR = join(TEST_DIR, '.meta');

beforeEach(() => {
  mkdirSync(join(META_DIR, 'sync'), { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
});

const sampleStory: Story = {
  type: 'story',
  id: 'story-1',
  title: 'Test Story',
  status: 'todo',
  priority: 'medium',
  assignee: 'Alice',
  labels: ['backend'],
  estimate: null,
  epic_ref: null,
  body: 'Story body',
  filePath: '.meta/stories/test-story.md',
  linear: {
    issue_id: 'issue-1',
    identifier: 'ENG-1',
    team_id: 'team-1',
    last_sync_hash: '',
    synced_at: '2026-01-01T00:00:00Z',
  },
};

const sampleEpic: Epic = {
  type: 'epic',
  id: 'epic-1',
  title: 'Test Epic',
  status: 'in_progress',
  priority: 'high',
  owner: 'Bob',
  labels: ['feature'],
  milestone_ref: null,
  body: 'Epic body',
  filePath: '.meta/epics/test-epic/epic.md',
  linear: {
    issue_id: 'issue-2',
    identifier: 'ENG-2',
    team_id: 'team-1',
    last_sync_hash: '',
    synced_at: '2026-01-01T00:00:00Z',
  },
};

describe('computeContentHash', () => {
  it('produces a sha256 hash string', () => {
    const hash = computeContentHash(sampleStory);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('produces different hashes for different entities', () => {
    const hashA = computeContentHash(sampleStory);
    const hashB = computeContentHash(sampleEpic);
    expect(hashA).not.toBe(hashB);
  });

  it('is deterministic', () => {
    const hash1 = computeContentHash(sampleStory);
    const hash2 = computeContentHash(sampleStory);
    expect(hash1).toBe(hash2);
  });

  it('ignores metadata fields like filePath and synced_at', () => {
    const modified = {
      ...sampleStory,
      filePath: '.meta/stories/different-path.md',
      linear: {
        issue_id: 'issue-1',
        identifier: 'ENG-1',
        team_id: 'team-1',
        last_sync_hash: '',
        synced_at: '2099-12-31T00:00:00Z',
      },
    };
    expect(computeContentHash(modified)).toBe(computeContentHash(sampleStory));
  });

  it('changes when semantic fields change', () => {
    const modified = { ...sampleStory, title: 'Different Title' };
    expect(computeContentHash(modified)).not.toBe(
      computeContentHash(sampleStory),
    );
  });
});

describe('createInitialState', () => {
  it('creates state with entries for all entities', () => {
    const state = createInitialState('team-1', [sampleStory, sampleEpic]);
    expect(state.team_id).toBe('team-1');
    expect(Object.keys(state.entities)).toHaveLength(2);
    expect(state.entities['story-1'].linear_issue_id).toBe('issue-1');
    expect(state.entities['epic-1'].linear_issue_id).toBe('issue-2');
  });

  it('skips roadmap entities', () => {
    const roadmap = {
      type: 'roadmap' as const,
      id: 'roadmap-1',
      title: 'Roadmap',
      description: '',
      milestones: [],
      updated_at: '2026-01-01T00:00:00Z',
      filePath: '.meta/roadmap/roadmap.yaml',
    };
    const state = createInitialState('team-1', [roadmap, sampleStory]);
    expect(Object.keys(state.entities)).toHaveLength(1);
  });
});

describe('computeContentHash — entity types', () => {
  it('hashes PRD entities using status and body', () => {
    const prd = {
      type: 'prd' as const,
      id: 'prd-1',
      title: 'Feature',
      status: 'draft' as const,
      body: '  multiline\n  doc\n  ',
      filePath: '.meta/prds/feature.md',
    };
    const hash = computeContentHash(prd);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('hashes milestones using target_date', () => {
    const ms = {
      type: 'milestone' as const,
      id: 'ms-1',
      title: 'Q2',
      status: 'in_progress' as const,
      target_date: '2026-06-30T00:00:00Z',
      body: 'Ship it',
      filePath: '.meta/roadmap/milestones/q2.md',
    };
    const hash = computeContentHash(ms);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('preserves cycle_id on milestone entries in createInitialState', () => {
    const ms = {
      type: 'milestone' as const,
      id: 'ms-2',
      title: 'Cycle A',
      status: 'in_progress' as const,
      body: '',
      filePath: '.meta/roadmap/milestones/cycle-a.md',
      linear: {
        cycle_id: 'cycle-7',
        team_id: 'team-1',
        last_sync_hash: '',
        synced_at: '2026-01-01T00:00:00Z',
      },
    };
    const state = createInitialState('team-1', [ms]);
    expect(state.entities['ms-2'].linear_cycle_id).toBe('cycle-7');
  });
});

describe('saveState error handling', () => {
  it('returns an error result when the target path cannot be written', async () => {
    const filePath = join(TEST_DIR, 'blocker');
    mkdirSync(TEST_DIR, { recursive: true });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(filePath, 'x');
    const pseudoMeta = join(filePath, 'nested');

    const result = await saveState(pseudoMeta, {
      team_id: 'team-1',
      last_sync: new Date().toISOString(),
      entities: {},
    });
    expect(result.ok).toBe(false);
  });
});

describe('saveState and loadState', () => {
  it('round-trips state to JSON', async () => {
    const state = createInitialState('team-1', [sampleStory]);
    const saveResult = await saveState(META_DIR, state);
    expect(saveResult.ok).toBe(true);

    const loadResult = await loadState(META_DIR);
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.value.team_id).toBe('team-1');
      expect(Object.keys(loadResult.value.entities)).toHaveLength(1);
    }
  });

  it('returns error when state does not exist', async () => {
    const result = await loadState(join(TEST_DIR, 'nonexistent'));
    expect(result.ok).toBe(false);
  });
});
