export type {
  GlEpic,
  GlIssue,
  GlLabel,
  GlMilestone,
  GlProject,
} from './client.js';
export { GitLabClient } from './client.js';
export { createDefaultConfig, loadConfig, saveConfig } from './config.js';
export { applyResolutions, resolveConflicts } from './conflict.js';
export {
  diffByHash,
  diffEntity,
  remoteIssueFields,
  remoteMilestoneFields,
} from './diff.js';
export { exportToGitLab } from './export.js';
export { importFromGitLab } from './import.js';
export type { LinkContext, LinkResult } from './linker.js';
export { resolveEpicLink } from './linker.js';
export type { CreateIssueParams, CreateMilestoneParams } from './mapper.js';
export {
  determineFilePath,
  entityToGlIssue,
  glEpicToEpic,
  glIssueToEntity,
  glMilestoneToMilestone,
  isEpicIssue,
  milestoneToGlMilestone,
} from './mapper.js';

export {
  computeContentHash,
  createInitialState,
  loadState,
  saveState,
} from './state.js';
export { syncWithGitLab } from './sync.js';

export type {
  ConflictStrategy,
  DiffResult,
  DiffStatus,
  ExportOptions,
  ExportResult,
  FieldChange,
  FieldConflict,
  GitLabConfig,
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
  DEFAULT_STATUS_MAPPING,
} from './types.js';
