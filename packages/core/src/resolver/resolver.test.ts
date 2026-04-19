import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTree } from '../parser/parse-tree.js';
import type { MetaTree } from '../parser/types.js';
import { buildDependencyGraph } from './graph.js';
import { resolveRefs } from './resolve.js';

const fixturesDir = join(__dirname, '..', '__fixtures__');
const validTree = join(fixturesDir, 'valid-tree', '.meta');
const brokenTree = join(fixturesDir, 'broken-tree', '.meta');

describe('resolveRefs', () => {
  it('resolves valid tree without errors', async () => {
    const parsed = await parseTree(validTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.value.errors).toHaveLength(0);
  });

  it('resolves epic → stories relationship', async () => {
    const parsed = await parseTree(validTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const epic = resolved.value.epics.find((e) => e.id === 'ep_balancing');
    expect(epic).toBeDefined();
    expect(epic?.resolvedStories).toHaveLength(2);
  });

  it('resolves epic → milestone relationship', async () => {
    const parsed = await parseTree(validTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const epic = resolved.value.epics.find((e) => e.id === 'ep_balancing');
    expect(epic?.resolvedMilestone).toBeDefined();
    expect(epic?.resolvedMilestone?.id).toBe('ms_q2_launch');
  });

  it('resolves milestone → epics reverse reference', async () => {
    const parsed = await parseTree(validTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const ms = resolved.value.milestones.find((m) => m.id === 'ms_q2_launch');
    expect(ms?.resolvedEpics).toHaveLength(1);
  });

  it('resolves roadmap → milestones', async () => {
    const parsed = await parseTree(validTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.value.roadmaps[0].resolvedMilestones).toHaveLength(2);
  });

  it('resolves PRD → epics', async () => {
    const parsed = await parseTree(validTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.value.prds[0].resolvedEpics).toHaveLength(1);
  });

  it('reports unresolved refs in broken tree', async () => {
    const parsed = await parseTree(brokenTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    // The orphan epic references ms_nonexistent
    const refErrors = resolved.value.errors.filter((e) =>
      e.message.includes('non-existent'),
    );
    expect(refErrors.length).toBeGreaterThan(0);
  });
});

describe('resolveRefs — unresolved reference paths', () => {
  it('reports unresolved story → epic reference', () => {
    const tree: MetaTree = {
      stories: [
        {
          type: 'story',
          id: 's1',
          title: 'Orphan story',
          status: 'todo',
          priority: 'medium',
          labels: [],
          assignee: null,
          estimate: null,
          epic_ref: { id: 'missing_epic' },
          body: '',
          filePath: '/s.md',
          created_at: '',
          updated_at: '',
        },
      ],
      epics: [],
      milestones: [],
      roadmaps: [],
      prds: [],
      sprints: [],
      errors: [],
    };
    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.errors).toHaveLength(1);
    expect(resolved.value.errors[0].message).toContain(
      'non-existent epic "missing_epic"',
    );
    expect(resolved.value.stories[0].resolvedEpic).toBeUndefined();
  });

  it('reports unresolved roadmap → milestone reference', () => {
    const tree: MetaTree = {
      stories: [],
      epics: [],
      milestones: [],
      roadmaps: [
        {
          type: 'roadmap',
          id: 'rm1',
          title: 'My roadmap',
          description: '',
          milestones: [{ id: 'missing_ms' }],
          filePath: '/r.yaml',
        },
      ],
      prds: [],
      sprints: [],
      errors: [],
    };
    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const refErrors = resolved.value.errors.filter((e) =>
      e.message.includes('non-existent milestone'),
    );
    expect(refErrors).toHaveLength(1);
    expect(resolved.value.roadmaps[0].resolvedMilestones).toHaveLength(0);
  });

  it('reports unresolved prd → epic reference', () => {
    const tree: MetaTree = {
      stories: [],
      epics: [],
      milestones: [],
      roadmaps: [],
      prds: [
        {
          type: 'prd',
          id: 'prd1',
          title: 'Big PRD',
          status: 'todo',
          epic_refs: [{ id: 'missing_epic' }],
          body: '',
          filePath: '/p.md',
        },
      ],
      sprints: [],
      errors: [],
    };
    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const refErrors = resolved.value.errors.filter((e) =>
      e.message.includes('non-existent epic'),
    );
    expect(refErrors).toHaveLength(1);
    expect(resolved.value.prds[0].resolvedEpics).toHaveLength(0);
  });

  it('resolves sprint → story references', () => {
    const tree: MetaTree = {
      stories: [
        {
          type: 'story',
          id: 'st_real',
          title: 'Existing story',
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
      ],
      epics: [],
      milestones: [],
      roadmaps: [],
      prds: [],
      sprints: [
        {
          type: 'sprint',
          id: 'sp1',
          title: 'Sprint',
          status: 'in_progress',
          start_date: '2026-01-01',
          end_date: '2026-01-14',
          stories: [{ id: 'st_real' }, { id: 'missing_story' }],
          body: '',
          filePath: '/sp.md',
          created_at: '',
          updated_at: '',
        },
      ],
      errors: [],
    };
    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.sprints[0].resolvedStories).toHaveLength(1);
    expect(resolved.value.sprints[0].resolvedStories[0].id).toBe('st_real');
    const storyErrors = resolved.value.errors.filter((e) =>
      e.message.includes('non-existent story'),
    );
    expect(storyErrors).toHaveLength(1);
  });

  it('handles undefined sprints via nullish fallback', () => {
    const tree = {
      stories: [],
      epics: [],
      milestones: [],
      roadmaps: [],
      prds: [],
      errors: [],
    } as unknown as MetaTree;
    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.sprints).toEqual([]);
  });
});

describe('buildDependencyGraph', () => {
  it('builds graph from valid tree', async () => {
    const parsed = await parseTree(validTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const graph = buildDependencyGraph(resolved.value);
    expect(graph.adjacency.size).toBeGreaterThan(0);
  });

  it('produces valid topological sort', async () => {
    const parsed = await parseTree(validTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const graph = buildDependencyGraph(resolved.value);
    const sorted = graph.topologicalSort();
    expect(sorted.length).toBe(graph.adjacency.size);
  });

  it('finds no cycles in valid tree', async () => {
    const parsed = await parseTree(validTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const graph = buildDependencyGraph(resolved.value);
    expect(graph.findCycles()).toHaveLength(0);
  });

  it('detects cycles when present', () => {
    // Build a synthetic tree with a cycle
    const tree: MetaTree = {
      stories: [],
      epics: [],
      milestones: [],
      roadmaps: [],
      prds: [],
      sprints: [],
      errors: [],
    };
    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    // Manually create a cycle in the adjacency list
    const graph = buildDependencyGraph(resolved.value);
    graph.adjacency.set('a', ['b']);
    graph.adjacency.set('b', ['c']);
    graph.adjacency.set('c', ['a']);
    const cycles = graph.findCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });
});
