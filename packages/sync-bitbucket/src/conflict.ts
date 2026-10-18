import type {
  ConflictStrategy,
  DiffResult,
  FieldConflict,
  Resolution,
} from '@gitpm/core';
import type { SyncField, SyncFields } from './diff.js';

/**
 * `local-wins` and `remote-wins` resolve every conflict; `ask` resolves none
 * and leaves the conflicts for the CLI to present.
 */
export function resolveConflicts(
  conflicts: FieldConflict[],
  strategy: ConflictStrategy,
): Resolution[] {
  if (strategy === 'ask') return [];
  const pick = strategy === 'local-wins' ? 'local' : 'remote';
  return conflicts.map((c) => ({ entityId: c.entityId, field: c.field, pick }));
}

/**
 * Merge both sides: local values, then remote-only changes, then the
 * resolution picked for each conflicting field.
 */
export function mergeFields(
  local: SyncFields,
  remote: SyncFields,
  diff: DiffResult,
  resolutions: Resolution[],
): SyncFields {
  const merged = { ...local } as Record<SyncField, unknown>;
  for (const change of diff.remoteChanges) {
    merged[change.field as SyncField] = change.newValue;
  }
  for (const resolution of resolutions) {
    const field = resolution.field as SyncField;
    merged[field] = resolution.pick === 'local' ? local[field] : remote[field];
  }
  return merged as unknown as SyncFields;
}
