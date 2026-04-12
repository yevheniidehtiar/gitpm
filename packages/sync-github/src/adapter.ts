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
    const token = options.token ?? options.credentials?.token;
    if (!token) {
      return {
        ok: false as const,
        error: new Error('GitHub token is required'),
      };
    }
    const repo = (options.repo as string) ?? options.credentials?.repo;
    if (!repo) {
      return {
        ok: false as const,
        error: new Error('GitHub repo is required (owner/repo)'),
      };
    }
    return importFromGitHub({
      token,
      repo,
      projectNumber: options.projectNumber as number | undefined,
      metaDir: options.metaDir,
      linkStrategy: options.linkStrategy as
        | 'body-refs'
        | 'sub-issues'
        | 'milestone'
        | 'labels'
        | 'score'
        | 'all'
        | undefined,
    });
  },

  async export(options: AdapterExportOptions) {
    const token = options.token ?? options.credentials?.token;
    if (!token) {
      return {
        ok: false as const,
        error: new Error('GitHub token is required'),
      };
    }
    const config = await loadConfig(options.metaDir);
    const repo =
      (options.repo as string) ??
      options.credentials?.repo ??
      (config.ok ? config.value.repo : undefined);
    if (!repo) {
      return {
        ok: false as const,
        error: new Error('GitHub repo is required (owner/repo)'),
      };
    }

    return exportToGitHub({
      token,
      repo,
      metaDir: options.metaDir,
      dryRun: options.dryRun,
    });
  },

  async sync(options: AdapterSyncOptions) {
    const token = options.token ?? options.credentials?.token;
    if (!token) {
      return {
        ok: false as const,
        error: new Error('GitHub token is required'),
      };
    }
    const config = await loadConfig(options.metaDir);
    const repo =
      (options.repo as string) ??
      options.credentials?.repo ??
      (config.ok ? config.value.repo : undefined);
    if (!repo) {
      return {
        ok: false as const,
        error: new Error('GitHub repo is required (owner/repo)'),
      };
    }

    return syncWithGitHub({
      token,
      repo,
      metaDir: options.metaDir,
      strategy: options.strategy,
      dryRun: options.dryRun,
    });
  },
};
