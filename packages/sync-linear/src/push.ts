import type { Epic, Story } from '@gitpm/core';
import type {
  CreateLinearIssueParams,
  LinearClient,
  LinearIssue,
  UpdateLinearIssueParams,
} from './client.js';
import { entityToLinearIssue, mapLinearPriority } from './mapper.js';
import type { LinearConfig } from './types.js';

/**
 * Per-run helper for pushing entities to Linear. Workflow states are fetched
 * once up front; labels and users are fetched lazily, only when an entity
 * actually needs them.
 */
export interface PushContext {
  /** Linear workflow state id for the `completed` type, if the team has one. */
  completedStateId: string | undefined;
  /** Creates an issue for `entity`, optionally under `parentId`. */
  createIssue(entity: Story | Epic, parentId?: string): Promise<LinearIssue>;
  /**
   * Pushes every syncable field of `entity` to `issueId`. Empty labels, an
   * empty body and a missing assignee are sent as explicit clears. When the
   * `current` remote issue is given, priority is only sent if it differs
   * from what that issue already maps to, so Linear's 0 ("No priority") is
   * not overwritten with 3 by an unrelated edit.
   */
  updateIssue(
    issueId: string,
    entity: Story | Epic,
    current?: LinearIssue,
  ): Promise<LinearIssue>;
}

export async function createPushContext(
  client: LinearClient,
  teamId: string,
  config: Pick<LinearConfig, 'status_mapping'>,
): Promise<PushContext> {
  const stateIdMap: Record<string, string> = {};
  for (const state of await client.listWorkflowStates(teamId)) {
    if (!(state.type in stateIdMap)) stateIdMap[state.type] = state.id;
  }

  let labelIdMap: Map<string, string> | undefined;
  const resolveLabelIds = async (names: string[]): Promise<string[]> => {
    if (names.length === 0) return [];
    if (!labelIdMap) {
      const labels = await client.listIssueLabels(teamId);
      labelIdMap = new Map(labels.map((l) => [l.name, l.id]));
    }
    const ids: string[] = [];
    for (const name of names) {
      let id = labelIdMap.get(name);
      if (!id) {
        id = (await client.createIssueLabel(teamId, name)).id;
        labelIdMap.set(name, id);
      }
      ids.push(id);
    }
    return ids;
  };

  let userIdMap: Map<string, string> | undefined;
  /** `null` = unassign; `undefined` = unknown user, leave unchanged. */
  const resolveAssigneeId = async (
    name: string | undefined,
  ): Promise<string | null | undefined> => {
    if (!name) return null;
    if (!userIdMap) {
      userIdMap = new Map();
      for (const user of await client.listUsers()) {
        userIdMap.set(user.name, user.id);
        if (user.displayName && !userIdMap.has(user.displayName)) {
          userIdMap.set(user.displayName, user.id);
        }
      }
    }
    return userIdMap.get(name);
  };

  const buildInput = async (
    entity: Story | Epic,
  ): Promise<UpdateLinearIssueParams & { title: string }> => {
    const params = entityToLinearIssue(entity, config);
    return {
      title: params.title,
      description: params.description,
      priority: params.priority,
      stateId: params.targetStateType
        ? stateIdMap[params.targetStateType]
        : undefined,
      labelIds: await resolveLabelIds(params.labels),
      assigneeId: await resolveAssigneeId(params.assignee),
    };
  };

  return {
    completedStateId: stateIdMap.completed,
    async createIssue(entity, parentId) {
      const { assigneeId, ...input } = await buildInput(entity);
      const params: CreateLinearIssueParams = {
        ...input,
        teamId,
        parentId,
        assigneeId: assigneeId ?? undefined,
      };
      return client.createIssue(params);
    },
    async updateIssue(issueId, entity, current) {
      const input = await buildInput(entity);
      if (current && mapLinearPriority(current.priority) === entity.priority) {
        delete input.priority;
      }
      return client.updateIssue(issueId, input);
    },
  };
}
