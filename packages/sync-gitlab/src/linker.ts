import type { EntityRef, Epic, Story } from '@gitpm/core';
import { toSlug } from '@gitpm/core';
import type { GlIssue } from './client.js';
import type { LinkStrategy } from './types.js';

export interface LinkContext {
  glIssues: GlIssue[];
  issueIidToEntity: Map<number, Epic | Story>;
  epicIssueIidToEpic: Map<number, Epic>;
  /** Map of epic issue IID → issue IIDs linked via native GitLab epics */
  nativeEpicIssueIids: Map<number, number[]>;
}

export interface LinkResult {
  epicRef: EntityRef;
  parentEpicSlug: string;
}

export function resolveEpicLink(
  glIssue: GlIssue,
  story: Story,
  ctx: LinkContext,
  strategy: LinkStrategy,
): LinkResult | null {
  if (strategy === 'all') {
    const strategies: LinkStrategy[] = [
      'body-refs',
      'native-epics',
      'milestone',
      'labels',
    ];
    for (const s of strategies) {
      const result = resolveEpicLink(glIssue, story, ctx, s);
      if (result) return result;
    }
    return null;
  }

  switch (strategy) {
    case 'body-refs':
      return linkByBodyRefs(glIssue, ctx);
    case 'native-epics':
      return linkByNativeEpics(glIssue, ctx);
    case 'milestone':
      return linkByMilestone(glIssue, ctx);
    case 'labels':
      return linkByLabels(glIssue, ctx);
    default:
      return null;
  }
}

function linkByBodyRefs(glIssue: GlIssue, ctx: LinkContext): LinkResult | null {
  const body = glIssue.description ?? '';
  const refPattern = /#(\d+)/g;
  let match: RegExpExecArray | null;

  while (true) {
    match = refPattern.exec(body);
    if (!match) break;
    const refIid = Number(match[1]);
    const epic = ctx.epicIssueIidToEpic.get(refIid);
    if (epic) {
      return {
        epicRef: { id: epic.id },
        parentEpicSlug: toSlug(epic.title),
      };
    }
  }

  return null;
}

function linkByNativeEpics(
  glIssue: GlIssue,
  ctx: LinkContext,
): LinkResult | null {
  // Check if this issue is linked to an epic via native GitLab epic relationship
  for (const [epicIid, issueIids] of ctx.nativeEpicIssueIids.entries()) {
    if (issueIids.includes(glIssue.iid)) {
      const epic = ctx.epicIssueIidToEpic.get(epicIid);
      if (epic) {
        return {
          epicRef: { id: epic.id },
          parentEpicSlug: toSlug(epic.title),
        };
      }
    }
  }

  // Also check the issue's epic_iid field (if present)
  if (glIssue.epic_iid) {
    // Look for an epic entity that was created from this native epic
    for (const entity of ctx.issueIidToEntity.values()) {
      if (
        entity.type === 'epic' &&
        entity.gitlab?.epic_iid === glIssue.epic_iid
      ) {
        return {
          epicRef: { id: entity.id },
          parentEpicSlug: toSlug(entity.title),
        };
      }
    }
  }

  return null;
}

function linkByMilestone(
  glIssue: GlIssue,
  ctx: LinkContext,
): LinkResult | null {
  if (!glIssue.milestone) return null;

  for (const [epicIid, epic] of ctx.epicIssueIidToEpic.entries()) {
    const epicIssue = ctx.glIssues.find((i) => i.iid === epicIid);
    if (
      epicIssue?.milestone &&
      epicIssue.milestone.id === glIssue.milestone.id
    ) {
      return {
        epicRef: { id: epic.id },
        parentEpicSlug: toSlug(epic.title),
      };
    }
  }

  return null;
}

function linkByLabels(glIssue: GlIssue, ctx: LinkContext): LinkResult | null {
  const issueLabels = new Set(glIssue.labels.filter((l) => l !== 'epic'));

  for (const [epicIid, epic] of ctx.epicIssueIidToEpic.entries()) {
    const epicIssue = ctx.glIssues.find((i) => i.iid === epicIid);
    if (!epicIssue) continue;

    const epicLabels = epicIssue.labels.filter((l) => l !== 'epic');
    const shared = epicLabels.filter((l) => issueLabels.has(l));

    if (shared.length === 1) {
      return {
        epicRef: { id: epic.id },
        parentEpicSlug: toSlug(epic.title),
      };
    }
  }

  return null;
}
