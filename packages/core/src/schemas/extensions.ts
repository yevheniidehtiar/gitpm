import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import type { Result } from './common.js';

export const fieldExtensionSchema = z.object({
  type: z.enum(['string', 'number', 'boolean']),
  required: z.boolean().default(false),
  enum: z.array(z.union([z.string(), z.number()])).optional(),
  default: z.unknown().optional(),
});

export type FieldExtension = z.infer<typeof fieldExtensionSchema>;

export const entityExtensionSchema = z.object({
  fields: z.record(z.string(), fieldExtensionSchema),
});

export const schemaExtensionsSchema = z.record(
  z.string(),
  entityExtensionSchema,
);

export type SchemaExtensions = z.infer<typeof schemaExtensionsSchema>;

const EXTENSIONS_PATH = '.gitpm/schema-extensions.yaml';

/**
 * Load schema extensions from .meta/.gitpm/schema-extensions.yaml.
 * Returns an empty extensions object if the file doesn't exist.
 */
export async function loadSchemaExtensions(
  metaDir: string,
): Promise<Result<SchemaExtensions>> {
  const filePath = join(metaDir, EXTENSIONS_PATH);

  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = YAML.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return { ok: true, value: {} };
    }

    const validated = schemaExtensionsSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        ok: false,
        error: new Error(
          `Invalid schema extensions in ${filePath}: ${validated.error.message}`,
        ),
      };
    }

    return { ok: true, value: validated.data };
  } catch (err) {
    // File doesn't exist — return empty extensions (not an error)
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return { ok: true, value: {} };
    }

    return {
      ok: false,
      error: new Error(`Failed to load schema extensions: ${err}`),
    };
  }
}

/**
 * Build a Zod schema for custom fields based on extension definitions.
 * Returns a schema that can be merged with the base entity schema.
 */
export function buildExtensionFields(
  extensions: SchemaExtensions,
  entityType: string,
): z.ZodRawShape | null {
  const entityExt = extensions[entityType];
  if (!entityExt?.fields) {
    return null;
  }

  const shape: z.ZodRawShape = {};

  for (const [fieldName, fieldDef] of Object.entries(entityExt.fields)) {
    let fieldSchema: z.ZodTypeAny;

    switch (fieldDef.type) {
      case 'string': {
        if (fieldDef.enum) {
          const members = fieldDef.enum.map(String);
          if (members.length === 0) {
            throw new Error(
              `Enum field "${fieldName}" in ${entityType} extensions must have at least one value`,
            );
          }
          fieldSchema = z.enum(members as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        break;
      }
      case 'number': {
        fieldSchema = z.number();
        break;
      }
      case 'boolean': {
        fieldSchema = z.boolean();
        break;
      }
    }

    if (!fieldDef.required) {
      fieldSchema = fieldSchema.optional();
    }

    if (fieldDef.default !== undefined) {
      fieldSchema = fieldSchema.default(fieldDef.default);
    }

    shape[fieldName] = fieldSchema;
  }

  return shape;
}

/**
 * Extend a base Zod object schema with custom fields from extensions.
 * Uses passthrough() to preserve unknown fields during parsing.
 */
export function extendEntitySchema<T extends z.ZodRawShape>(
  baseSchema: z.ZodObject<T>,
  extensions: SchemaExtensions,
  entityType: string,
): z.ZodObject<T> {
  const customFields = buildExtensionFields(extensions, entityType);

  if (!customFields) {
    // No extensions for this entity type — use passthrough to preserve any extra fields
    return baseSchema.passthrough() as unknown as z.ZodObject<T>;
  }

  // Extend schema with custom fields and use passthrough for any other extras
  return baseSchema
    .extend(customFields)
    .passthrough() as unknown as z.ZodObject<T>;
}
