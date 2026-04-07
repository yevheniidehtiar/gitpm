import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
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
    } catch {
      // File doesn't exist or can't be loaded, try next
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
    const resolvedPath = isAbsolute(adapterPath)
      ? adapterPath
      : resolve(rootDir ?? process.cwd(), adapterPath);
    const fileUrl = pathToFileURL(resolvedPath).href;
    mod = await import(fileUrl);
  } else {
    mod = await import(adapterPath);
  }

  // Look for a named export that is a SyncAdapter
  for (const value of Object.values(mod)) {
    if (isSyncAdapter(value)) {
      return value;
    }
  }

  // Check default export
  if (mod.default && isSyncAdapter(mod.default)) {
    return mod.default;
  }

  return null;
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
      const resolvedPath = isAbsolute(hookPath)
        ? hookPath
        : resolve(rootDir ?? process.cwd(), hookPath);
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
