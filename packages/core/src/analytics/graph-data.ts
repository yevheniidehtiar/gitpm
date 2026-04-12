import type { ResolvedTree } from '../resolver/types.js';

export interface GraphNode {
  id: string;
  title: string;
  type: string;
  status: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildGraphData(tree: ResolvedTree): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const s of tree.stories) {
    nodes.push({ id: s.id, title: s.title, type: 'story', status: s.status });
    if (s.resolvedEpic) {
      edges.push({
        source: s.id,
        target: s.resolvedEpic.id,
        label: 'epic_ref',
      });
    }
  }

  for (const e of tree.epics) {
    nodes.push({ id: e.id, title: e.title, type: 'epic', status: e.status });
    if (e.resolvedMilestone) {
      edges.push({
        source: e.id,
        target: e.resolvedMilestone.id,
        label: 'milestone_ref',
      });
    }
  }

  for (const m of tree.milestones) {
    nodes.push({
      id: m.id,
      title: m.title,
      type: 'milestone',
      status: m.status,
    });
  }

  for (const r of tree.roadmaps) {
    nodes.push({ id: r.id, title: r.title, type: 'roadmap', status: '' });
    for (const ms of r.resolvedMilestones) {
      edges.push({ source: r.id, target: ms.id, label: 'milestone' });
    }
  }

  for (const p of tree.prds) {
    nodes.push({ id: p.id, title: p.title, type: 'prd', status: p.status });
    for (const ep of p.resolvedEpics) {
      edges.push({ source: p.id, target: ep.id, label: 'epic_ref' });
    }
  }

  for (const sp of tree.sprints ?? []) {
    nodes.push({
      id: sp.id,
      title: sp.title,
      type: 'sprint',
      status: sp.status,
    });
    for (const story of sp.resolvedStories) {
      edges.push({ source: sp.id, target: story.id, label: 'sprint_story' });
    }
  }

  return { nodes, edges };
}
