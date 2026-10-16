export { linearAdapter } from './adapter.js';
export type {
  CreateLinearIssueParams,
  LinearApiError,
  LinearClientOptions,
  LinearCycle,
  LinearIssue,
  LinearProject,
  LinearTeam,
  LinearUser,
  LinearWorkflowState,
  UpdateLinearIssueParams,
} from './client.js';
export { isNotFoundError, LinearClient } from './client.js';
export { createDefaultConfig, loadConfig, saveConfig } from './config.js';
export { applyResolutions, resolveConflicts } from './conflict.js';
export {
  computeRemoteIssueHash,
  diffByHash,
  diffEntity,
  remoteIssueFields,
} from './diff.js';
export { exportToLinear } from './export.js';
export { importFromLinear } from './import.js';
export type { CreateLinearIssueFromEntity } from './mapper.js';
export {
  determineFilePath,
  entityToLinearIssue,
  isEpicIssue,
  linearCycleToMilestone,
  linearIssueToEntity,
  mapLinearPriority,
  mapLinearState,
} from './mapper.js';

export {
  computeContentHash,
  createInitialState,
  loadState,
  saveState,
} from './state.js';
export { syncWithLinear } from './sync.js';

export type {
  ConflictStrategy,
  DiffResult,
  DiffStatus,
  ExportResult,
  FieldChange,
  FieldConflict,
  ImportResult,
  LinearConfig,
  LinearExportOptions,
  LinearImportOptions,
  LinearSyncOptions,
  LinearSyncState,
  LinearSyncStateEntry,
  Resolution,
  SyncResult,
} from './types.js';

export { DEFAULT_STATUS_MAPPING } from './types.js';
