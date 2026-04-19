import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTree } from '../parser/parse-tree.js';
import type { MetaTree } from '../parser/types.js';
import { resolveRefs } from '../resolver/resolve.js';
import { validateTree } from './validate.js';

const fixturesDir = join(__dirname, '..', '__fixtures__');
const validTree = join(fixturesDir, 'valid-tree', '.meta');
const brokenTree = join(fixturesDir, 'broken-tree', '.meta');

describe('validateTree', () => {
  it('validates valid tree without errors', async () => {
    const parsed = await parseTree(validTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const result = validateTree(resolved.value);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects unresolved refs in broken tree', async () => {
    const parsed = await parseTree(brokenTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const result = validateTree(resolved.value);
    expect(result.valid).toBe(false);
    const unresolvedErrors = result.errors.filter(
      (e) => e.code === 'UNRESOLVED_REF',
    );
    expect(unresolvedErrors.length).toBeGreaterThan(0);
  });

  it('detects duplicate IDs in broken tree', async () => {
    const parsed = await parseTree(brokenTree);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolveRefs(parsed.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const result = validateTree(resolved.value);
    const dupErrors = result.errors.filter((e) => e.code === 'DUPLICATE_ID');
    expect(dupErrors.length).toBeGreaterThan(0);
  });

  it('detects status inconsistency (epic done with active stories)', () => {
    const tree: MetaTree = {
      stories: [
        {
          type: 'story',
          id: 'st_1',
          title: 'Active story',
          status: 'in_progress',
          priority: 'medium',
          labels: [],
          epic_ref: { id: 'ep_1' },
          body: '',
          filePath: '/test/st.md',
        },
      ],
      epics: [
        {
          type: 'epic',
          id: 'ep_1',
          title: 'Done epic',
          status: 'done',
          priority: 'high',
          labels: [],
          body: '',
          filePath: '/test/ep.md',
        },
      ],
      milestones: [],
      roadmaps: [],
      prds: [],
      sprints: [],
      errors: [],
    };

    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const result = validateTree(resolved.value);
    expect(result.valid).toBe(false);
    const statusErrors = result.errors.filter(
      (e) => e.code === 'STATUS_INCONSISTENCY',
    );
    expect(statusErrors.length).toBe(1);
    expect(statusErrors[0].message).toContain('active stories');
  });

  it('warns on cancelled epic with active stories', () => {
    const tree: MetaTree = {
      stories: [
        {
          type: 'story',
          id: 'st_1',
          title: 'Active story',
          status: 'todo',
          priority: 'medium',
          labels: [],
          epic_ref: { id: 'ep_1' },
          body: '',
          filePath: '/test/st.md',
        },
      ],
      epics: [
        {
          type: 'epic',
          id: 'ep_1',
          title: 'Cancelled epic',
          status: 'cancelled',
          priority: 'high',
          labels: [],
          body: '',
          filePath: '/test/ep.md',
        },
      ],
      milestones: [],
      roadmaps: [],
      prds: [],
      sprints: [],
      errors: [],
    };

    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const result = validateTree(resolved.value);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].code).toBe('STATUS_INCONSISTENCY');
  });

  it('detects circular dependencies in the dependency graph', () => {
    // Create a story and an epic that share the same ID. This causes the
    // adjacency map (keyed by ID) to produce a self-loop once the story's
    // epic_ref edge is added: 'X' → 'X'. The cycle detector then surfaces
    // a CIRCULAR_DEPENDENCY error (alongside a DUPLICATE_ID, which we
    // also verify is reported).
    const tree: MetaTree = {
      stories: [
        {
          type: 'story',
          id: 'X',
          title: 'Self-ref story',
          status: 'todo',
          priority: 'medium',
          labels: [],
          epic_ref: { id: 'X' },
          body: '',
          filePath: '/test/st.md',
        },
      ],
      epics: [
        {
          type: 'epic',
          id: 'X',
          title: 'Duplicate-id epic',
          status: 'todo',
          priority: 'medium',
          labels: [],
          body: '',
          filePath: '/test/ep.md',
        },
      ],
      milestones: [],
      roadmaps: [],
      prds: [],
      sprints: [],
      errors: [],
    };

    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const result = validateTree(resolved.value);
    expect(result.valid).toBe(false);
    const cycleErrors = result.errors.filter(
      (e) => e.code === 'CIRCULAR_DEPENDENCY',
    );
    expect(cycleErrors.length).toBeGreaterThan(0);
    expect(cycleErrors[0].message).toContain('Circular dependency');
  });

  it('passes when epic is done and all stories are done', () => {
    const tree: MetaTree = {
      stories: [
        {
          type: 'story',
          id: 'st_1',
          title: 'Done story',
          status: 'done',
          priority: 'medium',
          labels: [],
          epic_ref: { id: 'ep_1' },
          body: '',
          filePath: '/test/st.md',
        },
      ],
      epics: [
        {
          type: 'epic',
          id: 'ep_1',
          title: 'Done epic',
          status: 'done',
          priority: 'high',
          labels: [],
          body: '',
          filePath: '/test/ep.md',
        },
      ],
      milestones: [],
      roadmaps: [],
      prds: [],
      sprints: [],
      errors: [],
    };

    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const result = validateTree(resolved.value);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
