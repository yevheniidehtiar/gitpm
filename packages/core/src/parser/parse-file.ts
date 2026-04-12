import { readFile } from 'node:fs/promises';
import matter from 'gray-matter';
import YAML from 'yaml';
import type { Result } from '../schemas/common.js';
import type { SchemaExtensions } from '../schemas/extensions.js';
import { extendEntitySchema } from '../schemas/extensions.js';
import type { ParsedEntity } from '../schemas/index.js';
import {
  epicSchema,
  milestoneSchema,
  prdSchema,
  roadmapSchema,
  sprintSchema,
  storySchema,
} from '../schemas/index.js';

function coerceDates(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item instanceof Date
          ? item.toISOString()
          : item && typeof item === 'object' && !Array.isArray(item)
            ? coerceDates(item as Record<string, unknown>)
            : item,
      );
    } else if (value && typeof value === 'object') {
      result[key] = coerceDates(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function parseFile(
  filePath: string,
  extensions?: SchemaExtensions,
): Promise<Result<ParsedEntity>> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return parseFileContent(raw, filePath, extensions);
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to read file ${filePath}: ${err}`),
    };
  }
}

export function parseFileContent(
  raw: string,
  filePath: string,
  extensions?: SchemaExtensions,
): Result<ParsedEntity> {
  try {
    const isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml');

    if (isYaml) {
      const data = YAML.parse(raw);
      if (!data || typeof data !== 'object') {
        return { ok: false, error: new Error(`Invalid YAML in ${filePath}`) };
      }
      return parseEntityData(coerceDates(data), '', filePath, extensions);
    }

    const { data, content } = matter(raw);
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        error: new Error(`Invalid frontmatter in ${filePath}`),
      };
    }
    return parseEntityData(
      coerceDates(data as Record<string, unknown>),
      content.trim(),
      filePath,
      extensions,
    );
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to parse ${filePath}: ${err}`),
    };
  }
}

function getSchema(type: string, extensions?: SchemaExtensions) {
  switch (type) {
    case 'story':
      return extensions
        ? extendEntitySchema(storySchema, extensions, 'story')
        : storySchema;
    case 'epic':
      return extensions
        ? extendEntitySchema(epicSchema, extensions, 'epic')
        : epicSchema;
    case 'milestone':
      return extensions
        ? extendEntitySchema(milestoneSchema, extensions, 'milestone')
        : milestoneSchema;
    case 'roadmap':
      return extensions
        ? extendEntitySchema(roadmapSchema, extensions, 'roadmap')
        : roadmapSchema;
    case 'prd':
      return extensions
        ? extendEntitySchema(prdSchema, extensions, 'prd')
        : prdSchema;
    case 'sprint':
      return extensions
        ? extendEntitySchema(sprintSchema, extensions, 'sprint')
        : sprintSchema;
    default:
      return null;
  }
}

function parseEntityData(
  data: Record<string, unknown>,
  body: string,
  filePath: string,
  extensions?: SchemaExtensions,
): Result<ParsedEntity> {
  if (!data.type || typeof data.type !== 'string') {
    return {
      ok: false,
      error: new Error(`Missing or invalid "type" field in ${filePath}`),
    };
  }
  const type = data.type;
  const input = { ...data, body, filePath };

  const schema = getSchema(type, extensions);
  if (!schema) {
    return {
      ok: false,
      error: new Error(`Unknown entity type "${type}" in ${filePath}`),
    };
  }

  const result = schema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      error: new Error(
        `Validation failed for ${type} in ${filePath}: ${result.error.message}`,
      ),
    };
  }

  return { ok: true, value: result.data as ParsedEntity };
}
