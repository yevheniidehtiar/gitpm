import type { EntityId, Status } from '@gitpm/core';

export interface JiraImportOptions {
  email: string;
  apiToken: string;
  site: string;
  projectKey: string;
  metaDir: string;
  statusMapping?: Record<string, Status>;
  boardId?: number;
}

export interface ImportResult {
  milestones: number;
  epics: number;
  stories: number;
  totalFiles: number;
  writtenPaths: string[];
}

export interface JiraConfig {
  site: string;
  project_key: string;
  board_id?: number;
  status_mapping: Record<string, Status>;
  issue_type_mapping: {
    epic_types: string[];
  };
  auto_sync: boolean;
}

export interface JiraSyncStateEntry {
  jira_issue_key?: string;
  jira_sprint_id?: number;
  local_hash: string;
  remote_hash: string;
  synced_at: string;
}

export interface JiraSyncState {
  site: string;
  project_key: string;
  board_id?: number;
  last_sync: string;
  entities: Record<EntityId, JiraSyncStateEntry>;
}

export const DEFAULT_STATUS_MAPPING: Record<string, Status> = {
  'To Do': 'todo',
  'In Progress': 'in_progress',
  'In Review': 'in_review',
  Done: 'done',
  Backlog: 'backlog',
};

export const DEFAULT_EPIC_TYPES = ['Epic'];

export interface JiraExportOptions {
  email: string;
  apiToken: string;
  site: string;
  projectKey: string;
  metaDir: string;
  dryRun?: boolean;
}

export interface ExportResult {
  created: { milestones: number; issues: number };
  updated: { milestones: number; issues: number };
  totalChanges: number;
  exportedPaths: string[];
}

export interface JiraSyncOptions {
  email: string;
  apiToken: string;
  site: string;
  projectKey: string;
  metaDir: string;
  strategy?: ConflictStrategy;
  dryRun?: boolean;
}

export type ConflictStrategy = 'local-wins' | 'remote-wins' | 'ask';

export interface SyncResult {
  pushed: { milestones: number; issues: number };
  pulled: { milestones: number; issues: number };
  conflicts: FieldConflict[];
  resolved: number;
  skipped: number;
  pulledPaths: string[];
  pushedPaths: string[];
}

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface FieldConflict {
  entityId: string;
  entityTitle: string;
  entityType: string;
  field: string;
  baseValue: unknown;
  localValue: unknown;
  remoteValue: unknown;
}

export type DiffStatus =
  | 'in_sync'
  | 'local_changed'
  | 'remote_changed'
  | 'conflict';

export interface DiffResult {
  status: DiffStatus;
  localChanges: FieldChange[];
  remoteChanges: FieldChange[];
  conflicts: FieldConflict[];
}

export interface Resolution {
  entityId: string;
  field: string;
  pick: 'local' | 'remote';
}
