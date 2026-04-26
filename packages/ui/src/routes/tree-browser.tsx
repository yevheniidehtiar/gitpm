import { Link } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../components/EmptyState.js';
import { PriorityBadge } from '../components/PriorityBadge.js';
import { Spinner } from '../components/Spinner.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { useToast } from '../components/Toast.js';
import { TypeIcon } from '../components/TypeIcon.js';
import { type Entity, useCreateEntity, useTree } from '../lib/api.js';

const ROW_HEIGHT = 36;

type SortKey = 'title' | 'type' | 'status' | 'priority';
type SortDir = 'asc' | 'desc';

export function TreeBrowser() {
  const { data: tree, isLoading } = useTree();
  const createEntity = useCreateEntity();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('type');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState('story');
  const [newTitle, setNewTitle] = useState('');

  const allEntities = useMemo(() => {
    if (!tree) return [];
    return [
      ...tree.milestones,
      ...tree.epics,
      ...tree.stories,
      ...tree.prds,
      ...tree.roadmaps,
    ];
  }, [tree]);

  const uniqueAssignees = useMemo(() => {
    const names = allEntities
      .map((e) => e.assignee || e.owner)
      .filter((v): v is string => v != null);
    return [...new Set(names)].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }, [allEntities]);

  const filtered = useMemo(() => {
    let items = allEntities;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((e) => e.title.toLowerCase().includes(q));
    }
    if (statusFilter.length) {
      items = items.filter((e) => e.status && statusFilter.includes(e.status));
    }
    if (typeFilter.length) {
      items = items.filter((e) => typeFilter.includes(e.type));
    }
    if (assigneeFilter.length) {
      items = items.filter((e) => {
        const name = e.assignee || e.owner;
        if (name == null) return assigneeFilter.includes('__unassigned__');
        return assigneeFilter.includes(name);
      });
    }
    items.sort((a, b) => {
      const av = (a[sortKey] ?? '') as string;
      const bv = (b[sortKey] ?? '') as string;
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [
    allEntities,
    search,
    statusFilter,
    typeFilter,
    assigneeFilter,
    sortKey,
    sortDir,
  ]);

  // Build hierarchy: milestones -> epics -> stories
  const hierarchical = useMemo(() => {
    if (!tree) return [];
    const rows: { entity: Entity; depth: number }[] = [];

    for (const ms of tree.milestones) {
      rows.push({ entity: ms, depth: 0 });
      const msEpics = (ms as Entity).resolvedEpics ?? [];
      for (const ep of msEpics) {
        rows.push({ entity: ep, depth: 1 });
        const epStories = (ep as Entity).resolvedStories ?? [];
        for (const st of epStories) {
          rows.push({ entity: st, depth: 2 });
        }
      }
    }

    // Orphan epics (no milestone)
    const linkedEpicIds = new Set(
      tree.milestones.flatMap((ms) =>
        ((ms as Entity).resolvedEpics ?? []).map((e: Entity) => e.id),
      ),
    );
    for (const ep of tree.epics) {
      if (!linkedEpicIds.has(ep.id)) {
        rows.push({ entity: ep, depth: 0 });
        const epStories = (ep as Entity).resolvedStories ?? [];
        for (const st of epStories) {
          rows.push({ entity: st, depth: 1 });
        }
      }
    }

    // Orphan stories (no epic)
    const linkedStoryIds = new Set(
      tree.epics.flatMap((ep) =>
        ((ep as Entity).resolvedStories ?? []).map((s: Entity) => s.id),
      ),
    );
    for (const st of tree.stories) {
      if (!linkedStoryIds.has(st.id)) {
        rows.push({ entity: st, depth: 0 });
      }
    }

    // PRDs and roadmaps
    for (const p of tree.prds) rows.push({ entity: p, depth: 0 });
    for (const r of tree.roadmaps) rows.push({ entity: r, depth: 0 });

    return rows;
  }, [tree]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const useHierarchy =
    !search &&
    !statusFilter.length &&
    !typeFilter.length &&
    !assigneeFilter.length;
  const displayRows = useMemo(
    () =>
      useHierarchy
        ? hierarchical
        : filtered.map((e) => ({ entity: e, depth: 0 })),
    [useHierarchy, hierarchical, filtered],
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset scroll when dataset changes
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [displayRows]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!tree || allEntities.length === 0) {
    return (
      <EmptyState
        icon="📭"
        message="No entities found. Create your first entity to get started."
        action={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Entity
          </button>
        }
      />
    );
  }

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const result = await createEntity.mutateAsync({
        type: newType,
        title: newTitle.trim(),
      });
      toast(`Created ${result.type}: ${result.title}`, 'success');
      setNewTitle('');
      setShowCreate(false);
    } catch (err) {
      toast(String(err), 'error');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Filter Bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap flex-shrink-0">
        <input
          type="text"
          placeholder="Search entities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded w-60 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          multiple
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              Array.from(e.target.selectedOptions, (o) => o.value),
            )
          }
          className="px-2 py-1.5 text-sm border border-gray-300 rounded"
        >
          {[
            'backlog',
            'todo',
            'in_progress',
            'in_review',
            'done',
            'cancelled',
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          multiple
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(Array.from(e.target.selectedOptions, (o) => o.value))
          }
          className="px-2 py-1.5 text-sm border border-gray-300 rounded"
        >
          {['story', 'epic', 'milestone', 'prd', 'roadmap'].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          multiple
          aria-label="Filter by assignee"
          value={assigneeFilter}
          onChange={(e) =>
            setAssigneeFilter(
              Array.from(e.target.selectedOptions, (o) => o.value),
            )
          }
          className="px-2 py-1.5 text-sm border border-gray-300 rounded"
        >
          <option value="__unassigned__">Unassigned</option>
          {uniqueAssignees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + New Entity
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 flex items-end gap-3 flex-shrink-0">
          <div>
            <span className="block text-xs text-gray-500 mb-1">Type</span>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="story">Story</option>
              <option value="epic">Epic</option>
              <option value="milestone">Milestone</option>
              <option value="prd">PRD</option>
            </select>
          </div>
          <div className="flex-1">
            <span className="block text-xs text-gray-500 mb-1">Title</span>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Entity title..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={createEntity.isPending}
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {createEntity.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {/* Table */}
      <div
        ref={scrollContainerRef}
        className="bg-white rounded-lg border border-gray-200 overflow-y-auto flex-1 min-h-0"
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide flex items-center">
              <th
                className="px-4 py-2 w-20 flex-shrink-0 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('type')}
                onKeyDown={(e) => e.key === 'Enter' && toggleSort('type')}
              >
                Type {sortKey === 'type' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-2 flex-1 min-w-0 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('title')}
                onKeyDown={(e) => e.key === 'Enter' && toggleSort('title')}
              >
                Title {sortKey === 'title' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-2 w-28 flex-shrink-0 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('status')}
                onKeyDown={(e) => e.key === 'Enter' && toggleSort('status')}
              >
                Status {sortKey === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-2 w-24 flex-shrink-0 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('priority')}
                onKeyDown={(e) => e.key === 'Enter' && toggleSort('priority')}
              >
                Priority{' '}
                {sortKey === 'priority' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-2 w-32 flex-shrink-0">Assignee</th>
              <th className="px-4 py-2 w-8 flex-shrink-0" />
            </tr>
          </thead>
          <tbody
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
              display: 'block',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const { entity: e, depth } = displayRows[virtualRow.index];
              return (
                <tr
                  key={e.id}
                  className="border-b border-gray-100 hover:bg-gray-50 flex items-center"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <td className="px-4 py-2 w-20 flex-shrink-0">
                    <span style={{ paddingLeft: `${depth * 1.25}rem` }}>
                      <TypeIcon type={e.type} />
                    </span>
                  </td>
                  <td
                    className="px-4 py-2 flex-1 min-w-0 truncate"
                    style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
                  >
                    <Link
                      to="/entity/$id"
                      params={{ id: e.id }}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 w-28 flex-shrink-0">
                    {e.status && <StatusBadge status={e.status} />}
                  </td>
                  <td className="px-4 py-2 w-24 flex-shrink-0">
                    {e.priority && <PriorityBadge priority={e.priority} />}
                  </td>
                  <td className="px-4 py-2 w-32 flex-shrink-0 text-gray-500 text-xs truncate">
                    {(e.assignee || e.owner) ?? ''}
                  </td>
                  <td className="px-4 py-2 w-8 flex-shrink-0">
                    {e.github?.issue_number && (
                      <a
                        href={`https://github.com/${e.github.repo}/issues/${e.github.issue_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600"
                        title="Open in GitHub"
                      >
                        ↗
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tree.errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm flex-shrink-0">
          <p className="font-medium text-red-700 mb-1">
            Parse Errors ({tree.errors.length})
          </p>
          {tree.errors.map((e) => (
            <p key={e.filePath} className="text-red-600 text-xs">
              {e.filePath}: {e.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
