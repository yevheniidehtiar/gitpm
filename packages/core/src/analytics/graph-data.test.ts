import { describe, expect, it } from 'vitest';
import type {
  ResolvedEpic,
  ResolvedMilestone,
  ResolvedTree,
} from '../resolver/types.js';
import { buildGraphData } from './graph-data.js';

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

describe('buildGraphData', () => {
  it('returns empty graph for empty tree', () => {
    const result = buildGraphData(makeTree());
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('creates nodes for all entity types', () => {
    const tree = makeTree({
      stories: [
        {
          type: 'story',
          id: 's1',
          title: 'Story',
          status: 'todo',
          priority: 'medium',
          labels: [],
          assignee: null,
          estimate: null,
          epic_ref: null,
          body: '',
          filePath: '/s.md',
          created_at: '',
          updated_at: '',
        },
      ] as ResolvedTree['stories'],
      epics: [
        {
          type: 'epic',
          id: 'e1',
          title: 'Epic',
          status: 'in_progress',
          priority: 'high',
          labels: [],
          owner: null,
          milestone_ref: null,
          body: '',
          filePath: '/e.md',
          created_at: '',
          updated_at: '',
          resolvedStories: [],
          resolvedMilestone: undefined,
        },
      ] as ResolvedEpic[],
      milestones: [
        {
          type: 'milestone',
          id: 'm1',
          title: 'MS',
          status: 'todo',
          body: '',
          filePath: '/m.md',
          created_at: '',
          updated_at: '',
          resolvedEpics: [],
        },
      ] as ResolvedMilestone[],
    });

    const result = buildGraphData(tree);
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.map((n) => n.type)).toEqual([
      'story',
      'epic',
      'milestone',
    ]);
  });

  it('creates edges for story→epic and epic→milestone refs', () => {
    const ms = {
      type: 'milestone' as const,
      id: 'm1',
      title: 'MS',
      status: 'todo' as const,
      body: '',
      filePath: '/m.md',
      created_at: '',
      updated_at: '',
      resolvedEpics: [],
    };

    const epic = {
      type: 'epic' as const,
      id: 'e1',
      title: 'Epic',
      status: 'in_progress' as const,
      priority: 'high' as const,
      labels: [],
      owner: null,
      milestone_ref: { id: 'm1' },
      body: '',
      filePath: '/e.md',
      created_at: '',
      updated_at: '',
      resolvedStories: [],
      resolvedMilestone: ms,
    };

    const tree = makeTree({
      stories: [
        {
          type: 'story',
          id: 's1',
          title: 'Story',
          status: 'todo',
          priority: 'medium',
          labels: [],
          assignee: null,
          estimate: null,
          epic_ref: { id: 'e1' },
          body: '',
          filePath: '/s.md',
          created_at: '',
          updated_at: '',
          resolvedEpic: epic,
        },
      ] as ResolvedTree['stories'],
      epics: [epic] as ResolvedEpic[],
      milestones: [ms] as ResolvedMilestone[],
    });

    const result = buildGraphData(tree);
    expect(result.edges).toHaveLength(2);
    expect(result.edges).toContainEqual({
      source: 's1',
      target: 'e1',
      label: 'epic_ref',
    });
    expect(result.edges).toContainEqual({
      source: 'e1',
      target: 'm1',
      label: 'milestone_ref',
    });
  });

  it('does not create edges for unresolved refs', () => {
    const tree = makeTree({
      stories: [
        {
          type: 'story',
          id: 's1',
          title: 'Orphan',
          status: 'todo',
          priority: 'medium',
          labels: [],
          assignee: null,
          estimate: null,
          epic_ref: null,
          body: '',
          filePath: '/s.md',
          created_at: '',
          updated_at: '',
        },
      ] as ResolvedTree['stories'],
    });

    const result = buildGraphData(tree);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });
});
