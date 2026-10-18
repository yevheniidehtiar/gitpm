import type { Epic, Priority, Status, Story } from '@gitpm/core';
import type { BitbucketConfig, EpicLinkage } from './config.js';
import type {
  BbIssue,
  BbIssueKind,
  BbIssuePriority,
  BbIssueState,
  CreateIssueParams,
} from './types.js';

type MappingConfig = Partial<
  Pick<
    BitbucketConfig,
    'status_mapping' | 'priority_mapping' | 'kind_mapping' | 'epic_linkage'
  >
>;

// --- Status ---

export const DEFAULT_STATUS_MAPPING: Record<BbIssueState, Status> = {
  submitted: 'todo',
  new: 'todo',
  open: 'todo',
  'on hold': 'backlog',
  resolved: 'done',
  closed: 'cancelled',
  invalid: 'cancelled',
  duplicate: 'cancelled',
  wontfix: 'cancelled',
};

/** Bitbucket state written for each gitpm status when no override applies. */
export const DEFAULT_REVERSE_STATUS_MAPPING: Record<Status, BbIssueState> = {
  backlog: 'on hold',
  todo: 'new',
  in_progress: 'open',
  in_review: 'open',
  done: 'resolved',
  cancelled: 'closed',
};

function statusMapping(config?: MappingConfig): Record<BbIssueState, Status> {
  return { ...DEFAULT_STATUS_MAPPING, ...config?.status_mapping };
}

export function bbStateToStatus(
  state: BbIssueState,
  config?: MappingConfig,
): Status {
  return statusMapping(config)[state];
}

/**
 * Map a gitpm status to a Bitbucket state. When `current` already maps to
 * `status` it is kept, so a `duplicate` issue is not rewritten to `closed`.
 * Otherwise an explicit override for `status` wins over the default.
 */
export function statusToBbState(
  status: Status,
  config?: MappingConfig,
  current?: BbIssueState,
): BbIssueState {
  const mapping = statusMapping(config);
  if (current && mapping[current] === status) return current;
  const overrides = config?.status_mapping ?? {};
  const override = (Object.keys(overrides) as BbIssueState[]).find(
    (state) => overrides[state] === status,
  );
  return override ?? DEFAULT_REVERSE_STATUS_MAPPING[status];
}

// --- Priority ---

export const DEFAULT_PRIORITY_MAPPING: Record<BbIssuePriority, Priority> = {
  trivial: 'low',
  minor: 'low',
  major: 'medium',
  critical: 'high',
  blocker: 'critical',
};

export const DEFAULT_REVERSE_PRIORITY_MAPPING: Record<
  Priority,
  BbIssuePriority
> = {
  low: 'minor',
  medium: 'major',
  high: 'critical',
  critical: 'blocker',
};

function priorityMapping(
  config?: MappingConfig,
): Record<BbIssuePriority, Priority> {
  return { ...DEFAULT_PRIORITY_MAPPING, ...config?.priority_mapping };
}

export function bbPriorityToPriority(
  priority: BbIssuePriority,
  config?: MappingConfig,
): Priority {
  return priorityMapping(config)[priority];
}

/** Same precedence as statusToBbState: keep `current`, then override, then default. */
export function priorityToBbPriority(
  priority: Priority,
  config?: MappingConfig,
  current?: BbIssuePriority,
): BbIssuePriority {
  const mapping = priorityMapping(config);
  if (current && mapping[current] === priority) return current;
  const overrides = config?.priority_mapping ?? {};
  const override = (Object.keys(overrides) as BbIssuePriority[]).find(
    (p) => overrides[p] === priority,
  );
  return override ?? DEFAULT_REVERSE_PRIORITY_MAPPING[priority];
}

// --- Kind (stored as a label on the gitpm side) ---

export const DEFAULT_KIND_LABELS: Record<BbIssueKind, string> = {
  bug: 'kind:bug',
  enhancement: 'kind:enhancement',
  proposal: 'kind:proposal',
  task: 'kind:task',
};

/** Kind written to Bitbucket when an entity carries no kind label. */
export const DEFAULT_KIND: BbIssueKind = 'task';

function kindLabels(config?: MappingConfig): Record<BbIssueKind, string> {
  return { ...DEFAULT_KIND_LABELS, ...config?.kind_mapping };
}

export function bbKindToLabel(
  kind: BbIssueKind,
  config?: MappingConfig,
): string {
  return kindLabels(config)[kind];
}

/**
 * Pull the Bitbucket kind out of a gitpm label list. The first kind label
 * wins; every kind label is removed from `labels`.
 */
