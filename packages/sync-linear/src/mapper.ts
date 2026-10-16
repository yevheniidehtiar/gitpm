import type {
  Epic,
  LinearSync,
  Milestone,
  Priority,
  Status,
  Story,
} from '@gitpm/core';
import { toSlug } from '@gitpm/core';
import { nanoid } from 'nanoid';
import type { LinearCycle, LinearIssue } from './client.js';
import type { LinearConfig } from './types.js';
import { DEFAULT_STATUS_MAPPING } from './types.js';

export function linearCycleToMilestone(
  cycle: LinearCycle,
  teamId: string,
): Milestone {
  const id = nanoid(12);
  const title = cycle.name ?? `Cycle ${cycle.number}`;
  const slug = toSlug(title);
  const now = new Date().toISOString();

  const status: Status = cycle.completedAt ? 'done' : 'in_progress';

  const linear: LinearSync = {
    cycle_id: cycle.id,
    team_id: teamId,
    last_sync_hash: '',
    synced_at: now,
  };

  return {
    type: 'milestone',
    id,
    title,
    target_date: cycle.endsAt ?? undefined,
    status,
    body: '',
    github: undefined,
    jira: undefined,
    gitlab: undefined,
    linear,
    created_at: cycle.startsAt ?? now,
    updated_at: now,
    filePath: `.meta/roadmap/milestones/${slug}.md`,
  };
}

/** An issue with sub-issues is treated as an Epic; a leaf issue is a Story. */
export function isEpicIssue(issue: LinearIssue): boolean {
  return (issue.children?.nodes.length ?? 0) > 0;
}

export function mapLinearState(
  stateType: string,
  config?: Pick<LinearConfig, 'status_mapping'>,
): Status {
  const mapping = config?.status_mapping ?? DEFAULT_STATUS_MAPPING;
  return mapping[stateType] ?? 'todo';
}

export function mapLinearPriority(priority: number | undefined): Priority {
  switch (priority) {
    case 1:
      return 'critical';
    case 2:
      return 'high';
    case 4:
      return 'low';
    default:
      return 'medium';
  }
}

export function linearIssueToEntity(
  issue: LinearIssue,
  config: Pick<LinearConfig, 'status_mapping'>,
  teamId: string,
): Story | Epic {
  const isEpic = isEpicIssue(issue);
  const id = nanoid(12);
  const now = new Date().toISOString();
  const status = mapLinearState(issue.state.type, config);
  const priority = mapLinearPriority(issue.priority);
  const labels = issue.labels.nodes.map((label) => label.name);

  const linear: LinearSync = {
    issue_id: issue.id,
    identifier: issue.identifier,
    team_id: teamId,
    cycle_id: issue.cycle?.id,
    last_sync_hash: '',
    synced_at: now,
  };

  if (isEpic) {
    const slug = toSlug(issue.title);
    return {
      type: 'epic',
      id,
      title: issue.title,
      status,
      priority,
      owner: issue.assignee?.name ?? null,
      labels,
      milestone_ref: null,
      github: undefined,
      jira: undefined,
      gitlab: undefined,
      linear,
      body: issue.description ?? '',
      created_at: issue.createdAt,
      updated_at: issue.updatedAt,
      filePath: `.meta/epics/${slug}/epic.md`,
    } satisfies Epic;
  }

  return {
    type: 'story',
    id,
    title: issue.title,
    status,
    priority,
    assignee: issue.assignee?.name ?? null,
    labels,
    estimate: null,
    epic_ref: null,
    github: undefined,
    jira: undefined,
    gitlab: undefined,
    linear,
    body: issue.description ?? '',
    created_at: issue.createdAt,
    updated_at: issue.updatedAt,
    filePath: '',
  } satisfies Story;
}

export function determineFilePath(
  entity: Story | Epic | Milestone,
  parentEpicSlug?: string,
  slug: string = toSlug(entity.title),
): string {
  if (entity.type === 'milestone') {
    return `.meta/roadmap/milestones/${slug}.md`;
  }

  if (entity.type === 'epic') {
    return `.meta/epics/${slug}/epic.md`;
  }

  if (parentEpicSlug) {
    return `.meta/epics/${parentEpicSlug}/stories/${slug}.md`;
  }
  return `.meta/stories/${slug}.md`;
}

export interface CreateLinearIssueFromEntity {
  title: string;
  /** Always set; an empty string clears the remote description. */
  description: string;
  priority?: number;
  /** Always set; an empty list clears the remote labels. */
  labels: string[];
  assignee?: string;
  targetStateType?: string;
}

export function entityToLinearIssue(
  entity: Story | Epic,
  config: Pick<LinearConfig, 'status_mapping'>,
): CreateLinearIssueFromEntity {
  const assignee = entity.type === 'story' ? entity.assignee : entity.owner;

  // Reverse-map GitPM status to a Linear workflow state type. Multiple state
  // types can map to the same GitPM status (e.g. both 'triage' and 'backlog'
  // map to gitpm status 'backlog'), which makes a plain "first match wins"
  // scan order-dependent and can push entities into the wrong state (e.g.
  // GitPM 'backlog' landing in Linear's Triage state). Prefer a state type
  // whose name matches the GitPM status exactly — that mapping is always
  // unambiguous — before falling back to the first matching entry.
  const reverseMapping = config.status_mapping ?? DEFAULT_STATUS_MAPPING;
  let targetStateType: string | undefined;
  if (reverseMapping[entity.status] === entity.status) {
    targetStateType = entity.status;
  } else {
    for (const [stateType, gitpmStatus] of Object.entries(reverseMapping)) {
      if (gitpmStatus === entity.status) {
        targetStateType = stateType;
        break;
      }
    }
  }

  return {
    title: entity.title,
    description: entity.body ?? '',
    labels: [...(entity.labels ?? [])],
    assignee: assignee ?? undefined,
    priority: mapPriorityToLinear(entity.priority),
    targetStateType,
  };
}

function mapPriorityToLinear(priority: Priority): number {
  switch (priority) {
    case 'critical':
      return 1;
    case 'high':
      return 2;
    case 'low':
      return 4;
    default:
      return 3;
  }
}
