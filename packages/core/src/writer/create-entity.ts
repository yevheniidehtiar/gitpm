import { join } from 'node:path';
import { nanoid } from 'nanoid';
import type { ParsedEntity } from '../parser/types.js';
import type { Priority, Result, Status } from '../schemas/common.js';
import type { Epic } from '../schemas/epic.js';
import type { Milestone } from '../schemas/milestone.js';
import type { Story } from '../schemas/story.js';
import { toSlug } from './slug.js';
import { writeFile } from './write-file.js';

export interface CreateStoryOptions {
  title: string;
  priority?: Priority;
  status?: Status;
  labels?: string[];
  epicId?: string;
  epicSlug?: string;
  assignee?: string;
  estimate?: number;
  body?: string;
}

export interface CreateEpicOptions {
  title: string;
  priority?: Priority;
  status?: Status;
  labels?: string[];
  milestoneId?: string;
  owner?: string;
  body?: string;
}

export interface CreateMilestoneOptions {
  title: string;
  status?: Status;
  targetDate?: string;
  body?: string;
}

export interface CreateResult {
  filePath: string;
  id: string;
  entity: ParsedEntity;
}

export async function createStory(
  metaDir: string,
  options: CreateStoryOptions,
): Promise<Result<CreateResult>> {
  try {
    const id = nanoid(12);
    const slug = toSlug(options.title);
    const now = new Date().toISOString();

    let dir: string;
    if (options.epicSlug) {
      dir = join(metaDir, 'epics', options.epicSlug, 'stories');
    } else {
      dir = join(metaDir, 'stories');
    }
    const filePath = join(dir, `${slug}.md`);

    const story: Story = {
      type: 'story',
      id,
      title: options.title,
      status: options.status ?? 'backlog',
      priority: options.priority ?? 'medium',
      assignee: options.assignee ?? null,
      labels: options.labels ?? [],
      estimate: options.estimate ?? null,
      epic_ref: options.epicId ? { id: options.epicId } : null,
      body: options.body ?? '',
      filePath,
      created_at: now,
      updated_at: now,
    };

    const result = await writeFile(story, filePath);
    if (!result.ok) return result;

    return { ok: true, value: { filePath, id, entity: story } };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to create story: ${err}`),
    };
  }
}

export async function createEpic(
  metaDir: string,
  options: CreateEpicOptions,
): Promise<Result<CreateResult>> {
  try {
    const id = nanoid(12);
    const slug = toSlug(options.title);
    const now = new Date().toISOString();

    const filePath = join(metaDir, 'epics', slug, 'epic.md');

    const epic: Epic = {
      type: 'epic',
      id,
      title: options.title,
      status: options.status ?? 'backlog',
      priority: options.priority ?? 'medium',
      owner: options.owner ?? null,
      labels: options.labels ?? [],
      milestone_ref: options.milestoneId ? { id: options.milestoneId } : null,
      body: options.body ?? '',
      filePath,
      created_at: now,
      updated_at: now,
    };

    const result = await writeFile(epic, filePath);
    if (!result.ok) return result;

    return { ok: true, value: { filePath, id, entity: epic } };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to create epic: ${err}`),
    };
  }
}

export async function createMilestone(
  metaDir: string,
  options: CreateMilestoneOptions,
): Promise<Result<CreateResult>> {
  try {
    const id = nanoid(12);
    const slug = toSlug(options.title);
    const now = new Date().toISOString();

    const filePath = join(metaDir, 'roadmap', 'milestones', `${slug}.md`);

    const milestone: Milestone = {
      type: 'milestone',
      id,
      title: options.title,
      status: options.status ?? 'backlog',
      target_date: options.targetDate ?? '',
      body: options.body ?? '',
      filePath,
      created_at: now,
      updated_at: now,
    };

    const result = await writeFile(milestone, filePath);
    if (!result.ok) return result;

    return { ok: true, value: { filePath, id, entity: milestone } };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to create milestone: ${err}`),
    };
  }
}
