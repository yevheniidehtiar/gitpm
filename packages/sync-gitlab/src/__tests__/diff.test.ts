import type { Story } from '@gitpm/core';
import { describe, expect, it } from 'vitest';
import type { GlIssue, GlMilestone } from '../client.js';
import {
  diffByHash,
  remoteIssueFields,
  remoteMilestoneFields,
} from '../diff.js';
import { computeContentHash } from '../state.js';
import type { SyncStateEntry } from '../types.js';

describe('remoteIssueFields', () => {
  it('extracts fields from GitLab issue', () => {
    const gl: GlIssue = {
      id: 1,
      iid: 1,
      title: 'Test Issue',
      description: 'A test issue.',
      state: 'opened',
      assignee: { id: 42, username: 'alice' },
      labels: ['feature', 'epic'],
      milestone: null,
      weight: null,
      epic_iid: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const fields = remoteIssueFields(gl);
    expect(fields.title).toBe('Test Issue');
    expect(fields.status).toBe('todo');
    expect(fields.assignee).toBe('alice');
    // 'epic' label should be filtered out
    expect(fields.labels).toEqual(['feature']);
    expect(fields.body).toBe('A test issue.');
  });

  it('maps closed state to done', () => {
    const gl: GlIssue = {
      id: 1,
      iid: 1,
      title: 'Test',
      description: null,
      state: 'closed',
      assignee: null,
      labels: [],
      milestone: null,
      weight: null,
      epic_iid: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(remoteIssueFields(gl).status).toBe('done');
  });
});

describe('remoteMilestoneFields', () => {
  it('extracts fields from GitLab milestone', () => {
    const gl: GlMilestone = {
      id: 1,
      iid: 1,
      title: 'v1.0',
      description: 'First release',
      state: 'active',
      due_date: '2026-06-30',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const fields = remoteMilestoneFields(gl);
    expect(fields.title).toBe('v1.0');
    expect(fields.status).toBe('in_progress');
    expect(fields.target_date).toBe('2026-06-30');
    expect(fields.body).toBe('First release');
  });

  it('maps closed state to done', () => {
    const gl: GlMilestone = {
      id: 1,
      iid: 1,
      title: 'v1.0',
      description: null,
      state: 'closed',
      due_date: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(remoteMilestoneFields(gl).status).toBe('done');
  });
});

describe('diffByHash', () => {
  it('returns in_sync when hashes match', () => {
    const entry: SyncStateEntry = {
      local_hash: 'sha256:abc',
      remote_hash: 'sha256:xyz',
      synced_at: '2026-01-01T00:00:00Z',
    };
    expect(diffByHash('sha256:abc', 'sha256:xyz', entry)).toBe('in_sync');
  });

  it('returns local_changed when local hash differs', () => {
    const entry: SyncStateEntry = {
      local_hash: 'sha256:abc',
      remote_hash: 'sha256:xyz',
      synced_at: '2026-01-01T00:00:00Z',
    };
    expect(diffByHash('sha256:changed', 'sha256:xyz', entry)).toBe(
      'local_changed',
    );
  });

  it('returns remote_changed when remote hash differs', () => {
    const entry: SyncStateEntry = {
      local_hash: 'sha256:abc',
      remote_hash: 'sha256:xyz',
      synced_at: '2026-01-01T00:00:00Z',
    };
    expect(diffByHash('sha256:abc', 'sha256:changed', entry)).toBe(
      'remote_changed',
    );
  });

  it('returns both_changed when both hashes differ', () => {
    const entry: SyncStateEntry = {
      local_hash: 'sha256:abc',
      remote_hash: 'sha256:xyz',
      synced_at: '2026-01-01T00:00:00Z',
    };
    expect(diffByHash('sha256:new1', 'sha256:new2', entry)).toBe(
      'both_changed',
    );
  });
});

describe('computeContentHash', () => {
  it('produces deterministic hash for a story', () => {
    const story: Story = {
      type: 'story',
      id: 'test-id',
      title: 'Test Story',
      status: 'todo',
      priority: 'medium',
      assignee: 'alice',
      labels: ['feature'],
      estimate: null,
      epic_ref: null,
      body: 'A test story.',
      filePath: '.meta/stories/test-story.md',
    };

    const hash1 = computeContentHash(story);
    const hash2 = computeContentHash(story);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:/);
  });

  it('produces different hash when content changes', () => {
    const story1: Story = {
      type: 'story',
      id: 'test-id',
      title: 'Test Story',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: '.meta/stories/test.md',
    };

    const story2: Story = {
      ...story1,
      title: 'Different Story',
    };

    expect(computeContentHash(story1)).not.toBe(computeContentHash(story2));
  });
});
