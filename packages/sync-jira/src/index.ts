export { jiraAdapter } from './adapter.js';

export { JiraClient } from './client.js';
export type {
  JiraIssue,
  JiraSprint,
  JiraProject,
  JiraBoard,
  JiraTransition,
  JiraClientOptions,
  CreateJiraIssueParams,
  UpdateJiraIssueParams,
} from './client.js';

export {
  jiraSprintToMilestone,
  jiraIssueToEntity,
  isEpicIssue,
  determineFilePath,
  entityToJiraIssue,
  milestoneToJiraSprint,
  mapJiraStatus,
  mapJiraPriority,
} from './mapper.js';
export type { CreateJiraIssueFromEntity } from './mapper.js';

export { importFromJira } from './import.js';
export { exportToJira } from './export.js';
export { syncWithJira } from './sync.js';

export {
  diffEntity,
  diffByHash,
  remoteIssueFields,
  remoteSprintFields,
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
  JiraImportOptions,
  ImportResult,
  JiraExportOptions,
  ExportResult,
  JiraSyncOptions,
  SyncResult,
  JiraConfig,
  JiraSyncState,
  JiraSyncStateEntry,
  ConflictStrategy,
  FieldChange,
  FieldConflict,
  DiffResult,
  DiffStatus,
  Resolution,
} from './types.js';

export { DEFAULT_STATUS_MAPPING, DEFAULT_EPIC_TYPES } from './types.js';
