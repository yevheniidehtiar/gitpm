import { describe, expect, it } from 'vitest';
import type { JiraIssue, JiraSprint } from '../client.js';
import {
  diffByHash,
  diffEntity,
  remoteIssueFields,
  remoteSprintFields,
} from '../diff.js';
import type { JiraConfig, JiraSyncStateEntry } from '../types.js';

const config: Pick<JiraConfig, 'status_mapping'> = {
  status_mapping: {
    'To Do': 'todo',
    'In Progress': 'in_progress',
    Done: 'done',
  },
};

describe('remoteIssueFields', () => {
  it('extracts comparable fields from a Jira issue', () => {
    const issue: JiraIssue = {
      id: '1',
      key: 'TEST-1',
      fields: {
        summary: 'Test Issue',
        description: 'A description',
        status: { name: 'To Do', id: '1' },
        issuetype: { name: 'Story', id: '10001' },
        assignee: { accountId: 'abc', displayName: 'Alice' },
        labels: ['frontend', 'backend'],
        priority: { name: 'High', id: '2' },
        project: { key: 'TEST' },
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-02T00:00:00Z',
      },
    };

    const fields = remoteIssueFields(issue, config);
    expect(fields.title).toBe('Test Issue');
    expect(fields.status).toBe('todo');
    expect(fields.priority).toBe('high');
    expect(fields.assignee).toBe('Alice');
    expect(fields.labels).toEqual(['backend', 'frontend']);
    expect(fields.body).toBe('A description');
  });
});

describe('remoteSprintFields', () => {
  it('extracts comparable fields from a Jira sprint', () => {
    const sprint: JiraSprint = {
      id: 1,
      name: 'Sprint 1',
      state: 'active',
      endDate: '2026-01-14T00:00:00Z',
      goal: 'Finish onboarding',
    };

    const fields = remoteSprintFields(sprint);
    expect(fields.title).toBe('Sprint 1');
    expect(fields.status).toBe('in_progress');
    expect(fields.target_date).toBe('2026-01-14T00:00:00Z');
    expect(fields.body).toBe('Finish onboarding');
  });

  it('handles closed sprint', () => {
    const sprint: JiraSprint = {
      id: 2,
      name: 'Sprint 2',
      state: 'closed',
    };
    const fields = remoteSprintFields(sprint);
    expect(fields.status).toBe('done');
    expect(fields.target_date).toBeNull();
  });
});

describe('diffByHash', () => {
  const baseEntry: JiraSyncStateEntry = {
    jira_issue_key: 'TEST-1',
    local_hash: 'sha256:aaa',
    remote_hash: 'sha256:bbb',
    synced_at: '2026-01-01T00:00:00Z',
  };

  it('returns in_sync when no hashes changed', () => {
    expect(diffByHash('sha256:aaa', 'sha256:bbb', baseEntry)).toBe('in_sync');
  });

  it('returns local_changed when local hash differs', () => {
    expect(diffByHash('sha256:ccc', 'sha256:bbb', baseEntry)).toBe(
      'local_changed',
    );
  });

  it('returns remote_changed when remote hash differs', () => {
    expect(diffByHash('sha256:aaa', 'sha256:ddd', baseEntry)).toBe(
      'remote_changed',
    );
  });

  it('returns both_changed when both differ', () => {
    expect(diffByHash('sha256:ccc', 'sha256:ddd', baseEntry)).toBe(
      'both_changed',
    );
  });
});

