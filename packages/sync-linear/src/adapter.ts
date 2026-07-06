import type {
  AdapterExportOptions,
  AdapterImportOptions,
  AdapterSyncOptions,
  SyncAdapter,
} from '@gitpm/core';
import { loadConfig } from './config.js';
import { exportToLinear } from './export.js';
import { importFromLinear } from './import.js';
import { syncWithLinear } from './sync.js';

export const linearAdapter: SyncAdapter = {
  name: 'linear',
  displayName: 'Linear',

  async detect(metaDir: string): Promise<boolean> {
    const config = await loadConfig(metaDir);
    return config.ok;
  },

  async import(options: AdapterImportOptions) {
    const apiKey =
      (options.apiKey as string) ??
      options.credentials?.apiKey ??
      options.token;
    if (!apiKey) {
      return {
        ok: false as const,
        error: new Error('Linear API key is required'),
      };
    }
    const teamId = (options.teamId as string) ?? options.credentials?.teamId;
    if (!teamId) {
      return {
        ok: false as const,
        error: new Error('Linear team ID is required'),
      };
    }
    return importFromLinear({
      apiKey,
      teamId,
      metaDir: options.metaDir,
    });
  },

  async export(options: AdapterExportOptions) {
    const apiKey =
      (options.apiKey as string) ??
      options.credentials?.apiKey ??
      options.token;
    if (!apiKey) {
      return {
        ok: false as const,
        error: new Error('Linear API key is required'),
      };
    }
    const config = await loadConfig(options.metaDir);
    const teamId =
      (options.teamId as string) ??
      options.credentials?.teamId ??
      (config.ok ? config.value.team_id : undefined);
    if (!teamId) {
      return {
        ok: false as const,
        error: new Error('Linear team ID is required'),
      };
    }

    return exportToLinear({
      apiKey,
      teamId,
      metaDir: options.metaDir,
      dryRun: options.dryRun,
    });
  },

  async sync(options: AdapterSyncOptions) {
    const apiKey =
      (options.apiKey as string) ??
      options.credentials?.apiKey ??
      options.token;
    if (!apiKey) {
      return {
        ok: false as const,
        error: new Error('Linear API key is required'),
      };
    }
    const config = await loadConfig(options.metaDir);
    const teamId =
      (options.teamId as string) ??
      options.credentials?.teamId ??
      (config.ok ? config.value.team_id : undefined);
    if (!teamId) {
      return {
        ok: false as const,
        error: new Error('Linear team ID is required'),
      };
    }

    return syncWithLinear({
      apiKey,
      teamId,
      metaDir: options.metaDir,
      strategy: options.strategy,
      dryRun: options.dryRun,
    });
  },
};
