import type { EntityId, Status } from '@gitpm/core';

export interface ImportOptions {
  token: string;
  repo: string; // "owner/repo"
  projectNumber?: number;
  metaDir: string; // target .meta/ directory
  statusMapping?: Record<string, Status>;
}

export interface ImportResult {
  milestones: number;
  epics: number;
  stories: number;
  totalFiles: number;
}

export interface GitHubConfig {
  repo: string;
  project_number?: number;
  status_mapping: Record<string, Status>;
  label_mapping: {
    epic_labels: string[];
  };
  auto_sync: boolean;
}

export interface SyncStateEntry {
  github_issue_number?: number;
  github_milestone_number?: number;
  github_project_item_id?: string;
  local_hash: string;
  remote_hash: string;
  synced_at: string;
}

export interface SyncState {
  repo: string;
  project_number?: number;
  last_sync: string;
  entities: Record<EntityId, SyncStateEntry>;
}

export const DEFAULT_STATUS_MAPPING: Record<string, Status> = {
  Todo: 'todo',
  'In Progress': 'in_progress',
  'In Review': 'in_review',
  Done: 'done',
  Backlog: 'backlog',
};

export const DEFAULT_EPIC_LABELS = ['epic'];
