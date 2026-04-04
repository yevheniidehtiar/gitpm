import type { Epic, Milestone, ParsedEntity, Story } from '@gitpm/core';
import type { GhIssue, GhMilestone } from './client.js';
import type {
  DiffResult,
  FieldChange,
  FieldConflict,
  SyncStateEntry,
} from './types.js';

/**
 * Extracts comparable fields from a local entity.
 */
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

/**
 * Extracts comparable fields from a GitHub issue.
 */
export function remoteIssueFields(gh: GhIssue): Record<string, unknown> {
  const labels = gh.labels
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter((l) => l !== 'epic')
    .sort();
  const status = gh.state === 'closed' ? 'done' : 'todo';
  return {
    title: gh.title,
    status,
    labels,
    assignee: gh.assignee?.login ?? null,
    body: (gh.body ?? '').trim(),
  };
}

/**
 * Extracts comparable fields from a GitHub milestone.
 */
export function remoteMilestoneFields(
  gh: GhMilestone,
): Record<string, unknown> {
  const status = gh.state === 'closed' ? 'done' : 'in_progress';
  return {
    title: gh.title,
    status,
    target_date: gh.due_on ?? null,
    body: (gh.description ?? '').trim(),
  };
}

/**
 * Builds a baseline field snapshot from the sync state hash.
 * Since we only have hashes, we use local or remote as baseline when hashes match.
 */
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

/**
 * Diff a local entity against a remote GitHub resource using the sync state baseline.
 *
 * Uses the stored hashes to determine which side changed:
 * - If local_hash matches current local hash → local didn't change
 * - If remote_hash matches current remote hash → remote didn't change
 */
export function diffEntity(
  local: ParsedEntity,
  remoteFields: Record<string, unknown>,
  baselineLocal: Record<string, unknown>,
  baselineRemote: Record<string, unknown>,
): DiffResult {
  const currentLocal = localEntityFields(local);

  const localChanges = diffFields(baselineLocal, currentLocal);
  const remoteChanges = diffFields(baselineRemote, remoteFields);

  // Find conflicts: same field changed on both sides
  const conflicts: FieldConflict[] = [];
  const localChangedFields = new Set(localChanges.map((c) => c.field));
  const remoteChangedFields = new Set(remoteChanges.map((c) => c.field));

  for (const field of localChangedFields) {
    if (remoteChangedFields.has(field)) {
      const localChange = localChanges.find((c) => c.field === field);
      const remoteChange = remoteChanges.find((c) => c.field === field);
      // If both changed to the same value, it's not a conflict
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

  // Determine overall status
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

/**
 * Simplified diff that compares local and remote using hashes from sync state.
 * Returns whether local changed, remote changed, or both.
 */
export function diffByHash(
  currentLocalHash: string,
  currentRemoteHash: string,
  stateEntry: SyncStateEntry,
): 'in_sync' | 'local_changed' | 'remote_changed' | 'both_changed' {
  const localChanged = currentLocalHash !== stateEntry.local_hash;
  const remoteChanged = currentRemoteHash !== stateEntry.remote_hash;

  if (!localChanged && !remoteChanged) return 'in_sync';
  if (localChanged && !remoteChanged) return 'local_changed';
  if (!localChanged && remoteChanged) return 'remote_changed';
  return 'both_changed';
}
