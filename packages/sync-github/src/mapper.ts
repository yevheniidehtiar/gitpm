import type {
  Epic,
  GitHubSync,
  Milestone,
  Priority,
  Status,
  Story,
} from '@gitpm/core';
import { toSlug } from '@gitpm/core';
import { nanoid } from 'nanoid';
import type { GhIssue, GhMilestone } from './client.js';
import type { GitHubConfig } from './types.js';
import { DEFAULT_EPIC_LABELS, DEFAULT_PRIORITY_MAPPING } from './types.js';

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

/**
 * Extracts priority from GitHub issue labels using a mapping.
 * Returns the extracted priority and the remaining labels (with priority labels removed).
 */
export function extractPriority(
  issueLabels: string[],
  priorityMapping?: Record<string, Priority>,
): { priority: Priority; filteredLabels: string[] } {
  const mapping = priorityMapping ?? DEFAULT_PRIORITY_MAPPING;
  let priority: Priority = 'medium';
  const matchedLabels = new Set<string>();

  for (const label of issueLabels) {
    const mapped = mapping[label];
    if (mapped) {
      priority = mapped;
      matchedLabels.add(label);
    }
  }

  const filteredLabels = issueLabels.filter((l) => !matchedLabels.has(l));
  return { priority, filteredLabels };
}

export function ghIssueToEntity(
  gh: GhIssue,
  config?: Pick<GitHubConfig, 'label_mapping' | 'priority_mapping'>,
  repoSlug?: string,
): Story | Epic {
  const repo = repoSlug ?? '';
  const isEpic = isEpicIssue(gh, config);
  const id = nanoid(12);
  const now = new Date().toISOString();

  const epicLabels = config?.label_mapping?.epic_labels ?? DEFAULT_EPIC_LABELS;
  const rawLabels = gh.labels
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter((l) => !epicLabels.includes(l));

  const { priority, filteredLabels: labels } = extractPriority(
    rawLabels,
    config?.priority_mapping,
  );

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
      priority,
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
    priority,
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

export function entityToGhIssue(
  entity: Story | Epic,
  config?: Pick<GitHubConfig, 'priority_mapping'>,
): CreateIssueParams {
  const labels = [...(entity.labels ?? [])];
  if (entity.type === 'epic') {
    labels.push('epic');
  }

  // Re-add priority label for round-trip fidelity
  if (entity.priority && entity.priority !== 'medium') {
    const mapping = config?.priority_mapping ?? DEFAULT_PRIORITY_MAPPING;
    // Find the first label that maps to this priority
    const priorityLabel = Object.entries(mapping).find(
      ([, val]) => val === entity.priority,
    )?.[0];
    if (priorityLabel) {
      labels.push(priorityLabel);
    }
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
