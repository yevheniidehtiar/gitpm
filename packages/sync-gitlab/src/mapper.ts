import type { Epic, GitLabSync, Milestone, Status, Story } from '@gitpm/core';
import { toSlug } from '@gitpm/core';
import { nanoid } from 'nanoid';
import type { GlEpic, GlIssue, GlMilestone } from './client.js';
import type { GitLabConfig } from './types.js';
import { DEFAULT_EPIC_LABELS } from './types.js';

export function glMilestoneToMilestone(
  gl: GlMilestone,
  projectId: number,
  baseUrl: string,
): Milestone {
  const id = nanoid(12);
  const slug = toSlug(gl.title);
  const status: Status = gl.state === 'closed' ? 'done' : 'in_progress';
  const now = new Date().toISOString();

  const gitlab: GitLabSync = {
    milestone_id: gl.id,
    project_id: projectId,
    base_url: baseUrl,
    last_sync_hash: '',
    synced_at: now,
  };

  return {
    type: 'milestone',
    id,
    title: gl.title,
    target_date: gl.due_date ?? undefined,
    status,
    body: gl.description ?? '',
    gitlab,
    created_at: gl.created_at,
    updated_at: gl.updated_at,
    filePath: `.meta/roadmap/milestones/${slug}.md`,
  };
}

export function isEpicIssue(
  gl: GlIssue,
  config?: Pick<GitLabConfig, 'label_mapping'>,
): boolean {
  const epicLabels = config?.label_mapping?.epic_labels ?? DEFAULT_EPIC_LABELS;
  return gl.labels.some((label) => epicLabels.includes(label));
}

function weightToPriority(
  weight: number | null,
): 'low' | 'medium' | 'high' | 'critical' {
  if (weight === null || weight === 0) return 'medium';
  if (weight <= 2) return 'low';
  if (weight <= 4) return 'medium';
  if (weight <= 6) return 'high';
  return 'critical';
}

export function glIssueToEntity(
  gl: GlIssue,
  config?: Pick<GitLabConfig, 'label_mapping'>,
  projectId?: number,
  baseUrl?: string,
): Story | Epic {
  const pId = projectId ?? 0;
  const bUrl = baseUrl ?? 'https://gitlab.com';
  const isEpic = isEpicIssue(gl, config);
  const id = nanoid(12);
  const now = new Date().toISOString();
  const labels = gl.labels.filter((l) => {
    const epicLabels =
      config?.label_mapping?.epic_labels ?? DEFAULT_EPIC_LABELS;
    return !epicLabels.includes(l);
  });

  const gitlab: GitLabSync = {
    issue_iid: gl.iid,
    project_id: pId,
    base_url: bUrl,
    last_sync_hash: '',
    synced_at: now,
  };

  const status: Status = gl.state === 'closed' ? 'done' : 'todo';
  const priority = weightToPriority(gl.weight);

  if (isEpic) {
    const slug = toSlug(gl.title);
    return {
      type: 'epic',
      id,
      title: gl.title,
      status,
      priority,
      owner: gl.assignee?.username ?? null,
      labels,
      milestone_ref: null,
      gitlab,
      body: gl.description ?? '',
      created_at: gl.created_at,
      updated_at: gl.updated_at,
      filePath: `.meta/epics/${slug}/epic.md`,
    } satisfies Epic;
  }

  return {
    type: 'story',
    id,
    title: gl.title,
    status,
    priority,
    assignee: gl.assignee?.username ?? null,
    labels,
    estimate: null,
    epic_ref: null,
    gitlab,
    body: gl.description ?? '',
    created_at: gl.created_at,
    updated_at: gl.updated_at,
    filePath: '', // determined later by determineFilePath
  } satisfies Story;
}

export function glEpicToEpic(
  gl: GlEpic,
  projectId: number,
  baseUrl: string,
): Epic {
  const id = nanoid(12);
  const slug = toSlug(gl.title);
  const now = new Date().toISOString();
  const status: Status = gl.state === 'closed' ? 'done' : 'todo';

  const gitlab: GitLabSync = {
    epic_iid: gl.iid,
    project_id: projectId,
    base_url: baseUrl,
    last_sync_hash: '',
    synced_at: now,
  };

  return {
    type: 'epic',
    id,
    title: gl.title,
    status,
    priority: 'medium',
    owner: null,
    labels: gl.labels,
    milestone_ref: null,
    gitlab,
    body: gl.description ?? '',
    created_at: gl.created_at,
    updated_at: gl.updated_at,
    filePath: `.meta/epics/${slug}/epic.md`,
  };
}

export function determineFilePath(
  entity: Story | Epic | Milestone,
  parentEpicSlug?: string,
): string {
  if (entity.type === 'milestone') {
    const slug = toSlug(entity.title);
    return `.meta/roadmap/milestones/${slug}.md`;
  }

  if (entity.type === 'epic') {
    const slug = toSlug(entity.title);
    return `.meta/epics/${slug}/epic.md`;
  }

  // Story
  const slug = toSlug(entity.title);
  if (parentEpicSlug) {
    return `.meta/epics/${parentEpicSlug}/stories/${slug}.md`;
  }
  return `.meta/stories/${slug}.md`;
}

export interface CreateMilestoneParams {
  title: string;
  description?: string;
  due_date?: string;
  state_event?: 'close' | 'activate';
}

export function milestoneToGlMilestone(
  milestone: Milestone,
): CreateMilestoneParams {
  return {
    title: milestone.title,
    description: milestone.body || undefined,
    due_date: milestone.target_date ?? undefined,
    state_event:
      milestone.status === 'done' || milestone.status === 'cancelled'
        ? 'close'
        : 'activate',
  };
}

export interface CreateIssueParams {
  title: string;
  description?: string;
  labels?: string;
  milestone_id?: number;
  state_event?: 'close' | 'reopen';
}

export function entityToGlIssue(entity: Story | Epic): CreateIssueParams {
  const labels = [...(entity.labels ?? [])];
  if (entity.type === 'epic') {
    labels.push('epic');
  }

  return {
    title: entity.title,
    description: entity.body || undefined,
    labels: labels.join(','),
    state_event:
      entity.status === 'done' || entity.status === 'cancelled'
        ? 'close'
        : 'reopen',
  };
}
