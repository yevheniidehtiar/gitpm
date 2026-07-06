import type { EntityId, Status } from '@gitpm/core';

export interface LinearImportOptions {
  apiKey: string;
  teamId: string;
  metaDir: string;
  statusMapping?: Record<string, Status>;
}

export interface ImportResult {
  milestones: number;
  epics: number;
  stories: number;
  totalFiles: number;
  writtenPaths: string[];
}

export interface LinearConfig {
  team_id: string;
  /** Keyed by Linear workflow state `type` (triage/backlog/unstarted/started/completed/canceled). */
  status_mapping: Record<string, Status>;
  auto_sync: boolean;
}

export interface LinearSyncStateEntry {
  linear_issue_id?: string;
  linear_cycle_id?: string;
  local_hash: string;
  remote_hash: string;
  synced_at: string;
}

export interface LinearSyncState {
  team_id: string;
  last_sync: string;
  entities: Record<EntityId, LinearSyncStateEntry>;
}

export const DEFAULT_STATUS_MAPPING: Record<string, Status> = {
  triage: 'backlog',
  backlog: 'backlog',
  unstarted: 'todo',
  started: 'in_progress',
  completed: 'done',
  canceled: 'cancelled',
};

export interface LinearExportOptions {
  apiKey: string;
  teamId: string;
  metaDir: string;
  dryRun?: boolean;
}

export interface ExportResult {
  created: { milestones: number; issues: number };
  updated: { milestones: number; issues: number };
  totalChanges: number;
  exportedPaths: string[];
}

export interface LinearSyncOptions {
  apiKey: string;
  teamId: string;
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
