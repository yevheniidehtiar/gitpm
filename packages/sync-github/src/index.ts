export { GitHubClient } from './client.js';
export type {
  GhMilestone,
  GhIssue,
  GhSubIssue,
  GhProject,
  GhProjectItem,
} from './client.js';

export {
  ghMilestoneToMilestone,
  ghIssueToEntity,
  isEpicIssue,
  extractPriority,
  determineFilePath,
  milestoneToGhMilestone,
  entityToGhIssue,
} from './mapper.js';
export type { CreateMilestoneParams, CreateIssueParams } from './mapper.js';

export { importFromGitHub } from './import.js';
export { exportToGitHub } from './export.js';
export { syncWithGitHub } from './sync.js';

export { resolveEpicLink } from './linker.js';
export type { LinkContext, LinkResult } from './linker.js';

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
  LinkStrategy,
} from './types.js';

export {
  DEFAULT_STATUS_MAPPING,
  DEFAULT_EPIC_LABELS,
  DEFAULT_PRIORITY_MAPPING,
} from './types.js';
