import type { ParseError } from '../parser/types.js';
import type { EntityId } from '../schemas/common.js';
import type { Epic, Milestone, Prd, Roadmap, Story } from '../schemas/index.js';

export interface ResolvedStory extends Story {
  resolvedEpic?: Epic;
}

export interface ResolvedEpic extends Epic {
  resolvedStories: Story[];
  resolvedMilestone?: Milestone;
}

export interface ResolvedMilestone extends Milestone {
  resolvedEpics: Epic[];
}

export interface ResolvedRoadmap extends Roadmap {
  resolvedMilestones: Milestone[];
}

export interface ResolvedPrd extends Prd {
  resolvedEpics: Epic[];
}

export interface ResolvedTree {
  stories: ResolvedStory[];
  epics: ResolvedEpic[];
  milestones: ResolvedMilestone[];
  roadmaps: ResolvedRoadmap[];
  prds: ResolvedPrd[];
  errors: ParseError[];
}

export interface DependencyGraph {
  adjacency: Map<EntityId, EntityId[]>;
  topologicalSort(): EntityId[];
  findCycles(): EntityId[][];
}
