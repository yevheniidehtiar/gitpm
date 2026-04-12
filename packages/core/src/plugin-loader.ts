import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SyncAdapter } from './adapter.js';
import { isSyncAdapter } from './adapter.js';
import type { GitpmConfig, HookEvent } from './config.js';
import { createDefaultGitpmConfig, gitpmConfigSchema } from './config.js';
import type { Result } from './schemas/common.js';

const CONFIG_FILENAMES = [
  'gitpm.config.ts',
  'gitpm.config.js',
  'gitpm.config.mjs',
  'gitpm.config.json',
];

export interface HookContext {
  metaDir: string;
  event: HookEvent;
  adapterName?: string;
}

/**
 * Load gitpm.config from the project root directory.
 * Falls back to default config if no config file is found.
 */
export async function loadGitpmConfig(
  rootDir: string,
): Promise<Result<GitpmConfig>> {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = join(rootDir, filename);
    try {
      if (filename.endsWith('.json')) {
        const raw = await readFile(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        const validated = gitpmConfigSchema.safeParse(parsed);
        if (!validated.success) {
          return {
            ok: false,
            error: new Error(
              `Invalid config in ${configPath}: ${validated.error.message}`,
            ),
          };
        }
        return { ok: true, value: validated.data };
      }

      const fileUrl = pathToFileURL(resolve(configPath)).href;
      const mod = await import(fileUrl);
      const configData = mod.default ?? mod;
      const validated = gitpmConfigSchema.safeParse(configData);
      if (!validated.success) {
        return {
          ok: false,
          error: new Error(
            `Invalid config in ${configPath}: ${validated.error.message}`,
          ),
        };
      }
      return { ok: true, value: validated.data };
    } catch (err) {
      // Only skip file-not-found errors; surface other errors
      if (
        err instanceof Error &&
        (err.message.includes('ENOENT') ||
          err.message.includes('Cannot find module') ||
          err.message.includes('ERR_MODULE_NOT_FOUND'))
      ) {
        continue;
      }
      return {
        ok: false,
        error: new Error(
          `Failed to load config ${configPath}: ${err instanceof Error ? err.message : err}`,
        ),
      };
    }
  }

  // No config file found — use defaults
  return { ok: true, value: createDefaultGitpmConfig() };
}

/**
 * Dynamically load adapter modules and extract SyncAdapter objects.
 * Supports npm package names (e.g. "@gitpm/sync-github") and
 * relative/absolute paths (e.g. "./custom-adapter.ts").
 *
 * Adapters that are npm packages and not installed are silently skipped
 * (they are treated as optional). Relative/absolute path adapters that
 * fail to load are reported as errors.
 */
