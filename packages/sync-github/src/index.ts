export { GitHubClient } from './client.js';
export type {
  GhMilestone,
  GhIssue,
  GhProject,
  GhProjectItem,
} from './client.js';

export {
  ghMilestoneToMilestone,
  ghIssueToEntity,
  isEpicIssue,
  determineFilePath,
  milestoneToGhMilestone,
  entityToGhIssue,
} from './mapper.js';
export type { CreateMilestoneParams, CreateIssueParams } from './mapper.js';

export { importFromGitHub } from './import.js';
export { exportToGitHub } from './export.js';
export { syncWithGitHub } from './sync.js';

export {
  diffEntity,
  diffByHash,
  remoteIssueFields,
  remoteMilestoneFields,
} from './diff.js';

export { resolveConflicts, applyResolutions } from './conflict.js';

export {
  loadState,
  saveState,
  computeContentHash,
  createInitialState,
} from './state.js';

export { loadConfig, saveConfig, createDefaultConfig } from './config.js';

export type {
  ImportOptions,
  ImportResult,
  ExportOptions,
  ExportResult,
  SyncOptions,
  SyncResult,
  GitHubConfig,
  SyncState,
  SyncStateEntry,
  ConflictStrategy,
  FieldChange,
  FieldConflict,
  DiffResult,
  DiffStatus,
  Resolution,
} from './types.js';

export {
  DEFAULT_STATUS_MAPPING,
  DEFAULT_EPIC_LABELS,
} from './types.js';
