import { describe, expect, it } from 'vitest';
import type {
  ResolvedEpic,
  ResolvedMilestone,
  ResolvedTree,
} from '../resolver/types.js';
import {
  computeEpicProgress,
  computeMilestoneProgress,
  computeProjectProgress,
} from './progress.js';

function makeStory(overrides: Record<string, unknown> = {}) {
  return {
    type: 'story' as const,
    id: `s-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test story',
    status: 'todo' as const,
    priority: 'medium' as const,
    assignee: null,
    labels: [],
    estimate: null,
    epic_ref: null,
    body: '',
    filePath: '/tmp/test.md',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeEpic(
  stories: ReturnType<typeof makeStory>[],
  overrides: Record<string, unknown> = {},
): ResolvedEpic {
  return {
    type: 'epic' as const,
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test epic',
    status: 'in_progress' as const,
    priority: 'medium' as const,
    owner: null,
    labels: [],
    milestone_ref: null,
    body: '',
    filePath: '/tmp/epic.md',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    resolvedStories: stories,
    resolvedMilestone: undefined,
    ...overrides,
  } as ResolvedEpic;
}

describe('computeEpicProgress', () => {
  it('returns zero progress for epic with no stories', () => {
    const epic = makeEpic([]);
    const result = computeEpicProgress(epic);
    expect(result.total).toBe(0);
    expect(result.done).toBe(0);
    expect(result.progress).toBe(0);
  });

  it('computes progress from mixed statuses', () => {
    const stories = [
      makeStory({ status: 'done' }),
      makeStory({ status: 'done' }),
      makeStory({ status: 'in_progress' }),
      makeStory({ status: 'todo' }),
    ];
    const epic = makeEpic(stories);
    const result = computeEpicProgress(epic);
    expect(result.total).toBe(4);
    expect(result.done).toBe(2);
    expect(result.inProgress).toBe(1);
    expect(result.progress).toBe(0.5);
  });

  it('counts cancelled as done', () => {
    const stories = [
      makeStory({ status: 'cancelled' }),
      makeStory({ status: 'done' }),
    ];
    const result = computeEpicProgress(makeEpic(stories));
    expect(result.done).toBe(2);
    expect(result.progress).toBe(1);
  });

  it('counts blocked stories (todo/backlog with no assignee)', () => {
    const stories = [
      makeStory({ status: 'todo', assignee: null }),
      makeStory({ status: 'todo', assignee: 'alice' }),
      makeStory({ status: 'backlog', assignee: null }),
    ];
    const result = computeEpicProgress(makeEpic(stories));
    expect(result.blocked).toBe(2);
  });
});

describe('computeMilestoneProgress', () => {
  it('aggregates across linked epics', () => {
    const ms: ResolvedMilestone = {
      type: 'milestone',
      id: 'ms-1',
      title: 'v1.0',
      status: 'in_progress',
      body: '',
      filePath: '/tmp/ms.md',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      resolvedEpics: [],
    } as ResolvedMilestone;

    const epics: ResolvedEpic[] = [
      makeEpic([makeStory({ status: 'done' }), makeStory({ status: 'todo' })], {
        milestone_ref: { id: 'ms-1' },
      }),
      makeEpic([makeStory({ status: 'done' }), makeStory({ status: 'done' })], {
        milestone_ref: { id: 'ms-1' },
      }),
      makeEpic([makeStory({ status: 'todo' })], {
        milestone_ref: { id: 'other' },
      }),
    ];

    const result = computeMilestoneProgress(ms, epics);
    expect(result.total).toBe(4);
    expect(result.done).toBe(3);
    expect(result.progress).toBe(0.75);
    expect(result.epics).toHaveLength(2);
  });
});

describe('computeProjectProgress', () => {
  it('separates milestone-linked and orphan epics', () => {
    const tree: ResolvedTree = {
      stories: [],
      epics: [
        makeEpic([makeStory({ status: 'done' })], {
          id: 'linked',
          milestone_ref: { id: 'ms-1' },
        }),
        makeEpic([makeStory({ status: 'todo' })], {
          id: 'orphan',
          milestone_ref: null,
        }),
      ],
      milestones: [
        {
          type: 'milestone',
          id: 'ms-1',
          title: 'v1.0',
          status: 'in_progress',
          body: '',
          filePath: '/tmp/ms.md',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          resolvedEpics: [],
        } as ResolvedMilestone,
      ],
      roadmaps: [],
      prds: [],
      errors: [],
    };

    const result = computeProjectProgress(tree);
    expect(result.milestones).toHaveLength(1);
    expect(result.milestones[0].done).toBe(1);
    expect(result.orphanEpics).toHaveLength(1);
    expect(result.orphanEpics[0].epicId).toBe('orphan');
    expect(result.overall.total).toBe(2);
    expect(result.overall.done).toBe(1);
    expect(result.overall.progress).toBe(0.5);
  });

  it('handles empty tree', () => {
    const tree: ResolvedTree = {
      stories: [],
      epics: [],
      milestones: [],
      roadmaps: [],
      prds: [],
      errors: [],
    };
    const result = computeProjectProgress(tree);
    expect(result.milestones).toHaveLength(0);
    expect(result.orphanEpics).toHaveLength(0);
    expect(result.overall.progress).toBe(0);
  });
});
