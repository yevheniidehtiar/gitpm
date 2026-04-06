import type {
  AdapterExportOptions,
  AdapterImportOptions,
  AdapterSyncOptions,
  SyncAdapter,
} from '@gitpm/core';
import { loadConfig } from './config.js';
import { exportToJira } from './export.js';
import { importFromJira } from './import.js';
import { syncWithJira } from './sync.js';

export const jiraAdapter: SyncAdapter = {
  name: 'jira',
  displayName: 'Jira',

  async detect(metaDir: string): Promise<boolean> {
    const config = await loadConfig(metaDir);
    return config.ok;
  },

  async import(options: AdapterImportOptions) {
    return importFromJira({
      email: (options.email as string) ?? options.credentials?.email ?? '',
      apiToken:
        options.token ??
        (options.apiToken as string) ??
        options.credentials?.apiToken ??
        '',
      site: (options.site as string) ?? options.credentials?.site ?? '',
      projectKey:
        (options.projectKey as string) ?? options.credentials?.projectKey ?? '',
      metaDir: options.metaDir,
      boardId: options.boardId as number | undefined,
    });
  },

  async export(options: AdapterExportOptions) {
    const config = await loadConfig(options.metaDir);

    return exportToJira({
      email: (options.email as string) ?? options.credentials?.email ?? '',
      apiToken:
        options.token ??
        (options.apiToken as string) ??
        options.credentials?.apiToken ??
        '',
      site:
        (options.site as string) ??
        options.credentials?.site ??
        (config.ok ? config.value.site : ''),
      projectKey:
        (options.projectKey as string) ??
        options.credentials?.projectKey ??
        (config.ok ? config.value.project_key : ''),
      metaDir: options.metaDir,
      dryRun: options.dryRun,
    });
  },

  async sync(options: AdapterSyncOptions) {
    const config = await loadConfig(options.metaDir);

    return syncWithJira({
      email: (options.email as string) ?? options.credentials?.email ?? '',
      apiToken:
        options.token ??
        (options.apiToken as string) ??
        options.credentials?.apiToken ??
        '',
      site:
        (options.site as string) ??
        options.credentials?.site ??
        (config.ok ? config.value.site : ''),
      projectKey:
        (options.projectKey as string) ??
        options.credentials?.projectKey ??
        (config.ok ? config.value.project_key : ''),
      metaDir: options.metaDir,
      strategy: options.strategy,
      dryRun: options.dryRun,
    });
  },
};
