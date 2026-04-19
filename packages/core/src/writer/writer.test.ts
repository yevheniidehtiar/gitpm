import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTree } from '../parser/parse-tree.js';
import { scaffoldMeta } from './scaffold.js';
import { toSlug } from './slug.js';
import { writeTree } from './write-tree.js';

const fixturesDir = join(__dirname, '..', '__fixtures__');
const validTree = join(fixturesDir, 'valid-tree', '.meta');

describe('toSlug', () => {
  it('converts simple title', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(toSlug('Hello, World! @#$')).toBe('hello-world');
  });

  it('collapses multiple hyphens', () => {
    expect(toSlug('foo---bar')).toBe('foo-bar');
  });

  it('trims hyphens from edges', () => {
    expect(toSlug('  --hello--  ')).toBe('hello');
  });

  it('truncates to 60 characters', () => {
    const long = 'a'.repeat(100);
    expect(toSlug(long).length).toBeLessThanOrEqual(60);
  });
});

describe('round-trip: parse → write → parse', () => {
  it('is lossless for valid tree', async () => {
    // Parse original
    const original = await parseTree(validTree);
    expect(original.ok).toBe(true);
    if (!original.ok) return;

    // Write to temp dir — remap file paths from fixture dir to temp dir
    const tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-test-'));
    const metaDir = join(tmpDir, '.meta');

    // Remap all entity file paths
    const remapped = { ...original.value };
    const remap = (entities: Array<{ filePath: string }>) =>
      entities.map((e) => ({
        ...e,
        filePath: e.filePath.replace(validTree, metaDir),
      }));
    remapped.stories = remap(remapped.stories) as typeof remapped.stories;
    remapped.epics = remap(remapped.epics) as typeof remapped.epics;
    remapped.milestones = remap(
      remapped.milestones,
    ) as typeof remapped.milestones;
    remapped.roadmaps = remap(remapped.roadmaps) as typeof remapped.roadmaps;
    remapped.prds = remap(remapped.prds) as typeof remapped.prds;

    try {
      const writeResult = await writeTree(remapped, metaDir);
      expect(writeResult.ok).toBe(true);

      // Parse again
      const reparsed = await parseTree(metaDir);
      expect(reparsed.ok).toBe(true);
      if (!reparsed.ok) return;

      // Compare counts
      expect(reparsed.value.stories).toHaveLength(
        original.value.stories.length,
      );
      expect(reparsed.value.epics).toHaveLength(original.value.epics.length);
      expect(reparsed.value.milestones).toHaveLength(
        original.value.milestones.length,
      );
      expect(reparsed.value.roadmaps).toHaveLength(
        original.value.roadmaps.length,
      );
      expect(reparsed.value.prds).toHaveLength(original.value.prds.length);
      expect(reparsed.value.errors).toHaveLength(0);

      // Compare content of each entity
      for (const story of original.value.stories) {
        const match = reparsed.value.stories.find((s) => s.id === story.id);
        expect(match).toBeDefined();
        expect(match?.title).toBe(story.title);
        expect(match?.status).toBe(story.status);
        expect(match?.priority).toBe(story.priority);
      }

      for (const epic of original.value.epics) {
        const match = reparsed.value.epics.find((e) => e.id === epic.id);
        expect(match).toBeDefined();
        expect(match?.title).toBe(epic.title);
      }
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });
});

describe('writeTree error paths', () => {
  it('returns an error result when an entity cannot be written', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-writetree-err-'));
    try {
      // Blocking: metaDir is a file, not a dir.
      const metaDir = join(tmpDir, 'meta-file');
      const { writeFile: fsWrite } = await import('node:fs/promises');
      await fsWrite(metaDir, 'blocker');

      const tree = {
        stories: [],
        epics: [],
        milestones: [],
        roadmaps: [],
        prds: [],
        sprints: [
          {
            type: 'sprint' as const,
            id: 'sp1',
            title: 'S',
            status: 'todo' as const,
            start_date: '2026-01-01',
            end_date: '2026-01-14',
            stories: [],
            body: '',
            filePath: join(metaDir, 'sprints', 'sp1.md'),
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        errors: [],
      };

      const result = await writeTree(tree, metaDir);
      expect(result.ok).toBe(false);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('handles tree with undefined sprints field', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-writetree-nosprints-'));
    try {
      const metaDir = join(tmpDir, '.meta');
      const tree = {
        stories: [],
        epics: [],
        milestones: [],
        roadmaps: [],
        prds: [],
        errors: [],
      } as unknown as Parameters<typeof writeTree>[0];
      const result = await writeTree(tree, metaDir);
      expect(result.ok).toBe(true);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns an error when iterating fails unexpectedly', async () => {
    // Force the try/catch by passing a tree-like object whose accessors throw.
    const bad = {
      get stories(): never[] {
        throw new Error('boom');
      },
      epics: [],
      milestones: [],
      roadmaps: [],
      prds: [],
      sprints: [],
      errors: [],
    };
    const result = await writeTree(
      bad as unknown as Parameters<typeof writeTree>[0],
      '/tmp/nowhere',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('/tmp/nowhere');
  });
});

describe('scaffoldMeta', () => {
  it('creates a valid .meta tree', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-scaffold-'));
    const metaDir = join(tmpDir, '.meta');

    try {
      const result = await scaffoldMeta(metaDir, 'Test Project');
      expect(result.ok).toBe(true);

      // Parse the scaffolded tree
      const parsed = await parseTree(metaDir);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;

      expect(parsed.value.roadmaps).toHaveLength(1);
      expect(parsed.value.milestones).toHaveLength(1);
      expect(parsed.value.epics).toHaveLength(1);
      expect(parsed.value.stories).toHaveLength(1);
      expect(parsed.value.errors).toHaveLength(0);
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });
});
