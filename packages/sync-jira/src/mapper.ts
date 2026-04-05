import type {
  Epic,
  JiraSync,
  Milestone,
  Priority,
  Status,
  Story,
} from '@gitpm/core';
import { toSlug } from '@gitpm/core';
import { nanoid } from 'nanoid';
import type { JiraIssue, JiraSprint } from './client.js';
import type { JiraConfig } from './types.js';
import { DEFAULT_EPIC_TYPES, DEFAULT_STATUS_MAPPING } from './types.js';

export function jiraSprintToMilestone(
  sprint: JiraSprint,
  site: string,
  projectKey: string,
): Milestone {
  const id = nanoid(12);
  const slug = toSlug(sprint.name);
  const now = new Date().toISOString();

  const status: Status = sprint.state === 'closed' ? 'done' : 'in_progress';

  const jira: JiraSync = {
    sprint_id: sprint.id,
    project_key: projectKey,
    site,
    last_sync_hash: '',
    synced_at: now,
  };

  return {
    type: 'milestone',
    id,
    title: sprint.name,
    target_date: sprint.endDate ?? undefined,
    status,
    body: sprint.goal ?? '',
    github: undefined,
    jira,
    created_at: sprint.startDate ?? now,
    updated_at: now,
    filePath: `.meta/roadmap/milestones/${slug}.md`,
  };
}

export function isEpicIssue(
  issue: JiraIssue,
  config?: Pick<JiraConfig, 'issue_type_mapping'>,
): boolean {
  const epicTypes =
    config?.issue_type_mapping?.epic_types ?? DEFAULT_EPIC_TYPES;
  return epicTypes.includes(issue.fields.issuetype.name);
}

export function mapJiraStatus(
  jiraStatusName: string,
  config?: Pick<JiraConfig, 'status_mapping'>,
): Status {
  const mapping = config?.status_mapping ?? DEFAULT_STATUS_MAPPING;
  return mapping[jiraStatusName] ?? 'todo';
}

export function mapJiraPriority(
  jiraPriorityName: string | undefined,
): Priority {
  if (!jiraPriorityName) return 'medium';
  const lower = jiraPriorityName.toLowerCase();
  if (lower === 'highest' || lower === 'blocker') return 'critical';
  if (lower === 'high') return 'high';
  if (lower === 'low' || lower === 'lowest') return 'low';
  return 'medium';
}

export function jiraIssueToEntity(
  issue: JiraIssue,
  config: Pick<JiraConfig, 'issue_type_mapping' | 'status_mapping'>,
  site: string,
): Story | Epic {
  const isEpic = isEpicIssue(issue, config);
  const id = nanoid(12);
  const now = new Date().toISOString();
  const status = mapJiraStatus(issue.fields.status.name, config);
  const priority = mapJiraPriority(issue.fields.priority?.name);

  const jira: JiraSync = {
    issue_key: issue.key,
    project_key: issue.fields.project.key,
    site,
    last_sync_hash: '',
    synced_at: now,
  };

  if (isEpic) {
    const slug = toSlug(issue.fields.summary);
    return {
      type: 'epic',
      id,
      title: issue.fields.summary,
      status,
      priority,
      owner: issue.fields.assignee?.displayName ?? null,
      labels: [...issue.fields.labels],
      milestone_ref: null,
      github: undefined,
      jira,
      body: issue.fields.description ?? '',
      created_at: issue.fields.created,
      updated_at: issue.fields.updated,
      filePath: `.meta/epics/${slug}/epic.md`,
    } satisfies Epic;
  }

  return {
    type: 'story',
    id,
    title: issue.fields.summary,
    status,
    priority,
    assignee: issue.fields.assignee?.displayName ?? null,
    labels: [...issue.fields.labels],
    estimate: null,
    epic_ref: null,
    github: undefined,
    jira,
    body: issue.fields.description ?? '',
    created_at: issue.fields.created,
    updated_at: issue.fields.updated,
    filePath: '',
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

  const slug = toSlug(entity.title);
  if (parentEpicSlug) {
    return `.meta/epics/${parentEpicSlug}/stories/${slug}.md`;
  }
  return `.meta/stories/${slug}.md`;
}

export interface CreateJiraIssueFromEntity {
  summary: string;
  description?: string;
  issueType: string;
  labels?: string[];
  assignee?: string;
  parentKey?: string;
  priority?: string;
  targetStatus?: string;
}

export function entityToJiraIssue(
  entity: Story | Epic,
  config: Pick<JiraConfig, 'status_mapping'>,
): CreateJiraIssueFromEntity {
  const issueType = entity.type === 'epic' ? 'Epic' : 'Story';
  const assignee = entity.type === 'story' ? entity.assignee : entity.owner;

  // Reverse-map GitPM status to Jira status name
  const reverseMapping = config.status_mapping ?? DEFAULT_STATUS_MAPPING;
  let targetStatus: string | undefined;
  for (const [jiraStatus, gitpmStatus] of Object.entries(reverseMapping)) {
    if (gitpmStatus === entity.status) {
      targetStatus = jiraStatus;
      break;
    }
  }

  return {
    summary: entity.title,
    description: entity.body || undefined,
    issueType,
    labels: entity.labels?.length ? [...entity.labels] : undefined,
    assignee: assignee ?? undefined,
    parentKey:
      entity.type === 'story' && entity.epic_ref
        ? undefined // resolved externally via epic key lookup
        : undefined,
    priority: mapPriorityToJira(entity.priority),
    targetStatus,
  };
}

function mapPriorityToJira(priority: Priority): string {
  switch (priority) {
    case 'critical':
      return 'Highest';
    case 'high':
      return 'High';
    case 'low':
      return 'Low';
    default:
      return 'Medium';
  }
}

export function milestoneToJiraSprint(milestone: Milestone): {
  name: string;
  goal?: string;
  endDate?: string;
} {
  return {
    name: milestone.title,
    goal: milestone.body || undefined,
    endDate: milestone.target_date ?? undefined,
  };
}
