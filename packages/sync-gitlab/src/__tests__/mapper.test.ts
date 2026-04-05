import { describe, expect, it } from 'vitest';
import type { GlIssue, GlMilestone } from '../client.js';
import {
  determineFilePath,
  entityToGlIssue,
  glEpicToEpic,
  glIssueToEntity,
  glMilestoneToMilestone,
  isEpicIssue,
  milestoneToGlMilestone,
} from '../mapper.js';
import type { GitLabConfig } from '../types.js';

const PROJECT_ID = 42;
const BASE_URL = 'https://gitlab.com';

const baseMilestone: GlMilestone = {
  id: 101,
  iid: 1,
  title: 'v0.1 - MVP',
  description: 'Initial minimal viable product release.',
  state: 'active',
  due_date: '2026-06-30',
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
};

const epicIssue: GlIssue = {
  id: 1001,
  iid: 1,
  title: 'User Authentication',
  description: 'Implement user login and registration flow.',
  state: 'opened',
  assignee: { id: 42, username: 'alice' },
  labels: ['feature', 'epic'],
  milestone: { id: 101, iid: 1, title: 'v0.1 - MVP' },
  weight: 5,
  epic_iid: null,
  created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z',
};

const storyIssue: GlIssue = {
  id: 1003,
  iid: 3,
  title: 'Add OAuth2 provider support',
  description: 'Support Google and GitHub OAuth2 login.',
  state: 'opened',
  assignee: { id: 42, username: 'alice' },
  labels: ['feature'],
  milestone: { id: 101, iid: 1, title: 'v0.1 - MVP' },
  weight: 3,
  epic_iid: null,
  created_at: '2026-02-05T10:00:00Z',
  updated_at: '2026-02-05T10:00:00Z',
};

const closedIssue: GlIssue = {
  id: 1004,
  iid: 4,
  title: 'Implement rate limiter middleware',
  description: 'Token bucket rate limiter for API endpoints.',
  state: 'closed',
  assignee: { id: 43, username: 'bob' },
  labels: ['feature'],
  milestone: { id: 101, iid: 1, title: 'v0.1 - MVP' },
  weight: 2,
  epic_iid: null,
  created_at: '2026-02-10T10:00:00Z',
  updated_at: '2026-03-01T12:00:00Z',
};

const noDescIssue: GlIssue = {
  id: 1005,
  iid: 5,
  title: 'Fix login page styling',
  description: null,
  state: 'opened',
  assignee: null,
  labels: ['bug'],
  milestone: null,
  weight: null,
  epic_iid: null,
  created_at: '2026-03-01T10:00:00Z',
  updated_at: '2026-03-01T10:00:00Z',
};

describe('glMilestoneToMilestone', () => {
  it('maps an active milestone correctly', () => {
    const ms = glMilestoneToMilestone(baseMilestone, PROJECT_ID, BASE_URL);
    expect(ms.type).toBe('milestone');
    expect(ms.title).toBe('v0.1 - MVP');
    expect(ms.status).toBe('in_progress');
    expect(ms.target_date).toBe('2026-06-30');
    expect(ms.body).toBe('Initial minimal viable product release.');
    expect(ms.gitlab?.project_id).toBe(PROJECT_ID);
    expect(ms.gitlab?.milestone_id).toBe(101);
    expect(ms.gitlab?.base_url).toBe(BASE_URL);
    expect(ms.id).toHaveLength(12);
    expect(ms.filePath).toBe('.meta/roadmap/milestones/v01-mvp.md');
  });

  it('maps a closed milestone to done status', () => {
    const closedMs: GlMilestone = { ...baseMilestone, state: 'closed' };
    const ms = glMilestoneToMilestone(closedMs, PROJECT_ID, BASE_URL);
    expect(ms.status).toBe('done');
  });

  it('handles milestone with no description or due date', () => {
    const emptyMs: GlMilestone = {
      ...baseMilestone,
      description: null,
      due_date: null,
    };
    const ms = glMilestoneToMilestone(emptyMs, PROJECT_ID, BASE_URL);
    expect(ms.body).toBe('');
    expect(ms.target_date).toBeUndefined();
  });
});

describe('isEpicIssue', () => {
  it('returns true for issues with epic label', () => {
    expect(isEpicIssue(epicIssue)).toBe(true);
  });

  it('returns false for issues without epic label', () => {
    expect(isEpicIssue(storyIssue)).toBe(false);
  });

  it('uses custom epic labels from config', () => {
    const config: Pick<GitLabConfig, 'label_mapping'> = {
      label_mapping: { epic_labels: ['theme'] },
    };
    expect(isEpicIssue(epicIssue, config)).toBe(false);
    const themeIssue: GlIssue = {
      ...storyIssue,
      labels: ['theme'],
    };
    expect(isEpicIssue(themeIssue, config)).toBe(true);
  });
});