export async function loadAdapters(
  config: GitpmConfig,
  rootDir?: string,
): Promise<Result<SyncAdapter[]>> {
  const adapters: SyncAdapter[] = [];
  const errors: string[] = [];

  for (const adapterPath of config.adapters) {
    try {
      const adapter = await loadSingleAdapter(adapterPath, rootDir);
      if (adapter) {
        adapters.push(adapter);
      } else {
        errors.push(
          `Module "${adapterPath}" does not export a valid SyncAdapter`,
        );
      }
    } catch (err) {
      // If this is an npm package (not a relative/absolute path) and
      // the error is "module not found", skip silently — it's optional.
      const isNpmPackage =
        !adapterPath.startsWith('.') && !isAbsolute(adapterPath);
      if (isNpmPackage && isModuleNotFoundError(err)) {
        // Package not installed — skip silently
      } else {
        errors.push(
          `Failed to load adapter "${adapterPath}": ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  if (adapters.length === 0 && errors.length > 0) {
    return {
      ok: false,
      error: new Error(`No adapters could be loaded:\n${errors.join('\n')}`),
    };
  }

  return { ok: true, value: adapters };
}

function isModuleNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes('Cannot find package') ||
    msg.includes('Cannot find module') ||
    msg.includes('MODULE_NOT_FOUND') ||
    msg.includes('ERR_MODULE_NOT_FOUND') ||
    msg.includes('Failed to load url') ||
    msg.includes('is not installed')
  );
}

async function loadSingleAdapter(
  adapterPath: string,
  rootDir?: string,
): Promise<SyncAdapter | null> {
  let mod: Record<string, unknown>;

  if (adapterPath.startsWith('.') || isAbsolute(adapterPath)) {
    const base = resolve(rootDir ?? process.cwd());
    const resolvedPath = isAbsolute(adapterPath)
      ? resolve(adapterPath)
      : resolve(base, adapterPath);
    if (!resolvedPath.startsWith(base)) {
      throw new Error(
        `Adapter path "${adapterPath}" resolves outside the project root`,
      );
    }
    const fileUrl = pathToFileURL(resolvedPath).href;
    mod = await import(fileUrl);
  } else {
    // Try the standard bare import first (works when packages are in a
    // standard node_modules tree reachable from this module's location).
    try {
      mod = await import(adapterPath);
    } catch {
      // Bare import failed — search for the package in node_modules trees
      // under the project root. In workspace monorepos (especially Bun),
      // packages are symlinked into consuming packages' node_modules
      // (e.g. packages/cli/node_modules/@gitpm/sync-github) rather than
      // the root node_modules, so Node can't find them from core's location.
      const base = resolve(rootDir ?? process.cwd());
      const entryPath = await findPackageEntry(adapterPath, base);
      if (entryPath) {
        mod = await import(pathToFileURL(entryPath).href);
      } else {
        // Throw a module-not-found error for proper error reporting
        throw new Error(`Cannot find package '${adapterPath}'`);
      }
    }
  }

  // Check default export first (canonical)
  if (mod.default && isSyncAdapter(mod.default)) {
    return mod.default;
  }

  // Fall back to scanning named exports
  for (const value of Object.values(mod)) {
    if (isSyncAdapter(value)) {
      return value;
    }
  }

  return null;
}

/**
 * Search for an npm package's ESM entry point in node_modules directories.
 * Handles workspace monorepos where packages may be symlinked into nested
 * node_modules (e.g. packages/cli/node_modules/@scope/pkg).
 */
export async function findPackageEntry(
  packageName: string,
  rootDir: string,
): Promise<string | null> {
  const checked = new Set<string>();

  // 1. Walk up from rootDir checking node_modules at each level
  let dir = rootDir;
  while (true) {
    const candidate = join(dir, 'node_modules', packageName);
    if (!checked.has(candidate)) {
      checked.add(candidate);
      const entry = await getPackageEntry(candidate);
      if (entry) return entry;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 2. Scan workspace packages (packages/*/node_modules/<pkg>)
  const packagesDir = join(rootDir, 'packages');
  try {
    const children = await readdir(packagesDir);
    for (const child of children) {
      const candidate = join(packagesDir, child, 'node_modules', packageName);
      if (!checked.has(candidate)) {
        checked.add(candidate);
        const entry = await getPackageEntry(candidate);
        if (entry) return entry;
      }
    }
  } catch {
    // packages dir missing or not readable — skip
  }

  return null;
}

/**
 * Read a package directory's package.json and return the resolved ESM entry path.
 * Handles both object-form and string-form exports, plus the 'default' condition.
 */
export async function getPackageEntry(
  packageDir: string,
): Promise<string | null> {
  const pkgJsonPath = join(packageDir, 'package.json');
  try {
    await access(pkgJsonPath);
  } catch {
    return null;
  }
  try {
    const raw = await readFile(pkgJsonPath, 'utf-8');
    const pkg = JSON.parse(raw);
    const entry =
      resolveExportsEntry(pkg.exports) || pkg.module || pkg.main || 'index.js';
    return resolve(packageDir, entry);
  } catch {
    return null;
  }
}

/**
 * Resolve the ESM entry point from a package.json exports field.
 * Handles object-form ({".": {"import": "..."}}) and string-form ({".": "..."})
 * as well as the 'default' condition key.
 */
export function resolveExportsEntry(exports: unknown): string | undefined {
  if (!exports || typeof exports !== 'object') return undefined;
  const dot = (exports as Record<string, unknown>)['.'];
  if (typeof dot === 'string') return dot;
  if (dot && typeof dot === 'object') {
    const conditions = dot as Record<string, unknown>;
    if (typeof conditions.import === 'string') return conditions.import;
    if (typeof conditions.default === 'string') return conditions.default;
  }
  return undefined;
}

/**
 * Auto-detect which adapter is configured for a given .meta directory.
 * Iterates through adapters and returns the first one whose detect() returns true.
 */
export async function detectAdapter(
  adapters: SyncAdapter[],
  metaDir: string,
): Promise<SyncAdapter | null> {
  for (const adapter of adapters) {
    try {
      const detected = await adapter.detect(metaDir);
      if (detected) {
        return adapter;
      }
    } catch {
      // If detect fails, skip this adapter
    }
  }
  return null;
}

/**
 * Find a specific adapter by name from a list of loaded adapters.
 */
export function findAdapterByName(
  adapters: SyncAdapter[],
  name: string,
): SyncAdapter | null {
  return adapters.find((a) => a.name === name) ?? null;
}

/**
 * Run hooks for a given lifecycle event.
 * Hooks are specified in gitpm.config as paths to scripts.
 * Each hook script should export a default function that receives a HookContext.
 */
export async function runHooks(
  config: GitpmConfig,
  event: HookEvent,
  context: HookContext,
  rootDir?: string,
): Promise<Result<void>> {
  const hookPaths = config.hooks[event];
  if (!hookPaths) {
    return { ok: true, value: undefined };
  }

  const paths = Array.isArray(hookPaths) ? hookPaths : [hookPaths];

  for (const hookPath of paths) {
    try {
      const base = resolve(rootDir ?? process.cwd());
      const resolvedPath = isAbsolute(hookPath)
        ? resolve(hookPath)
        : resolve(base, hookPath);
      if (!resolvedPath.startsWith(base)) {
        return {
          ok: false,
          error: new Error(
            `Hook path "${hookPath}" resolves outside the project root`,
          ),
        };
      }
      const fileUrl = pathToFileURL(resolvedPath).href;
      const mod = await import(fileUrl);
      const hookFn = mod.default ?? mod;

      if (typeof hookFn === 'function') {
        await hookFn(context);
      } else {
        return {
          ok: false,
          error: new Error(
            `Hook "${hookPath}" for event "${event}" does not export a function`,
          ),
        };
      }
    } catch (err) {
      return {
        ok: false,
        error: new Error(
          `Hook "${hookPath}" for event "${event}" failed: ${err instanceof Error ? err.message : err}`,
        ),
      };
    }
  }

  return { ok: true, value: undefined };
}
