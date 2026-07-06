export { linearAdapter } from './adapter.js';

export type {
  CreateLinearIssueParams,
  LinearClientOptions,
  LinearCycle,
  LinearIssue,
  LinearProject,
  LinearTeam,
  LinearWorkflowState,
  UpdateLinearIssueParams,
} from './client.js';
export { LinearClient } from './client.js';
export { createDefaultConfig, loadConfig, saveConfig } from './config.js';
export { applyResolutions, resolveConflicts } from './conflict.js';
export {
  diffByHash,
  diffEntity,
  remoteCycleFields,
  remoteIssueFields,
} from './diff.js';
export { buildStateIdMap, exportToLinear } from './export.js';
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
  milestoneToLinearCycle,
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
