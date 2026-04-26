import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { EmptyState } from '../components/EmptyState.js';
import { PriorityBadge } from '../components/PriorityBadge.js';
import { Spinner } from '../components/Spinner.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { type Entity, useTree } from '../lib/api.js';

interface SprintEntity extends Entity {
  start_date?: string;
  end_date?: string;
  stories?: { id: string }[];
  resolvedStories?: Entity[];
  capacity?: number;
}

function SprintProgress({ done, total }: { done: number; total: number }) {
  const ratio = total > 0 ? done / total : 0;
  const pct = Math.round(ratio * 100);
  const color =
    ratio >= 0.75
      ? 'bg-emerald-500'
      : ratio >= 0.25
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">
        {pct}% ({done}/{total})
      </span>
    </div>
  );
}

export function SprintView() {
  const { data: tree, isLoading } = useTree();

  const sprints = useMemo(() => {
    if (!tree) return [];
    return ((tree.sprints ?? []) as SprintEntity[]).sort((a, b) =>
      (a.start_date ?? '').localeCompare(b.start_date ?? ''),
    );
  }, [tree]);

  const backlogStories = useMemo(() => {
    if (!tree) return [];
    const assignedIds = new Set(
      sprints.flatMap((sp) => (sp.resolvedStories ?? []).map((s) => s.id)),
    );
    return tree.stories.filter(
      (s) =>
        !assignedIds.has(s.id) &&
        s.status !== 'done' &&
        s.status !== 'cancelled',
    );
  }, [tree, sprints]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (sprints.length === 0) {
    return (
      <EmptyState
        icon="🏃"
        message="No sprints defined yet. Create one via CLI: gitpm sprint create --title 'Sprint W15' --start 2026-04-07 --end 2026-04-13"
      />
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Sprint Planning</h2>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Sprint columns */}
        {sprints.map((sp) => {
          const sprintStories = sp.resolvedStories ?? [];
          const done = sprintStories.filter(
            (s) => s.status === 'done' || s.status === 'cancelled',
          ).length;

          return (
            <div
              key={sp.id}
              className="bg-white rounded-lg border border-gray-200 min-w-72 flex-shrink-0 flex flex-col"
            >
              {/* Header */}
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-sm">{sp.title}</h3>
                  <StatusBadge status={sp.status ?? 'todo'} />
                </div>
                <p className="text-xs text-gray-400">
                  {sp.start_date?.slice(0, 10)} &rarr;{' '}
                  {sp.end_date?.slice(0, 10)}
                </p>
                <div className="mt-2">
                  <SprintProgress done={done} total={sprintStories.length} />
                </div>
                {sp.capacity && (
                  <p className="text-xs text-gray-400 mt-1">
                    Capacity: {sp.capacity} pts
                  </p>
                )}
              </div>
              {/* Stories */}
              <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-96">
                {sprintStories.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">
                    No stories assigned
                  </p>
                )}
                {sprintStories.map((story) => (
                  <Link
                    key={story.id}
                    to="/entity/$id"
                    params={{ id: story.id }}
                    className="block p-2 rounded border border-gray-100 hover:border-gray-300 text-xs"
                  >
                    <div className="font-medium text-gray-800 mb-1 truncate">
                      {story.title}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={story.status ?? 'todo'} />
                      {story.priority && (
                        <PriorityBadge priority={story.priority} />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        {/* Backlog column */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 min-w-72 flex-shrink-0 flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <h3 className="font-medium text-sm text-gray-500">
              Backlog ({backlogStories.length})
            </h3>
          </div>
          <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-96">
            {backlogStories.map((story) => (
              <Link
                key={story.id}
                to="/entity/$id"
                params={{ id: story.id }}
                className="block p-2 rounded border border-gray-100 hover:border-gray-300 bg-white text-xs"
              >
                <div className="font-medium text-gray-800 mb-1 truncate">
                  {story.title}
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={story.status ?? 'todo'} />
                  {story.priority && (
                    <PriorityBadge priority={story.priority} />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
