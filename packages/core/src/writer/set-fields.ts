import type { Result } from '../schemas/common.js';
import type { ParsedEntity } from '../schemas/index.js';
import {
  epicSchema,
  milestoneSchema,
  prdSchema,
  roadmapSchema,
  storySchema,
} from '../schemas/index.js';

export interface FieldAssignment {
  field: string;
  operator: '=' | '+=' | '-=';
  value: string;
}

export function parseAssignment(expr: string): Result<FieldAssignment> {
  // Check for += and -= first (before =)
  const addMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_.]*)\+=(.*)$/);
  if (addMatch) {
    return {
      ok: true,
      value: { field: addMatch[1], operator: '+=', value: addMatch[2] },
    };
  }

  const removeMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_.]*)-=(.*)$/);
  if (removeMatch) {
    return {
      ok: true,
      value: { field: removeMatch[1], operator: '-=', value: removeMatch[2] },
    };
  }

  const setMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_.]*)=(.*)$/);
  if (setMatch) {
    return {
      ok: true,
      value: { field: setMatch[1], operator: '=', value: setMatch[2] },
    };
  }

  return {
    ok: false,
    error: new Error(
      `Invalid assignment expression: "${expr}". Expected field=value, field+=value, or field-=value`,
    ),
  };
}

function setNestedField(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (
      current[part] === null ||
      current[part] === undefined ||
      typeof current[part] !== 'object'
    ) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function coerceValue(value: string): unknown {
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export function applyAssignments(
  entity: ParsedEntity,
  assignments: FieldAssignment[],
): Result<ParsedEntity> {
  const data = { ...entity } as Record<string, unknown>;

  for (const assignment of assignments) {
    const { field, operator, value } = assignment;

    if (operator === '+=') {
      const current = data[field];
      if (Array.isArray(current)) {
        data[field] = [...current, value];
      } else {
        return {
          ok: false,
          error: new Error(`Cannot use += on non-array field "${field}"`),
        };
      }
      continue;
    }

    if (operator === '-=') {
      const current = data[field];
      if (Array.isArray(current)) {
        data[field] = current.filter((item: unknown) => item !== value);
      } else {
        return {
          ok: false,
          error: new Error(`Cannot use -= on non-array field "${field}"`),
        };
      }
      continue;
    }

    // operator === '='
    const coerced = coerceValue(value);
    if (field.includes('.')) {
      setNestedField(data, field, coerced);
    } else {
      data[field] = coerced;
    }
  }

  // Update timestamp
  data.updated_at = new Date().toISOString();

  // Validate against the appropriate schema
  const type = data.type;
  switch (type) {
    case 'story': {
      const result = storySchema.safeParse(data);
      if (!result.success) {
        return {
          ok: false,
          error: new Error(`Validation failed: ${result.error.message}`),
        };
      }
      return { ok: true, value: result.data };
    }
    case 'epic': {
      const result = epicSchema.safeParse(data);
      if (!result.success) {
        return {
          ok: false,
          error: new Error(`Validation failed: ${result.error.message}`),
        };
      }
      return { ok: true, value: result.data };
    }
    case 'milestone': {
      const result = milestoneSchema.safeParse(data);
      if (!result.success) {
        return {
          ok: false,
          error: new Error(`Validation failed: ${result.error.message}`),
        };
      }
      return { ok: true, value: result.data };
    }
    case 'prd': {
      const result = prdSchema.safeParse(data);
      if (!result.success) {
        return {
          ok: false,
          error: new Error(`Validation failed: ${result.error.message}`),
        };
      }
      return { ok: true, value: result.data };
    }
    case 'roadmap': {
      const result = roadmapSchema.safeParse(data);
      if (!result.success) {
        return {
          ok: false,
          error: new Error(`Validation failed: ${result.error.message}`),
        };
      }
      return { ok: true, value: result.data };
    }
    default:
      return {
        ok: false,
        error: new Error(`Unknown entity type "${type}"`),
      };
  }
}
