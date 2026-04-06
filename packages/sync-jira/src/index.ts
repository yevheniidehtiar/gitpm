export type {
  CreateJiraIssueParams,
  JiraBoard,
  JiraClientOptions,
  JiraIssue,
  JiraProject,
  JiraSprint,
  JiraTransition,
  UpdateJiraIssueParams,
} from './client.js';
export { JiraClient } from './client.js';
export { createDefaultConfig, loadConfig, saveConfig } from './config.js';
export { applyResolutions, resolveConflicts } from './conflict.js';
export {
  diffByHash,
  diffEntity,
  remoteIssueFields,
  remoteSprintFields,
} from './diff.js';
export { exportToJira } from './export.js';
export { importFromJira } from './import.js';
export type { CreateJiraIssueFromEntity } from './mapper.js';
export {
  determineFilePath,
  entityToJiraIssue,
  isEpicIssue,
  jiraIssueToEntity,
  jiraSprintToMilestone,
  mapJiraPriority,
  mapJiraStatus,
  milestoneToJiraSprint,
} from './mapper.js';

export {
  computeContentHash,
  createInitialState,
  loadState,
  saveState,
} from './state.js';
export { syncWithJira } from './sync.js';

export type {
  ConflictStrategy,
  DiffResult,
  DiffStatus,
  ExportResult,
  FieldChange,
  FieldConflict,
  ImportResult,
  JiraConfig,
  JiraExportOptions,
  JiraImportOptions,
  JiraSyncOptions,
  JiraSyncState,
  JiraSyncStateEntry,
  Resolution,
  SyncResult,
} from './types.js';

export { DEFAULT_EPIC_TYPES, DEFAULT_STATUS_MAPPING } from './types.js';
