import { describe, expect, it } from 'vitest';
import type { LinearCycle, LinearIssue } from '../client.js';
import {
  determineFilePath,
  entityToLinearIssue,
  isEpicIssue,
  linearCycleToMilestone,
  linearIssueToEntity,
  mapLinearPriority,
  mapLinearState,
  milestoneToLinearCycle,
} from '../mapper.js';
import type { LinearConfig } from '../types.js';

const TEAM_ID = 'team-1';

const baseCycle: LinearCycle = {
  id: 'cycle-1',
  number: 1,
  name: 'Cycle 1',
  startsAt: '2026-01-01T00:00:00Z',
  endsAt: '2026-01-14T00:00:00Z',
};

const epicIssue: LinearIssue = {
  id: 'issue-1',
  identifier: 'ENG-1',
  title: 'User Authentication',
  description: 'Epic for auth system.',
  priority: 2,
  createdAt: '2026-01-20T08:00:00Z',
  updatedAt: '2026-03-10T12:00:00Z',
  state: { id: 's1', name: 'In Progress', type: 'started' },
  assignee: { id: 'u1', name: 'Alice' },
  labels: { nodes: [{ name: 'backend' }, { name: 'security' }] },
  parent: null,
  children: { nodes: [{ id: 'issue-2' }] },
  cycle: null,
  project: null,
};

const storyIssue: LinearIssue = {
  id: 'issue-2',
  identifier: 'ENG-2',
  title: 'Login Page',
  description: 'Implement login page.',
  priority: 3,
  createdAt: '2026-02-05T10:00:00Z',
  updatedAt: '2026-03-12T16:00:00Z',
  state: { id: 's2', name: 'Todo', type: 'unstarted' },
  assignee: { id: 'u2', name: 'Bob' },
  labels: { nodes: [{ name: 'frontend' }] },
  parent: { id: 'issue-1', identifier: 'ENG-1', title: 'User Authentication' },
  children: { nodes: [] },
  cycle: { id: 'cycle-1', number: 1 },
  project: null,
};

const doneIssue: LinearIssue = {
  id: 'issue-3',
  identifier: 'ENG-3',
  title: 'Setup CI/CD',
  description: null,
  priority: 0,
  createdAt: '2026-01-18T07:00:00Z',
  updatedAt: '2026-02-15T13:00:00Z',
  state: { id: 's3', name: 'Done', type: 'completed' },
  assignee: null,
  labels: { nodes: [] },
  parent: null,
  children: { nodes: [] },
  cycle: null,
  project: null,
};

const defaultConfig: Pick<LinearConfig, 'status_mapping'> = {
  status_mapping: {
    triage: 'backlog',
    backlog: 'backlog',
    unstarted: 'todo',
    started: 'in_progress',
    completed: 'done',
    canceled: 'cancelled',
  },
};

describe('linearCycleToMilestone', () => {
  it('maps an active cycle correctly', () => {
    const ms = linearCycleToMilestone(baseCycle, TEAM_ID);
    expect(ms.type).toBe('milestone');
    expect(ms.title).toBe('Cycle 1');
    expect(ms.status).toBe('in_progress');
    expect(ms.target_date).toBe('2026-01-14T00:00:00Z');
    expect(ms.linear?.team_id).toBe(TEAM_ID);
    expect(ms.linear?.cycle_id).toBe('cycle-1');
    expect(ms.id).toHaveLength(12);
    expect(ms.filePath).toBe('.meta/roadmap/milestones/cycle-1.md');
  });

  it('maps a completed cycle to done status', () => {
    const completedCycle: LinearCycle = {
      ...baseCycle,
      completedAt: '2026-01-14T00:00:00Z',
    };
    const ms = linearCycleToMilestone(completedCycle, TEAM_ID);
    expect(ms.status).toBe('done');
  });

  it('falls back to a generated name when the cycle has no name', () => {
    const unnamedCycle: LinearCycle = { id: 'c2', number: 5 };
    const ms = linearCycleToMilestone(unnamedCycle, TEAM_ID);
    expect(ms.title).toBe('Cycle 5');
    expect(ms.target_date).toBeUndefined();
  });
});

describe('isEpicIssue', () => {
  it('returns true when the issue has sub-issues', () => {
    expect(isEpicIssue(epicIssue)).toBe(true);
  });

  it('returns false for a leaf issue', () => {
    expect(isEpicIssue(storyIssue)).toBe(false);
  });
});

describe('mapLinearState', () => {
  it('maps known state types', () => {
    expect(mapLinearState('unstarted')).toBe('todo');
    expect(mapLinearState('started')).toBe('in_progress');
    expect(mapLinearState('completed')).toBe('done');
    expect(mapLinearState('canceled')).toBe('cancelled');
    expect(mapLinearState('triage')).toBe('backlog');
    expect(mapLinearState('backlog')).toBe('backlog');
  });

  it('falls back to todo for unknown state types', () => {
    expect(mapLinearState('unknown')).toBe('todo');
  });
});

