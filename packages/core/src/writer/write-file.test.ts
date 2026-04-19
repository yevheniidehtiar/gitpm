import {
  writeFile as fsWriteFile,
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ParsedEntity } from '../schemas/index.js';
import { writeFile } from './write-file.js';

describe('writeFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-writefile-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a roadmap file as pure YAML (no frontmatter)', async () => {
    const roadmap: ParsedEntity = {
      type: 'roadmap',
      id: 'rm_1',
      title: 'My Roadmap',
      description: '',
      milestones: [{ id: 'ms_1' }],
      filePath: join(tmpDir, 'roadmap.yaml'),
    };
    const result = await writeFile(roadmap, roadmap.filePath);
    expect(result.ok).toBe(true);

    const raw = await readFile(roadmap.filePath, 'utf-8');
    expect(raw).not.toContain('---');
    expect(raw).toContain('type: roadmap');
    expect(raw).toContain('id: rm_1');
  });

  it('omits filePath from serialized output', async () => {
    const story: ParsedEntity = {
      type: 'story',
      id: 'st_1',
      title: 'Test',
      status: 'todo',
      priority: 'medium',
      labels: [],
      assignee: null,
      estimate: null,
      epic_ref: null,
      body: 'Body text',
      filePath: join(tmpDir, 'st.md'),
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const result = await writeFile(story, story.filePath);
    expect(result.ok).toBe(true);

    const raw = await readFile(story.filePath, 'utf-8');
    expect(raw).not.toContain('filePath');
    expect(raw).toContain('Body text');
  });

  it('handles entities without body cleanly (no trailing blank section)', async () => {
    const milestone: ParsedEntity = {
      type: 'milestone',
      id: 'ms_1',
      title: 'Milestone',
      status: 'backlog',
      target_date: '',
      body: '',
      filePath: join(tmpDir, 'ms.md'),
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const result = await writeFile(milestone, milestone.filePath);
    expect(result.ok).toBe(true);

    const raw = await readFile(milestone.filePath, 'utf-8');
    // Ends with `---\n` (no body section appended)
    expect(raw.endsWith('---\n')).toBe(true);
  });

  it('returns a Result error when the destination cannot be created', async () => {
    // Block writeFile by making the parent path a regular file.
    const blocker = join(tmpDir, 'blocker');
    await fsWriteFile(blocker, 'blocker');
    const story: ParsedEntity = {
      type: 'story',
      id: 'st_1',
      title: 'Blocked',
      status: 'todo',
      priority: 'medium',
      labels: [],
      assignee: null,
      estimate: null,
      epic_ref: null,
      body: '',
      filePath: join(blocker, 'nested', 'st.md'),
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const result = await writeFile(story, story.filePath);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Failed to write');
  });
});