export function labelsToBbKind(
  labels: readonly string[],
  config?: MappingConfig,
): { kind: BbIssueKind; labels: string[] } {
  const byLabel = new Map<string, BbIssueKind>();
  for (const [kind, label] of Object.entries(kindLabels(config))) {
    byLabel.set(label, kind as BbIssueKind);
  }
  let kind: BbIssueKind | undefined;
  const rest: string[] = [];
  for (const label of labels) {
    const match = byLabel.get(label);
    if (match) kind ??= match;
    else rest.push(label);
  }
  return { kind: kind ?? DEFAULT_KIND, labels: rest };
}

// --- Epic linkage ---

const EPIC_MARKER_RE = /\n*<!--\s*gitpm:epic=([^\s>]+)\s*-->\n*/g;

export function epicMarker(epicId: string): string {
  return `<!-- gitpm:epic=${epicId} -->`;
}

/** The epic id from the first `<!-- gitpm:epic=<id> -->` marker, or null. */
export function extractEpicMarker(body: string): string | null {
  const match = new RegExp(EPIC_MARKER_RE.source).exec(body);
  return match?.[1] ?? null;
}

/** Remove every epic marker from a Bitbucket body. */
export function stripEpicMarker(body: string): string {
  return body.replace(EPIC_MARKER_RE, '\n\n').trim();
}

/** Replace any epic marker in `body` with one for `epicId` (or none if null). */
export function withEpicMarker(body: string, epicId: string | null): string {
  const clean = stripEpicMarker(body);
  if (!epicId) return clean;
  return clean ? `${clean}\n\n${epicMarker(epicId)}` : epicMarker(epicId);
}

export interface EpicLinkTarget {
  id: string;
  title: string;
}

/**
 * Apply the configured epic linkage to an outgoing issue: returns the body
 * (with or without the marker) and the component to set.
 */
export function epicToBbLink(
  body: string,
  epic: EpicLinkTarget | null,
  linkage: EpicLinkage = 'both',
): { body: string; component: { name: string } | null } {
  const useMarker = linkage !== 'component';
  const useComponent = linkage !== 'body-marker';
  return {
    body: useMarker
      ? withEpicMarker(body, epic?.id ?? null)
      : stripEpicMarker(body),
    component: useComponent && epic ? { name: epic.title } : null,
  };
}

/**
 * Resolve the epic id an incoming issue belongs to. `epicIdsByComponent`
 * maps a component name to the epic id that owns it. With `both`, the body
 * marker wins and the component is the fallback.
 */
export function bbIssueToEpicId(
  issue: Pick<BbIssue, 'content' | 'component'>,
  epicIdsByComponent: ReadonlyMap<string, string>,
  linkage: EpicLinkage = 'both',
): string | null {
  if (linkage !== 'component') {
    const marked = extractEpicMarker(issue.content?.raw ?? '');
    if (marked) return marked;
  }
  if (linkage !== 'body-marker' && issue.component) {
    return epicIdsByComponent.get(issue.component.name) ?? null;
  }
  return null;
}

// --- Whole-entity mapping ---

export interface BbIssueFields {
  title: string;
  status: Status;
  priority: Priority;
  labels: string[];
  assignee: string | null;
  /** Body with any epic marker removed. */
  body: string;
  epicId: string | null;
}

/** Map a Bitbucket issue to the gitpm fields a story carries. */
export function bbIssueToFields(
  issue: BbIssue,
  config?: MappingConfig,
  epicIdsByComponent: ReadonlyMap<string, string> = new Map(),
): BbIssueFields {
  return {
    title: issue.title,
    status: bbStateToStatus(issue.state, config),
    priority: bbPriorityToPriority(issue.priority, config),
    labels: [bbKindToLabel(issue.kind, config)],
    assignee: issue.assignee?.nickname ?? issue.assignee?.display_name ?? null,
    body: stripEpicMarker(issue.content?.raw ?? ''),
    epicId: bbIssueToEpicId(issue, epicIdsByComponent, config?.epic_linkage),
  };
}

/**
 * Map a gitpm story or epic to Bitbucket create/update params. Pass the
 * current remote issue as `current` so unchanged states and priorities that
 * share a gitpm value (e.g. `duplicate` vs `closed`) are preserved.
 */
export function entityToBbIssue(
  entity: Story | Epic,
  config?: MappingConfig,
  epic: EpicLinkTarget | null = null,
  current?: Pick<BbIssue, 'state' | 'priority'>,
): CreateIssueParams {
  const { kind } = labelsToBbKind(entity.labels ?? [], config);
  const link = epicToBbLink(entity.body ?? '', epic, config?.epic_linkage);
  return {
    title: entity.title,
    content: { raw: link.body },
    kind,
    priority: priorityToBbPriority(entity.priority, config, current?.priority),
    state: statusToBbState(entity.status, config, current?.state),
    component: link.component,
  };
}
