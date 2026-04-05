import type { ConflictStrategy, FieldConflict, Resolution } from './types.js';

export function resolveConflicts(
  conflicts: FieldConflict[],
  strategy: ConflictStrategy,
): Resolution[] {
  if (strategy === 'local-wins') {
    return conflicts.map((c) => ({
      entityId: c.entityId,
      field: c.field,
      pick: 'local' as const,
    }));
  }

  if (strategy === 'remote-wins') {
    return conflicts.map((c) => ({
      entityId: c.entityId,
      field: c.field,
      pick: 'remote' as const,
    }));
  }

  // 'ask' strategy — return empty, CLI layer handles interactive prompting
  return [];
}

export function applyResolutions(
  localFields: Record<string, unknown>,
  remoteFields: Record<string, unknown>,
  conflicts: FieldConflict[],
  resolutions: Resolution[],
): Record<string, unknown> {
  const result = { ...localFields };

  // Apply non-conflicting remote changes
  const conflictFields = new Set(conflicts.map((c) => c.field));
  for (const [key, value] of Object.entries(remoteFields)) {
    if (!conflictFields.has(key)) {
      result[key] = value;
    }
  }

  // Apply resolution picks
  for (const resolution of resolutions) {
    const conflict = conflicts.find((c) => c.field === resolution.field);
    if (conflict) {
      result[resolution.field] =
        resolution.pick === 'local'
          ? conflict.localValue
          : conflict.remoteValue;
    }
  }

  return result;
}
