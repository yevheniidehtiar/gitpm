import { useNavigate } from '@tanstack/react-router';
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../components/EmptyState.js';
import { Spinner } from '../components/Spinner.js';
import { type GraphEdge, type GraphNode, useGraphData } from '../lib/api.js';

const TYPE_COLORS: Record<string, string> = {
  story: '#60A5FA',
  epic: '#A78BFA',
  milestone: '#FBBF24',
  roadmap: '#34D399',
  prd: '#F472B6',
};

const DONE_STATUSES = new Set(['done', 'cancelled']);

interface SimNode extends SimulationNodeDatum {
  id: string;
  title: string;
  type: string;
  status: string;
  radius: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  label: string;
}

function buildSimData(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { simNodes: SimNode[]; simLinks: SimLink[] } {
  const nodeMap = new Map<string, SimNode>();

  const typeRadius: Record<string, number> = {
    milestone: 18,
    epic: 14,
    story: 8,
    roadmap: 20,
    prd: 12,
  };

  for (const n of nodes) {
    nodeMap.set(n.id, {
      ...n,
      radius: typeRadius[n.type] ?? 10,
    });
  }

  const simLinks: SimLink[] = edges
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      label: e.label,
    }));

  return { simNodes: Array.from(nodeMap.values()), simLinks };
}

export function GraphView() {
  const { data, isLoading } = useGraphData();
  const svgRef = useRef<SVGSVGElement>(null);
  const navigate = useNavigate();
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    node: SimNode;
  } | null>(null);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);

  const { initialNodes, initialLinks } = useMemo(() => {
    if (!data) return { initialNodes: [], initialLinks: [] };
    const { simNodes: n, simLinks: l } = buildSimData(data.nodes, data.edges);
    return { initialNodes: n, initialLinks: l };
  }, [data]);

  useEffect(() => {
    if (initialNodes.length === 0) return;

    const sim = forceSimulation<SimNode>(initialNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(initialLinks)
          .id((d) => d.id)
          .distance(80),
      )
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(400, 300));

    sim.on('tick', () => {
      setSimNodes([...sim.nodes()]);
      setSimLinks([...initialLinks]);
    });

    return () => {
      sim.stop();
    };
  }, [initialNodes, initialLinks]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      navigate({ to: '/entity/$id', params: { id: nodeId } });
    },
    [navigate],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <EmptyState
        icon="🔗"
        message="No entities found. Create some stories and epics to see the dependency graph."
      />
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Dependency Graph</h2>
      <div className="bg-white rounded-lg border border-gray-200 relative overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height={600}
          viewBox="0 0 800 600"
          className="w-full"
          role="img"
        >
          <title>Entity Dependency Graph</title>
          <defs>
            <marker
              id="arrowhead"
              viewBox="0 0 10 7"
              refX="10"
              refY="3.5"
              markerWidth="6"
              markerHeight="5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
            </marker>
          </defs>

          {/* Edges */}
          {simLinks.map((link) => {
            const s = link.source as SimNode;
            const t = link.target as SimNode;
            if (s.x == null || s.y == null || t.x == null || t.y == null)
              return null;
            return (
              <line
                key={`${s.id}-${t.id}-${link.label}`}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke="#D1D5DB"
                strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Nodes */}
          {simNodes.map((node) => {
            const color = TYPE_COLORS[node.type] ?? '#9CA3AF';
            const opacity = DONE_STATUSES.has(node.status) ? 0.4 : 1;
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: SVG <g> cannot use semantic elements
              <g
                key={node.id}
                transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(node.id)}
                onMouseEnter={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top - 30,
                      node,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <circle
                  r={node.radius}
                  fill={color}
                  opacity={opacity}
                  stroke={color}
                  strokeWidth={2}
                />
                {node.radius >= 12 && (
                  <text
                    textAnchor="middle"
                    dy={node.radius + 14}
                    fontSize={10}
                    fill="#6B7280"
                    className="select-none pointer-events-none"
                  >
                    {node.title.length > 20
                      ? `${node.title.slice(0, 20)}...`
                      : node.title}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <span className="font-medium">{tooltip.node.title}</span>
            <br />
            <span className="text-gray-400">
              {tooltip.node.type} &middot; {tooltip.node.status || 'n/a'}
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-white/90 rounded border border-gray-200 p-2 text-xs flex flex-wrap gap-3">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-600">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
