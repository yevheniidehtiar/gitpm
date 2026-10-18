import { createHash } from 'node:crypto';
import type {
  DiffResult,
  Epic,
  FieldChange,
  FieldConflict,
  Priority,
  Status,
  Story,
} from '@gitpm/core';
import type { BitbucketConfig } from './config.js';
import {
  bbPriorityToPriority,
  bbStateToStatus,
  labelsToBbKind,
  priorityToBbPriority,
  statusToBbState,
  stripEpicMarker,
} from './mapper.js';
import type { BbIssue, BbIssueKind } from './types.js';

type MappingConfig = Partial<
  Pick<
    BitbucketConfig,
    'status_mapping' | 'priority_mapping' | 'kind_mapping' | 'epic_linkage'
  >
>;

/** The fields Bitbucket and gitpm both carry, in gitpm terms. */
export interface SyncFields {
  title: string;
  status: Status;
  priority: Priority;
  /** Story assignee or epic owner. */
  assignee: string | null;
  kind: BbIssueKind;
  body: string;
  /** Epic id a story belongs to; always null for epics. */
  epic: string | null;
}

export type SyncField = keyof SyncFields;

export const SYNC_FIELDS: readonly SyncField[] = [
  'title',
  'status',
  'priority',
  'assignee',
  'kind',
  'body',
  'epic',
];

function normalizeBody(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

export function localFields(
  entity: Story | Epic,
  config?: MappingConfig,
): SyncFields {
  return {
    title: entity.title,
    status: entity.status,
    priority: entity.priority,
    assignee:
      (entity.type === 'story' ? entity.assignee : entity.owner) ?? null,
    kind: labelsToBbKind(entity.labels ?? [], config).kind,
    body: normalizeBody(entity.body ?? ''),
    epic: entity.type === 'story' ? (entity.epic_ref?.id ?? null) : null,
  };
}

/**
 * Project a Bitbucket issue onto gitpm fields. Where the mapping is lossy
 * (`in_progress` and `in_review` both write `open`), a remote value the
 * local one would have written keeps the local value, so a pushed entity
 * reads back unchanged.
 */
export function remoteFields(
  issue: BbIssue,
  local: SyncFields,
  config: MappingConfig | undefined,
  epicId: string | null,
): SyncFields {
  const status =
    statusToBbState(local.status, config, issue.state) === issue.state
      ? local.status
      : bbStateToStatus(issue.state, config);
  const priority =
    priorityToBbPriority(local.priority, config, issue.priority) ===
    issue.priority
      ? local.priority
      : bbPriorityToPriority(issue.priority, config);
  return {
    title: issue.title,
    status,
    priority,
    assignee: issue.assignee?.nickname ?? issue.assignee?.display_name ?? null,
    kind: issue.kind,
    body: normalizeBody(stripEpicMarker(issue.content?.raw ?? '')),
    epic: epicId,
  };
}

function hashValue(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value ?? null))
    .digest('hex')
    .slice(0, 16);
}

export function fieldHashes(fields: SyncFields): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const field of SYNC_FIELDS) hashes[field] = hashValue(fields[field]);
  return hashes;
}

/**
 * What each side looked like at the last sync: per-field hashes when the
 * last run was a sync, otherwise only whether each side changed as a whole.
 */
export type SyncBaseline =
  | {
      kind: 'fields';
      local: Record<string, string>;
      remote: Record<string, string>;
    }
  | { kind: 'whole'; localChanged: boolean; remoteChanged: boolean };

/**
 * Field-level three-way diff. A field changed on one side only is taken from
 * that side; a field changed on both sides to different values is a
 * conflict. Fields that differ without either side changing (a value one
 * side cannot represent) are left alone.
 */
export function diffSyncFields(
  entity: Story | Epic,
  local: SyncFields,
  remote: SyncFields,
  baseline: SyncBaseline,
): DiffResult {
  const localChanges: FieldChange[] = [];
  const remoteChanges: FieldChange[] = [];
  const conflicts: FieldConflict[] = [];

  for (const field of SYNC_FIELDS) {
    const localValue = local[field];
    const remoteValue = remote[field];
    if (localValue === remoteValue) continue;

    const localChanged =
      baseline.kind === 'fields'
        ? hashValue(localValue) !== baseline.local[field]
        : baseline.localChanged;
    const remoteChanged =
      baseline.kind === 'fields'
        ? hashValue(remoteValue) !== baseline.remote[field]
        : baseline.remoteChanged;

    if (localChanged && remoteChanged) {
      conflicts.push({
        entityId: entity.id,
        entityTitle: entity.title,
        entityType: entity.type,
        field,
        baseValue: null,
        localValue,
        remoteValue,
      });
    } else if (localChanged) {
      localChanges.push({ field, oldValue: remoteValue, newValue: localValue });
    } else if (remoteChanged) {
      remoteChanges.push({
        field,
        oldValue: localValue,
        newValue: remoteValue,
      });
    }
  }

  let status: DiffResult['status'] = 'in_sync';
  if (conflicts.length > 0) status = 'conflict';
  else if (localChanges.length > 0) status = 'local_changed';
  else if (remoteChanges.length > 0) status = 'remote_changed';
  return { status, localChanges, remoteChanges, conflicts };
}
