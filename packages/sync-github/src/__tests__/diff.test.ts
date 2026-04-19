import type { Epic, Milestone, Story } from '@gitpm/core';
import { describe, expect, it } from 'vitest';
import type { GhIssue, GhMilestone } from '../client.js';
import {
  diffByHash,
  diffEntity,
  remoteIssueFields,
  remoteMilestoneFields,
} from '../diff.js';
import type { SyncStateEntry } from '../types.js';

const baseStory: Story = {
  type: 'story',
  id: 'story-001',
  title: 'Test Story',
  status: 'todo',
  priority: 'medium',
  assignee: 'alice',
  labels: ['frontend'],
  estimate: null,
  epic_ref: null,
  github: null,
  body: 'Story body',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  filePath: '.meta/stories/test-story.md',
};

const baseIssue: GhIssue = {
  number: 1,
  title: 'Test Story',
  body: 'Story body',
  state: 'open',
  assignee: { login: 'alice' },
  labels: [{ name: 'frontend' }],
  milestone: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const _baseMilestone: Milestone = {
  type: 'milestone',
  id: 'ms-001',
  title: 'Q1 Release',
  status: 'in_progress',
  target_date: '2026-03-31T00:00:00Z',
  github: null,
  body: 'First release',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  filePath: '.meta/roadmap/milestones/q1-release.md',
};

const baseGhMilestone: GhMilestone = {
  number: 1,
  title: 'Q1 Release',
  description: 'First release',
  state: 'open',
  due_on: '2026-03-31T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('remoteIssueFields', () => {
  it('extracts comparable fields from a GitHub issue', () => {
    const fields = remoteIssueFields(baseIssue);
    expect(fields.title).toBe('Test Story');
    expect(fields.status).toBe('todo');
    expect(fields.labels).toEqual(['frontend']);
    expect(fields.assignee).toBe('alice');
    expect(fields.body).toBe('Story body');
  });

  it('maps closed state to done', () => {
    const fields = remoteIssueFields({ ...baseIssue, state: 'closed' });
    expect(fields.status).toBe('done');
  });

  it('filters out epic label', () => {
    const fields = remoteIssueFields({
      ...baseIssue,
      labels: [{ name: 'epic' }, { name: 'backend' }],
    });
    expect(fields.labels).toEqual(['backend']);
  });
});

describe('remoteMilestoneFields', () => {
  it('extracts comparable fields from a GitHub milestone', () => {
    const fields = remoteMilestoneFields(baseGhMilestone);
    expect(fields.title).toBe('Q1 Release');
    expect(fields.status).toBe('in_progress');
    expect(fields.target_date).toBe('2026-03-31T00:00:00Z');
    expect(fields.body).toBe('First release');
  });

  it('maps closed state to done', () => {
    const fields = remoteMilestoneFields({
      ...baseGhMilestone,
      state: 'closed',
    });
    expect(fields.status).toBe('done');
  });
});

