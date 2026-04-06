import type { ParsedEntity } from '@gitpm/core';
import type { JiraIssue, JiraSprint } from './client.js';
import { mapJiraPriority, mapJiraStatus } from './mapper.js';
import type {
  DiffResult,
  FieldChange,
  FieldConflict,
  JiraConfig,
  JiraSyncStateEntry,
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
  issue: JiraIssue,
  config?: Pick<JiraConfig, 'status_mapping'>,
): Record<string, unknown> {
  const status = mapJiraStatus(issue.fields.status.name, config);
  const priority = mapJiraPriority(issue.fields.priority?.name);
  return {
    title: issue.fields.summary,
    status,
    priority,
    labels: [...issue.fields.labels].sort(),
    assignee: issue.fields.assignee?.displayName ?? null,
    body: (issue.fields.description ?? '').trim(),
  };
}

export function remoteSprintFields(
  sprint: JiraSprint,
): Record<string, unknown> {
  const status = sprint.state === 'closed' ? 'done' : 'in_progress';
  return {
    title: sprint.name,
    status,
    target_date: sprint.endDate ?? null,
    body: (sprint.goal ?? '').trim(),
  };
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
  stateEntry: JiraSyncStateEntry,
): 'in_sync' | 'local_changed' | 'remote_changed' | 'both_changed' {
  const localChanged = currentLocalHash !== stateEntry.local_hash;
  const remoteChanged = currentRemoteHash !== stateEntry.remote_hash;

  if (!localChanged && !remoteChanged) return 'in_sync';
  if (localChanged && !remoteChanged) return 'local_changed';
  if (!localChanged && remoteChanged) return 'remote_changed';
  return 'both_changed';
}
