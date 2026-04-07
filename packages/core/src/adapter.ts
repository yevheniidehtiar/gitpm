import type { Result } from './schemas/common.js';

// --- Shared result types (deduplicated from sync-github, sync-gitlab, sync-jira) ---

export interface ImportResult {
  milestones: number;
  epics: number;
  stories: number;
  totalFiles: number;
}

export interface ExportResult {
  created: { milestones: number; issues: number };
  updated: { milestones: number; issues: number };
  totalChanges: number;
}

export interface SyncResult {
  pushed: { milestones: number; issues: number };
  pulled: { milestones: number; issues: number };
  conflicts: FieldConflict[];
  resolved: number;
  skipped: number;
}

export type ConflictStrategy = 'local-wins' | 'remote-wins' | 'ask';

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

// --- Adapter options ---

export interface AdapterImportOptions {
  metaDir: string;
  token?: string;
  credentials?: Record<string, string>;
  linkStrategy?: string;
  [key: string]: unknown;
}

export interface AdapterExportOptions {
  metaDir: string;
  token?: string;
  credentials?: Record<string, string>;
  dryRun?: boolean;
  [key: string]: unknown;
}

export interface AdapterSyncOptions {
  metaDir: string;
  token?: string;
  credentials?: Record<string, string>;
  strategy?: ConflictStrategy;
  dryRun?: boolean;
  [key: string]: unknown;
}

// --- SyncAdapter interface ---

export interface SyncAdapter {
  /** Unique adapter name (e.g. "github", "gitlab", "jira") */
  name: string;

  /** Display name for CLI output (e.g. "GitHub", "GitLab", "Jira") */
  displayName: string;

  /** Detect if this adapter is configured for the given .meta directory */
  detect(metaDir: string): Promise<boolean>;

  /** Import from remote into .meta */
  import(options: AdapterImportOptions): Promise<Result<ImportResult>>;

  /** Export from .meta to remote */
  export(options: AdapterExportOptions): Promise<Result<ExportResult>>;

  /** Bidirectional sync */
  sync(options: AdapterSyncOptions): Promise<Result<SyncResult>>;
}

/** Validate that an object conforms to the SyncAdapter interface */
export function isSyncAdapter(obj: unknown): obj is SyncAdapter {
  if (!obj || typeof obj !== 'object') return false;
  const adapter = obj as Record<string, unknown>;
  return (
    typeof adapter.name === 'string' &&
    typeof adapter.displayName === 'string' &&
    typeof adapter.detect === 'function' &&
    typeof adapter.import === 'function' &&
    typeof adapter.export === 'function' &&
    typeof adapter.sync === 'function'
  );
}
