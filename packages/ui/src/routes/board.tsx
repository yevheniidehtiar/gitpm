import { type DragEvent, useCallback, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '../components/EmptyState.js';
import { Spinner } from '../components/Spinner.js';
import { TypeIcon } from '../components/TypeIcon.js';
import { type Entity, useTree, useUpdateEntity } from '../lib/api.js';

const COLUMNS = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
] as const;

type ColumnStatus = (typeof COLUMNS)[number];

const COLUMN_LABELS: Record<ColumnStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

const COLUMN_COLORS: Record<ColumnStatus, string> = {
  backlog: 'bg-gray-100 border-gray-300',
  todo: 'bg-blue-50 border-blue-300',
  in_progress: 'bg-amber-50 border-amber-300',
  in_review: 'bg-violet-50 border-violet-300',
  done: 'bg-emerald-50 border-emerald-300',
};

const PRIORITY_BADGES: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-800' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  low: { bg: 'bg-green-100', text: 'text-green-800' },
};

function PriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_BADGES[priority] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}
    >
      {priority}
    </span>
  );
}

function KanbanCard({
  entity,
  onDragStart,
}: {
  entity: Entity;
  onDragStart: (e: DragEvent<HTMLDivElement>, entity: Entity) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, entity)}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2 mb-1.5">
        <TypeIcon type={entity.type} className="mt-0.5 flex-shrink-0" />
        <Link
          to="/entity/$id"
          params={{ id: entity.id }}
          className="text-sm font-medium text-gray-900 hover:text-blue-600 leading-tight"
        >
          {entity.title}
        </Link>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {entity.priority && <PriorityBadge priority={entity.priority} />}
        {entity.assignee && (
          <span className="inline-flex items-center text-xs text-gray-500">
            <span className="w-4 h-4 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-[10px] font-medium mr-1">
              {entity.assignee.charAt(0).toUpperCase()}
            </span>
            {entity.assignee}
          </span>
        )}
      </div>
    </div>
  );
}

export function BoardView() {
  const { data: tree, isLoading } = useTree();
  const updateEntity = useUpdateEntity();

  const [epicFilter, setEpicFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Collect all stories and epics as board items (entities with status)
  const allEntities = useMemo(() => {
    if (!tree) return [];
    return [...tree.stories, ...tree.epics].filter(
      (e) => e.status && COLUMNS.includes(e.status as ColumnStatus),
    );
  }, [tree]);

  // Extract unique epics and assignees for filters
  const epics = useMemo(() => {
    if (!tree) return [];
    return tree.epics.map((e) => ({ id: e.id, title: e.title }));
  }, [tree]);

  const assignees = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntities) {
      if (e.assignee) set.add(e.assignee);
    }
    return Array.from(set).sort();
  }, [allEntities]);

  // Apply filters
  const filteredEntities = useMemo(() => {
    let items = allEntities;
    if (epicFilter) {
      items = items.filter((e) => e.epic_ref?.id === epicFilter);
    }
    if (assigneeFilter) {
      items = items.filter((e) => e.assignee === assigneeFilter);
    }
    return items;
  }, [allEntities, epicFilter, assigneeFilter]);

  // Group by column
  const columns = useMemo(() => {
    const grouped: Record<string, Entity[]> = {};
    for (const col of COLUMNS) {
      grouped[col] = [];
    }
    for (const entity of filteredEntities) {
      const status = entity.status ?? 'backlog';
      if (grouped[status]) {
        grouped[status].push(entity);
      }
    }
    return grouped;
  }, [filteredEntities]);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, entity: Entity) => {
      e.dataTransfer.setData('text/plain', entity.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, status: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverColumn(status);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, newStatus: string) => {
      e.preventDefault();
      setDragOverColumn(null);
      const entityId = e.dataTransfer.getData('text/plain');
      if (!entityId) return;

      const entity = allEntities.find((ent) => ent.id === entityId);
      if (!entity || entity.status === newStatus) return;

      updateEntity.mutate({ id: entityId, data: { status: newStatus } });
    },
    [allEntities, updateEntity],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!allEntities.length) {
    return (
      <EmptyState
        icon="📋"
        message="No stories or epics found. Create entities in the tree browser to see the board."
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Kanban Board</h2>
        <div className="flex items-center gap-3">
          <select
            value={epicFilter}
            onChange={(e) => setEpicFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
          >
            <option value="">All Epics</option>
            {epics.map((ep) => (
              <option key={ep.id} value={ep.id}>
                {ep.title}
              </option>
            ))}
          </select>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
          >
            <option value="">All Assignees</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
        {COLUMNS.map((status) => {
          const items = columns[status] ?? [];
          const isDragOver = dragOverColumn === status;
          return (
            <div
              key={status}
              className={`flex-shrink-0 w-72 flex flex-col rounded-lg border-2 ${
                isDragOver
                  ? 'border-blue-400 bg-blue-50'
                  : COLUMN_COLORS[status]
              } transition-colors`}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">
                  {COLUMN_LABELS[status]}
                </h3>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.map((entity) => (
                  <KanbanCard
                    key={entity.id}
                    entity={entity}
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
