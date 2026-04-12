import type {
  ResolvedEpic,
  ResolvedStory,
  ResolvedTree,
} from '../resolver/types.js';

export interface AuditConfig {
  staleDays: number;
}

export interface AuditItem {
  id: string;
  title: string;
  type: string;
  filePath: string;
  reason: string;
}

export interface DuplicatePair {
  a: { id: string; title: string; filePath: string };
  b: { id: string; title: string; filePath: string };
  similarity: number;
}

export interface AuditReport {
  stale: AuditItem[];
  orphans: AuditItem[];
  emptyBodies: AuditItem[];
  zombieEpics: AuditItem[];
  duplicates: DuplicatePair[];
  summary: { total: number; issues: number };
}

const DEFAULT_CONFIG: AuditConfig = { staleDays: 90 };
const DONE_STATUSES = new Set(['done', 'cancelled']);

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findStale(
  stories: ResolvedStory[],
  now: Date,
  staleDays: number,
): AuditItem[] {
  return stories
    .filter((s) => {
      if (DONE_STATUSES.has(s.status)) return false;
      if (s.status !== 'todo' && s.status !== 'backlog') return false;
      const updated = s.updated_at ? new Date(s.updated_at) : null;
      if (!updated) return true; // no date = stale
      return daysBetween(now, updated) > staleDays;
    })
    .map((s) => {
      const days = s.updated_at
        ? Math.round(daysBetween(now, new Date(s.updated_at)))
        : -1;
      return {
        id: s.id,
        title: s.title,
        type: 'story',
        filePath: s.filePath,
        reason: days >= 0 ? `${days} days since last update` : 'no update date',
      };
    });
}

function findOrphans(stories: ResolvedStory[]): AuditItem[] {
  return stories
    .filter((s) => s.epic_ref == null && !DONE_STATUSES.has(s.status))
    .map((s) => ({
      id: s.id,
      title: s.title,
      type: 'story',
      filePath: s.filePath,
      reason: 'no epic link',
    }));
}

function findEmptyBodies(tree: ResolvedTree): AuditItem[] {
  const items: AuditItem[] = [];
  for (const s of tree.stories) {
    if (s.body.trim().length === 0 && !DONE_STATUSES.has(s.status)) {
      items.push({
        id: s.id,
        title: s.title,
        type: 'story',
        filePath: s.filePath,
        reason: 'empty body',
      });
    }
  }
  for (const e of tree.epics) {
    if (e.body.trim().length === 0 && !DONE_STATUSES.has(e.status)) {
      items.push({
        id: e.id,
        title: e.title,
        type: 'epic',
        filePath: e.filePath,
        reason: 'empty body',
      });
    }
  }
  return items;
}

function findZombieEpics(epics: ResolvedEpic[]): AuditItem[] {
  return epics
    .filter((e) => {
      if (DONE_STATUSES.has(e.status)) return false;
      if (e.resolvedStories.length === 0) return false;
      return e.resolvedStories.every((s) => DONE_STATUSES.has(s.status));
    })
    .map((e) => ({
      id: e.id,
      title: e.title,
      type: 'epic',
      filePath: e.filePath,
      reason: 'all stories done but epic is not',
    }));
}

function findDuplicates(tree: ResolvedTree): DuplicatePair[] {
  const entities = [
    ...tree.stories.map((s) => ({
      id: s.id,
      title: s.title,
      filePath: s.filePath,
      norm: normalizeTitle(s.title),
    })),
    ...tree.epics.map((e) => ({
      id: e.id,
      title: e.title,
      filePath: e.filePath,
      norm: normalizeTitle(e.title),
    })),
  ];

  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];
      const maxLen = Math.max(a.norm.length, b.norm.length);
      if (maxLen === 0) continue;
      const dist = levenshtein(a.norm, b.norm);
      const similarity = 1 - dist / maxLen;
      if (similarity >= 0.85) {
        pairs.push({
          a: { id: a.id, title: a.title, filePath: a.filePath },
          b: { id: b.id, title: b.title, filePath: b.filePath },
          similarity,
        });
      }
    }
  }
  return pairs.sort((a, b) => b.similarity - a.similarity);
}

export function auditTree(
  tree: ResolvedTree,
  config?: Partial<AuditConfig>,
): AuditReport {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = new Date();

  const stale = findStale(tree.stories, now, cfg.staleDays);
  const orphans = findOrphans(tree.stories);
  const emptyBodies = findEmptyBodies(tree);
  const zombieEpics = findZombieEpics(tree.epics);
  const duplicates = findDuplicates(tree);

  const total =
    tree.stories.length + tree.epics.length + tree.milestones.length;
  const issues =
    stale.length +
    orphans.length +
    emptyBodies.length +
    zombieEpics.length +
    duplicates.length;

  return {
    stale,
    orphans,
    emptyBodies,
    zombieEpics,
    duplicates,
    summary: { total, issues },
  };
}
