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
  jira: {
    issue_key: 'TEST-1',
    project_key: 'TEST',
    site: 'test.atlassian.net',
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
  jira: {
    issue_key: 'TEST-2',
    project_key: 'TEST',
    site: 'test.atlassian.net',
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
      jira: {
        issue_key: 'TEST-1',
        project_key: 'TEST',
        site: 'test.atlassian.net',
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
    const state = createInitialState('test.atlassian.net', 'TEST', [
      sampleStory,
      sampleEpic,
    ]);
    expect(state.site).toBe('test.atlassian.net');
    expect(state.project_key).toBe('TEST');
    expect(Object.keys(state.entities)).toHaveLength(2);
    expect(state.entities['story-1'].jira_issue_key).toBe('TEST-1');
    expect(state.entities['epic-1'].jira_issue_key).toBe('TEST-2');
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
    const state = createInitialState('test.atlassian.net', 'TEST', [
      roadmap,
      sampleStory,
    ]);
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

  it('preserves sprint_id on milestone entries in createInitialState', () => {
    const ms = {
      type: 'milestone' as const,
      id: 'ms-2',
      title: 'Sprint A',
      status: 'in_progress' as const,
      body: '',
      filePath: '.meta/roadmap/milestones/sprint-a.md',
      jira: {
        sprint_id: 7,
        project_key: 'TEST',
        site: 'test.atlassian.net',
        last_sync_hash: '',
        synced_at: '2026-01-01T00:00:00Z',
      },
    };
    const state = createInitialState('test.atlassian.net', 'TEST', [ms]);
    expect(state.entities['ms-2'].jira_sprint_id).toBe(7);
  });
});

describe('saveState error handling', () => {
  it('returns an error result when the target path cannot be written', async () => {
    // Attempting to save beneath a file (as if the path segment were a dir)
    // should fail, triggering the error branch.
    const filePath = join(TEST_DIR, 'blocker');
    mkdirSync(TEST_DIR, { recursive: true });
    // Write a file named "blocker" so we can't mkdir under it
    const { writeFileSync } = await import('node:fs');
    writeFileSync(filePath, 'x');
    const pseudoMeta = join(filePath, 'nested');

    const result = await saveState(pseudoMeta, {
      site: 's',
      project_key: 'p',
      last_sync: new Date().toISOString(),
      entities: {},
    });
    expect(result.ok).toBe(false);
  });
});

describe('saveState and loadState', () => {
  it('round-trips state to JSON', async () => {
    const state = createInitialState('test.atlassian.net', 'TEST', [
      sampleStory,
    ]);
    const saveResult = await saveState(META_DIR, state);
    expect(saveResult.ok).toBe(true);

    const loadResult = await loadState(META_DIR);
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.value.site).toBe('test.atlassian.net');
      expect(loadResult.value.project_key).toBe('TEST');
      expect(Object.keys(loadResult.value.entities)).toHaveLength(1);
    }
  });

  it('returns error when state does not exist', async () => {
    const result = await loadState(join(TEST_DIR, 'nonexistent'));
    expect(result.ok).toBe(false);
  });
});
