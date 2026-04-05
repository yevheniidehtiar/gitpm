export { GitLabClient } from './client.js';
export type {
  GlMilestone,
  GlIssue,
  GlEpic,
  GlProject,
  GlLabel,
} from './client.js';

export {
  glMilestoneToMilestone,
  glIssueToEntity,
  glEpicToEpic,
  isEpicIssue,
  determineFilePath,
  milestoneToGlMilestone,
  entityToGlIssue,
} from './mapper.js';
export type { CreateMilestoneParams, CreateIssueParams } from './mapper.js';

export { importFromGitLab } from './import.js';
export { exportToGitLab } from './export.js';
export { syncWithGitLab } from './sync.js';

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
  GitLabConfig,
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
} from './types.js';
