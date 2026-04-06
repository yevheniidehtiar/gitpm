import { readFile } from 'node:fs/promises';
import matter from 'gray-matter';
import YAML from 'yaml';
import type { Result } from '../schemas/common.js';
import type { ParsedEntity } from '../schemas/index.js';
import {
  epicSchema,
  milestoneSchema,
  prdSchema,
  roadmapSchema,
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
): Promise<Result<ParsedEntity>> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return parseFileContent(raw, filePath);
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
): Result<ParsedEntity> {
  try {
    const isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml');

    if (isYaml) {
      const data = YAML.parse(raw);
      if (!data || typeof data !== 'object') {
        return { ok: false, error: new Error(`Invalid YAML in ${filePath}`) };
      }
      return parseEntityData(coerceDates(data), '', filePath);
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
    );
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to parse ${filePath}: ${err}`),
    };
  }
}

function parseEntityData(
  data: Record<string, unknown>,
  body: string,
  filePath: string,
): Result<ParsedEntity> {
  const type = data.type;

  const input = { ...data, body, filePath };

  switch (type) {
    case 'story': {
      const result = storySchema.safeParse(input);
      if (!result.success) {
        return {
          ok: false,
          error: new Error(
            `Validation failed for story in ${filePath}: ${result.error.message}`,
          ),
        };
      }
      return { ok: true, value: result.data };
    }
    case 'epic': {
      const result = epicSchema.safeParse(input);
      if (!result.success) {
        return {
          ok: false,
          error: new Error(
            `Validation failed for epic in ${filePath}: ${result.error.message}`,
          ),
        };
      }
      return { ok: true, value: result.data };
    }
    case 'milestone': {
      const result = milestoneSchema.safeParse(input);
      if (!result.success) {
        return {
          ok: false,
          error: new Error(
            `Validation failed for milestone in ${filePath}: ${result.error.message}`,
          ),
        };
      }
      return { ok: true, value: result.data };
    }
    case 'roadmap': {
      const result = roadmapSchema.safeParse(input);
      if (!result.success) {
        return {
          ok: false,
          error: new Error(
            `Validation failed for roadmap in ${filePath}: ${result.error.message}`,
          ),
        };
      }
      return { ok: true, value: result.data };
    }
    case 'prd': {
      const result = prdSchema.safeParse(input);
      if (!result.success) {
        return {
          ok: false,
          error: new Error(
            `Validation failed for prd in ${filePath}: ${result.error.message}`,
          ),
        };
      }
      return { ok: true, value: result.data };
    }
    default:
      return {
        ok: false,
        error: new Error(`Unknown entity type "${type}" in ${filePath}`),
      };
  }
}
