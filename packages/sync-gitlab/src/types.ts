import type { EntityId, Status } from '@gitpm/core';

export type LinkStrategy =
  | 'body-refs'
  | 'native-epics'
  | 'milestone'
  | 'labels'
  | 'all';

export interface ImportOptions {
  token: string;
  project: string; // "namespace/project"
  projectId?: number;
  groupId?: number;
  baseUrl?: string; // default: "https://gitlab.com"
  metaDir: string;
  statusMapping?: Record<string, Status>;
  linkStrategy?: LinkStrategy;
}

export interface ImportResult {
  milestones: number;
  epics: number;
  stories: number;
  totalFiles: number;
  writtenPaths: string[];
}

export interface GitLabConfig {
  project: string;
  project_id: number;
  group_id?: number;
  base_url: string;
  status_mapping: Record<string, Status>;
  label_mapping: {
    epic_labels: string[];
  };
  auto_sync: boolean;
}

export interface SyncStateEntry {
  gitlab_issue_iid?: number;
  gitlab_milestone_id?: number;
  gitlab_epic_iid?: number;
  local_hash: string;
  remote_hash: string;
  synced_at: string;
}

export interface SyncState {
  project: string;
  project_id?: number;
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

export interface ExportOptions {
  token: string;
  project: string; // "namespace/project"
  projectId?: number;
  groupId?: number;
  baseUrl?: string;
  metaDir: string;
  dryRun?: boolean;
}

export interface ExportResult {
  created: { milestones: number; issues: number };
  updated: { milestones: number; issues: number };
  totalChanges: number;
  exportedPaths: string[];
}

export interface SyncOptions {
  token: string;
  project: string;
  projectId?: number;
  groupId?: number;
  baseUrl?: string;
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
