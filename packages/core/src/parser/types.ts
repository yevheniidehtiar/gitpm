import type {
  Epic,
  Milestone,
  ParsedEntity,
  Prd,
  Roadmap,
  Story,
} from '../schemas/index.js';

export interface MetaTree {
  stories: Story[];
  epics: Epic[];
  milestones: Milestone[];
  roadmaps: Roadmap[];
  prds: Prd[];
  errors: ParseError[];
}

export interface ParseError {
  filePath: string;
  message: string;
  details?: unknown;
}

export type { ParsedEntity };