describe('mapLinearPriority', () => {
  it('maps known priority values', () => {
    expect(mapLinearPriority(1)).toBe('critical');
    expect(mapLinearPriority(2)).toBe('high');
    expect(mapLinearPriority(3)).toBe('medium');
    expect(mapLinearPriority(4)).toBe('low');
    expect(mapLinearPriority(0)).toBe('medium');
  });

  it('returns medium for undefined', () => {
    expect(mapLinearPriority(undefined)).toBe('medium');
  });
});

describe('linearIssueToEntity', () => {
  it('creates an Epic from an issue with sub-issues', () => {
    const entity = linearIssueToEntity(epicIssue, defaultConfig, TEAM_ID);
    expect(entity.type).toBe('epic');
    expect(entity.title).toBe('User Authentication');
    expect(entity.status).toBe('in_progress');
    if (entity.type === 'epic') {
      expect(entity.owner).toBe('Alice');
      expect(entity.labels).toEqual(['backend', 'security']);
      expect(entity.priority).toBe('high');
    }
    expect(entity.linear?.issue_id).toBe('issue-1');
    expect(entity.linear?.team_id).toBe(TEAM_ID);
    expect(entity.id).toHaveLength(12);
  });

  it('creates a Story from a leaf issue', () => {
    const entity = linearIssueToEntity(storyIssue, defaultConfig, TEAM_ID);
    expect(entity.type).toBe('story');
    expect(entity.title).toBe('Login Page');
    if (entity.type === 'story') {
      expect(entity.assignee).toBe('Bob');
      expect(entity.labels).toEqual(['frontend']);
    }
    expect(entity.linear?.cycle_id).toBe('cycle-1');
  });

  it('maps completed issues to done status', () => {
    const entity = linearIssueToEntity(doneIssue, defaultConfig, TEAM_ID);
    expect(entity.status).toBe('done');
  });

  it('handles issue with no description', () => {
    const entity = linearIssueToEntity(doneIssue, defaultConfig, TEAM_ID);
    expect(entity.body).toBe('');
  });

  it('handles issue with no assignee', () => {
    const entity = linearIssueToEntity(doneIssue, defaultConfig, TEAM_ID);
    if (entity.type === 'story') {
      expect(entity.assignee).toBeNull();
    }
  });
});

describe('determineFilePath', () => {
  it('places epics in .meta/epics/<slug>/epic.md', () => {
    const entity = linearIssueToEntity(epicIssue, defaultConfig, TEAM_ID);
    const path = determineFilePath(entity as never);
    expect(path).toBe('.meta/epics/user-authentication/epic.md');
  });

  it('places orphan stories in .meta/stories/<slug>.md', () => {
    const entity = linearIssueToEntity(storyIssue, defaultConfig, TEAM_ID);
    const path = determineFilePath(entity as never);
    expect(path).toBe('.meta/stories/login-page.md');
  });

  it('places stories under epic when parentEpicSlug is provided', () => {
    const entity = linearIssueToEntity(storyIssue, defaultConfig, TEAM_ID);
    const path = determineFilePath(entity as never, 'user-authentication');
    expect(path).toBe('.meta/epics/user-authentication/stories/login-page.md');
  });

  it('places milestones in .meta/roadmap/milestones/<slug>.md', () => {
    const ms = linearCycleToMilestone(baseCycle, TEAM_ID);
    const path = determineFilePath(ms);
    expect(path).toBe('.meta/roadmap/milestones/cycle-1.md');
  });
});

describe('entityToLinearIssue', () => {
  it('maps epic to Linear issue params', () => {
    const entity = linearIssueToEntity(epicIssue, defaultConfig, TEAM_ID);
    const params = entityToLinearIssue(entity as never, defaultConfig);
    expect(params.title).toBe('User Authentication');
    expect(params.priority).toBe(2);
  });

  it('maps story to Linear issue params', () => {
    const entity = linearIssueToEntity(storyIssue, defaultConfig, TEAM_ID);
    const params = entityToLinearIssue(entity as never, defaultConfig);
    expect(params.title).toBe('Login Page');
  });

  it('maps done entity to completed target state type', () => {
    const entity = linearIssueToEntity(doneIssue, defaultConfig, TEAM_ID);
    const params = entityToLinearIssue(entity as never, defaultConfig);
    expect(params.targetStateType).toBe('completed');
  });

  it('maps priority values to their Linear numbers', () => {
    const entity = linearIssueToEntity(storyIssue, defaultConfig, TEAM_ID) as {
      priority: 'critical' | 'high' | 'medium' | 'low';
      type: 'story';
    };
    entity.priority = 'critical';
    expect(entityToLinearIssue(entity as never, defaultConfig).priority).toBe(
      1,
    );
    entity.priority = 'low';
    expect(entityToLinearIssue(entity as never, defaultConfig).priority).toBe(
      4,
    );
    entity.priority = 'medium';
    expect(entityToLinearIssue(entity as never, defaultConfig).priority).toBe(
      3,
    );
  });
});

describe('milestoneToLinearCycle', () => {
  it('maps milestone to cycle params', () => {
    const ms = linearCycleToMilestone(baseCycle, TEAM_ID);
    const params = milestoneToLinearCycle(ms);
    expect(params.name).toBe('Cycle 1');
    expect(params.endsAt).toBe('2026-01-14T00:00:00Z');
  });
});
