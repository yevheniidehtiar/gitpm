import type { Epic, Milestone, Prd, Story } from '@gitpm/core';
import { describe, expect, it } from 'vitest';
import type { GlIssue, GlMilestone } from '../client.js';
import {
  diffByHash,
  diffEntity,
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

function makeStory(overrides?: Partial<Story>): Story {
  return {
    type: 'story',
    id: 's1',
    title: 'Story',
    status: 'todo',
    priority: 'medium',
    assignee: null,
    labels: [],
    estimate: null,
    epic_ref: null,
    body: '',
    filePath: '.meta/stories/s1.md',
    ...overrides,
  } as Story;
}

function makeEpic(overrides?: Partial<Epic>): Epic {
  return {
    type: 'epic',
    id: 'e1',
    title: 'Epic',
    status: 'todo',
    priority: 'medium',
    owner: null,
    labels: [],
    milestone_ref: null,
    body: '',
    filePath: '.meta/epics/e1/epic.md',
    ...overrides,
  } as Epic;
}

function makeMilestone(overrides?: Partial<Milestone>): Milestone {
  return {
    type: 'milestone',
    id: 'm1',
    title: 'Milestone',
    status: 'in_progress',
    body: '',
    filePath: '.meta/roadmap/milestones/m1.md',
    ...overrides,
  } as Milestone;
}

describe('diffEntity', () => {
  it('detects in_sync when nothing changed', () => {
    const story = makeStory({ title: 'Base', body: 'hi' });
    const baseline = {
      title: 'Base',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: 'hi',
    };
    const remote = { ...baseline };
    const result = diffEntity(story, remote, baseline, baseline);
    expect(result.status).toBe('in_sync');
    expect(result.conflicts).toEqual([]);
    expect(result.localChanges).toEqual([]);
    expect(result.remoteChanges).toEqual([]);
  });

  it('detects local_changed only', () => {
    const story = makeStory({ title: 'Changed', body: 'hi' });
    const baselineLocal = {
      title: 'Base',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: 'hi',
    };
    const baselineRemote = { ...baselineLocal };
    const result = diffEntity(
      story,
      baselineRemote,
      baselineLocal,
      baselineRemote,
    );
    expect(result.status).toBe('local_changed');
    expect(result.localChanges.some((c) => c.field === 'title')).toBe(true);
  });

  it('detects remote_changed only', () => {
    const story = makeStory({ title: 'Base' });
    const baselineLocal = {
      title: 'Base',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: '',
    };
    const newRemote = { ...baselineLocal, title: 'Remote Changed' };
    const result = diffEntity(story, newRemote, baselineLocal, baselineLocal);
    expect(result.status).toBe('remote_changed');
    expect(result.remoteChanges.some((c) => c.field === 'title')).toBe(true);
  });

  it('detects conflict when local and remote change same field to different values', () => {
    const story = makeStory({ title: 'Local New' });
    const baselineLocal = {
      title: 'Base',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: '',
    };
    const newRemote = { ...baselineLocal, title: 'Remote New' };
    const result = diffEntity(story, newRemote, baselineLocal, baselineLocal);
    expect(result.status).toBe('conflict');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].field).toBe('title');
    expect(result.conflicts[0].localValue).toBe('Local New');
    expect(result.conflicts[0].remoteValue).toBe('Remote New');
  });

  it('does not conflict when both sides change same field to same value', () => {
    const story = makeStory({ title: 'Same New' });
    const baselineLocal = {
      title: 'Base',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: '',
    };
    const newRemote = { ...baselineLocal, title: 'Same New' };
    const result = diffEntity(story, newRemote, baselineLocal, baselineLocal);
    // fields changed, but to same value → no conflict, both show as changes
    expect(result.conflicts).toHaveLength(0);
  });

  it('handles epic entities', () => {
    const epic = makeEpic({ owner: 'alice' });
    const baselineLocal = {
      title: 'Epic',
      status: 'todo',
      priority: 'medium',
      owner: null,
      labels: [],
      body: '',
    };
    const result = diffEntity(
      epic,
      baselineLocal,
      baselineLocal,
      baselineLocal,
    );
    expect(result.status).toBe('local_changed');
    expect(result.localChanges.some((c) => c.field === 'owner')).toBe(true);
  });

  it('handles milestone entities', () => {
    const ms = makeMilestone({ target_date: '2026-06-30' });
    const baselineLocal = {
      title: 'Milestone',
      status: 'in_progress',
      target_date: null,
      body: '',
    };
    const result = diffEntity(ms, baselineLocal, baselineLocal, baselineLocal);
    expect(result.status).toBe('local_changed');
    expect(result.localChanges.some((c) => c.field === 'target_date')).toBe(
      true,
    );
  });

  it('falls through to title-only for non-story/epic/milestone entities', () => {
    const prd: Prd = {
      type: 'prd',
      id: 'p1',
      title: 'Prd',
      status: 'in_progress',
      body: '',
      filePath: '.meta/prds/p1.md',
    } as Prd;
    const baseline = { title: 'Prd' };
    const result = diffEntity(prd, baseline, baseline, baseline);
    expect(result.status).toBe('in_sync');
  });

  it('treats equal trimmed strings as equal (whitespace tolerance)', () => {
    const story = makeStory({ body: '  hello  ' });
    const baselineLocal = {
      title: 'Story',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: 'hello',
    };
    const result = diffEntity(
      story,
      baselineLocal,
      baselineLocal,
      baselineLocal,
    );
    // body compared with whitespace-trim — should be equal
    expect(result.localChanges.find((c) => c.field === 'body')).toBeUndefined();
  });

  it('treats arrays element-wise', () => {
    const story = makeStory({ labels: ['a', 'b'] });
    const baseline = {
      title: 'Story',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: ['a', 'b'],
      body: '',
    };
    const result = diffEntity(story, baseline, baseline, baseline);
    expect(result.status).toBe('in_sync');
  });

  it('treats arrays of different lengths as different', () => {
    const story = makeStory({ labels: ['a'] });
    const baseline = {
      title: 'Story',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: ['a', 'b'],
      body: '',
    };
    const result = diffEntity(story, baseline, baseline, baseline);
    expect(result.localChanges.find((c) => c.field === 'labels')).toBeDefined();
  });

  it('treats null and undefined as equal', () => {
    const story = makeStory({ assignee: null });
    const baseline = {
      title: 'Story',
      status: 'todo',
      priority: 'medium',
      assignee: undefined,
      labels: [],
      body: '',
    };
    const result = diffEntity(story, baseline, baseline, baseline);
    expect(
      result.localChanges.find((c) => c.field === 'assignee'),
    ).toBeUndefined();
  });
});
