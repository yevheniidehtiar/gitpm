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

/** Score weights for composite linkByScore strategy. */
const SCORE_WEIGHTS = {
  subIssues: 10,
  bodyRefs: 8,
  milestone: 5,
  perLabel: 2,
} as const;

const SCORE_THRESHOLD = 5;

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
    case 'score':
      return linkByScore(ghIssue, ctx);
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

/** Link stories to epics when they share a milestone. Pick the dominant epic (most sub-issues) when multiple match. */
function linkByMilestone(
  ghIssue: GhIssue,
  ctx: LinkContext,
): LinkResult | null {
  if (!ghIssue.milestone) return null;

  const matchingEpics: Array<{ epic: Epic; epicNumber: number }> = [];

  for (const [epicNumber, epic] of ctx.epicIssueNumberToEpic) {
    const epicGhIssue = ctx.ghIssues.find((i) => i.number === epicNumber);
    if (
      epicGhIssue?.milestone &&
      epicGhIssue.milestone.number === ghIssue.milestone.number
    ) {
      matchingEpics.push({ epic, epicNumber });
    }
  }

  if (matchingEpics.length === 0) return null;

  if (matchingEpics.length === 1) {
    const { epic } = matchingEpics[0];
    return {
      epicRef: { id: epic.id },
      parentEpicSlug: toSlug(epic.title),
    };
  }

  // Multiple epics share the milestone — pick the one with the most sub-issues
  let dominant: { epic: Epic; count: number } | null = null;
  for (const { epic, epicNumber } of matchingEpics) {
    const subCount = ctx.epicSubIssues.get(epicNumber)?.length ?? 0;
    if (!dominant || subCount > dominant.count) {
      dominant = { epic, count: subCount };
    }
  }

  if (dominant) {
    return {
      epicRef: { id: dominant.epic.id },
      parentEpicSlug: toSlug(dominant.epic.title),
    };
  }

  return null;
}

/** Link stories to epics by shared labels. Score epics by count of shared labels; require minimum 2 to avoid false positives. */
function linkByLabels(ghIssue: GhIssue, ctx: LinkContext): LinkResult | null {
  const storyLabels = new Set(
    ghIssue.labels.map((l) => (typeof l === 'string' ? l : l.name)),
  );

  if (storyLabels.size === 0) return null;

  const MIN_SHARED_LABELS = 2;
  let bestEpic: Epic | null = null;
  let bestScore = 0;

  for (const [epicNumber, epic] of ctx.epicIssueNumberToEpic) {
    const epicGhIssue = ctx.ghIssues.find((i) => i.number === epicNumber);
    if (!epicGhIssue) continue;

    const epicLabels = epicGhIssue.labels
      .map((l) => (typeof l === 'string' ? l : l.name))
      .filter((l) => l !== 'epic'); // exclude the 'epic' label itself

    const sharedCount = epicLabels.filter((l) => storyLabels.has(l)).length;
    if (sharedCount >= MIN_SHARED_LABELS && sharedCount > bestScore) {
      bestScore = sharedCount;
      bestEpic = epic;
    }
  }

  if (bestEpic) {
    return {
      epicRef: { id: bestEpic.id },
      parentEpicSlug: toSlug(bestEpic.title),
    };
  }
  return null;
}

/** Composite scoring strategy: combines sub-issues, body-refs, milestone, and labels into a single score per epic. */
function linkByScore(ghIssue: GhIssue, ctx: LinkContext): LinkResult | null {
  const storyLabels = new Set(
    ghIssue.labels.map((l) => (typeof l === 'string' ? l : l.name)),
  );

  let bestEpic: Epic | null = null;
  let bestScore = 0;

  for (const [epicNumber, epic] of ctx.epicIssueNumberToEpic) {
    let score = 0;

    // Sub-issues match: 10 pts
    const subIssueNumbers = ctx.epicSubIssues.get(epicNumber);
    if (subIssueNumbers?.includes(ghIssue.number)) {
      score += SCORE_WEIGHTS.subIssues;
    }

    // Body-ref match: 8 pts
    if (ghIssue.body) {
      const refPattern = new RegExp(`#${epicNumber}\\b`);
      if (refPattern.test(ghIssue.body)) {
        score += SCORE_WEIGHTS.bodyRefs;
      }
    }

    // Milestone match: 5 pts
    const epicGhIssue = ctx.ghIssues.find((i) => i.number === epicNumber);
    if (
      ghIssue.milestone &&
      epicGhIssue?.milestone &&
      epicGhIssue.milestone.number === ghIssue.milestone.number
    ) {
      score += SCORE_WEIGHTS.milestone;
    }

    // Per shared label: 2 pts each
    if (epicGhIssue && storyLabels.size > 0) {
      const epicLabels = epicGhIssue.labels
        .map((l) => (typeof l === 'string' ? l : l.name))
        .filter((l) => l !== 'epic');
      const sharedCount = epicLabels.filter((l) => storyLabels.has(l)).length;
      score += sharedCount * SCORE_WEIGHTS.perLabel;
    }

    if (score > bestScore) {
      bestScore = score;
      bestEpic = epic;
    }
  }

  if (bestEpic && bestScore > SCORE_THRESHOLD) {
    return {
      epicRef: { id: bestEpic.id },
      parentEpicSlug: toSlug(bestEpic.title),
    };
  }
  return null;
}
