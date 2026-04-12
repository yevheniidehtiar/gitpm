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
