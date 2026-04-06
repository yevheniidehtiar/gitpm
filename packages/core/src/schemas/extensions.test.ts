import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { epicSchema } from './epic.js';
import {
  buildExtensionFields,
  extendEntitySchema,
  loadSchemaExtensions,
  schemaExtensionsSchema,
} from './extensions.js';
import { storySchema } from './story.js';

describe('schemaExtensionsSchema', () => {
  it('validates a complete extensions definition', () => {
    const result = schemaExtensionsSchema.safeParse({
      story: {
        fields: {
          story_points: { type: 'number', required: false },
          team: {
            type: 'string',
            enum: ['platform', 'frontend', 'backend'],
          },
        },
      },
      epic: {
        fields: {
          department: { type: 'string', required: false },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid field type', () => {
    const result = schemaExtensionsSchema.safeParse({
      story: {
        fields: {
          bad_field: { type: 'date' }, // "date" not in enum
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('validates boolean field type', () => {
    const result = schemaExtensionsSchema.safeParse({
      story: {
        fields: {
          is_urgent: { type: 'boolean', required: false },
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('loadSchemaExtensions', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gitpm-ext-test-${Date.now()}`);
    await mkdir(join(tmpDir, '.gitpm'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty extensions when file does not exist', async () => {
    const result = await loadSchemaExtensions(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({});
    }
  });

  it('loads valid extensions from YAML', async () => {
    await writeFile(
      join(tmpDir, '.gitpm', 'schema-extensions.yaml'),
      `story:
  fields:
    story_points:
      type: number
      required: false
    team:
      type: string
      enum: [platform, frontend, backend]
`,
    );

    const result = await loadSchemaExtensions(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.story?.fields.story_points.type).toBe('number');
      expect(result.value.story?.fields.team.enum).toEqual([
        'platform',
        'frontend',
        'backend',
      ]);
    }
  });

  it('returns error for invalid YAML content', async () => {
    await writeFile(
      join(tmpDir, '.gitpm', 'schema-extensions.yaml'),
      `story:
  fields:
    bad: { type: invalid_type }
`,
    );

    const result = await loadSchemaExtensions(tmpDir);
    expect(result.ok).toBe(false);
  });
});

describe('buildExtensionFields', () => {
  it('returns null when no extensions for entity type', () => {
    const result = buildExtensionFields({}, 'story');
    expect(result).toBeNull();
  });

  it('builds string field', () => {
    const fields = buildExtensionFields(
      {
        story: {
          fields: {
            team: { type: 'string', required: false },
          },
        },
      },
      'story',
    );
    expect(fields).not.toBeNull();
    expect(fields?.team).toBeDefined();
  });

  it('builds number field', () => {
    const fields = buildExtensionFields(
      {
        story: {
          fields: {
            points: { type: 'number', required: true },
          },
        },
      },
      'story',
    );
    expect(fields).not.toBeNull();
    expect(fields?.points).toBeDefined();
  });

  it('builds boolean field', () => {
    const fields = buildExtensionFields(
      {
        story: {
          fields: {
            is_blocked: { type: 'boolean', required: false },
          },
        },
      },
      'story',
    );
    expect(fields).not.toBeNull();
    expect(fields?.is_blocked).toBeDefined();
  });

  it('builds enum string field', () => {
    const fields = buildExtensionFields(
      {
        story: {
          fields: {
            team: {
              type: 'string',
              required: false,
              enum: ['a', 'b', 'c'],
            },
          },
        },
      },
      'story',
    );
    expect(fields).not.toBeNull();
  });
});

describe('extendEntitySchema', () => {
  const extensions = {
    story: {
      fields: {
        story_points: { type: 'number' as const, required: false },
        team: {
          type: 'string' as const,
          required: false,
          enum: ['platform', 'frontend', 'backend'],
        },
      },
    },
  };

  it('extends story schema and validates custom fields', () => {
    const extended = extendEntitySchema(storySchema, extensions, 'story');
    const result = extended.safeParse({
      type: 'story',
      id: 'test-123',
      title: 'Test story',
      status: 'todo',
      priority: 'medium',
      body: '',
      filePath: '/test.md',
      story_points: 5,
      team: 'frontend',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.story_points).toBe(5);
      expect(result.data.team).toBe('frontend');
    }
  });

  it('rejects invalid enum value in custom field', () => {
    const extended = extendEntitySchema(storySchema, extensions, 'story');
    const result = extended.safeParse({
      type: 'story',
      id: 'test-123',
      title: 'Test story',
      status: 'todo',
      priority: 'medium',
      body: '',
      filePath: '/test.md',
      team: 'invalid-team',
    });
    expect(result.success).toBe(false);
  });

  it('allows omitting optional custom fields', () => {
    const extended = extendEntitySchema(storySchema, extensions, 'story');
    const result = extended.safeParse({
      type: 'story',
      id: 'test-123',
      title: 'Test story',
      status: 'todo',
      priority: 'medium',
      body: '',
      filePath: '/test.md',
    });
    expect(result.success).toBe(true);
  });

  it('preserves base schema validation', () => {
    const extended = extendEntitySchema(storySchema, extensions, 'story');
    // Missing required 'title'
    const result = extended.safeParse({
      type: 'story',
      id: 'test-123',
      status: 'todo',
      priority: 'medium',
      body: '',
      filePath: '/test.md',
    });
    expect(result.success).toBe(false);
  });

  it('returns passthrough schema when no extensions for type', () => {
    const extended = extendEntitySchema(
      epicSchema,
      { story: extensions.story },
      'epic',
    );
    // Should still work as normal epic schema + passthrough
    const result = extended.safeParse({
      type: 'epic',
      id: 'epic-123',
      title: 'Test epic',
      status: 'todo',
      priority: 'medium',
      body: '',
      filePath: '/test.md',
      unknown_field: 'preserved',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unknown_field).toBe('preserved');
    }
  });
});
