import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFile, parseFileContent } from './parse-file.js';
import { parseTree } from './parse-tree.js';

const fixturesDir = join(__dirname, '..', '__fixtures__');
const validTree = join(fixturesDir, 'valid-tree', '.meta');
const brokenTree = join(fixturesDir, 'broken-tree', '.meta');

describe('parseFileContent', () => {
  it('parses a story from markdown', () => {
    const content = `---
type: story
id: "st_1"
title: "Test story"
status: todo
priority: low
---

Some body text.`;
    const result = parseFileContent(content, '/test/story.md');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe('story');
      expect(result.value.id).toBe('st_1');
    }
  });

  it('parses a roadmap from YAML', () => {
    const content = `type: roadmap
id: "rm_1"
title: "Test Roadmap"
milestones:
  - id: "ms_1"
`;
    const result = parseFileContent(content, '/test/roadmap.yaml');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe('roadmap');
    }
  });

  it('returns error for unknown type', () => {
    const content = `---
type: unknown
id: "x"
title: "X"
---`;
    const result = parseFileContent(content, '/test/x.md');
    expect(result.ok).toBe(false);
  });

  it('returns error for invalid data', () => {
    const content = `---
type: story
---`;
    const result = parseFileContent(content, '/test/bad.md');
    expect(result.ok).toBe(false);
  });

  it('returns error for YAML file that parses to a non-object', () => {
    const result = parseFileContent('42', '/test/scalar.yaml');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Invalid YAML');
  });

  it('returns error for YAML file that parses to null', () => {
    const result = parseFileContent('', '/test/empty.yaml');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Invalid YAML');
  });

  it('returns error when YAML content is malformed', () => {
    const result = parseFileContent('::: not yaml :::', '/test/bad.yaml');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Failed to parse');
  });

  it('returns error for missing type field', () => {
    const content = `---
id: "abc"
title: "no type"
---`;
    const result = parseFileContent(content, '/test/typeless.md');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Missing or invalid "type"');
  });

  it('coerces Date instances to ISO strings', () => {
    const content = `---
type: milestone
id: "ms_1"
title: "Milestone"
status: todo
target_date: 2026-06-01
created_at: 2026-01-01
updated_at: 2026-01-01
---`;
    const result = parseFileContent(content, '/test/m.md');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof (result.value as Record<string, unknown>).target_date).toBe(
      'string',
    );
  });

  it('coerces nested Date arrays', () => {
    // roadmap.milestones expects array of entity refs, but we can still
    // exercise the date-coercion logic by passing a frontmatter with a
    // Date value inside a nested object.
    const content = `---
type: roadmap
id: "rm_1"
title: "Roadmap"
milestones:
  - id: ms_1
    target_date: 2026-06-01
---`;
    const result = parseFileContent(content, '/test/r.md');
    expect(result.ok).toBe(true);
  });
});

describe('parseFile', () => {
  it('parses a valid story file', async () => {
    const filePath = join(validTree, 'stories', 'setup-ci.md');
    const result = await parseFile(filePath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe('story');
      expect(result.value.id).toBe('st_ci');
    }
  });

  it('parses a valid epic file', async () => {
    const filePath = join(validTree, 'epics', 'balancing-engine', 'epic.md');
    const result = await parseFile(filePath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe('epic');
    }
  });

  it('parses a valid roadmap YAML file', async () => {
    const filePath = join(validTree, 'roadmap', 'roadmap.yaml');
    const result = await parseFile(filePath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe('roadmap');
    }
  });

  it('returns error for nonexistent file', async () => {
    const result = await parseFile('/nonexistent/file.md');
    expect(result.ok).toBe(false);
  });

  it('parses a YAML file and coerces top-level dates', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gitpm-parse-yaml-'));
    try {
      const yamlPath = join(dir, 'roadmap.yaml');
      await writeFile(
        yamlPath,
        'type: roadmap\nid: rm_yaml\ntitle: Yaml roadmap\nupdated_at: 2026-01-01\n',
      );
      const result = await parseFile(yamlPath);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.type).toBe('roadmap');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('parseTree', () => {
  it('parses valid tree completely', async () => {
    const result = await parseTree(validTree);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const tree = result.value;
      expect(tree.stories).toHaveLength(3);
      expect(tree.epics).toHaveLength(1);
      expect(tree.milestones).toHaveLength(2);
      expect(tree.roadmaps).toHaveLength(1);
      expect(tree.prds).toHaveLength(1);
      expect(tree.errors).toHaveLength(0);
    }
  });

  it('parses broken tree with errors', async () => {
    const result = await parseTree(brokenTree);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const tree = result.value;
      // missing-fields.md should fail (no title)
      expect(tree.errors.length).toBeGreaterThan(0);
      // orphan epic and duplicate-id story should parse OK
      expect(tree.epics.length + tree.stories.length).toBeGreaterThan(0);
    }
  });

  it('records an error when schema-extensions.yaml is invalid', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gitpm-parse-ext-'));
    try {
      const metaDir = join(dir, '.meta');
      await mkdir(join(metaDir, '.gitpm'), { recursive: true });
      await writeFile(
        join(metaDir, '.gitpm', 'schema-extensions.yaml'),
        'story:\n  fields:\n    foo:\n      type: invalid_type\n',
      );

      const result = await parseTree(metaDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const extErrors = result.value.errors.filter((e) =>
        e.filePath.endsWith('schema-extensions.yaml'),
      );
      expect(extErrors.length).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('collects per-file parse errors without aborting the tree walk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gitpm-parse-errs-'));
    try {
      const metaDir = join(dir, '.meta', 'stories');
      await mkdir(metaDir, { recursive: true });
      await writeFile(
        join(metaDir, 'bad.md'),
        '---\ntype: unknown\nid: "x"\ntitle: "X"\n---',
      );
      await writeFile(
        join(metaDir, 'ok.md'),
        '---\ntype: story\nid: st_ok\ntitle: Ok\nstatus: todo\npriority: medium\nlabels: []\ncreated_at: 2026-01-01T00:00:00Z\nupdated_at: 2026-01-01T00:00:00Z\n---\n',
      );
      const result = await parseTree(join(dir, '.meta'));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.errors.length).toBeGreaterThan(0);
      expect(result.value.stories).toHaveLength(1);
      expect(result.value.stories[0].id).toBe('st_ok');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('accepts sprint files into tree.sprints', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gitpm-parse-sprint-'));
    try {
      const metaDir = join(dir, '.meta', 'sprints');
      await mkdir(metaDir, { recursive: true });
      await writeFile(
        join(metaDir, 'sp.md'),
        '---\ntype: sprint\nid: sp_1\ntitle: Sprint One\nstatus: in_progress\nstart_date: 2026-01-01\nend_date: 2026-01-14\nstories: []\ncreated_at: 2026-01-01T00:00:00Z\nupdated_at: 2026-01-01T00:00:00Z\n---\n',
      );
      const result = await parseTree(join(dir, '.meta'));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.sprints).toHaveLength(1);
      expect(result.value.sprints[0].id).toBe('sp_1');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns an error result when the meta directory does not exist', async () => {
    const result = await parseTree('/does/not/exist/anywhere-ever');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Failed to parse tree');
  });
});
