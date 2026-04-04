import type { Epic, GitHubSync, Milestone, Status, Story } from '@gitpm/core';
import { toSlug } from '@gitpm/core';
import { nanoid } from 'nanoid';
import type { GhIssue, GhMilestone } from './client.js';
import type { GitHubConfig } from './types.js';
import { DEFAULT_EPIC_LABELS } from './types.js';

export function ghMilestoneToMilestone(
  gh: GhMilestone,
  repoSlug: string,
): Milestone {
  const id = nanoid(12);
  const slug = toSlug(gh.title);
  const status: Status = gh.state === 'closed' ? 'done' : 'in_progress';
  const now = new Date().toISOString();

  const github: GitHubSync = {
    milestone_id: gh.number,
    repo: repoSlug,
    last_sync_hash: '',
    synced_at: now,
  };

  return {
    type: 'milestone',
    id,
    title: gh.title,
    target_date: gh.due_on ?? undefined,
    status,
    body: gh.description ?? '',
    github,
    created_at: gh.created_at,
    updated_at: gh.updated_at,
    filePath: `.meta/roadmap/milestones/${slug}.md`,
  };
}

export function isEpicIssue(
  gh: GhIssue,
  config?: Pick<GitHubConfig, 'label_mapping'>,
): boolean {
  const epicLabels = config?.label_mapping?.epic_labels ?? DEFAULT_EPIC_LABELS;
  const issueLabels = gh.labels.map((l) =>
    typeof l === 'string' ? l : l.name,
  );
  return issueLabels.some((label) => epicLabels.includes(label));
}

export function ghIssueToEntity(
  gh: GhIssue,
  config?: Pick<GitHubConfig, 'label_mapping'>,
  repoSlug?: string,
): Story | Epic {
  const repo = repoSlug ?? '';
  const isEpic = isEpicIssue(gh, config);
  const id = nanoid(12);
  const now = new Date().toISOString();
  const labels = gh.labels
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter((l) => {
      const epicLabels =
        config?.label_mapping?.epic_labels ?? DEFAULT_EPIC_LABELS;
      return !epicLabels.includes(l);
    });

  const github: GitHubSync = {
    issue_number: gh.number,
    repo,
    last_sync_hash: '',
    synced_at: now,
  };

  const status: Status = gh.state === 'closed' ? 'done' : 'todo';

  if (isEpic) {
    const slug = toSlug(gh.title);
    return {
      type: 'epic',
      id,
      title: gh.title,
      status,
      priority: 'medium',
      owner: gh.assignee?.login ?? null,
      labels,
      milestone_ref: null,
      github,
      body: gh.body ?? '',
      created_at: gh.created_at,
      updated_at: gh.updated_at,
      filePath: `.meta/epics/${slug}/epic.md`,
    } satisfies Epic;
  }

  return {
    type: 'story',
    id,
    title: gh.title,
    status,
    priority: 'medium',
    assignee: gh.assignee?.login ?? null,
    labels,
    estimate: null,
    epic_ref: null,
    github,
    body: gh.body ?? '',
    created_at: gh.created_at,
    updated_at: gh.updated_at,
    filePath: '', // determined later by determineFilePath
  } satisfies Story;
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
  due_on?: string;
  state?: 'open' | 'closed';
}

export function milestoneToGhMilestone(
  milestone: Milestone,
): CreateMilestoneParams {
  return {
    title: milestone.title,
    description: milestone.body || undefined,
    due_on: milestone.target_date ?? undefined,
    state:
      milestone.status === 'done' || milestone.status === 'cancelled'
        ? 'closed'
        : 'open',
  };
}

export interface CreateIssueParams {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
  state?: 'open' | 'closed';
}

export function entityToGhIssue(entity: Story | Epic): CreateIssueParams {
  const labels = [...(entity.labels ?? [])];
  if (entity.type === 'epic') {
    labels.push('epic');
  }

  const assignee = entity.type === 'story' ? entity.assignee : entity.owner;

  return {
    title: entity.title,
    body: entity.body || undefined,
    labels,
    assignees: assignee ? [assignee] : undefined,
    milestone:
      entity.type === 'epic'
        ? entity.milestone_ref?.id
          ? undefined
          : undefined
        : undefined,
    state:
      entity.status === 'done' || entity.status === 'cancelled'
        ? 'closed'
        : 'open',
  };
}
