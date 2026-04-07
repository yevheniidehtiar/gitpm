import type { Epic, Story } from '@gitpm/core';
import { toSlug } from '@gitpm/core';
import type { GhIssue } from './client.js';
import type { LinkStrategy } from './types.js';

export interface LinkContext {
  /** All GitHub issues (epics + stories) */
  ghIssues: GhIssue[];
  /** Map from GitHub issue number to parsed entity */
  issueNumberToEntity: Map<number, Epic | Story>;
  /** Map from epic issue number to Epic entity */
  epicIssueNumberToEpic: Map<number, Epic>;
  /** Map from epic issue number to its sub-issue numbers (from GitHub API) */
  epicSubIssues: Map<number, number[]>;
}

export interface LinkResult {
  epicRef: { id: string };
  parentEpicSlug: string;
}

/**
 * Resolve epic reference for a story using the specified link strategy.
 * Strategies are tried in priority order when strategy is 'all'.
 */
export function resolveEpicLink(
  ghIssue: GhIssue,
  story: Story,
  ctx: LinkContext,
  strategy: LinkStrategy = 'all',
): LinkResult | null {
  const strategies = getStrategies(strategy);

  for (const strat of strategies) {
    const result = applyStrategy(strat, ghIssue, story, ctx);
    if (result) return result;
  }

  return null;
}

function getStrategies(strategy: LinkStrategy): LinkStrategy[] {
  if (strategy === 'all') {
    return ['body-refs', 'sub-issues', 'milestone', 'labels'];
  }
  return [strategy];
}

function applyStrategy(
  strategy: LinkStrategy,
  ghIssue: GhIssue,
  _story: Story,
  ctx: LinkContext,
): LinkResult | null {
  switch (strategy) {
    case 'body-refs':
      return linkByBodyRefs(ghIssue, ctx);
    case 'sub-issues':
      return linkBySubIssues(ghIssue, ctx);
    case 'milestone':
      return linkByMilestone(ghIssue, ctx);
    case 'labels':
      return linkByLabels(ghIssue, ctx);
    default:
      return null;
  }
}

/** Original strategy: scan issue body for "#<epicNumber>" references. */
function linkByBodyRefs(ghIssue: GhIssue, ctx: LinkContext): LinkResult | null {
  if (!ghIssue.body) return null;

  for (const [epicNumber, epic] of ctx.epicIssueNumberToEpic) {
    const refPattern = new RegExp(`#${epicNumber}\\b`);
    if (refPattern.test(ghIssue.body)) {
      return {
        epicRef: { id: epic.id },
        parentEpicSlug: toSlug(epic.title),
      };
    }
  }
  return null;
}

/** Link via GitHub Sub-Issues API: if the story is a sub-issue of an epic. */
function linkBySubIssues(
  ghIssue: GhIssue,
  ctx: LinkContext,
): LinkResult | null {
  for (const [epicNumber, epic] of ctx.epicIssueNumberToEpic) {
    const subIssueNumbers = ctx.epicSubIssues.get(epicNumber);
    if (subIssueNumbers?.includes(ghIssue.number)) {
      return {
        epicRef: { id: epic.id },
        parentEpicSlug: toSlug(epic.title),
      };
    }
  }
  return null;
}

/** Link stories to epics when they share exactly one milestone in common. */
function linkByMilestone(
  ghIssue: GhIssue,
  ctx: LinkContext,
): LinkResult | null {
  if (!ghIssue.milestone) return null;

  const matchingEpics: Epic[] = [];

  for (const [epicNumber, epic] of ctx.epicIssueNumberToEpic) {
    const epicGhIssue = ctx.ghIssues.find((i) => i.number === epicNumber);
    if (
      epicGhIssue?.milestone &&
      epicGhIssue.milestone.number === ghIssue.milestone.number
    ) {
      matchingEpics.push(epic);
    }
  }

  // Only link when exactly one epic shares the same milestone
  if (matchingEpics.length === 1) {
    const epic = matchingEpics[0];
    return {
      epicRef: { id: epic.id },
      parentEpicSlug: toSlug(epic.title),
    };
  }
  return null;
}

/** Link stories to epics when they share exactly one non-epic label match. */
function linkByLabels(ghIssue: GhIssue, ctx: LinkContext): LinkResult | null {
  const storyLabels = new Set(
    ghIssue.labels.map((l) => (typeof l === 'string' ? l : l.name)),
  );

  if (storyLabels.size === 0) return null;

  const matchingEpics: Epic[] = [];

  for (const [epicNumber, epic] of ctx.epicIssueNumberToEpic) {
    const epicGhIssue = ctx.ghIssues.find((i) => i.number === epicNumber);
    if (!epicGhIssue) continue;

    const epicLabels = epicGhIssue.labels
      .map((l) => (typeof l === 'string' ? l : l.name))
      .filter((l) => l !== 'epic'); // exclude the 'epic' label itself

    const shared = epicLabels.filter((l) => storyLabels.has(l));
    if (shared.length > 0) {
      matchingEpics.push(epic);
    }
  }

  // Only link when exactly one epic has overlapping labels
  if (matchingEpics.length === 1) {
    const epic = matchingEpics[0];
    return {
      epicRef: { id: epic.id },
      parentEpicSlug: toSlug(epic.title),
    };
  }
  return null;
}
