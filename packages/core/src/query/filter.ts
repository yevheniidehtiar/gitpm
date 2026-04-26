import type { MetaTree, ParsedEntity } from '../parser/types.js';
import type { Priority, Status } from '../schemas/common.js';

export interface QueryFilter {
  type?: string[];
  status?: Status[];
  priority?: Priority[];
  labels?: string[];
  epic?: string;
  assignee?: string;
  search?: string;
}

export function filterEntities(
  tree: MetaTree,
  filter: QueryFilter,
): ParsedEntity[] {
  let entities: ParsedEntity[] = [
    ...tree.stories,
    ...tree.epics,
    ...tree.milestones,
    ...tree.roadmaps,
    ...tree.prds,
    ...(tree.sprints ?? []),
  ];

  if (filter.type && filter.type.length > 0) {
    const types = new Set(filter.type);
    entities = entities.filter((e) => types.has(e.type));
  }

  if (filter.status && filter.status.length > 0) {
    const statuses = new Set<string>(filter.status);
    entities = entities.filter(
      (e) => 'status' in e && statuses.has(e.status as string),
    );
  }

  if (filter.priority && filter.priority.length > 0) {
    const priorities = new Set<string>(filter.priority);
    entities = entities.filter(
      (e) => 'priority' in e && priorities.has(e.priority as string),
    );
  }

  if (filter.labels && filter.labels.length > 0) {
    const labelSet = new Set(filter.labels);
    entities = entities.filter(
      (e) =>
        'labels' in e &&
        Array.isArray(e.labels) &&
        e.labels.some((l: string) => labelSet.has(l)),
    );
  }

  if (filter.epic) {
    const epicFilter = filter.epic;
    entities = entities.filter((e) => {
      if (e.type !== 'story') return false;
      const epicRef = (e as { epic_ref?: { id: string } | null }).epic_ref;
      if (!epicRef) return false;
      // Match by epic ID or by directory slug in filePath
      return (
        epicRef.id === epicFilter ||
        e.filePath.includes(`/epics/${epicFilter}/`)
      );
    });
  }

  if (filter.assignee) {
    const assignee = filter.assignee;
    entities = entities.filter(
      (e) =>
        'assignee' in e &&
        (e as { assignee?: string | null }).assignee === assignee,
    );
  }

  if (filter.search) {
    const term = filter.search.toLowerCase();
    entities = entities.filter((e) => {
      const title = e.title.toLowerCase();
      const body = 'body' in e ? (e.body as string).toLowerCase() : '';
      return title.includes(term) || body.includes(term);
    });
  }

  return entities;
}
