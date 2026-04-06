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
export type { MetaTree, ParseError, ParsedEntity } from './parser/index.js';

export { writeFile, writeTree, scaffoldMeta, toSlug } from './writer/index.js';

export { resolveRefs, buildDependencyGraph } from './resolver/index.js';
export type {
  ResolvedTree,
  ResolvedStory,
  ResolvedEpic,
  ResolvedMilestone,
  ResolvedRoadmap,
  ResolvedPrd,
  DependencyGraph,
} from './resolver/index.js';

export { validateTree } from './validator/index.js';
export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './validator/index.js';

export * from './schemas/index.js';
