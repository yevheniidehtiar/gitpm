import type { EntityId, Priority, Status } from '@gitpm/core';

export type LinkStrategy =
  | 'body-refs'
  | 'sub-issues'
  | 'milestone'
  | 'labels'
  | 'score'
  | 'all';

export interface ImportOptions {
  token: string;
  repo: string; // "owner/repo"
  projectNumber?: number;
  metaDir: string; // target .meta/ directory
  statusMapping?: Record<string, Status>;
  linkStrategy?: LinkStrategy;
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
  priority_mapping: Record<string, Priority>;
  auto_sync: boolean;
}

export interface SyncStateEntry {
  github_issue_number?: number;
  github_milestone_number?: number;
  github_project_item_id?: string;
  local_hash: string;
  remote_hash: string;
  closed_on_remote?: boolean;
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

export const DEFAULT_PRIORITY_MAPPING: Record<string, Priority> = {
  'priority:critical': 'critical',
  'priority:high': 'high',
  'priority:medium': 'medium',
  'priority:low': 'low',
  P0: 'critical',
  P1: 'high',
  P2: 'medium',
  P3: 'low',
  critical: 'critical',
  urgent: 'critical',
};

// Phase 4 types

export interface ExportOptions {
  token: string;
  repo: string; // "owner/repo"
  projectNumber?: number;
  metaDir: string;
  dryRun?: boolean;
}

export interface ExportResult {
  created: { milestones: number; issues: number };
  updated: { milestones: number; issues: number };
  totalChanges: number;
}

export interface SyncOptions {
  token: string;
  repo: string;
  projectNumber?: number;
  metaDir: string;
  strategy?: ConflictStrategy;
  dryRun?: boolean;
}

export type ConflictStrategy = 'local-wins' | 'remote-wins' | 'ask';

export interface SyncCheckpoint {
  startedAt: string;
  repo: string;
  processedEntityIds: string[];
  lastError?: { entityId: string; message: string };
}

export interface SyncResult {
  pushed: { milestones: number; issues: number };
  pulled: { milestones: number; issues: number };
  conflicts: FieldConflict[];
  resolved: number;
  skipped: number;
  resumedFromCheckpoint: boolean;
  failedEntities: { entityId: string; error: string }[];
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
