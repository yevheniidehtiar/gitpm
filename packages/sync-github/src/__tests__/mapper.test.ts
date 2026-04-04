import { describe, expect, it } from 'vitest';
import type { GhIssue, GhMilestone } from '../client.js';
import {
  determineFilePath,
  entityToGhIssue,
  ghIssueToEntity,
  ghMilestoneToMilestone,
  isEpicIssue,
  milestoneToGhMilestone,
} from '../mapper.js';
import type { GitHubConfig } from '../types.js';

const REPO = 'test-org/test-repo';

const baseMilestone: GhMilestone = {
  number: 1,
  title: 'Q2 2026 Launch',
  description: 'Launch by Q2',
  state: 'open',
  due_on: '2026-06-30T00:00:00Z',
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-02-20T14:30:00Z',
};

const epicIssue: GhIssue = {
  number: 1,
  title: 'Balancing Engine',
  body: 'Epic for balancing engine.',
  state: 'open',
  assignee: { login: 'alice' },
  labels: [{ name: 'epic' }, { name: 'backend' }],
  milestone: { number: 1, title: 'Q2 2026 Launch' },
  created_at: '2026-01-20T08:00:00Z',
  updated_at: '2026-03-10T12:00:00Z',
};

const storyIssue: GhIssue = {
  number: 3,
  title: 'Price Feed Ingestion',
  body: 'Implement price feed.',
  state: 'open',
  assignee: { login: 'charlie' },
  labels: [{ name: 'backend' }],
  milestone: { number: 1, title: 'Q2 2026 Launch' },
  created_at: '2026-02-05T10:00:00Z',
  updated_at: '2026-03-12T16:00:00Z',
};

const closedIssue: GhIssue = {
  number: 5,
  title: 'Setup CI/CD',
  body: 'Configure CI.',
  state: 'closed',
  assignee: null,
  labels: [],
  milestone: null,
  created_at: '2026-01-18T07:00:00Z',
  updated_at: '2026-02-15T13:00:00Z',
};

const noBodyIssue: GhIssue = {
  number: 6,
  title: 'Issue with no body',
  body: null,
  state: 'open',
  assignee: null,
  labels: [],
  milestone: null,
  created_at: '2026-03-01T08:00:00Z',
  updated_at: '2026-03-01T08:00:00Z',
};

describe('ghMilestoneToMilestone', () => {
  it('maps an open milestone correctly', () => {
    const ms = ghMilestoneToMilestone(baseMilestone, REPO);
    expect(ms.type).toBe('milestone');
    expect(ms.title).toBe('Q2 2026 Launch');
    expect(ms.status).toBe('in_progress');
    expect(ms.target_date).toBe('2026-06-30T00:00:00Z');
    expect(ms.body).toBe('Launch by Q2');
    expect(ms.github?.repo).toBe(REPO);
    expect(ms.github?.milestone_id).toBe(1);
    expect(ms.id).toHaveLength(12);
    expect(ms.filePath).toBe('.meta/roadmap/milestones/q2-2026-launch.md');
  });

  it('maps a closed milestone to done status', () => {
    const closedMs: GhMilestone = { ...baseMilestone, state: 'closed' };
    const ms = ghMilestoneToMilestone(closedMs, REPO);
    expect(ms.status).toBe('done');
  });

  it('handles milestone with no description or due date', () => {
    const emptyMs: GhMilestone = {
      ...baseMilestone,
      description: null,
      due_on: null,
    };
    const ms = ghMilestoneToMilestone(emptyMs, REPO);
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
    const config: Pick<GitHubConfig, 'label_mapping'> = {
      label_mapping: { epic_labels: ['theme'] },
    };
    expect(isEpicIssue(epicIssue, config)).toBe(false);
    const themeIssue: GhIssue = {
      ...storyIssue,
      labels: [{ name: 'theme' }],
    };
    expect(isEpicIssue(themeIssue, config)).toBe(true);
  });
});

