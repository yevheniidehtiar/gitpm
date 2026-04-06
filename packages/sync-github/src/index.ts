export type {
  GhIssue,
  GhMilestone,
  GhProject,
  GhProjectItem,
  GhSubIssue,
} from './client.js';
export { GitHubClient } from './client.js';
export { createDefaultConfig, loadConfig, saveConfig } from './config.js';
export { applyResolutions, resolveConflicts } from './conflict.js';
export {
  diffByHash,
  diffEntity,
  remoteIssueFields,
  remoteMilestoneFields,
} from './diff.js';
export { exportToGitHub } from './export.js';
export { importFromGitHub } from './import.js';
export type { LinkContext, LinkResult } from './linker.js';
export { resolveEpicLink } from './linker.js';
export type { CreateIssueParams, CreateMilestoneParams } from './mapper.js';
export {
  determineFilePath,
  entityToGhIssue,
  extractPriority,
  ghIssueToEntity,
  ghMilestoneToMilestone,
  isEpicIssue,
  milestoneToGhMilestone,
} from './mapper.js';

export {
  computeContentHash,
  createInitialState,
  loadState,
  saveState,
} from './state.js';
export { syncWithGitHub } from './sync.js';

export type {
  ConflictStrategy,
  DiffResult,
  DiffStatus,
  ExportOptions,
  ExportResult,
  FieldChange,
  FieldConflict,
  GitHubConfig,
  ImportOptions,
  ImportResult,
  LinkStrategy,
  Resolution,
  SyncOptions,
  SyncResult,
  SyncState,
  SyncStateEntry,
} from './types.js';

export {
  DEFAULT_EPIC_LABELS,
  DEFAULT_PRIORITY_MAPPING,
  DEFAULT_STATUS_MAPPING,
} from './types.js';
