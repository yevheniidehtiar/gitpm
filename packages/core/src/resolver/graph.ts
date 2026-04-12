import type { EntityId } from '../schemas/common.js';
import type { DependencyGraph, ResolvedTree } from './types.js';

export function buildDependencyGraph(tree: ResolvedTree): DependencyGraph {
  const adjacency = new Map<EntityId, EntityId[]>();

  // Initialize all nodes
  for (const s of tree.stories) adjacency.set(s.id, []);
  for (const e of tree.epics) adjacency.set(e.id, []);
  for (const m of tree.milestones) adjacency.set(m.id, []);
  for (const r of tree.roadmaps) adjacency.set(r.id, []);
  for (const p of tree.prds) adjacency.set(p.id, []);
  for (const sp of tree.sprints ?? []) adjacency.set(sp.id, []);

  // Add edges: child → parent (story → epic, epic → milestone, etc.)
  for (const s of tree.stories) {
    if (s.resolvedEpic) {
      adjacency.get(s.id)?.push(s.resolvedEpic.id);
    }
  }
  for (const e of tree.epics) {
    if (e.resolvedMilestone) {
      adjacency.get(e.id)?.push(e.resolvedMilestone.id);
    }
  }
  for (const r of tree.roadmaps) {
    for (const ms of r.resolvedMilestones) {
      adjacency.get(r.id)?.push(ms.id);
    }
  }
  for (const p of tree.prds) {
    for (const ep of p.resolvedEpics) {
      adjacency.get(p.id)?.push(ep.id);
    }
  }

  return {
    adjacency,
    topologicalSort(): EntityId[] {
      const visited = new Set<EntityId>();
      const result: EntityId[] = [];

      function visit(node: EntityId): void {
        if (visited.has(node)) return;
        visited.add(node);
        const neighbors = adjacency.get(node) || [];
        for (const n of neighbors) {
          visit(n);
        }
        result.push(node);
      }

      for (const node of adjacency.keys()) {
        visit(node);
      }

      return result.reverse();
    },
    findCycles(): EntityId[][] {
      const cycles: EntityId[][] = [];
      const visited = new Set<EntityId>();
      const inStack = new Set<EntityId>();
      const path: EntityId[] = [];

      function dfs(node: EntityId): void {
        if (inStack.has(node)) {
          const cycleStart = path.indexOf(node);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart));
          }
          return;
        }
        if (visited.has(node)) return;

        visited.add(node);
        inStack.add(node);
        path.push(node);

        const neighbors = adjacency.get(node) || [];
        for (const n of neighbors) {
          dfs(n);
        }

        path.pop();
        inStack.delete(node);
      }

      for (const node of adjacency.keys()) {
        dfs(node);
      }

      return cycles;
    },
  };
}
