import type { ResolvedTree } from '../resolver/types.js';

export interface GraphNode {
  id: string;
  title: string;
  type: string;
  status: string;
  critical: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  critical: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const DONE_STATUSES = new Set(['done', 'cancelled']);

const REFERENCE_PATTERN = /#(\d+)/g;

interface BodySource {
  id: string;
  body: string;
}

/**
 * Scans each body source's markdown text for `#N` references and resolves
 * them against the issue-number → entity-id map. Self-references and
 * unresolvable numbers are skipped; duplicate source→target pairs collapse
 * into a single edge.
 */
function buildReferenceEdges(
  sources: BodySource[],
  issueNumberToId: Map<number, string>,
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    if (!source.body) continue;
    for (const match of source.body.matchAll(REFERENCE_PATTERN)) {
      const issueNumber = Number(match[1]);
      const targetId = issueNumberToId.get(issueNumber);
      if (!targetId || targetId === source.id) continue;

      const key = `${source.id}->${targetId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({
        source: source.id,
        target: targetId,
        label: 'references',
        critical: false,
      });
    }
  }

  return edges;
}

/**
 * Finds the longest dependency chain (edges treated as "depends on" arrows)
 * over the subgraph of not-done/cancelled nodes, and returns the set of node
 * ids and edge keys that lie on it. Guards against cycles (possible via
 * `references` edges) with a recursion-stack visited set: a node already on
 * the current path is treated as a dead end rather than recursed into again.
 */
function computeCriticalPath(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { nodeIds: Set<string>; edgeKeys: Set<string> } {
  const activeIds = new Set(
    nodes.filter((n) => !DONE_STATUSES.has(n.status)).map((n) => n.id),
  );

  const adjacency = new Map<string, GraphEdge[]>();
  for (const id of activeIds) adjacency.set(id, []);
  for (const edge of edges) {
    if (activeIds.has(edge.source) && activeIds.has(edge.target)) {
      adjacency.get(edge.source)?.push(edge);
    }
  }

  const memo = new Map<
    string,
    { length: number; nextEdge: GraphEdge | null }
  >();
  const visiting = new Set<string>();

  function longestFrom(id: string): {
    length: number;
    nextEdge: GraphEdge | null;
  } {
    const cached = memo.get(id);
    if (cached) return cached;

    // Cycle guard: a node revisited within the current DFS path is a dead
    // end rather than recursed into again.
    if (visiting.has(id)) {
      return { length: 0, nextEdge: null };
    }

    visiting.add(id);
    let best: { length: number; nextEdge: GraphEdge | null } = {
      length: 0,
      nextEdge: null,
    };
    for (const edge of adjacency.get(id) ?? []) {
      const downstream = longestFrom(edge.target);
      if (downstream.length + 1 > best.length) {
        best = { length: downstream.length + 1, nextEdge: edge };
      }
    }
    visiting.delete(id);
    memo.set(id, best);
    return best;
  }

  let bestStart: string | null = null;
  let bestLength = 0;
  for (const id of activeIds) {
    const result = longestFrom(id);
    if (result.length > bestLength) {
      bestLength = result.length;
      bestStart = id;
    }
  }

  const nodeIds = new Set<string>();
  const edgeKeys = new Set<string>();

  // Only mark a critical path when at least one dependency edge is involved
  // — a lone unconnected node isn't a "chain".
  if (bestStart && bestLength > 0) {
    // `memo` can point back to an already-visited node when the graph has a
    // cycle (e.g. two entities referencing each other's issue number), so
    // reconstruction needs its own visited guard to avoid looping forever.
    const visited = new Set<string>();
    nodeIds.add(bestStart);
    visited.add(bestStart);
    let current = bestStart;
    for (;;) {
      const step = memo.get(current);
      if (!step?.nextEdge || visited.has(step.nextEdge.target)) break;
      edgeKeys.add(
        `${step.nextEdge.source}->${step.nextEdge.target}|${step.nextEdge.label}`,
      );
      nodeIds.add(step.nextEdge.target);
      visited.add(step.nextEdge.target);
      current = step.nextEdge.target;
    }
  }

  return { nodeIds, edgeKeys };
}

export function buildGraphData(tree: ResolvedTree): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const issueNumberToId = new Map<number, string>();
  const bodySources: BodySource[] = [];

  for (const s of tree.stories) {
    nodes.push({
      id: s.id,
      title: s.title,
      type: 'story',
      status: s.status,
      critical: false,
    });
    if (s.resolvedEpic) {
      edges.push({
        source: s.id,
        target: s.resolvedEpic.id,
        label: 'epic_ref',
        critical: false,
      });
    }
    if (s.github?.issue_number != null) {
      issueNumberToId.set(s.github.issue_number, s.id);
    }
    bodySources.push({ id: s.id, body: s.body });
  }

  for (const e of tree.epics) {
    nodes.push({
      id: e.id,
      title: e.title,
      type: 'epic',
      status: e.status,
      critical: false,
    });
    if (e.resolvedMilestone) {
      edges.push({
        source: e.id,
        target: e.resolvedMilestone.id,
        label: 'milestone_ref',
        critical: false,
      });
    }
    if (e.github?.issue_number != null) {
      issueNumberToId.set(e.github.issue_number, e.id);
    }
    bodySources.push({ id: e.id, body: e.body });
  }

  for (const m of tree.milestones) {
    nodes.push({
      id: m.id,
      title: m.title,
      type: 'milestone',
      status: m.status,
      critical: false,
    });
    if (m.github?.issue_number != null) {
      issueNumberToId.set(m.github.issue_number, m.id);
    }
    bodySources.push({ id: m.id, body: m.body });
  }

  for (const r of tree.roadmaps) {
    nodes.push({
      id: r.id,
      title: r.title,
      type: 'roadmap',
      status: '',
      critical: false,
    });
    for (const ms of r.resolvedMilestones) {
      edges.push({
        source: r.id,
        target: ms.id,
        label: 'milestone',
        critical: false,
      });
    }
  }

  for (const p of tree.prds) {
    nodes.push({
      id: p.id,
      title: p.title,
      type: 'prd',
      status: p.status,
      critical: false,
    });
    for (const ep of p.resolvedEpics) {
      edges.push({
        source: p.id,
        target: ep.id,
        label: 'epic_ref',
        critical: false,
      });
    }
    bodySources.push({ id: p.id, body: p.body });
  }

  for (const sp of tree.sprints ?? []) {
    nodes.push({
      id: sp.id,
      title: sp.title,
      type: 'sprint',
      status: sp.status,
      critical: false,
    });
    for (const story of sp.resolvedStories) {
      edges.push({
        source: sp.id,
        target: story.id,
        label: 'sprint_story',
        critical: false,
      });
    }
    if (sp.github?.issue_number != null) {
      issueNumberToId.set(sp.github.issue_number, sp.id);
    }
    bodySources.push({ id: sp.id, body: sp.body });
  }

  edges.push(...buildReferenceEdges(bodySources, issueNumberToId));

  const { nodeIds, edgeKeys } = computeCriticalPath(nodes, edges);
  for (const node of nodes) {
    node.critical = nodeIds.has(node.id);
  }
  for (const edge of edges) {
    edge.critical = edgeKeys.has(
      `${edge.source}->${edge.target}|${edge.label}`,
    );
  }

  return { nodes, edges };
}
