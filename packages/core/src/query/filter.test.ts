import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTree } from '../parser/parse-tree.js';
import { filterEntities } from './filter.js';

const validTree = join(__dirname, '..', '__fixtures__', 'valid-tree', '.meta');

describe('filterEntities', () => {
  it('returns all entities when no filter is applied', async () => {
    const tree = await parseTree(validTree);
    expect(tree.ok).toBe(true);
    if (!tree.ok) return;

    const result = filterEntities(tree.value, {});
    // valid-tree has: 3 stories + 1 epic + 2 milestones + 1 roadmap + 1 prd = 8
    expect(result.length).toBe(8);
  });

  it('filters by type', async () => {
    const tree = await parseTree(validTree);
    if (!tree.ok) return;

    const stories = filterEntities(tree.value, { type: ['story'] });
    expect(stories.length).toBe(3);
    expect(stories.every((e) => e.type === 'story')).toBe(true);

    const epics = filterEntities(tree.value, { type: ['epic'] });
    expect(epics.length).toBe(1);
    expect(epics[0].type).toBe('epic');
  });

  it('filters by multiple types', async () => {
    const tree = await parseTree(validTree);
    if (!tree.ok) return;

    const result = filterEntities(tree.value, { type: ['story', 'epic'] });
    expect(result.length).toBe(4);
    expect(result.every((e) => e.type === 'story' || e.type === 'epic')).toBe(
      true,
    );
  });

  it('filters by status', async () => {
    const tree = await parseTree(validTree);
    if (!tree.ok) return;

    const done = filterEntities(tree.value, { status: ['done'] });
    expect(done.length).toBeGreaterThanOrEqual(1);
    expect(done.every((e) => 'status' in e && e.status === 'done')).toBe(true);
  });

  it('filters by priority', async () => {
    const tree = await parseTree(validTree);
    if (!tree.ok) return;

    const critical = filterEntities(tree.value, { priority: ['critical'] });
    expect(critical.length).toBeGreaterThanOrEqual(1);
    expect(
      critical.every((e) => 'priority' in e && e.priority === 'critical'),
    ).toBe(true);
  });

  it('filters by labels', async () => {
    const tree = await parseTree(validTree);
    if (!tree.ok) return;

    const core = filterEntities(tree.value, { labels: ['core'] });
    expect(core.length).toBeGreaterThanOrEqual(1);
    expect(
      core.every(
        (e) =>
          'labels' in e && Array.isArray(e.labels) && e.labels.includes('core'),
      ),
    ).toBe(true);
  });

  it('filters by epic', async () => {
    const tree = await parseTree(validTree);
    if (!tree.ok) return;

    // Filter by epic ID
    const byId = filterEntities(tree.value, { epic: 'ep_balancing' });
    expect(byId.length).toBe(2); // optimization-solver and price-feed-ingestion
    expect(byId.every((e) => e.type === 'story')).toBe(true);

    // Filter by epic directory slug
    const bySlug = filterEntities(tree.value, { epic: 'balancing-engine' });
    expect(bySlug.length).toBe(2);
  });

  it('filters by assignee', async () => {
    const tree = await parseTree(validTree);
    if (!tree.ok) return;

    const alex = filterEntities(tree.value, { assignee: 'alex' });
    expect(alex.length).toBeGreaterThanOrEqual(1);
    expect(
      alex.every((e) => (e as { assignee?: string }).assignee === 'alex'),
    ).toBe(true);
  });

  it('filters by text search in title', async () => {
    const tree = await parseTree(validTree);
    if (!tree.ok) return;

    const result = filterEntities(tree.value, { search: 'optimization' });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(
      result.some((e) => e.title.toLowerCase().includes('optimization')),
    ).toBe(true);
  });

  it('filters by text search in body', async () => {
    const tree = await parseTree(validTree);
    if (!tree.ok) return;

    const result = filterEntities(tree.value, { search: 'linear programming' });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('combines multiple filters (AND logic)', async () => {
    const tree = await parseTree(validTree);
    if (!tree.ok) return;

    const result = filterEntities(tree.value, {
      type: ['story'],
      priority: ['critical'],
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(
      result.every(
        (e) =>
          e.type === 'story' && 'priority' in e && e.priority === 'critical',
      ),
    ).toBe(true);
  });

  it('returns empty array when no entities match', async () => {
    const tree = await parseTree(validTree);
    if (!tree.ok) return;

    const result = filterEntities(tree.value, {
      type: ['story'],
      status: ['cancelled'],
    });
    expect(result).toEqual([]);
  });
});
