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
    // s1 -> e1 -> m1 is the only chain in this tree, so it's the critical path.
    expect(result.edges).toContainEqual({
      source: 's1',
      target: 'e1',
      label: 'epic_ref',
      critical: true,
    });
    expect(result.edges).toContainEqual({
      source: 'e1',
      target: 'm1',
      label: 'milestone_ref',
      critical: true,
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

  it('creates roadmap node with milestone edges', () => {
    const ms = {
      type: 'milestone' as const,
      id: 'm1',
      title: 'MS',
      status: 'todo' as const,
      body: '',
      filePath: '/m.md',
      created_at: '',
      updated_at: '',
    };
    const tree = makeTree({
      roadmaps: [
        {
          type: 'roadmap',
          id: 'r1',
          title: 'Roadmap 2026',
          description: '',
          milestones: [{ id: 'm1' }],
          filePath: '/r.yaml',
          resolvedMilestones: [ms],
        },
      ] as ResolvedTree['roadmaps'],
    });

    const result = buildGraphData(tree);
    // 'm1' isn't itself a node in this tree (tree.milestones is empty — only
    // referenced as an edge target), so it can't participate in the active
    // subgraph and no critical path is marked.
    expect(result.nodes).toContainEqual({
      id: 'r1',
      title: 'Roadmap 2026',
      type: 'roadmap',
      status: '',
      critical: false,
    });
    expect(result.edges).toContainEqual({
      source: 'r1',
      target: 'm1',
      label: 'milestone',
      critical: false,
    });
  });

  it('creates prd node with epic edges', () => {
    const epic = {
      type: 'epic' as const,
      id: 'e1',
      title: 'Epic',
      status: 'in_progress' as const,
      priority: 'high' as const,
      labels: [],
      owner: null,
      milestone_ref: null,
      body: '',
      filePath: '/e.md',
      created_at: '',
      updated_at: '',
    };
    const tree = makeTree({
      prds: [
        {
          type: 'prd',
          id: 'p1',
          title: 'PRD',
          status: 'todo',
          owner: null,
          epic_refs: [{ id: 'e1' }],
          body: '',
          filePath: '/p.md',
          resolvedEpics: [epic],
        },
      ] as ResolvedTree['prds'],
    });

    const result = buildGraphData(tree);
    expect(result.nodes).toContainEqual({
      id: 'p1',
      title: 'PRD',
      type: 'prd',
      status: 'todo',
      critical: false,
    });
    expect(result.edges).toContainEqual({
      source: 'p1',
      target: 'e1',
      label: 'epic_ref',
      critical: false,
    });
  });

  it('creates sprint node with story edges', () => {
    const story = {
      type: 'story' as const,
      id: 's1',
      title: 'Story',
      status: 'todo' as const,
      priority: 'medium' as const,
      labels: [],
      assignee: null,
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: '/s.md',
      created_at: '',
      updated_at: '',
    };
    const tree = makeTree({
      sprints: [
        {
          type: 'sprint',
          id: 'sp1',
          title: 'Sprint 1',
          status: 'in_progress',
          start_date: '2026-01-01',
          end_date: '2026-01-14',
          stories: [{ id: 's1' }],
          body: '',
          filePath: '/sp.md',
          created_at: '',
          updated_at: '',
          resolvedStories: [story],
        },
      ] as ResolvedTree['sprints'],
    });

    const result = buildGraphData(tree);
    expect(result.nodes).toContainEqual({
      id: 'sp1',
      title: 'Sprint 1',
      type: 'sprint',
      status: 'in_progress',
      critical: false,
    });
    expect(result.edges).toContainEqual({
      source: 'sp1',
      target: 's1',
      label: 'sprint_story',
      critical: false,
    });
  });

  it('creates "references" edges from #N mentions in body, resolved by github.issue_number', () => {
    const s1 = {
      type: 'story' as const,
      id: 's1',
      title: 'Story 1',
      status: 'todo' as const,
      priority: 'medium' as const,
      labels: [],
      assignee: null,
      estimate: null,
      epic_ref: null,
      github: { issue_number: 10, repo: 'org/repo', synced_at: '' },
      // References e2 (#20) twice — should dedupe to a single edge — plus an
      // unresolvable number (#999) and a self-reference (#10) that must both
      // be skipped.
      body: 'See #20 for context, also #20 again. Unrelated: #999. Self: #10.',
      filePath: '/s1.md',
      created_at: '',
      updated_at: '',
    };
    const e2 = {
      type: 'epic' as const,
      id: 'e2',
      title: 'Epic 2',
      status: 'todo' as const,
      priority: 'high' as const,
      labels: [],
      owner: null,
      milestone_ref: null,
      github: { issue_number: 20, repo: 'org/repo', synced_at: '' },
      body: '',
      filePath: '/e2.md',
      created_at: '',
      updated_at: '',
    };

    const tree = makeTree({
      stories: [s1] as ResolvedTree['stories'],
      epics: [e2] as ResolvedEpic[],
    });

    const result = buildGraphData(tree);
    const referenceEdges = result.edges.filter((e) => e.label === 'references');
    expect(referenceEdges).toHaveLength(1);
    expect(referenceEdges[0]).toEqual({
      source: 's1',
      target: 'e2',
      label: 'references',
      // s1 -> e2 is the only edge in this tree, so it doubles as the
      // critical path.
      critical: true,
    });
  });

  it('marks the longest not-done/cancelled dependency chain as critical', () => {
    const m1 = {
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
    const e1 = {
      type: 'epic' as const,
      id: 'e1',
      title: 'Epic',
      status: 'in_progress' as const,
      priority: 'high' as const,
      labels: [],
      owner: null,
      milestone_ref: { id: 'm1' },
      body: '',
      filePath: '/e1.md',
      created_at: '',
      updated_at: '',
      resolvedStories: [],
      resolvedMilestone: m1,
    };
    const s1 = {
      type: 'story' as const,
      id: 's1',
      title: 'Story 1',
      status: 'todo' as const,
      priority: 'medium' as const,
      labels: [],
      assignee: null,
      estimate: null,
      epic_ref: { id: 'e1' },
      body: '',
      filePath: '/s1.md',
      created_at: '',
      updated_at: '',
      resolvedEpic: e1,
    };
    // Done story also points at e1 — its status excludes it (and the edge)
    // from the active subgraph, so it must not extend the critical chain.
    const s2Done = {
      type: 'story' as const,
      id: 's2',
      title: 'Story 2 (done)',
      status: 'done' as const,
      priority: 'medium' as const,
      labels: [],
      assignee: null,
      estimate: null,
      epic_ref: { id: 'e1' },
      body: '',
      filePath: '/s2.md',
      created_at: '',
      updated_at: '',
      resolvedEpic: e1,
    };
    // Unconnected story — should never be marked critical.
    const s3Orphan = {
      type: 'story' as const,
      id: 's3',
      title: 'Orphan',
      status: 'todo' as const,
      priority: 'low' as const,
      labels: [],
      assignee: null,
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: '/s3.md',
      created_at: '',
      updated_at: '',
    };
    const sp1 = {
      type: 'sprint' as const,
      id: 'sp1',
      title: 'Sprint 1',
      status: 'in_progress' as const,
      start_date: '2026-01-01',
      end_date: '2026-01-14',
      stories: [{ id: 's1' }],
      body: '',
      filePath: '/sp1.md',
      created_at: '',
      updated_at: '',
      resolvedStories: [s1],
    };

    const tree = makeTree({
      stories: [s1, s2Done, s3Orphan] as ResolvedTree['stories'],
      epics: [e1] as ResolvedEpic[],
      milestones: [m1] as ResolvedMilestone[],
      sprints: [sp1] as ResolvedTree['sprints'],
    });

    const result = buildGraphData(tree);

    // The longest chain is sp1 -> s1 -> e1 -> m1 (3 edges, 4 nodes).
    const byId = (id: string) => result.nodes.find((n) => n.id === id);
    expect(byId('sp1')?.critical).toBe(true);
    expect(byId('s1')?.critical).toBe(true);
    expect(byId('e1')?.critical).toBe(true);
    expect(byId('m1')?.critical).toBe(true);
    expect(byId('s2')?.critical).toBe(false);
    expect(byId('s3')?.critical).toBe(false);

    const byEdge = (source: string, target: string) =>
      result.edges.find((e) => e.source === source && e.target === target);
    expect(byEdge('sp1', 's1')?.critical).toBe(true);
    expect(byEdge('s1', 'e1')?.critical).toBe(true);
    expect(byEdge('e1', 'm1')?.critical).toBe(true);
    expect(byEdge('s2', 'e1')?.critical).toBe(false);
  });

  it('guards against cycles created by mutual body #N references', () => {
    const s1 = {
      type: 'story' as const,
      id: 's1',
      title: 'Story 1',
      status: 'todo' as const,
      priority: 'medium' as const,
      labels: [],
      assignee: null,
      estimate: null,
      epic_ref: null,
      github: { issue_number: 1, repo: 'org/repo', synced_at: '' },
      body: 'Blocked by #2.',
      filePath: '/s1.md',
      created_at: '',
      updated_at: '',
    };
    const s2 = {
      type: 'story' as const,
      id: 's2',
      title: 'Story 2',
      status: 'todo' as const,
      priority: 'medium' as const,
      labels: [],
      assignee: null,
      estimate: null,
      epic_ref: null,
      github: { issue_number: 2, repo: 'org/repo', synced_at: '' },
      body: 'Blocked by #1.',
      filePath: '/s2.md',
      created_at: '',
      updated_at: '',
    };

    const tree = makeTree({
      stories: [s1, s2] as ResolvedTree['stories'],
    });

    // Must terminate (no infinite loop/stack overflow) and still resolve both
    // reference edges.
    const result = buildGraphData(tree);
    expect(result.edges).toHaveLength(2);
    expect(result.edges).toContainEqual({
      source: 's1',
      target: 's2',
      label: 'references',
      critical: expect.any(Boolean),
    });
    expect(result.edges).toContainEqual({
      source: 's2',
      target: 's1',
      label: 'references',
      critical: expect.any(Boolean),
    });
  });

  it('does not let a cycle-truncated chain outrank a longer real chain', () => {
    // c0 -> c1 -> c2 -> c3 -> c1 (cycle). The cycle guard makes the c1->c2->c3->c1
    // step a dead end, so the real reconstructable chain from c0 is only
    // c0->c1->c2->c3 (3 edges) — it must not be inflated to tie/beat the
    // genuinely longer 4-edge chain below.
    const makeStory = (
      id: string,
      issueNumber: number,
      body: string,
    ): ResolvedTree['stories'][number] =>
      ({
        type: 'story' as const,
        id,
        title: id,
        status: 'todo' as const,
        priority: 'medium' as const,
        labels: [],
        assignee: null,
        estimate: null,
        epic_ref: null,
        github: { issue_number: issueNumber, repo: 'org/repo', synced_at: '' },
        body,
        filePath: `/${id}.md`,
        created_at: '',
        updated_at: '',
      }) as ResolvedTree['stories'][number];

    const cycle = [
      makeStory('c0', 10, 'See #11.'),
      makeStory('c1', 11, 'See #12.'),
      makeStory('c2', 12, 'See #13.'),
      makeStory('c3', 13, 'See #11.'),
    ];
    const chain = [
      makeStory('s1', 1, 'See #2.'),
      makeStory('s2', 2, 'See #3.'),
      makeStory('s3', 3, 'See #4.'),
      makeStory('s4', 4, 'See #5.'),
      makeStory('s5', 5, ''),
    ];

    const tree = makeTree({
      stories: [...cycle, ...chain] as ResolvedTree['stories'],
    });

    const result = buildGraphData(tree);
    const byId = (id: string) => result.nodes.find((n) => n.id === id);

    for (const id of ['s1', 's2', 's3', 's4', 's5']) {
      expect(byId(id)?.critical).toBe(true);
    }
    for (const id of ['c0', 'c1', 'c2', 'c3']) {
      expect(byId(id)?.critical).toBe(false);
    }
  });

  it('handles undefined sprints array (nullish coalescing)', () => {
    const tree = {
      stories: [],
      epics: [],
      milestones: [],
      roadmaps: [],
      prds: [],
      errors: [],
    } as unknown as ResolvedTree;

    const result = buildGraphData(tree);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});
