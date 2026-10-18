import type { EpicLinkage } from './config.js';
import { bbIssueToEpicId } from './mapper.js';
import type { BbIssue } from './types.js';

export type IssueEntityType = 'epic' | 'story';

const EPIC_TITLE_RE = /^\s*\[epic\]/i;

/**
 * Decide which issues become epics, given Bitbucket has no issue types:
 * 1. the type the issue was imported or exported as before (`knownTypes`)
 * 2. a title starting with `[Epic]`
 * 3. unless linkage is `body-marker`, a title another issue uses as its component
 */
export function classifyIssues(
  issues: readonly BbIssue[],
  knownTypes: ReadonlyMap<number, IssueEntityType>,
  linkage: EpicLinkage,
): Set<number> {
  const componentNames = new Set<string>();
  if (linkage !== 'body-marker') {
    for (const issue of issues) {
      if (issue.component) componentNames.add(issue.component.name);
    }
  }

  const epicIds = new Set<number>();
  for (const issue of issues) {
    const known = knownTypes.get(issue.id);
    const isEpic = known
      ? known === 'epic'
      : EPIC_TITLE_RE.test(issue.title) || componentNames.has(issue.title);
    if (isEpic) epicIds.add(issue.id);
  }
  return epicIds;
}

export interface EpicIssue {
  issue: BbIssue;
  epicId: string;
}

/**
 * Map component names to epic ids. A component named after an epic's title
 * (what export writes) wins over the component an epic issue itself carries.
 */
export function buildComponentIndex(
  epics: readonly EpicIssue[],
): Map<string, string> {
  const index = new Map<string, string>();
  for (const { issue, epicId } of epics) {
    index.set(issue.title, epicId);
  }
  for (const { issue, epicId } of epics) {
    if (issue.component && !index.has(issue.component.name)) {
      index.set(issue.component.name, epicId);
    }
  }
  return index;
}

/**
 * Resolve the epic a story issue belongs to. A body marker only counts when
 * it names a known epic; with `both`, a dangling marker falls back to the
 * component.
 */
export function resolveStoryEpic(
  issue: Pick<BbIssue, 'content' | 'component'>,
  componentIndex: ReadonlyMap<string, string>,
  knownEpicIds: ReadonlySet<string>,
  linkage: EpicLinkage,
): string | null {
  if (linkage !== 'component') {
    const marked = bbIssueToEpicId(issue, componentIndex, 'body-marker');
    if (marked && knownEpicIds.has(marked)) return marked;
  }
  if (linkage !== 'body-marker') {
    return bbIssueToEpicId(issue, componentIndex, 'component');
  }
  return null;
}