describe('glIssueToEntity', () => {
  it('creates an Epic from issue with epic label', () => {
    const entity = glIssueToEntity(epicIssue, undefined, PROJECT_ID, BASE_URL);
    expect(entity.type).toBe('epic');
    expect(entity.title).toBe('User Authentication');
    expect(entity.status).toBe('todo');
    if (entity.type === 'epic') {
      expect(entity.owner).toBe('alice');
      expect(entity.labels).toEqual(['feature']);
      expect(entity.priority).toBe('high'); // weight 5
    }
    expect(entity.gitlab?.issue_iid).toBe(1);
    expect(entity.gitlab?.project_id).toBe(PROJECT_ID);
    expect(entity.id).toHaveLength(12);
  });

  it('creates a Story from issue without epic label', () => {
    const entity = glIssueToEntity(storyIssue, undefined, PROJECT_ID, BASE_URL);
    expect(entity.type).toBe('story');
    expect(entity.title).toBe('Add OAuth2 provider support');
    if (entity.type === 'story') {
      expect(entity.assignee).toBe('alice');
      expect(entity.labels).toEqual(['feature']);
      expect(entity.priority).toBe('medium'); // weight 3
    }
  });

  it('maps closed issues to done status', () => {
    const entity = glIssueToEntity(
      closedIssue,
      undefined,
      PROJECT_ID,
      BASE_URL,
    );
    expect(entity.status).toBe('done');
  });

  it('handles issue with no description', () => {
    const entity = glIssueToEntity(
      noDescIssue,
      undefined,
      PROJECT_ID,
      BASE_URL,
    );
    expect(entity.body).toBe('');
  });

  it('handles issue with no assignee', () => {
    const entity = glIssueToEntity(
      noDescIssue,
      undefined,
      PROJECT_ID,
      BASE_URL,
    );
    if (entity.type === 'story') {
      expect(entity.assignee).toBeNull();
    }
  });

  it('maps weight to priority correctly', () => {
    const lowWeight: GlIssue = { ...storyIssue, weight: 1 };
    const medWeight: GlIssue = { ...storyIssue, weight: 4 };
    const highWeight: GlIssue = { ...storyIssue, weight: 6 };
    const critWeight: GlIssue = { ...storyIssue, weight: 8 };
    const nullWeight: GlIssue = { ...storyIssue, weight: null };

    expect(glIssueToEntity(lowWeight).priority).toBe('low');
    expect(glIssueToEntity(medWeight).priority).toBe('medium');
    expect(glIssueToEntity(highWeight).priority).toBe('high');
    expect(glIssueToEntity(critWeight).priority).toBe('critical');
    expect(glIssueToEntity(nullWeight).priority).toBe('medium');
  });
});

describe('glEpicToEpic', () => {
  it('creates an Epic from native GitLab epic', () => {
    const glEpic = {
      id: 201,
      iid: 1,
      group_id: 10,
      title: 'Platform Migration',
      description: 'Migrate to new platform.',
      state: 'opened' as const,
      labels: ['platform'],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const epic = glEpicToEpic(glEpic, PROJECT_ID, BASE_URL);
    expect(epic.type).toBe('epic');
    expect(epic.title).toBe('Platform Migration');
    expect(epic.status).toBe('todo');
    expect(epic.gitlab?.epic_iid).toBe(1);
    expect(epic.labels).toEqual(['platform']);
    expect(epic.filePath).toBe('.meta/epics/platform-migration/epic.md');
  });
});

describe('determineFilePath', () => {
  it('places epics in .meta/epics/<slug>/epic.md', () => {
    const entity = glIssueToEntity(epicIssue, undefined, PROJECT_ID, BASE_URL);
    const path = determineFilePath(entity as never);
    expect(path).toBe('.meta/epics/user-authentication/epic.md');
  });

  it('places orphan stories in .meta/stories/<slug>.md', () => {
    const entity = glIssueToEntity(storyIssue, undefined, PROJECT_ID, BASE_URL);
    const path = determineFilePath(entity as never);
    expect(path).toBe('.meta/stories/add-oauth2-provider-support.md');
  });

  it('places stories under epic when parentEpicSlug is provided', () => {
    const entity = glIssueToEntity(storyIssue, undefined, PROJECT_ID, BASE_URL);
    const path = determineFilePath(entity as never, 'user-authentication');
    expect(path).toBe(
      '.meta/epics/user-authentication/stories/add-oauth2-provider-support.md',
    );
  });

  it('places milestones in .meta/roadmap/milestones/<slug>.md', () => {
    const ms = glMilestoneToMilestone(baseMilestone, PROJECT_ID, BASE_URL);
    const path = determineFilePath(ms);
    expect(path).toBe('.meta/roadmap/milestones/v01-mvp.md');
  });
});

describe('milestoneToGlMilestone', () => {
  it('maps milestone back to GitLab params', () => {
    const ms = glMilestoneToMilestone(baseMilestone, PROJECT_ID, BASE_URL);
    const params = milestoneToGlMilestone(ms);
    expect(params.title).toBe('v0.1 - MVP');
    expect(params.description).toBe('Initial minimal viable product release.');
    expect(params.due_date).toBe('2026-06-30');
    expect(params.state_event).toBe('activate');
  });

  it('maps done milestone to close state_event', () => {
    const closedMs: GlMilestone = { ...baseMilestone, state: 'closed' };
    const ms = glMilestoneToMilestone(closedMs, PROJECT_ID, BASE_URL);
    const params = milestoneToGlMilestone(ms);
    expect(params.state_event).toBe('close');
  });
});

describe('entityToGlIssue', () => {
  it('maps epic to issue with epic label added', () => {
    const entity = glIssueToEntity(epicIssue, undefined, PROJECT_ID, BASE_URL);
    const params = entityToGlIssue(entity as never);
    expect(params.title).toBe('User Authentication');
    expect(params.labels).toContain('epic');
    expect(params.labels).toContain('feature');
    expect(params.state_event).toBe('reopen');
  });

  it('maps story to issue without epic label', () => {
    const entity = glIssueToEntity(storyIssue, undefined, PROJECT_ID, BASE_URL);
    const params = entityToGlIssue(entity as never);
    expect(params.title).toBe('Add OAuth2 provider support');
    expect(params.labels).not.toContain('epic');
  });

  it('maps closed entity to close state_event', () => {
    const entity = glIssueToEntity(
      closedIssue,
      undefined,
      PROJECT_ID,
      BASE_URL,
    );
    const params = entityToGlIssue(entity as never);
    expect(params.state_event).toBe('close');
  });
});
