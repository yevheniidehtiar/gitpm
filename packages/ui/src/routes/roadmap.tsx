import { useMemo } from 'react';
import { EmptyState } from '../components/EmptyState.js';
import { Spinner } from '../components/Spinner.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { type Entity, useProgress, useTree } from '../lib/api.js';

const STATUS_COLORS: Record<string, string> = {
  backlog: '#9CA3AF',
  todo: '#60A5FA',
  in_progress: '#FBBF24',
  in_review: '#A78BFA',
  done: '#34D399',
  cancelled: '#F87171',
};

export function RoadmapView() {
  const { data: tree, isLoading } = useTree();
  const { data: progress } = useProgress();

  const milestones = useMemo(() => {
    if (!tree) return [];
    return tree.milestones
      .filter((ms) => ms.target_date)
      .sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''));
  }, [tree]);

  const timeline = useMemo(() => {
    if (milestones.length === 0) return null;

    // biome-ignore lint/style/noNonNullAssertion: filtered to only milestones with target_date above
    const dates = milestones.map((ms) => new Date(ms.target_date!));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add padding of 1 month on each side
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 1);

    const totalDays =
      (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    const width = Math.max(800, totalDays * 3);

    const toX = (date: Date) => {
      const d = (date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      return (d / totalDays) * width;
    };

    // Generate month markers
    const months: { x: number; label: string }[] = [];
    const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cursor <= maxDate) {
      months.push({
        x: toX(cursor),
        label: cursor.toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return { minDate, maxDate, totalDays, width, toX, months };
  }, [milestones]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!milestones.length) {
    return (
      <EmptyState
        icon="🗺️"
        message="No milestones with target dates defined. Create milestones in the tree browser to see the roadmap."
      />
    );
  }

  if (!timeline) return null;

  const rowHeight = 40;
  const headerHeight = 50;

  // Calculate total SVG height based on milestones and their epics
  let totalRows = 0;
  const milestonePositions = milestones.map((ms) => {
    const y = headerHeight + totalRows * rowHeight;
    const epics = (ms as Entity).resolvedEpics ?? [];
    totalRows += 1 + epics.length;
    return { ms, y, epics };
  });

  const svgHeight = headerHeight + totalRows * rowHeight + 40;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Roadmap Timeline</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-x-auto">
        <svg
          width={timeline.width + 60}
          height={svgHeight}
          className="text-sm"
          role="img"
        >
          <title>Roadmap Timeline</title>
          {/* Month grid lines */}
          {timeline.months.map((m) => (
            <g key={m.label}>
              <line
                x1={m.x + 30}
                y1={headerHeight - 10}
                x2={m.x + 30}
                y2={svgHeight}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={m.x + 30}
                y={20}
                textAnchor="middle"
                fill="#6b7280"
                fontSize="11"
              >
                {m.label}
              </text>
            </g>
          ))}

          {/* Milestones and epics */}
          {milestonePositions.map(({ ms, y, epics }) => {
            // biome-ignore lint/style/noNonNullAssertion: milestones filtered to have target_date
            const x = timeline.toX(new Date(ms.target_date!)) + 30;
            const color = STATUS_COLORS[ms.status ?? 'backlog'] ?? '#9CA3AF';

            return (
              <g key={ms.id}>
                {/* Milestone diamond */}
                <polygon
                  points={`${x},${y} ${x + 8},${y + 8} ${x},${y + 16} ${x - 8},${y + 8}`}
                  fill={color}
                />
                <text
                  x={x + 14}
                  y={y + 12}
                  fill="#111827"
                  fontSize="12"
                  fontWeight="600"
                >
                  {ms.title}
                </text>

                {/* Epics as bars */}
                {epics.map((ep: Entity, ei: number) => {
                  const epY = y + (ei + 1) * rowHeight;
                  const epColor =
                    STATUS_COLORS[ep.status ?? 'backlog'] ?? '#9CA3AF';
                  const barWidth = 120;
                  const epProgress = progress?.milestones
                    .flatMap((m) => m.epics)
                    .find((p) => p.epicId === ep.id);
                  const ratio = epProgress?.progress ?? 0;

                  return (
                    <g key={ep.id}>
                      <rect
                        x={x - 20}
                        y={epY}
                        width={barWidth}
                        height={24}
                        rx={4}
                        fill={epColor}
                        opacity={0.15}
                      />
                      {ratio > 0 && (
                        <rect
                          x={x - 20}
                          y={epY}
                          width={barWidth * ratio}
                          height={24}
                          rx={4}
                          fill={epColor}
                          opacity={0.4}
                        />
                      )}
                      <rect
                        x={x - 20}
                        y={epY}
                        width={barWidth}
                        height={24}
                        rx={4}
                        fill="none"
                        stroke={epColor}
                        strokeWidth="1.5"
                      />
                      <text
                        x={x - 14}
                        y={epY + 16}
                        fill="#374151"
                        fontSize="11"
                        className="truncate"
                      >
                        {ep.title.length > 18
                          ? `${ep.title.slice(0, 18)}...`
                          : ep.title}
                      </text>
                      {ratio > 0 && (
                        <text
                          x={x - 20 + barWidth + 6}
                          y={epY + 16}
                          fill="#6b7280"
                          fontSize="10"
                        >
                          {Math.round(ratio * 100)}%
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <StatusBadge status={status} />
          </div>
        ))}
      </div>
    </div>
  );
}
