import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFile } from '../parser/parse-file.js';
import { createEpic, createStory } from './create-entity.js';
import { moveStory } from './move-entity.js';

describe('moveStory', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-move-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('moves a standalone story into an epic', async () => {
    // Create an epic first
    const epicResult = await createEpic(metaDir, { title: 'Target Epic' });
    expect(epicResult.ok).toBe(true);
    if (!epicResult.ok) return;

    // Create a standalone story
    const storyResult = await createStory(metaDir, { title: 'Moveable Story' });
    expect(storyResult.ok).toBe(true);
    if (!storyResult.ok) return;

    // Move into the epic by ID
    const moveResult = await moveStory(metaDir, storyResult.value.filePath, {
      toEpic: epicResult.value.id,
    });

    expect(moveResult.ok).toBe(true);
    if (!moveResult.ok) return;

    expect(moveResult.value.newPath).toContain('/epics/target-epic/stories/');
    expect(moveResult.value.oldPath).toBe(storyResult.value.filePath);

    // Verify the moved file is valid
    const parsed = await parseFile(moveResult.value.newPath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.title).toBe('Moveable Story');
    expect((parsed.value as Record<string, unknown>).epic_ref).toEqual({
      id: epicResult.value.id,
    });
  });

  it('moves a story out of an epic to orphan', async () => {
    // Create an epic with a story
    const epicResult = await createEpic(metaDir, { title: 'Source Epic' });
    expect(epicResult.ok).toBe(true);
    if (!epicResult.ok) return;

    const storyResult = await createStory(metaDir, {
      title: 'Epic Story',
      epicId: epicResult.value.id,
      epicSlug: 'source-epic',
    });
    expect(storyResult.ok).toBe(true);
    if (!storyResult.ok) return;

    // Move to orphan
    const moveResult = await moveStory(metaDir, storyResult.value.filePath, {
      toOrphan: true,
    });

    expect(moveResult.ok).toBe(true);
    if (!moveResult.ok) return;

    expect(moveResult.value.newPath).toContain('/.meta/stories/');

    // Verify epic_ref is cleared
    const parsed = await parseFile(moveResult.value.newPath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect((parsed.value as Record<string, unknown>).epic_ref).toBeNull();
  });

  it('moves a story between epics', async () => {
    // Create two epics
    const epic1 = await createEpic(metaDir, { title: 'Epic One' });
    const epic2 = await createEpic(metaDir, { title: 'Epic Two' });
    expect(epic1.ok && epic2.ok).toBe(true);
    if (!epic1.ok || !epic2.ok) return;

    // Create story in epic1
    const storyResult = await createStory(metaDir, {
      title: 'Transferable Story',
      epicId: epic1.value.id,
      epicSlug: 'epic-one',
    });
    expect(storyResult.ok).toBe(true);
    if (!storyResult.ok) return;

    // Move to epic2
    const moveResult = await moveStory(metaDir, storyResult.value.filePath, {
      toEpic: epic2.value.id,
    });

    expect(moveResult.ok).toBe(true);
    if (!moveResult.ok) return;

    expect(moveResult.value.newPath).toContain('/epics/epic-two/stories/');

    const parsed = await parseFile(moveResult.value.newPath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect((parsed.value as Record<string, unknown>).epic_ref).toEqual({
      id: epic2.value.id,
    });
  });

  it('rejects moving a non-story entity', async () => {
    const epicResult = await createEpic(metaDir, { title: 'Not Moveable' });
    expect(epicResult.ok).toBe(true);
    if (!epicResult.ok) return;

    const moveResult = await moveStory(metaDir, epicResult.value.filePath, {
      toOrphan: true,
    });

    expect(moveResult.ok).toBe(false);
    if (moveResult.ok) return;
    expect(moveResult.error.message).toContain('Only stories can be moved');
  });

  it('fails when target epic does not exist', async () => {
    const storyResult = await createStory(metaDir, { title: 'Orphan story' });
    expect(storyResult.ok).toBe(true);
    if (!storyResult.ok) return;

    const moveResult = await moveStory(metaDir, storyResult.value.filePath, {
      toEpic: 'nonexistent_epic',
    });

    expect(moveResult.ok).toBe(false);
    if (moveResult.ok) return;
    expect(moveResult.error.message).toContain('Epic not found');
  });

  it('fails when neither --to-epic nor --to-orphan specified', async () => {
    const storyResult = await createStory(metaDir, { title: 'No target' });
    expect(storyResult.ok).toBe(true);
    if (!storyResult.ok) return;

    const moveResult = await moveStory(metaDir, storyResult.value.filePath, {});
    expect(moveResult.ok).toBe(false);
    if (moveResult.ok) return;
    expect(moveResult.error.message).toContain('--to-epic or --to-orphan');
  });

  it('returns a Result error when move logic throws unexpectedly', async () => {
    // Create a standalone story so parseFile succeeds.
    const storyResult = await createStory(metaDir, { title: 'Throwy story' });
    expect(storyResult.ok).toBe(true);
    if (!storyResult.ok) return;

    // Force a throw deep inside the move logic by passing a Symbol as
    // toEpic. Template literal interpolation (used by the epic-matching
    // check) rejects Symbol values with a TypeError, exercising the
    // outer catch block.
    const moveResult = await moveStory(metaDir, storyResult.value.filePath, {
      toEpic: Symbol('unconvertible') as unknown as string,
    });
    expect(moveResult.ok).toBe(false);
    if (moveResult.ok) return;
    expect(moveResult.error.message).toContain('Failed to move story');
  });

  it('updates updated_at timestamp', async () => {
    const epicResult = await createEpic(metaDir, { title: 'Time Epic' });
    expect(epicResult.ok).toBe(true);
    if (!epicResult.ok) return;

    const storyResult = await createStory(metaDir, { title: 'Time Story' });
    expect(storyResult.ok).toBe(true);
    if (!storyResult.ok) return;

    const before = new Date().toISOString();
    const moveResult = await moveStory(metaDir, storyResult.value.filePath, {
      toEpic: epicResult.value.id,
    });

    expect(moveResult.ok).toBe(true);
    if (!moveResult.ok) return;

    const parsed = await parseFile(moveResult.value.newPath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const updatedAt = (parsed.value as Record<string, unknown>)
      .updated_at as string;
    expect(updatedAt >= before).toBe(true);
  });
});
