import type {
  ResolvedEpic,
  ResolvedStory,
  ResolvedTree,
} from '../resolver/types.js';
import type { QualityConfig } from './config.js';
import { checkTemplateCoverage, hasChecklist } from './template.js';

export interface ScoreBreakdown {
  hasBody: boolean;
  bodyOver100: boolean;
  hasLabels: boolean;
  hasAssignee: boolean;
  hasAcceptanceCriteria: boolean;
  linkedToEpic: boolean;
  hasMilestone: boolean;
}

export interface EntityScore {
  id: string;
  title: string;
  type: string;
  filePath: string;
  score: number;
  maxScore: number;
  grade: string;
  breakdown: ScoreBreakdown;
}

export interface GradeSummary {
  A: number;
  B: number;
  C: number;
  D: number;
  F: number;
}

export interface QualityReport {
  entities: EntityScore[];
  average: number;
  distribution: GradeSummary;
}

function computeGrade(score: number): string {
  if (score >= 8) return 'A';
  if (score >= 6) return 'B';
  if (score >= 4) return 'C';
  if (score >= 2) return 'D';
  return 'F';
}

function checkAcceptanceCriteria(
  body: string,
  config: QualityConfig | null,
): boolean {
  if (config?.template) {
    const result = checkTemplateCoverage(
      body,
      config.template.required_sections,
      config.template.min_coverage ?? 0.5,
    );
    return result.passes;
  }
  return hasChecklist(body);
}

export function scoreStory(
  story: ResolvedStory,
  config: QualityConfig | null,
): EntityScore {
  const body = story.body.trim();
  const breakdown: ScoreBreakdown = {
    hasBody: body.length > 0,
    bodyOver100: body.length > 100,
    hasLabels: story.labels.length > 0,
    hasAssignee: story.assignee != null && story.assignee !== '',
    hasAcceptanceCriteria: checkAcceptanceCriteria(story.body, config),
    linkedToEpic: story.epic_ref != null,
    hasMilestone: story.resolvedEpic?.milestone_ref != null,
  };

  let score = 0;
  if (breakdown.hasBody) score += 2;
  if (breakdown.bodyOver100) score += 1;
  if (breakdown.hasLabels) score += 1;
  if (breakdown.hasAssignee) score += 1;
  if (breakdown.hasAcceptanceCriteria) score += 2;
  if (breakdown.linkedToEpic) score += 1;
  if (breakdown.hasMilestone) score += 1;

  return {
    id: story.id,
    title: story.title,
    type: 'story',
    filePath: story.filePath,
    score,
    maxScore: 9,
    grade: computeGrade(score),
    breakdown,
  };
}

export function scoreEpic(
  epic: ResolvedEpic,
  config: QualityConfig | null,
): EntityScore {
  const body = epic.body.trim();
  const breakdown: ScoreBreakdown = {
    hasBody: body.length > 0,
    bodyOver100: body.length > 100,
    hasLabels: epic.labels.length > 0,
    hasAssignee: epic.owner != null && epic.owner !== '',
    hasAcceptanceCriteria: checkAcceptanceCriteria(epic.body, config),
    linkedToEpic: epic.resolvedStories.length > 0,
    hasMilestone: epic.milestone_ref != null,
  };

  let score = 0;
  if (breakdown.hasBody) score += 2;
  if (breakdown.bodyOver100) score += 1;
  if (breakdown.hasLabels) score += 1;
  if (breakdown.hasAssignee) score += 1;
  if (breakdown.hasAcceptanceCriteria) score += 2;
  if (breakdown.linkedToEpic) score += 1;
  if (breakdown.hasMilestone) score += 1;

  return {
    id: epic.id,
    title: epic.title,
    type: 'epic',
    filePath: epic.filePath,
    score,
    maxScore: 9,
    grade: computeGrade(score),
    breakdown,
  };
}

export function scoreEntities(
  tree: ResolvedTree,
  config?: QualityConfig | null,
): QualityReport {
  const cfg = config ?? null;
  const entities: EntityScore[] = [];

  for (const story of tree.stories) {
    entities.push(scoreStory(story, cfg));
  }
  for (const epic of tree.epics) {
    entities.push(scoreEpic(epic, cfg));
  }

  const distribution: GradeSummary = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  let total = 0;
  for (const entity of entities) {
    total += entity.score;
    distribution[entity.grade as keyof GradeSummary] += 1;
  }

  const average = entities.length > 0 ? total / entities.length : 0;

  return { entities, average, distribution };
}
