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

/**
 * Bare same-repo issue reference: `#N` not preceded by a word character or
 * `/` (rejects cross-repo `owner/repo#12`, URL fragments like `page#12`) and
 * not followed by a word character (rejects hex-like `#12ab`).
 */
const REFERENCE_PATTERN = /(?<![\w/])#(\d+)(?!\w)/g;

/**
 * Fenced code blocks (``` / ~~~, closed by the same fence or end of input)
 * and inline code spans — `#N` inside code is not a reference.
 */
const CODE_PATTERN = /^(`{3,}|~{3,})[\s\S]*?(?:^\1|(?![\s\S]))|`[^`\n]*`/gm;

interface BodySource {
  id: string;
  repo: string | undefined;
  body: string;
}

interface IssueEntry {
  id: string;
  repo: string | undefined;
}

/**
 * Resolves a bare `#N` against the entities carrying issue number N. A
 * candidate from a different known repo never matches; among the rest, a
 * same-repo candidate wins, otherwise only an unambiguous single one is used.
 */
function resolveIssue(
  candidates: IssueEntry[] | undefined,
  repo: string | undefined,
): string | undefined {
  if (!candidates) return undefined;
  const compatible = candidates.filter(
    (c) => !repo || !c.repo || c.repo === repo,
  );
  const sameRepo = compatible.find((c) => repo && c.repo === repo);
  if (sameRepo) return sameRepo.id;
  return compatible.length === 1 ? compatible[0].id : undefined;
}

/**
 * Scans each body source's markdown text (outside code) for `#N` references
 * and resolves them against the issue-number index. Self-references and
 * unresolvable numbers are skipped; duplicate source→target pairs collapse
 * into a single edge.
 */
function buildReferenceEdges(
  sources: BodySource[],
  issueIndex: Map<number, IssueEntry[]>,
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    if (!source.body) continue;
    const text = source.body.replace(CODE_PATTERN, ' ');
    for (const match of text.matchAll(REFERENCE_PATTERN)) {
      const issueNumber = Number(match[1]);
      const targetId = resolveIssue(issueIndex.get(issueNumber), source.repo);
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
 * Upper bound on node expansions spent on the exact longest-simple-path
 * search. Longest simple path is NP-hard on general (cyclic) graphs, and
 * `references` edges come from free-form `#N` mentions, so a densely
 * cross-linked tree can make an exhaustive search explode. Past this budget
 * (or past `EXACT_SEARCH_MAX_NODES`, which also bounds recursion depth) we
 * fall back to a linear-time longest path over a DAG obtained by dropping DFS
 * back-edges.
 */
const EXACT_SEARCH_STEP_BUDGET = 50_000;
const EXACT_SEARCH_MAX_NODES = 1_000;

interface Chain {
  start: string | null;
  edges: GraphEdge[];
}

/**
 * Exhaustive longest-simple-path search with a recursion-stack cycle guard.
 * Not memoized on purpose: with cycles, a node's best downstream chain
 * depends on which ancestors are on the current path. Returns `null` when the
 * step budget is exhausted.
 */
function exactLongestChain(
  activeIds: Set<string>,
  adjacency: Map<string, GraphEdge[]>,
): Chain | null {
  const visiting = new Set<string>();
  let steps = 0;
  let exhausted = false;

  function longestFrom(id: string): GraphEdge[] | null {
    // A node already on the current path is unusable (not a length-0 path),
    // so the edge into it is never chosen.
    if (visiting.has(id)) return null;
    steps++;
    if (steps > EXACT_SEARCH_STEP_BUDGET) {
      exhausted = true;
      return null;
    }

    visiting.add(id);
    let best: GraphEdge[] = [];
    for (const edge of adjacency.get(id) ?? []) {
      const downstream = longestFrom(edge.target);
      if (exhausted) break;
      if (downstream && downstream.length + 1 > best.length) {
        best = [edge, ...downstream];
      }
    }
    visiting.delete(id);
    return best;
  }

  let best: Chain = { start: null, edges: [] };
  for (const id of activeIds) {
    const chain = longestFrom(id);
    if (exhausted) return null;
    if (chain && chain.length > best.edges.length) {
      best = { start: id, edges: chain };
    }
  }
  return best;
}

/**
 * Linear-time fallback: one iterative DFS classifies edges, back-edges are
 * dropped to make the graph acyclic, and the longest path is computed in DFS
 * post-order (a reverse topological order of the resulting DAG). O(V + E).
 */
function dagLongestChain(
  activeIds: Set<string>,
  adjacency: Map<string, GraphEdge[]>,
): Chain {
  const state = new Map<string, 'open' | 'closed'>();
  const length = new Map<string, number>();
  const next = new Map<string, GraphEdge>();

  for (const root of activeIds) {
    if (state.has(root)) continue;
    const stack: Array<{ id: string; i: number }> = [{ id: root, i: 0 }];
    state.set(root, 'open');

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const out = adjacency.get(frame.id) ?? [];
      if (frame.i < out.length) {
        const target = out[frame.i++].target;
        if (!state.has(target)) {
          state.set(target, 'open');
          stack.push({ id: target, i: 0 });
        }
        continue;
      }

      // Post-order: every non-back-edge target is already closed.
      let bestLength = 0;
      for (const edge of out) {
        if (state.get(edge.target) !== 'closed') continue; // back-edge
        const candidate = (length.get(edge.target) ?? 0) + 1;
        if (candidate > bestLength) {
          bestLength = candidate;
          next.set(frame.id, edge);
        }
      }
      length.set(frame.id, bestLength);
      state.set(frame.id, 'closed');
      stack.pop();
    }
  }

  let start: string | null = null;
  let startLength = 0;
  for (const [id, len] of length) {
    if (len > startLength) {
      startLength = len;
      start = id;
    }
  }

  const edges: GraphEdge[] = [];
  let cursor = start ? next.get(start) : undefined;
  while (cursor) {
    edges.push(cursor);
    cursor = next.get(cursor.target);
  }
  return { start, edges };
}

/**
 * Finds the longest dependency chain (edges treated as "depends on" arrows)
 * over the subgraph of not-done/cancelled nodes, and returns the set of node
 * ids and edge keys that lie on it. Small graphs get an exact longest simple
 * path; large or densely cyclic ones fall back to a linear-time DAG
 * approximation, so the work is always bounded.
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

  const chain =
    (activeIds.size <= EXACT_SEARCH_MAX_NODES
      ? exactLongestChain(activeIds, adjacency)
      : null) ?? dagLongestChain(activeIds, adjacency);

  const nodeIds = new Set<string>();
  const edgeKeys = new Set<string>();

  // Only mark a critical path when at least one dependency edge is involved
  // — a lone unconnected node isn't a "chain".
  if (chain.start && chain.edges.length > 0) {
    nodeIds.add(chain.start);
    for (const edge of chain.edges) {
      edgeKeys.add(`${edge.source}->${edge.target}|${edge.label}`);
      nodeIds.add(edge.target);
    }
  }

  return { nodeIds, edgeKeys };
}

export function buildGraphData(tree: ResolvedTree): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const issueIndex = new Map<number, IssueEntry[]>();
  const bodySources: BodySource[] = [];

  function register(entity: {
    id: string;
    body: string;
    github?: { issue_number?: number; repo: string } | null;
  }): void {
    const repo = entity.github?.repo;
    const issueNumber = entity.github?.issue_number;
    if (issueNumber != null) {
      const entries = issueIndex.get(issueNumber) ?? [];
      entries.push({ id: entity.id, repo });
      issueIndex.set(issueNumber, entries);
    }
    bodySources.push({ id: entity.id, repo, body: entity.body });
  }

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
    register(s);
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
    register(e);
  }

  for (const m of tree.milestones) {
    nodes.push({
      id: m.id,
      title: m.title,
      type: 'milestone',
      status: m.status,
      critical: false,
    });
    register(m);
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
    register(p);
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
    register(sp);
  }

  edges.push(...buildReferenceEdges(bodySources, issueIndex));

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
