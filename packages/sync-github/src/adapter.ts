import type {
  AdapterExportOptions,
  AdapterImportOptions,
  AdapterSyncOptions,
  SyncAdapter,
} from '@gitpm/core';
import { loadConfig } from './config.js';
import { exportToGitHub } from './export.js';
import { importFromGitHub } from './import.js';
import { syncWithGitHub } from './sync.js';

export const githubAdapter: SyncAdapter = {
  name: 'github',
  displayName: 'GitHub',

  async detect(metaDir: string): Promise<boolean> {
    const config = await loadConfig(metaDir);
    return config.ok;
  },

  async import(options: AdapterImportOptions) {
    return importFromGitHub({
      token: options.token ?? options.credentials?.token ?? '',
      repo: (options.repo as string) ?? options.credentials?.repo ?? '',
      projectNumber: options.projectNumber as number | undefined,
      metaDir: options.metaDir,
      linkStrategy: options.linkStrategy as
        | 'body-refs'
        | 'sub-issues'
        | 'milestone'
        | 'labels'
        | 'all'
        | undefined,
    });
  },

  async export(options: AdapterExportOptions) {
    const config = await loadConfig(options.metaDir);
    const repo =
      (options.repo as string) ??
      options.credentials?.repo ??
      (config.ok ? config.value.repo : '');

    return exportToGitHub({
      token: options.token ?? options.credentials?.token ?? '',
      repo,
      metaDir: options.metaDir,
      dryRun: options.dryRun,
    });
  },

  async sync(options: AdapterSyncOptions) {
    const config = await loadConfig(options.metaDir);
    const repo =
      (options.repo as string) ??
      options.credentials?.repo ??
      (config.ok ? config.value.repo : '');

    return syncWithGitHub({
      token: options.token ?? options.credentials?.token ?? '',
      repo,
      metaDir: options.metaDir,
      strategy: options.strategy,
      dryRun: options.dryRun,
    });
  },
};
