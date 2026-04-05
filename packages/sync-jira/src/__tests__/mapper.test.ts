import { describe, expect, it } from 'vitest';
import type { JiraIssue, JiraSprint } from '../client.js';
import {
  determineFilePath,
  entityToJiraIssue,
  isEpicIssue,
  jiraIssueToEntity,
  jiraSprintToMilestone,
  mapJiraPriority,
  mapJiraStatus,
  milestoneToJiraSprint,
} from '../mapper.js';
import type { JiraConfig } from '../types.js';

const SITE = 'test.atlassian.net';
const PROJECT_KEY = 'TEST';

const baseSprint: JiraSprint = {
  id: 1,
  name: 'Sprint 1',
  state: 'active',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-01-14T00:00:00Z',
  goal: 'Complete onboarding',
};

const epicIssue: JiraIssue = {
  id: '10001',
  key: 'TEST-1',
  fields: {
    summary: 'User Authentication',
    description: 'Epic for auth system.',
    status: { name: 'In Progress', id: '3' },
    issuetype: { name: 'Epic', id: '10000' },
    assignee: { accountId: 'abc123', displayName: 'Alice' },
    labels: ['backend', 'security'],
    priority: { name: 'High', id: '2' },
    project: { key: PROJECT_KEY },
    created: '2026-01-20T08:00:00Z',
    updated: '2026-03-10T12:00:00Z',
  },
};

const storyIssue: JiraIssue = {
  id: '10002',
  key: 'TEST-2',
  fields: {
    summary: 'Login Page',
    description: 'Implement login page.',
    status: { name: 'To Do', id: '1' },
    issuetype: { name: 'Story', id: '10001' },
    assignee: { accountId: 'def456', displayName: 'Bob' },
    labels: ['frontend'],
    priority: { name: 'Medium', id: '3' },
    parent: {
      key: 'TEST-1',
      fields: { summary: 'User Authentication', issuetype: { name: 'Epic' } },
    },
    project: { key: PROJECT_KEY },
    created: '2026-02-05T10:00:00Z',
    updated: '2026-03-12T16:00:00Z',
  },
};

const doneIssue: JiraIssue = {
  id: '10003',
  key: 'TEST-3',
  fields: {
    summary: 'Setup CI/CD',
    description: null,
    status: { name: 'Done', id: '4' },
    issuetype: { name: 'Task', id: '10002' },
    assignee: null,
    labels: [],
    priority: null,
    project: { key: PROJECT_KEY },
    created: '2026-01-18T07:00:00Z',
    updated: '2026-02-15T13:00:00Z',
  },
};

const defaultConfig: Pick<JiraConfig, 'issue_type_mapping' | 'status_mapping'> =
  {
    issue_type_mapping: { epic_types: ['Epic'] },
    status_mapping: {
      'To Do': 'todo',
      'In Progress': 'in_progress',
      'In Review': 'in_review',
      Done: 'done',
      Backlog: 'backlog',
    },
  };

describe('jiraSprintToMilestone', () => {
  it('maps an active sprint correctly', () => {
    const ms = jiraSprintToMilestone(baseSprint, SITE, PROJECT_KEY);
    expect(ms.type).toBe('milestone');
    expect(ms.title).toBe('Sprint 1');
    expect(ms.status).toBe('in_progress');
    expect(ms.target_date).toBe('2026-01-14T00:00:00Z');
    expect(ms.body).toBe('Complete onboarding');
    expect(ms.jira?.site).toBe(SITE);
    expect(ms.jira?.sprint_id).toBe(1);
    expect(ms.id).toHaveLength(12);
    expect(ms.filePath).toBe('.meta/roadmap/milestones/sprint-1.md');
  });

  it('maps a closed sprint to done status', () => {
    const closedSprint: JiraSprint = { ...baseSprint, state: 'closed' };
    const ms = jiraSprintToMilestone(closedSprint, SITE, PROJECT_KEY);
    expect(ms.status).toBe('done');
  });

  it('handles sprint with no goal or dates', () => {
    const emptySprint: JiraSprint = {
      id: 2,
      name: 'Sprint 2',
      state: 'future',
    };
    const ms = jiraSprintToMilestone(emptySprint, SITE, PROJECT_KEY);
    expect(ms.body).toBe('');
    expect(ms.target_date).toBeUndefined();
  });
});

describe('isEpicIssue', () => {
  it('returns true for Epic issuetype', () => {
    expect(isEpicIssue(epicIssue)).toBe(true);
  });

  it('returns false for non-Epic issuetypes', () => {
    expect(isEpicIssue(storyIssue)).toBe(false);
  });

  it('uses custom epic types from config', () => {
    const config: Pick<JiraConfig, 'issue_type_mapping'> = {
      issue_type_mapping: { epic_types: ['Theme'] },
    };
    expect(isEpicIssue(epicIssue, config)).toBe(false);
  });
});