describe('diffEntity', () => {
  it('returns in_sync when nothing changed', () => {
    const local = {
      type: 'story' as const,
      id: 's1',
      title: 'Test',
      status: 'todo' as const,
      priority: 'medium' as const,
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: '.meta/stories/test.md',
    };
    const baseline = {
      title: 'Test',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: '',
    };

    const result = diffEntity(local, baseline, baseline, baseline);
    expect(result.status).toBe('in_sync');
    expect(result.conflicts).toHaveLength(0);
  });

  it('detects local changes', () => {
    const local = {
      type: 'story' as const,
      id: 's1',
      title: 'Updated Title',
      status: 'todo' as const,
      priority: 'medium' as const,
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: '.meta/stories/test.md',
    };
    const baseline = {
      title: 'Original Title',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: '',
    };

    const result = diffEntity(local, baseline, baseline, baseline);
    expect(result.status).toBe('local_changed');
    expect(result.localChanges.length).toBeGreaterThan(0);
  });

  it('detects remote changes when only the remote side differs', () => {
    const local = {
      type: 'story' as const,
      id: 's1',
      title: 'Same',
      status: 'todo' as const,
      priority: 'medium' as const,
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: '.meta/stories/s.md',
    };
    const baseline = {
      title: 'Same',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: '',
    };
    const remote = {
      title: 'Remote Edited',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: '',
    };

    const result = diffEntity(local, remote, baseline, baseline);
    expect(result.status).toBe('remote_changed');
    expect(result.remoteChanges.length).toBeGreaterThan(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('treats strings with equivalent trimmed content as equal', () => {
    const local = {
      type: 'story' as const,
      id: 's1',
      title: 'Same Title',
      status: 'todo' as const,
      priority: 'medium' as const,
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      body: 'body text',
      filePath: '.meta/stories/s.md',
    };
    const baseline = {
      title: '  Same Title  ',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: '  body text  ',
    };

    const result = diffEntity(local, baseline, baseline, baseline);
    expect(result.status).toBe('in_sync');
  });

  it('extracts epic fields including owner', () => {
    const epic = {
      type: 'epic' as const,
      id: 'e1',
      title: 'Feature',
      status: 'in_progress' as const,
      priority: 'high' as const,
      owner: 'Alice',
      labels: ['backend'],
      milestone_ref: null,
      body: 'Epic body',
      filePath: '.meta/epics/feature/epic.md',
    };
    const remoteFields = {
      title: 'Feature',
      status: 'in_progress',
      priority: 'high',
      owner: 'Alice',
      labels: ['backend'],
      body: 'Epic body',
    };

    const result = diffEntity(epic, remoteFields, remoteFields, remoteFields);
    expect(result.status).toBe('in_sync');
  });

  it('extracts milestone fields including target_date', () => {
    const milestone = {
      type: 'milestone' as const,
      id: 'm1',
      title: 'Q2',
      status: 'in_progress' as const,
      target_date: '2026-06-30T00:00:00Z',
      body: 'body',
      filePath: '.meta/roadmap/milestones/q2.md',
    };
    const baseline = {
      title: 'Q2',
      status: 'in_progress',
      target_date: '2026-06-30T00:00:00Z',
      body: 'body',
    };

    const result = diffEntity(milestone, baseline, baseline, baseline);
    expect(result.status).toBe('in_sync');
  });

  it('falls back to title-only fields for unsupported entity types', () => {
    const prd = {
      type: 'prd' as const,
      id: 'p1',
      title: 'Product Requirements',
      status: 'draft' as const,
      body: 'PRD body',
      filePath: '.meta/prds/p.md',
    };
    const baseline = {
      title: 'Product Requirements',
    };

    const result = diffEntity(prd, baseline, baseline, baseline);
    expect(result.status).toBe('in_sync');
  });

  it('detects conflicts when both sides change same field differently', () => {
    const local = {
      type: 'story' as const,
      id: 's1',
      title: 'Local Title',
      status: 'todo' as const,
      priority: 'medium' as const,
      assignee: null,
      labels: [],
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: '.meta/stories/test.md',
    };
    const baseline = {
      title: 'Original Title',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: '',
    };
    const remote = {
      title: 'Remote Title',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      labels: [],
      body: '',
    };

    const result = diffEntity(local, remote, baseline, baseline);
    expect(result.status).toBe('conflict');
    expect(result.conflicts.length).toBeGreaterThan(0);
  });
});
