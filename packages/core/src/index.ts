export type { MetaTree, ParsedEntity, ParseError } from './parser/index.js';

export { isSyncAdapter } from './adapter.js';
export type {
  SyncAdapter,
  AdapterImportOptions,
  AdapterExportOptions,
  AdapterSyncOptions,
  ImportResult,
  ExportResult,
  SyncResult,
  ConflictStrategy,
  FieldChange,
  FieldConflict,
  DiffStatus,
  DiffResult,
  Resolution,
} from './adapter.js';

export {
  gitpmConfigSchema,
  hookEventSchema,
  createDefaultGitpmConfig,
  HOOK_EVENTS,
} from './config.js';
export type { GitpmConfig, HookEvent } from './config.js';

export {
  loadGitpmConfig,
  loadAdapters,
  detectAdapter,
  findAdapterByName,
  runHooks,
} from './plugin-loader.js';
export type { HookContext } from './plugin-loader.js';

export { parseFile, parseFileContent, parseTree } from './parser/index.js';
export type {
  DependencyGraph,
  ResolvedEpic,
  ResolvedMilestone,
  ResolvedPrd,
  ResolvedRoadmap,
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
export { scaffoldMeta, toSlug, writeFile, writeTree } from './writer/index.js';
