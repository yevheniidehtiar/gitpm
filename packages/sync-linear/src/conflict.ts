import type { ConflictStrategy, FieldConflict, Resolution } from './types.js';

export function resolveConflicts(
  conflicts: FieldConflict[],
  strategy: ConflictStrategy,
): Resolution[] {
  if (strategy === 'ask') {
    return [];
  }

  const pick = strategy === 'local-wins' ? 'local' : 'remote';

  return conflicts.map((conflict) => ({
    entityId: conflict.entityId,
    field: conflict.field,
    pick,
  }));
}

export function applyResolutions(
  localFields: Record<string, unknown>,
  _remoteFields: Record<string, unknown>,
  conflicts: FieldConflict[],
  resolutions: Resolution[],
): Record<string, unknown> {
  const merged = { ...localFields };

  for (const resolution of resolutions) {
    if (resolution.pick === 'remote') {
      const conflict = conflicts.find((c) => c.field === resolution.field);
      if (conflict) {
        merged[resolution.field] = conflict.remoteValue;
      }
    }
  }

  return merged;
}