describe('ghIssueToEntity', () => {
  it('creates an Epic from issue with epic label', () => {
    const entity = ghIssueToEntity(epicIssue, undefined, REPO);
    expect(entity.type).toBe('epic');
    expect(entity.title).toBe('Balancing Engine');
    expect(entity.status).toBe('todo');
    if (entity.type === 'epic') {
      expect(entity.owner).toBe('alice');
      // 'epic' label should be filtered out, only 'backend' remains
      expect(entity.labels).toEqual(['backend']);
    }
    expect(entity.github?.issue_number).toBe(1);
    expect(entity.github?.repo).toBe(REPO);
    expect(entity.id).toHaveLength(12);
  });

  it('creates a Story from issue without epic label', () => {
    const entity = ghIssueToEntity(storyIssue, undefined, REPO);
    expect(entity.type).toBe('story');
    expect(entity.title).toBe('Price Feed Ingestion');
    if (entity.type === 'story') {
      expect(entity.assignee).toBe('charlie');
      expect(entity.labels).toEqual(['backend']);
    }
  });

  it('maps closed issues to done status', () => {
    const entity = ghIssueToEntity(closedIssue, undefined, REPO);
    expect(entity.status).toBe('done');
  });

  it('handles issue with no body', () => {
    const entity = ghIssueToEntity(noBodyIssue, undefined, REPO);
    expect(entity.body).toBe('');
  });

  it('handles issue with no assignee', () => {
    const entity = ghIssueToEntity(closedIssue, undefined, REPO);
    if (entity.type === 'story') {
      expect(entity.assignee).toBeNull();
    }
  });
});

describe('determineFilePath', () => {
  it('places epics in .meta/epics/<slug>/epic.md', () => {
    const entity = ghIssueToEntity(epicIssue, undefined, REPO);
    const path = determineFilePath(entity as never);
    expect(path).toBe('.meta/epics/balancing-engine/epic.md');
  });

  it('places orphan stories in .meta/stories/<slug>.md', () => {
    const entity = ghIssueToEntity(storyIssue, undefined, REPO);
    const path = determineFilePath(entity as never);
    expect(path).toBe('.meta/stories/price-feed-ingestion.md');
  });

  it('places stories under epic when parentEpicSlug is provided', () => {
    const entity = ghIssueToEntity(storyIssue, undefined, REPO);
    const path = determineFilePath(entity as never, 'balancing-engine');
    expect(path).toBe(
      '.meta/epics/balancing-engine/stories/price-feed-ingestion.md',
    );
  });

  it('places milestones in .meta/roadmap/milestones/<slug>.md', () => {
    const ms = ghMilestoneToMilestone(baseMilestone, REPO);
    const path = determineFilePath(ms);
    expect(path).toBe('.meta/roadmap/milestones/q2-2026-launch.md');
  });
});

describe('milestoneToGhMilestone', () => {
  it('maps milestone back to GitHub params', () => {
    const ms = ghMilestoneToMilestone(baseMilestone, REPO);
    const params = milestoneToGhMilestone(ms);
    expect(params.title).toBe('Q2 2026 Launch');
    expect(params.description).toBe('Launch by Q2');
    expect(params.due_on).toBe('2026-06-30T00:00:00Z');
    expect(params.state).toBe('open');
  });

  it('maps done milestone to closed state', () => {
    const closedMs: GhMilestone = { ...baseMilestone, state: 'closed' };
    const ms = ghMilestoneToMilestone(closedMs, REPO);
    const params = milestoneToGhMilestone(ms);
    expect(params.state).toBe('closed');
  });
});

describe('entityToGhIssue', () => {
  it('maps epic to issue with epic label added', () => {
    const entity = ghIssueToEntity(epicIssue, undefined, REPO);
    const params = entityToGhIssue(entity as never);
    expect(params.title).toBe('Balancing Engine');
    expect(params.labels).toContain('epic');
    expect(params.labels).toContain('backend');
    expect(params.assignees).toEqual(['alice']);
    expect(params.state).toBe('open');
  });

  it('maps story to issue without epic label', () => {
    const entity = ghIssueToEntity(storyIssue, undefined, REPO);
    const params = entityToGhIssue(entity as never);
    expect(params.title).toBe('Price Feed Ingestion');
    expect(params.labels).not.toContain('epic');
    expect(params.assignees).toEqual(['charlie']);
  });

  it('maps closed entity to closed state', () => {
    const entity = ghIssueToEntity(closedIssue, undefined, REPO);
    const params = entityToGhIssue(entity as never);
    expect(params.state).toBe('closed');
  });
});
