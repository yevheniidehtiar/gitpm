import type { Result } from '../schemas/common.js';
import type { ParsedEntity } from '../schemas/index.js';
import {
  epicSchema,
  milestoneSchema,
  prdSchema,
  roadmapSchema,
  storySchema,
} from '../schemas/index.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isDangerousKey(key: string): boolean {
  return DANGEROUS_KEYS.has(key);
}

function dangerousKeyError(part: string, path: string): Result<ParsedEntity> {
  return {
    ok: false,
    error: new Error(
      `Dangerous field name "${part}" in "${path}" — this could cause prototype pollution`,
    ),
  };
}

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
): Result<void> {
  const parts = path.split('.');
  // Reject dangerous keys in any segment of the path.
  for (const part of parts) {
    if (isDangerousKey(part)) {
      return {
        ok: false,
        error: new Error(
          `Dangerous field name "${part}" in path "${path}" — this could cause prototype pollution`,
        ),
      };
    }
  }
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const existing = Object.hasOwn(current, part) ? current[part] : undefined;
    if (
      existing === null ||
      existing === undefined ||
      typeof existing !== 'object'
    ) {
      // Create with a null prototype so intermediate objects cannot be
      // used as a vector to reach Object.prototype.
      const fresh = Object.create(null) as Record<string, unknown>;
      Object.defineProperty(current, part, {
        value: fresh,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      current = fresh;
    } else {
      current = existing as Record<string, unknown>;
    }
  }
  const last = parts[parts.length - 1];
  // Use defineProperty to bypass any accessor on the prototype chain.
  Object.defineProperty(current, last, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  return { ok: true, value: undefined };
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

    // Guard against prototype pollution for all operators.
    const fieldParts = field.split('.');
    for (const part of fieldParts) {
      if (isDangerousKey(part)) {
        return dangerousKeyError(part, field);
      }
    }

    if (operator === '+=') {
      const current = Object.hasOwn(data, field) ? data[field] : undefined;
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
      const current = Object.hasOwn(data, field) ? data[field] : undefined;
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
      const nestedResult = setNestedField(data, field, coerced);
      if (!nestedResult.ok) {
        return {
          ok: false,
          error: nestedResult.error,
        };
      }
    } else {
      // Use defineProperty to avoid any accessor on the prototype chain.
      Object.defineProperty(data, field, {
        value: coerced,
        writable: true,
        enumerable: true,
        configurable: true,
      });
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
