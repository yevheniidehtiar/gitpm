import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFile } from '../parser/parse-file.js';
import { createEpic, createMilestone, createStory } from './create-entity.js';

describe('createStory', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-create-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a standalone story in .meta/stories/', async () => {
    const result = await createStory(metaDir, {
      title: 'Test story creation',
      priority: 'high',
      status: 'todo',
      labels: ['frontend', 'responsive'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.id).toHaveLength(12);
    expect(result.value.filePath).toContain('/stories/');
    expect(result.value.filePath).toMatch(/\.md$/);

    // Verify the file parses correctly
    const parsed = await parseFile(result.value.filePath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.type).toBe('story');
    expect(parsed.value.title).toBe('Test story creation');
    expect(parsed.value.id).toBe(result.value.id);
    const story = parsed.value as {
      priority: string;
      status: string;
      labels: string[];
    };
    expect(story.priority).toBe('high');
    expect(story.status).toBe('todo');
    expect(story.labels).toEqual(['frontend', 'responsive']);
  });

  it('creates a story under an epic directory', async () => {
    const result = await createStory(metaDir, {
      title: 'Epic child story',
      epicId: 'ep_test',
      epicSlug: 'my-epic',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.filePath).toContain('/epics/my-epic/stories/');

    const parsed = await parseFile(result.value.filePath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect((parsed.value as Record<string, unknown>).epic_ref).toEqual({
      id: 'ep_test',
    });
  });

  it('sets defaults for optional fields', async () => {
    const result = await createStory(metaDir, { title: 'Minimal story' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsed = await parseFile(result.value.filePath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const story = parsed.value as Record<string, unknown>;
    expect(story.status).toBe('backlog');
    expect(story.priority).toBe('medium');
    expect(story.labels).toEqual([]);
    expect(story.created_at).toBeDefined();
    expect(story.updated_at).toBeDefined();
  });

  it('generates unique IDs', async () => {
    const r1 = await createStory(metaDir, { title: 'Story A' });
    const r2 = await createStory(metaDir, { title: 'Story B' });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;

    expect(r1.value.id).not.toBe(r2.value.id);
  });

  it('includes body content when provided', async () => {
    const result = await createStory(metaDir, {
      title: 'Story with body',
      body: '## Description\n\nSome content here.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const raw = await readFile(result.value.filePath, 'utf-8');
    expect(raw).toContain('## Description');
    expect(raw).toContain('Some content here.');
  });
});

describe('createEpic', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-create-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates an epic at .meta/epics/<slug>/epic.md', async () => {
    const result = await createEpic(metaDir, {
      title: 'Responsive Design',
      priority: 'high',
      labels: ['frontend'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.filePath).toContain('/epics/responsive-design/epic.md');
    expect(result.value.id).toHaveLength(12);

    const parsed = await parseFile(result.value.filePath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.type).toBe('epic');
    expect(parsed.value.title).toBe('Responsive Design');
  });

  it('links to a milestone when milestoneId is provided', async () => {
    const result = await createEpic(metaDir, {
      title: 'Linked Epic',
      milestoneId: 'ms_test',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsed = await parseFile(result.value.filePath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect((parsed.value as Record<string, unknown>).milestone_ref).toEqual({
      id: 'ms_test',
    });
  });
});

describe('createMilestone', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-create-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a milestone at .meta/roadmap/milestones/<slug>.md', async () => {
    const result = await createMilestone(metaDir, {
      title: 'v2.0 Beta',
      targetDate: '2026-06-01',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.filePath).toContain('/roadmap/milestones/v20-beta.md');
    expect(result.value.id).toHaveLength(12);

    const parsed = await parseFile(result.value.filePath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.type).toBe('milestone');
    expect(parsed.value.title).toBe('v2.0 Beta');
    expect((parsed.value as Record<string, unknown>).target_date).toContain(
      '2026-06-01',
    );
  });
});
