import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
});
