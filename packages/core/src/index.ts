export type {
  AdapterExportOptions,
  AdapterImportOptions,
  AdapterSyncOptions,
  ConflictStrategy,
  DiffResult,
  DiffStatus,
  ExportResult,
  FieldChange,
  FieldConflict,
  ImportResult,
  Resolution,
  SyncAdapter,
  SyncResult,
} from './adapter.js';
export { isSyncAdapter } from './adapter.js';
export type {
  AuditConfig,
  AuditItem,
  AuditReport,
  DuplicatePair,
} from './analytics/audit.js';
export { auditTree } from './analytics/audit.js';
export type {
  GraphData,
  GraphEdge,
  GraphNode,
} from './analytics/graph-data.js';
export { buildGraphData } from './analytics/graph-data.js';
export type {
  EpicProgress,
  MilestoneProgress,
  ProjectProgress,
} from './analytics/progress.js';
export {
  computeEpicProgress,
  computeMilestoneProgress,
  computeProjectProgress,
} from './analytics/progress.js';
export type {
  ArchiveOptions,
  ArchiveResult,
} from './archiver/index.js';
export { archiveOldEntities } from './archiver/index.js';
export type { GitpmConfig, HookEvent } from './config.js';

export {
  createDefaultGitpmConfig,
  gitpmConfigSchema,
  HOOK_EVENTS,
  hookEventSchema,
} from './config.js';
export type { MetaTree, ParsedEntity, ParseError } from './parser/index.js';
export { parseFile, parseFileContent, parseTree } from './parser/index.js';
export type { HookContext } from './plugin-loader.js';
export {
  detectAdapter,
  findAdapterByName,
  loadAdapters,
  loadGitpmConfig,
  runHooks,
} from './plugin-loader.js';
export type {
  EntityScore,
  GradeSummary,
  QualityConfig,
  QualityReport,
  ScoreBreakdown,
} from './quality/index.js';
export {
  loadQualityConfig,
  scoreEntities,
} from './quality/index.js';
export type { FormatOptions, QueryFilter } from './query/index.js';
export { filterEntities, formatEntities } from './query/index.js';
export type {
  DependencyGraph,
  ResolvedEpic,
  ResolvedMilestone,
  ResolvedPrd,
  ResolvedRoadmap,
  ResolvedSprint,
  ResolvedStory,
  ResolvedTree,
} from './resolver/index.js';
export { buildDependencyGraph, resolveRefs } from './resolver/index.js';
export * from './schemas/index.js';
export type {
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from './validator/index.js';
export { validateTree } from './validator/index.js';
export type {
  CreateEpicOptions,
  CreateMilestoneOptions,
  CreateResult,
  CreateSprintOptions,
  CreateStoryOptions,
  FieldAssignment,
  MoveOptions,
  MoveResult,
} from './writer/index.js';
export {
  applyAssignments,
  createEpic,
  createMilestone,
  createSprint,
  createStory,
  moveStory,
  parseAssignment,
  scaffoldMeta,
  toSlug,
  writeFile,
  writeTree,
} from './writer/index.js';
