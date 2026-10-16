import { createHash } from 'node:crypto';
import type { Epic, ParsedEntity, Story } from '@gitpm/core';
import type { LinearIssue } from './client.js';
import { mapLinearPriority, mapLinearState } from './mapper.js';
import type {
  DiffResult,
  FieldChange,
  FieldConflict,
  LinearConfig,
  LinearSyncStateEntry,
} from './types.js';

function localEntityFields(entity: ParsedEntity): Record<string, unknown> {
  if (entity.type === 'story') {
    return {
      title: entity.title,
      status: entity.status,
      priority: entity.priority,
      assignee: entity.assignee ?? null,
      labels: [...(entity.labels ?? [])].sort(),
      body: (entity.body ?? '').trim(),
    };
  }
  if (entity.type === 'epic') {
    return {
      title: entity.title,
      status: entity.status,
      priority: entity.priority,
      owner: entity.owner ?? null,
      labels: [...(entity.labels ?? [])].sort(),
      body: (entity.body ?? '').trim(),
    };
  }
  if (entity.type === 'milestone') {
    return {
      title: entity.title,
      status: entity.status,
      target_date: entity.target_date ?? null,
      body: (entity.body ?? '').trim(),
    };
  }
  return { title: entity.title };
}

export function remoteIssueFields(
  issue: LinearIssue,
  config?: Pick<LinearConfig, 'status_mapping'>,
): Record<string, unknown> {
  const status = mapLinearState(issue.state.type, config);
  const priority = mapLinearPriority(issue.priority);
  return {
    title: issue.title,
    status,
    priority,
    labels: [...issue.labels.nodes.map((l) => l.name)].sort(),
    assignee: issue.assignee?.name ?? null,
    body: (issue.description ?? '').trim(),
  };
}

/**
 * Hash of an issue's syncable fields as Linear reports them. This is the
 * only function that may produce or be compared against `remote_hash`.
 */
export function computeRemoteIssueHash(
  issue: LinearIssue,
  config?: Pick<LinearConfig, 'status_mapping'>,
): string {
  const json = JSON.stringify(remoteIssueFields(issue, config));
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}

/**
 * True when every syncable field of `local` already equals what `remote`
 * reports, i.e. the two sides agree regardless of the stored baseline.
 */
export function localMatchesRemote(
  local: Story | Epic,
  remote: LinearIssue,
  config?: Pick<LinearConfig, 'status_mapping'>,
): boolean {
  const remoteFields = remoteIssueFields(remote, config);
  const localFields: Record<string, unknown> = {
    title: local.title,
    status: local.status,
    priority: local.priority,
    labels: [...(local.labels ?? [])].sort(),
    assignee: (local.type === 'story' ? local.assignee : local.owner) ?? null,
    body: (local.body ?? '').trim(),
  };
  return diffFields(localFields, remoteFields).length === 0;
}

function diffFields(
  baseFields: Record<string, unknown>,
  currentFields: Record<string, unknown>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const allKeys = new Set([
    ...Object.keys(baseFields),
    ...Object.keys(currentFields),
  ]);

  for (const key of allKeys) {
    const base = baseFields[key];
    const current = currentFields[key];
    if (!fieldEquals(base, current)) {
      changes.push({ field: key, oldValue: base, newValue: current });
    }
  }
  return changes;
}

function fieldEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null && b === undefined) return true;
  if (a === undefined && b === null) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => fieldEquals(v, b[i]));
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim() === b.trim();
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffEntity(
  local: ParsedEntity,
  remoteFields: Record<string, unknown>,
  baselineLocal: Record<string, unknown>,
  baselineRemote: Record<string, unknown>,
): DiffResult {
  const currentLocal = localEntityFields(local);

  const localChanges = diffFields(baselineLocal, currentLocal);
  const remoteChanges = diffFields(baselineRemote, remoteFields);

  const conflicts: FieldConflict[] = [];
  const localChangedFields = new Set(localChanges.map((c) => c.field));
  const remoteChangedFields = new Set(remoteChanges.map((c) => c.field));

  for (const field of localChangedFields) {
    if (remoteChangedFields.has(field)) {
      const localChange = localChanges.find((c) => c.field === field);
      const remoteChange = remoteChanges.find((c) => c.field === field);
      if (
        localChange &&
        remoteChange &&
        !fieldEquals(localChange.newValue, remoteChange.newValue)
      ) {
        const id = 'id' in local ? (local as { id: string }).id : '';
        conflicts.push({
          entityId: id,
          entityTitle: local.title,
          entityType: local.type,
          field,
          baseValue: localChange.oldValue,
          localValue: localChange.newValue,
          remoteValue: remoteChange.newValue,
        });
      }
    }
  }

  const nonConflictLocalChanges = localChanges.filter(
    (c) => !conflicts.some((conf) => conf.field === c.field),
  );
  const nonConflictRemoteChanges = remoteChanges.filter(
    (c) => !conflicts.some((conf) => conf.field === c.field),
  );

  let status: DiffResult['status'];
  if (conflicts.length > 0) {
    status = 'conflict';
  } else if (nonConflictLocalChanges.length > 0) {
    status = 'local_changed';
  } else if (nonConflictRemoteChanges.length > 0) {
    status = 'remote_changed';
  } else {
    status = 'in_sync';
  }

  return {
    status,
    localChanges: nonConflictLocalChanges,
    remoteChanges: nonConflictRemoteChanges,
    conflicts,
  };
}

export function diffByHash(
  currentLocalHash: string,
  currentRemoteHash: string,
  stateEntry: LinearSyncStateEntry,
): 'in_sync' | 'local_changed' | 'remote_changed' | 'both_changed' {
  const localChanged = currentLocalHash !== stateEntry.local_hash;
  const remoteChanged = currentRemoteHash !== stateEntry.remote_hash;

  if (!localChanged && !remoteChanged) return 'in_sync';
  if (localChanged && !remoteChanged) return 'local_changed';
  if (!localChanged && remoteChanged) return 'remote_changed';
  return 'both_changed';
}
