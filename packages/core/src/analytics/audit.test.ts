import { describe, expect, it } from 'vitest';
import type { ResolvedEpic, ResolvedTree } from '../resolver/types.js';
import { auditTree } from './audit.js';

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
    body: 'Some body text',
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
    body: 'Epic body',
    filePath: '/tmp/epic.md',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    resolvedStories: stories,
    resolvedMilestone: undefined,
    ...overrides,
  } as ResolvedEpic;
}

function makeTree(overrides: Partial<ResolvedTree> = {}): ResolvedTree {
  return {
    stories: [],
    epics: [],
    milestones: [],
    roadmaps: [],
    prds: [],
    sprints: [],
    errors: [],
    ...overrides,
  };
}

describe('auditTree', () => {
  describe('stale detection', () => {
    it('detects stale stories (old updated_at, todo status)', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 120);
      const tree = makeTree({
        stories: [
          makeStory({ updated_at: oldDate.toISOString(), status: 'todo' }),
          makeStory({ updated_at: new Date().toISOString(), status: 'todo' }),
        ] as ResolvedTree['stories'],
      });
      const report = auditTree(tree);
      expect(report.stale).toHaveLength(1);
    });

    it('does not flag done stories as stale', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 120);
      const tree = makeTree({
        stories: [
          makeStory({ updated_at: oldDate.toISOString(), status: 'done' }),
        ] as ResolvedTree['stories'],
      });
      const report = auditTree(tree);
      expect(report.stale).toHaveLength(0);
    });

    it('respects custom staleDays', () => {
      const date = new Date();
      date.setDate(date.getDate() - 40);
      const tree = makeTree({
        stories: [
          makeStory({ updated_at: date.toISOString(), status: 'todo' }),
        ] as ResolvedTree['stories'],
      });
      expect(auditTree(tree, { staleDays: 30 }).stale).toHaveLength(1);
      expect(auditTree(tree, { staleDays: 60 }).stale).toHaveLength(0);
    });
  });

  describe('orphan detection', () => {
    it('detects stories without epic_ref', () => {
      const tree = makeTree({
        stories: [
          makeStory({ epic_ref: null }),
          makeStory({ epic_ref: { id: 'e-1' } }),
        ] as ResolvedTree['stories'],
      });
      const report = auditTree(tree);
      expect(report.orphans).toHaveLength(1);
    });

    it('does not flag done orphans', () => {
      const tree = makeTree({
        stories: [
          makeStory({ epic_ref: null, status: 'done' }),
        ] as ResolvedTree['stories'],
      });
      expect(auditTree(tree).orphans).toHaveLength(0);
    });
  });

  describe('empty body detection', () => {
    it('detects stories and epics with empty bodies', () => {
      const tree = makeTree({
        stories: [
          makeStory({ body: '' }),
          makeStory({ body: '   ' }),
          makeStory({ body: 'has content' }),
        ] as ResolvedTree['stories'],
        epics: [makeEpic([], { body: '' })],
      });
      const report = auditTree(tree);
      expect(report.emptyBodies).toHaveLength(3);
    });
  });

  describe('zombie epic detection', () => {
    it('detects epics where all stories are done but epic is not', () => {
      const doneStories = [
        makeStory({ status: 'done' }),
        makeStory({ status: 'cancelled' }),
      ];
      const tree = makeTree({
        epics: [
          makeEpic(doneStories, { status: 'in_progress' }),
          makeEpic([makeStory({ status: 'done' })], { status: 'done' }),
        ],
      });
      const report = auditTree(tree);
      expect(report.zombieEpics).toHaveLength(1);
    });

    it('does not flag epics with no stories', () => {
      const tree = makeTree({
        epics: [makeEpic([], { status: 'todo' })],
      });
      expect(auditTree(tree).zombieEpics).toHaveLength(0);
    });
  });

  describe('duplicate detection', () => {
    it('detects similar titles', () => {
      const tree = makeTree({
        stories: [
          makeStory({ title: 'Add user authentication module' }),
          makeStory({ title: 'Add user authentication modules' }),
        ] as ResolvedTree['stories'],
      });
      const report = auditTree(tree);
      expect(report.duplicates.length).toBeGreaterThanOrEqual(1);
      expect(report.duplicates[0].similarity).toBeGreaterThanOrEqual(0.85);
    });

    it('does not flag dissimilar titles', () => {
      const tree = makeTree({
        stories: [
          makeStory({ title: 'Add authentication' }),
          makeStory({ title: 'Fix database migration' }),
        ] as ResolvedTree['stories'],
      });
      expect(auditTree(tree).duplicates).toHaveLength(0);
    });
  });

  it('computes summary correctly', () => {
    const tree = makeTree({
      stories: [
        makeStory({ epic_ref: null, body: '' }),
      ] as ResolvedTree['stories'],
      milestones: [],
    });
    const report = auditTree(tree);
    expect(report.summary.total).toBe(1);
    expect(report.summary.issues).toBeGreaterThanOrEqual(2); // orphan + empty body
  });
});
