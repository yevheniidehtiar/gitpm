import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFile } from '../parser/parse-file.js';
import {
  createEpic,
  createMilestone,
  createSprint,
  createStory,
} from './create-entity.js';

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

  it('appends numeric suffix for duplicate titles', async () => {
    const r1 = await createStory(metaDir, { title: 'Duplicate' });
    const r2 = await createStory(metaDir, { title: 'Duplicate' });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;

    expect(r1.value.filePath).toContain('duplicate.md');
    expect(r2.value.filePath).toContain('duplicate-2.md');
    expect(r1.value.filePath).not.toBe(r2.value.filePath);
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

  it('appends numeric suffix when epic slug directory already has epic.md', async () => {
    const r1 = await createEpic(metaDir, { title: 'Shared Name' });
    const r2 = await createEpic(metaDir, { title: 'Shared Name' });
    const r3 = await createEpic(metaDir, { title: 'Shared Name' });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);
    if (!r1.ok || !r2.ok || !r3.ok) return;

    expect(r1.value.filePath).toContain('/epics/shared-name/epic.md');
    expect(r2.value.filePath).toContain('/epics/shared-name-2/epic.md');
    expect(r3.value.filePath).toContain('/epics/shared-name-3/epic.md');
  });

  it('returns an error Result when write fails due to invalid path', async () => {
    // Using a file as parent dir forces mkdir to fail.
    await writeFile(metaDir, 'not-a-directory');

    const result = await createEpic(metaDir, { title: 'Blocked Epic' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Failed to write');
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

  it('creates a milestone with default status when not provided', async () => {
    const result = await createMilestone(metaDir, {
      title: 'Future milestone',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = await parseFile(result.value.filePath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect((parsed.value as Record<string, unknown>).status).toBe('backlog');
    expect((parsed.value as Record<string, unknown>).target_date).toBe('');
  });

  it('returns an error when milestone write fails', async () => {
    await writeFile(metaDir, 'not-a-directory');
    const result = await createMilestone(metaDir, { title: 'Blocked' });
    expect(result.ok).toBe(false);
  });
});

describe('createSprint', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-create-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a sprint at .meta/sprints/<slug>.md', async () => {
    const result = await createSprint(metaDir, {
      title: 'Sprint 42',
      startDate: '2026-04-01',
      endDate: '2026-04-14',
      status: 'in_progress',
      storyIds: ['st_a', 'st_b'],
      capacity: 20,
      body: '## Goals\n\nShip everything.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.filePath).toContain('/sprints/sprint-42.md');
    expect(result.value.id).toHaveLength(12);

    const parsed = await parseFile(result.value.filePath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.type).toBe('sprint');
    const sprint = parsed.value as Record<string, unknown>;
    expect(sprint.start_date).toContain('2026-04-01');
    expect(sprint.end_date).toContain('2026-04-14');
    expect(sprint.status).toBe('in_progress');
    expect(sprint.capacity).toBe(20);
    expect(sprint.stories).toEqual([{ id: 'st_a' }, { id: 'st_b' }]);
    expect(sprint.body).toContain('Ship everything.');
  });

  it('applies defaults for status and storyIds', async () => {
    const result = await createSprint(metaDir, {
      title: 'Sprint minimal',
      startDate: '2026-05-01',
      endDate: '2026-05-14',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = await parseFile(result.value.filePath);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const sprint = parsed.value as Record<string, unknown>;
    expect(sprint.status).toBe('todo');
    expect(sprint.stories).toEqual([]);
    expect(sprint.body).toBe('');
  });

  it('appends numeric suffix for duplicate sprint titles', async () => {
    const r1 = await createSprint(metaDir, {
      title: 'Dup Sprint',
      startDate: '2026-06-01',
      endDate: '2026-06-14',
    });
    const r2 = await createSprint(metaDir, {
      title: 'Dup Sprint',
      startDate: '2026-06-15',
      endDate: '2026-06-28',
    });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.value.filePath).toContain('dup-sprint.md');
    expect(r2.value.filePath).toContain('dup-sprint-2.md');
  });

  it('returns an error when sprint write fails', async () => {
    await writeFile(metaDir, 'not-a-directory');
    const result = await createSprint(metaDir, {
      title: 'Blocked sprint',
      startDate: '2026-07-01',
      endDate: '2026-07-14',
    });
    expect(result.ok).toBe(false);
  });
});