describe('diffEntity', () => {
  it('detects in_sync when nothing changed', () => {
    const localFields = {
      title: 'Test Story',
      status: 'todo',
      priority: 'medium',
      labels: ['frontend'],
      assignee: 'alice',
      body: 'Story body',
    };
    const result = diffEntity(baseStory, localFields, localFields, localFields);
    expect(result.status).toBe('in_sync');
    expect(result.localChanges).toHaveLength(0);
    expect(result.remoteChanges).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('detects local-only changes', () => {
    const baseline = {
      title: 'Test Story',
      status: 'todo',
      priority: 'medium',
      labels: ['frontend'],
      assignee: 'alice',
      body: 'Story body',
    };
    const modifiedStory: Story = {
      ...baseStory,
      title: 'Updated Story',
    };
    const result = diffEntity(modifiedStory, baseline, baseline, baseline);
    expect(result.status).toBe('local_changed');
    expect(result.localChanges).toHaveLength(1);
    expect(result.localChanges[0].field).toBe('title');
    expect(result.remoteChanges).toHaveLength(0);
  });

  it('detects remote-only changes', () => {
    const baseline = {
      title: 'Test Story',
      status: 'todo',
      priority: 'medium',
      labels: ['frontend'],
      assignee: 'alice',
      body: 'Story body',
    };
    const remoteFields = {
      ...baseline,
      title: 'Remote Updated',
    };
    const result = diffEntity(baseStory, remoteFields, baseline, baseline);
    expect(result.status).toBe('remote_changed');
    expect(result.remoteChanges).toHaveLength(1);
    expect(result.remoteChanges[0].field).toBe('title');
  });

  it('detects conflicts when same field changed on both sides', () => {
    const baseline = {
      title: 'Test Story',
      status: 'todo',
      priority: 'medium',
      labels: ['frontend'],
      assignee: 'alice',
      body: 'Story body',
    };
    const modifiedStory: Story = {
      ...baseStory,
      status: 'in_progress',
    };
    const remoteFields = {
      ...baseline,
      status: 'done',
    };
    const result = diffEntity(modifiedStory, remoteFields, baseline, baseline);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].field).toBe('status');
    expect(result.conflicts[0].localValue).toBe('in_progress');
    expect(result.conflicts[0].remoteValue).toBe('done');
  });

  it('diffs epic entities (covers epic branch in localEntityFields)', () => {
    const baseEpic: Epic = {
      type: 'epic',
      id: 'epic-001',
      title: 'Epic',
      status: 'todo',
      priority: 'medium',
      owner: 'alice',
      labels: ['backend'],
      milestone_ref: null,
      github: null,
      body: 'Epic body',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      filePath: '.meta/epics/e/epic.md',
    };
    const baseline = {
      title: 'Epic',
      status: 'todo',
      priority: 'medium',
      owner: 'alice',
      labels: ['backend'],
      body: 'Epic body',
    };
    const modified: Epic = { ...baseEpic, owner: 'bob' };
    const result = diffEntity(modified, baseline, baseline, baseline);
    expect(result.status).toBe('local_changed');
    expect(result.localChanges[0].field).toBe('owner');
  });

  it('diffs non-story/epic/milestone entities (covers default branch)', () => {
    const roadmap = {
      type: 'roadmap' as const,
      id: 'rm',
      title: 'Roadmap',
      description: '',
      milestones: [],
      updated_at: '2026-01-01T00:00:00Z',
      filePath: '.meta/roadmap/roadmap.yaml',
    };
    const baseline = { title: 'Roadmap' };
    const result = diffEntity(roadmap, baseline, baseline, baseline);
    expect(result.status).toBe('in_sync');
  });

  it('diffs milestone entities (covers milestone branch in localEntityFields)', () => {
    const baseMilestone: Milestone = {
      type: 'milestone',
      id: 'ms-001',
      title: 'Q2',
      status: 'in_progress',
      target_date: '2026-06-30T00:00:00Z',
      github: null,
      body: 'body',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      filePath: '.meta/roadmap/milestones/q2.md',
    };
    const baseline = {
      title: 'Q2',
      status: 'in_progress',
      target_date: '2026-06-30T00:00:00Z',
      body: 'body',
    };
    const modified: Milestone = { ...baseMilestone, status: 'done' };
    const result = diffEntity(modified, baseline, baseline, baseline);
    expect(result.status).toBe('local_changed');
  });

  it('ignores string changes that differ only in surrounding whitespace', () => {
    // This specifically exercises the string-trim branch of fieldEquals (line 113 in diff.ts).
    const baseline = {
      title: 'Story',
      status: 'todo',
      priority: 'medium',
      labels: ['frontend'],
      assignee: 'alice',
      body: '   hello world   ',
    };
    const remote = {
      ...baseline,
      body: 'hello world',
    };
    const result = diffEntity(baseStory, remote, baseline, baseline);
    // "body" trimmed → equal on both sides → no remote_changed
    expect(result.status).toBe('local_changed');
  });

  it('does not conflict when both changed to same value', () => {
    const baseline = {
      title: 'Test Story',
      status: 'todo',
      priority: 'medium',
      labels: ['frontend'],
      assignee: 'alice',
      body: 'Story body',
    };
    const modifiedStory: Story = {
      ...baseStory,
      status: 'done',
    };
    const remoteFields = {
      ...baseline,
      status: 'done',
    };
    const result = diffEntity(modifiedStory, remoteFields, baseline, baseline);
    expect(result.conflicts).toHaveLength(0);
  });
});

describe('diffByHash', () => {
  const entry: SyncStateEntry = {
    local_hash: 'sha256:aaa',
    remote_hash: 'sha256:bbb',
    synced_at: '2026-01-01T00:00:00Z',
  };

  it('returns in_sync when hashes match', () => {
    expect(diffByHash('sha256:aaa', 'sha256:bbb', entry)).toBe('in_sync');
  });

  it('returns local_changed when only local changed', () => {
    expect(diffByHash('sha256:ccc', 'sha256:bbb', entry)).toBe('local_changed');
  });

  it('returns remote_changed when only remote changed', () => {
    expect(diffByHash('sha256:aaa', 'sha256:ccc', entry)).toBe(
      'remote_changed',
    );
  });

  it('returns both_changed when both changed', () => {
    expect(diffByHash('sha256:ccc', 'sha256:ddd', entry)).toBe('both_changed');
  });
});
