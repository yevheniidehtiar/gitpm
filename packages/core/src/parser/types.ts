import type {
  Epic,
  Milestone,
  ParsedEntity,
  Prd,
  Roadmap,
  Sprint,
  Story,
} from '../schemas/index.js';

export interface MetaTree {
  stories: Story[];
  epics: Epic[];
  milestones: Milestone[];
  roadmaps: Roadmap[];
  prds: Prd[];
  sprints: Sprint[];
  errors: ParseError[];
}

export interface ParseError {
  filePath: string;
  message: string;
  details?: unknown;
}

export type { ParsedEntity };
