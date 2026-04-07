import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Milestone, Story } from '@gitpm/core';
import { describe, expect, it } from 'vitest';
import { createInitialState, loadState, saveState } from '../state.js';

describe('saveState / loadState', () => {
  it('round-trips sync state through JSON file', async () => {
    const metaDir = await mkdtemp(join(tmpdir(), 'gitpm-state-'));
    try {
      const state = {
        project: 'ns/proj',
        project_id: 42,
        last_sync: '2026-01-01T00:00:00Z',
        entities: {
          ent1: {
            gitlab_issue_iid: 1,
            local_hash: 'sha256:abc',
            remote_hash: 'sha256:abc',
            synced_at: '2026-01-01T00:00:00Z',
          },
        },
      };

      const saveResult = await saveState(metaDir, state);
      expect(saveResult.ok).toBe(true);

      const loadResult = await loadState(metaDir);
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok) {
        expect(loadResult.value.project).toBe('ns/proj');
        expect(loadResult.value.entities.ent1.gitlab_issue_iid).toBe(1);
      }
    } finally {
      await rm(metaDir, { recursive: true });
    }
  });

  it('returns error when state file does not exist', async () => {
    const metaDir = await mkdtemp(join(tmpdir(), 'gitpm-state-'));
    try {
      const result = await loadState(metaDir);
      expect(result.ok).toBe(false);
    } finally {
      await rm(metaDir, { recursive: true });
    }
  });
});

describe('createInitialState', () => {
  it('creates state with correct entries', () => {
    const story: Story = {
      type: 'story',
      id: 'story-1',
      title: 'Test Story',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      gitlab: {
        issue_iid: 5,
        project_id: 42,
        base_url: 'https://gitlab.com',
        last_sync_hash: 'sha256:abc',
        synced_at: '2026-01-01T00:00:00Z',
      },
      body: '',
      filePath: '.meta/stories/test-story.md',
    };

    const milestone: Milestone = {
      type: 'milestone',
      id: 'ms-1',
      title: 'v1.0',
      status: 'in_progress',
      gitlab: {
        milestone_id: 101,
        project_id: 42,
        base_url: 'https://gitlab.com',
        last_sync_hash: 'sha256:def',
        synced_at: '2026-01-01T00:00:00Z',
      },
      body: '',
      filePath: '.meta/roadmap/milestones/v10.md',
    };

    const state = createInitialState('ns/proj', [story, milestone], 42);
    expect(state.project).toBe('ns/proj');
    expect(state.project_id).toBe(42);
    expect(state.entities['story-1']).toBeDefined();
    expect(state.entities['story-1'].gitlab_issue_iid).toBe(5);
    expect(state.entities['ms-1']).toBeDefined();
    expect(state.entities['ms-1'].gitlab_milestone_id).toBe(101);
  });
});
