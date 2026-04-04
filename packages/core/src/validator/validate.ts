import { buildDependencyGraph } from '../resolver/graph.js';
import type { ResolvedTree } from '../resolver/types.js';
import type {
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from './types.js';

export function validateTree(tree: ResolvedTree): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check for unresolved refs (already collected in tree.errors)
  for (const err of tree.errors) {
    errors.push({
      entityId: '',
      filePath: err.filePath,
      code: 'UNRESOLVED_REF',
      message: err.message,
    });
  }

  // Check for duplicate IDs
  const idMap = new Map<string, string[]>();
  const allEntities = [
    ...tree.stories,
    ...tree.epics,
    ...tree.milestones,
    ...tree.roadmaps,
    ...tree.prds,
  ];

  for (const entity of allEntities) {
    const existing = idMap.get(entity.id);
    if (existing) {
      existing.push(entity.filePath);
    } else {
      idMap.set(entity.id, [entity.filePath]);
    }
  }

  for (const [id, paths] of idMap) {
    if (paths.length > 1) {
      errors.push({
        entityId: id,
        filePath: paths[0],
        code: 'DUPLICATE_ID',
        message: `Duplicate entity ID "${id}" found in: ${paths.join(', ')}`,
      });
    }
  }

  // Check for cycles
  const graph = buildDependencyGraph(tree);
  const cycles = graph.findCycles();
  for (const cycle of cycles) {
    errors.push({
      entityId: cycle[0],
      filePath: '',
      code: 'CIRCULAR_DEPENDENCY',
      message: `Circular dependency detected: ${cycle.join(' → ')} → ${cycle[0]}`,
    });
  }

  // Status consistency: epic not "done" if any story is "in_progress" or similar
  for (const epic of tree.epics) {
    if (epic.resolvedStories.length === 0) continue;

    const activeStatuses = ['in_progress', 'in_review', 'todo'];
    const hasActiveStories = epic.resolvedStories.some((s) =>
      activeStatuses.includes(s.status),
    );

    if (epic.status === 'done' && hasActiveStories) {
      errors.push({
        entityId: epic.id,
        filePath: epic.filePath,
        code: 'STATUS_INCONSISTENCY',
        message: `Epic "${epic.title}" is marked as done but has active stories`,
      });
    }

    if (epic.status === 'cancelled' && hasActiveStories) {
      warnings.push({
        entityId: epic.id,
        filePath: epic.filePath,
        code: 'STATUS_INCONSISTENCY',
        message: `Epic "${epic.title}" is cancelled but has active stories`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
