import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { archiveOldEntities } from './index.js';

function makeStory(
  id: string,
  status: string,
  updatedAt: string,
  title = 'Test story',
): string {
  return `---
type: story
id: ${id}
title: ${title}
status: ${status}
priority: medium
labels: []
created_at: ${updatedAt}
updated_at: ${updatedAt}
---

Story body.
`;
}

function makeEpic(
  id: string,
  status: string,
  updatedAt: string,
  title = 'Test epic',
): string {
  return `---
type: epic
id: ${id}
title: ${title}
status: ${status}
priority: medium
labels: []
created_at: ${updatedAt}
updated_at: ${updatedAt}
---

Epic body.
`;
}

describe('archiveOldEntities', () => {
  let metaDir: string;

  beforeEach(async () => {
    metaDir = join(tmpdir(), `gitpm-archive-test-${Date.now()}`);
    await mkdir(join(metaDir, 'stories'), { recursive: true });
    await mkdir(join(metaDir, 'epics', 'epic-test', 'stories'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await rm(metaDir, { recursive: true, force: true });
  });

  it('archives done stories older than N days', async () => {
    const oldDate = '2020-01-01T00:00:00Z';
    const recentDate = new Date().toISOString();

    await writeFile(
      join(metaDir, 'stories', 'old-done.md'),
      makeStory('s1', 'done', oldDate),
    );
    await writeFile(
      join(metaDir, 'stories', 'recent-done.md'),
      makeStory('s2', 'done', recentDate),
    );
    await writeFile(
      join(metaDir, 'stories', 'old-todo.md'),
      makeStory('s3', 'todo', oldDate),
    );

    const result = await archiveOldEntities(metaDir, {
      daysOld: 7,
      dryRun: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.archivedFiles).toEqual(['stories/old-done.md']);

    // Verify file moved to archive
    const archived = await readFile(
      join(metaDir, 'archive', 'stories', 'old-done.md'),
      'utf-8',
    );
    expect(archived).toContain('id: s1');

    // Verify original removed
    const remaining = await readdir(join(metaDir, 'stories'));
    expect(remaining).toContain('recent-done.md');
    expect(remaining).toContain('old-todo.md');
    expect(remaining).not.toContain('old-done.md');
  });

  it('archives cancelled entities', async () => {
    const oldDate = '2020-01-01T00:00:00Z';

    await writeFile(
      join(metaDir, 'stories', 'cancelled.md'),
      makeStory('s1', 'cancelled', oldDate),
    );

    const result = await archiveOldEntities(metaDir, {
      daysOld: 7,
      dryRun: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.archivedFiles).toEqual(['stories/cancelled.md']);
  });

  it('dry run does not move files', async () => {
    const oldDate = '2020-01-01T00:00:00Z';

    await writeFile(
      join(metaDir, 'stories', 'old-done.md'),
      makeStory('s1', 'done', oldDate),
    );

    const result = await archiveOldEntities(metaDir, {
      daysOld: 7,
      dryRun: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.archivedFiles).toEqual(['stories/old-done.md']);

    // File should still be in original location
    const remaining = await readdir(join(metaDir, 'stories'));
    expect(remaining).toContain('old-done.md');
  });

  it('preserves epic directory structure in archive', async () => {
    const oldDate = '2020-01-01T00:00:00Z';

    await writeFile(
      join(metaDir, 'epics', 'epic-test', 'epic.md'),
      makeEpic('e1', 'done', oldDate),
    );
    await writeFile(
      join(metaDir, 'epics', 'epic-test', 'stories', 'story1.md'),
      makeStory('s1', 'done', oldDate),
    );

    const result = await archiveOldEntities(metaDir, {
      daysOld: 7,
      dryRun: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.archivedFiles).toHaveLength(2);
    expect(result.value.archivedFiles).toContain('epics/epic-test/epic.md');
    expect(result.value.archivedFiles).toContain(
      'epics/epic-test/stories/story1.md',
    );

    // Verify files exist in archive
    const archivedEpic = await readFile(
      join(metaDir, 'archive', 'epics', 'epic-test', 'epic.md'),
      'utf-8',
    );
    expect(archivedEpic).toContain('id: e1');
  });

  it('returns empty list when no items match', async () => {
    const recentDate = new Date().toISOString();

    await writeFile(
      join(metaDir, 'stories', 'recent.md'),
      makeStory('s1', 'done', recentDate),
    );

    const result = await archiveOldEntities(metaDir, {
      daysOld: 7,
      dryRun: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.archivedFiles).toEqual([]);
  });
});