describe('mapJiraStatus', () => {
  it('maps known statuses', () => {
    expect(mapJiraStatus('To Do')).toBe('todo');
    expect(mapJiraStatus('In Progress')).toBe('in_progress');
    expect(mapJiraStatus('Done')).toBe('done');
  });

  it('falls back to todo for unknown statuses', () => {
    expect(mapJiraStatus('Unknown Status')).toBe('todo');
  });
});

describe('mapJiraPriority', () => {
  it('maps known priorities', () => {
    expect(mapJiraPriority('Highest')).toBe('critical');
    expect(mapJiraPriority('High')).toBe('high');
    expect(mapJiraPriority('Medium')).toBe('medium');
    expect(mapJiraPriority('Low')).toBe('low');
  });

  it('returns medium for undefined', () => {
    expect(mapJiraPriority(undefined)).toBe('medium');
  });
});

describe('jiraIssueToEntity', () => {
  it('creates an Epic from Epic issuetype', () => {
    const entity = jiraIssueToEntity(epicIssue, defaultConfig, SITE);
    expect(entity.type).toBe('epic');
    expect(entity.title).toBe('User Authentication');
    expect(entity.status).toBe('in_progress');
    if (entity.type === 'epic') {
      expect(entity.owner).toBe('Alice');
      expect(entity.labels).toEqual(['backend', 'security']);
      expect(entity.priority).toBe('high');
    }
    expect(entity.jira?.issue_key).toBe('TEST-1');
    expect(entity.jira?.site).toBe(SITE);
    expect(entity.id).toHaveLength(12);
  });

  it('creates a Story from non-Epic issuetype', () => {
    const entity = jiraIssueToEntity(storyIssue, defaultConfig, SITE);
    expect(entity.type).toBe('story');
    expect(entity.title).toBe('Login Page');
    if (entity.type === 'story') {
      expect(entity.assignee).toBe('Bob');
      expect(entity.labels).toEqual(['frontend']);
    }
  });

  it('maps done issues to done status', () => {
    const entity = jiraIssueToEntity(doneIssue, defaultConfig, SITE);
    expect(entity.status).toBe('done');
  });

  it('handles issue with no description', () => {
    const entity = jiraIssueToEntity(doneIssue, defaultConfig, SITE);
    expect(entity.body).toBe('');
  });

  it('handles issue with no assignee', () => {
    const entity = jiraIssueToEntity(doneIssue, defaultConfig, SITE);
    if (entity.type === 'story') {
      expect(entity.assignee).toBeNull();
    }
  });
});

describe('determineFilePath', () => {
  it('places epics in .meta/epics/<slug>/epic.md', () => {
    const entity = jiraIssueToEntity(epicIssue, defaultConfig, SITE);
    const path = determineFilePath(entity as never);
    expect(path).toBe('.meta/epics/user-authentication/epic.md');
  });

  it('places orphan stories in .meta/stories/<slug>.md', () => {
    const entity = jiraIssueToEntity(storyIssue, defaultConfig, SITE);
    const path = determineFilePath(entity as never);
    expect(path).toBe('.meta/stories/login-page.md');
  });

  it('places stories under epic when parentEpicSlug is provided', () => {
    const entity = jiraIssueToEntity(storyIssue, defaultConfig, SITE);
    const path = determineFilePath(entity as never, 'user-authentication');
    expect(path).toBe('.meta/epics/user-authentication/stories/login-page.md');
  });

  it('places milestones in .meta/roadmap/milestones/<slug>.md', () => {
    const ms = jiraSprintToMilestone(baseSprint, SITE, PROJECT_KEY);
    const path = determineFilePath(ms);
    expect(path).toBe('.meta/roadmap/milestones/sprint-1.md');
  });
});

describe('entityToJiraIssue', () => {
  it('maps epic to Jira issue params', () => {
    const entity = jiraIssueToEntity(epicIssue, defaultConfig, SITE);
    const params = entityToJiraIssue(entity as never, defaultConfig);
    expect(params.summary).toBe('User Authentication');
    expect(params.issueType).toBe('Epic');
    expect(params.priority).toBe('High');
  });

  it('maps story to Jira issue params', () => {
    const entity = jiraIssueToEntity(storyIssue, defaultConfig, SITE);
    const params = entityToJiraIssue(entity as never, defaultConfig);
    expect(params.summary).toBe('Login Page');
    expect(params.issueType).toBe('Story');
  });

  it('maps done entity to Done target status', () => {
    const entity = jiraIssueToEntity(doneIssue, defaultConfig, SITE);
    const params = entityToJiraIssue(entity as never, defaultConfig);
    expect(params.targetStatus).toBe('Done');
  });
});

describe('milestoneToJiraSprint', () => {
  it('maps milestone to sprint params', () => {
    const ms = jiraSprintToMilestone(baseSprint, SITE, PROJECT_KEY);
    const params = milestoneToJiraSprint(ms);
    expect(params.name).toBe('Sprint 1');
    expect(params.goal).toBe('Complete onboarding');
    expect(params.endDate).toBe('2026-01-14T00:00:00Z');
  });
});
