import { describe, expect, it } from 'vitest';
import {
  entityRefSchema,
  epicSchema,
  gitHubSyncSchema,
  milestoneSchema,
  prdSchema,
  prioritySchema,
  roadmapSchema,
  statusSchema,
  storySchema,
} from '../index.js';

describe('Common schemas', () => {
  it('validates status values', () => {
    expect(statusSchema.parse('backlog')).toBe('backlog');
    expect(statusSchema.parse('done')).toBe('done');
    expect(() => statusSchema.parse('invalid')).toThrow();
  });

  it('validates priority values', () => {
    expect(prioritySchema.parse('high')).toBe('high');
    expect(() => prioritySchema.parse('urgent')).toThrow();
  });

  it('validates entity ref', () => {
    expect(entityRefSchema.parse({ id: 'abc123' })).toEqual({ id: 'abc123' });
    expect(entityRefSchema.parse({ id: 'abc', path: 'some/path' })).toEqual({
      id: 'abc',
      path: 'some/path',
    });
    expect(() => entityRefSchema.parse({})).toThrow();
  });

  it('validates github sync', () => {
    const valid = {
      repo: 'org/repo',
      last_sync_hash: 'abc123',
      synced_at: '2026-01-01T00:00:00Z',
    };
    expect(gitHubSyncSchema.parse(valid)).toMatchObject(valid);
    expect(() => gitHubSyncSchema.parse({})).toThrow();
  });

  it('accepts github sync without last_sync_hash (pre-sync baseline)', () => {
    const preSync = {
      repo: 'org/repo',
      synced_at: '2026-01-01T00:00:00Z',
    };
    const parsed = gitHubSyncSchema.parse(preSync);
    expect(parsed.repo).toBe('org/repo');
    expect(parsed.last_sync_hash).toBeUndefined();
  });
});

describe('Story schema', () => {
  const validStory = {
    type: 'story' as const,
    id: 'st_test',
    title: 'Test story',
    status: 'todo' as const,
    priority: 'medium' as const,
    filePath: '/test/path.md',
  };

  it('parses valid story', () => {
    const result = storySchema.parse(validStory);
    expect(result.type).toBe('story');
    expect(result.title).toBe('Test story');
    expect(result.labels).toEqual([]);
    expect(result.body).toBe('');
  });

  it('parses story with all fields', () => {
    const full = {
      ...validStory,
      assignee: 'john',
      labels: ['backend'],
      estimate: 5,
      epic_ref: { id: 'ep_1' },
      body: 'Some description',
      created_at: '2026-01-01T00:00:00Z',
    };
    const result = storySchema.parse(full);
    expect(result.assignee).toBe('john');
    expect(result.estimate).toBe(5);
  });

  it('rejects story without title', () => {
    const { title, ...noTitle } = validStory;
    expect(() => storySchema.parse(noTitle)).toThrow();
  });

  it('rejects story with invalid status', () => {
    expect(() =>
      storySchema.parse({ ...validStory, status: 'nope' }),
    ).toThrow();
  });
});

describe('Epic schema', () => {
  const validEpic = {
    type: 'epic' as const,
    id: 'ep_test',
    title: 'Test epic',
    status: 'in_progress' as const,
    priority: 'high' as const,
    filePath: '/test/epic.md',
  };

  it('parses valid epic', () => {
    const result = epicSchema.parse(validEpic);
    expect(result.type).toBe('epic');
    expect(result.labels).toEqual([]);
  });

  it('parses epic with milestone ref', () => {
    const result = epicSchema.parse({
      ...validEpic,
      milestone_ref: { id: 'ms_1' },
    });
    expect(result.milestone_ref).toEqual({ id: 'ms_1' });
  });

  it('rejects epic without id', () => {
    const { id, ...noId } = validEpic;
    expect(() => epicSchema.parse(noId)).toThrow();
  });
});

describe('Milestone schema', () => {
  const validMilestone = {
    type: 'milestone' as const,
    id: 'ms_test',
    title: 'Test milestone',
    status: 'backlog' as const,
    filePath: '/test/ms.md',
  };

  it('parses valid milestone', () => {
    const result = milestoneSchema.parse(validMilestone);
    expect(result.type).toBe('milestone');
  });

  it('parses milestone with target date', () => {
    const result = milestoneSchema.parse({
      ...validMilestone,
      target_date: '2026-06-30',
    });
    expect(result.target_date).toBe('2026-06-30');
  });

  it('rejects milestone without title', () => {
    const { title, ...noTitle } = validMilestone;
    expect(() => milestoneSchema.parse(noTitle)).toThrow();
  });
});

describe('Roadmap schema', () => {
  const validRoadmap = {
    type: 'roadmap' as const,
    id: 'rm_test',
    title: 'Test roadmap',
    filePath: '/test/roadmap.yaml',
  };

  it('parses valid roadmap', () => {
    const result = roadmapSchema.parse(validRoadmap);
    expect(result.type).toBe('roadmap');
    expect(result.milestones).toEqual([]);
  });

  it('parses roadmap with milestones', () => {
    const result = roadmapSchema.parse({
      ...validRoadmap,
      milestones: [{ id: 'ms_1' }, { id: 'ms_2' }],
    });
    expect(result.milestones).toHaveLength(2);
  });

  it('rejects roadmap without title', () => {
    const { title, ...noTitle } = validRoadmap;
    expect(() => roadmapSchema.parse(noTitle)).toThrow();
  });
});

describe('PRD schema', () => {
  const validPrd = {
    type: 'prd' as const,
    id: 'prd_test',
    title: 'Test PRD',
    status: 'in_review' as const,
    filePath: '/test/prd.md',
  };

  it('parses valid PRD', () => {
    const result = prdSchema.parse(validPrd);
    expect(result.type).toBe('prd');
    expect(result.epic_refs).toEqual([]);
  });

  it('parses PRD with epic refs', () => {
    const result = prdSchema.parse({
      ...validPrd,
      epic_refs: [{ id: 'ep_1' }],
      owner: 'alice',
    });
    expect(result.epic_refs).toHaveLength(1);
    expect(result.owner).toBe('alice');
  });

  it('rejects PRD with invalid status', () => {
    expect(() => prdSchema.parse({ ...validPrd, status: 'invalid' })).toThrow();
  });
});
