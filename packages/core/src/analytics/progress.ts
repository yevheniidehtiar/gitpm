import type {
  ResolvedEpic,
  ResolvedMilestone,
  ResolvedTree,
} from '../resolver/types.js';

export interface EpicProgress {
  epicId: string;
  title: string;
  status: string;
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  progress: number; // 0–1
}

export interface MilestoneProgress {
  milestoneId: string;
  title: string;
  targetDate?: string;
  epics: EpicProgress[];
  total: number;
  done: number;
  progress: number; // 0–1
}

export interface ProjectProgress {
  milestones: MilestoneProgress[];
  orphanEpics: EpicProgress[];
  overall: { total: number; done: number; progress: number };
}

const DONE_STATUSES = new Set(['done', 'cancelled']);
const ACTIVE_STATUSES = new Set(['in_progress', 'in_review']);

export function computeEpicProgress(epic: ResolvedEpic): EpicProgress {
  const stories = epic.resolvedStories;
  const total = stories.length;
  const done = stories.filter((s) => DONE_STATUSES.has(s.status)).length;
  const inProgress = stories.filter((s) =>
    ACTIVE_STATUSES.has(s.status),
  ).length;
  const blocked = stories.filter(
    (s) =>
      !DONE_STATUSES.has(s.status) &&
      !ACTIVE_STATUSES.has(s.status) &&
      s.assignee == null,
  ).length;

  return {
    epicId: epic.id,
    title: epic.title,
    status: epic.status,
    total,
    done,
    inProgress,
    blocked,
    progress: total > 0 ? done / total : 0,
  };
}

export function computeMilestoneProgress(
  milestone: ResolvedMilestone,
  allEpics: ResolvedEpic[],
): MilestoneProgress {
  const linkedEpics = allEpics.filter(
    (e) => e.milestone_ref?.id === milestone.id,
  );
  const epics = linkedEpics.map(computeEpicProgress);
  const total = epics.reduce((sum, e) => sum + e.total, 0);
  const done = epics.reduce((sum, e) => sum + e.done, 0);

  return {
    milestoneId: milestone.id,
    title: milestone.title,
    targetDate: milestone.target_date,
    epics,
    total,
    done,
    progress: total > 0 ? done / total : 0,
  };
}

export function computeProjectProgress(tree: ResolvedTree): ProjectProgress {
  const milestoneIds = new Set(tree.milestones.map((m) => m.id));
  const linkedEpicIds = new Set(
    tree.epics
      .filter((e) => e.milestone_ref && milestoneIds.has(e.milestone_ref.id))
      .map((e) => e.id),
  );

  const milestones = tree.milestones.map((ms) =>
    computeMilestoneProgress(ms, tree.epics),
  );

  const orphanEpics = tree.epics
    .filter((e) => !linkedEpicIds.has(e.id))
    .map(computeEpicProgress);

  const allTotal =
    milestones.reduce((s, m) => s + m.total, 0) +
    orphanEpics.reduce((s, e) => s + e.total, 0);
  const allDone =
    milestones.reduce((s, m) => s + m.done, 0) +
    orphanEpics.reduce((s, e) => s + e.done, 0);

  return {
    milestones,
    orphanEpics,
    overall: {
      total: allTotal,
      done: allDone,
      progress: allTotal > 0 ? allDone / allTotal : 0,
    },
  };
}
