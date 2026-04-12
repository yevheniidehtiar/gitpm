import { dirname } from 'node:path';
import type { GitpmConfig, SyncAdapter } from '@gitpm/core';
import {
  detectAdapter,
  findAdapterByName,
  loadAdapters,
  loadGitpmConfig,
} from '@gitpm/core';
import { printError } from './output.js';

export interface ResolvedAdapter {
  adapter: SyncAdapter;
  config: GitpmConfig;
}

/**
 * Load config, load adapters, and auto-detect (or find by name) the active adapter.
 * Exits the process if no adapter can be resolved.
 */
export async function resolveAdapter(
  metaDir: string,
  adapterName?: string,
): Promise<ResolvedAdapter> {
  // Load config from project root (parent of .meta)
  const rootDir = dirname(metaDir);
  const configResult = await loadGitpmConfig(rootDir);
  if (!configResult.ok) {
    printError(`Failed to load config: ${configResult.error.message}`);
    process.exit(1);
  }
  const config = configResult.value;

  // Load adapter modules
  const adaptersResult = await loadAdapters(config, rootDir);
  if (!adaptersResult.ok) {
    printError(adaptersResult.error.message);
    printError(
      'No sync adapters installed. Install at least one adapter package, e.g.:\n' +
        '  bun add @gitpm/sync-github\n' +
        '  bun add @gitpm/sync-gitlab\n' +
        '  bun add @gitpm/sync-jira',
    );
    process.exit(1);
  }
  const adapters = adaptersResult.value;

  if (adapters.length === 0) {
    printError(
      'No sync adapters installed. Install at least one adapter package, e.g.:\n' +
        '  bun add @gitpm/sync-github',
    );
    process.exit(1);
  }

  // Resolve by name or auto-detect
  let adapter: SyncAdapter | null = null;

  if (adapterName) {
    adapter = findAdapterByName(adapters, adapterName);
    if (!adapter) {
      printError(
        `Adapter "${adapterName}" not found. Available: ${adapters.map((a) => a.name).join(', ')}`,
      );
      process.exit(1);
    }
  } else {
    adapter = await detectAdapter(adapters, metaDir);
    if (!adapter) {
      printError(
        'No sync config found. Run `gitpm import` first to set up sync.',
      );
      process.exit(1);
    }
  }

  return { adapter, config };
}
