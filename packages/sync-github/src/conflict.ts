import type { ConflictStrategy, FieldConflict, Resolution } from './types.js';

/**
 * Resolve conflicts using the specified strategy.
 *
 * For 'local-wins': all conflicts resolve to local values.
 * For 'remote-wins': all conflicts resolve to remote values.
 * For 'ask': returns empty resolutions — the CLI layer (Phase 5) handles interactive prompting.
 */
export function resolveConflicts(
  conflicts: FieldConflict[],
  strategy: ConflictStrategy,
): Resolution[] {
  if (strategy === 'ask') {
    // Return empty — the caller (CLI) is responsible for interactive resolution
    return [];
  }

  const pick = strategy === 'local-wins' ? 'local' : 'remote';

  return conflicts.map((conflict) => ({
    entityId: conflict.entityId,
    field: conflict.field,
    pick,
  }));
}

/**
 * Apply resolutions to a set of field values.
 * Returns the merged field map with conflicts resolved.
 */
export function applyResolutions(
  localFields: Record<string, unknown>,
  remoteFields: Record<string, unknown>,
  conflicts: FieldConflict[],
  resolutions: Resolution[],
): Record<string, unknown> {
  const merged = { ...localFields };

  // Apply non-conflicting remote changes (remote-only fields)
  for (const [key, value] of Object.entries(remoteFields)) {
    if (!conflicts.some((c) => c.field === key)) {
      // Only apply if field was changed remotely (handled by caller)
    }
  }

  // Apply resolutions for conflicts
  for (const resolution of resolutions) {
    if (resolution.pick === 'remote') {
      const conflict = conflicts.find((c) => c.field === resolution.field);
      if (conflict) {
        merged[resolution.field] = conflict.remoteValue;
      }
    }
    // 'local' pick means keep current local value (already in merged)
  }

  return merged;
}
