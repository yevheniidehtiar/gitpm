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
    const email = (options.email as string) ?? options.credentials?.email;
    if (!email) {
      return { ok: false as const, error: new Error('Jira email is required') };
    }
    const apiToken =
      (options.apiToken as string) ??
      options.credentials?.apiToken ??
      options.token;
    if (!apiToken) {
      return {
        ok: false as const,
        error: new Error('Jira API token is required'),
      };
    }
    const site = (options.site as string) ?? options.credentials?.site;
    if (!site) {
      return { ok: false as const, error: new Error('Jira site is required') };
    }
    const projectKey =
      (options.projectKey as string) ?? options.credentials?.projectKey;
    if (!projectKey) {
      return {
        ok: false as const,
        error: new Error('Jira project key is required'),
      };
    }
    return importFromJira({
      email,
      apiToken,
      site,
      projectKey,
      metaDir: options.metaDir,
      boardId: options.boardId as number | undefined,
    });
  },

  async export(options: AdapterExportOptions) {
    const email = (options.email as string) ?? options.credentials?.email;
    if (!email) {
      return { ok: false as const, error: new Error('Jira email is required') };
    }
    const apiToken =
      (options.apiToken as string) ??
      options.credentials?.apiToken ??
      options.token;
    if (!apiToken) {
      return {
        ok: false as const,
        error: new Error('Jira API token is required'),
      };
    }
    const config = await loadConfig(options.metaDir);
    const site =
      (options.site as string) ??
      options.credentials?.site ??
      (config.ok ? config.value.site : undefined);
    if (!site) {
      return { ok: false as const, error: new Error('Jira site is required') };
    }
    const projectKey =
      (options.projectKey as string) ??
      options.credentials?.projectKey ??
      (config.ok ? config.value.project_key : undefined);
    if (!projectKey) {
      return {
        ok: false as const,
        error: new Error('Jira project key is required'),
      };
    }

    return exportToJira({
      email,
      apiToken,
      site,
      projectKey,
      metaDir: options.metaDir,
      dryRun: options.dryRun,
    });
  },

  async sync(options: AdapterSyncOptions) {
    const email = (options.email as string) ?? options.credentials?.email;
    if (!email) {
      return { ok: false as const, error: new Error('Jira email is required') };
    }
    const apiToken =
      (options.apiToken as string) ??
      options.credentials?.apiToken ??
      options.token;
    if (!apiToken) {
      return {
        ok: false as const,
        error: new Error('Jira API token is required'),
      };
    }
    const config = await loadConfig(options.metaDir);
    const site =
      (options.site as string) ??
      options.credentials?.site ??
      (config.ok ? config.value.site : undefined);
    if (!site) {
      return { ok: false as const, error: new Error('Jira site is required') };
    }
    const projectKey =
      (options.projectKey as string) ??
      options.credentials?.projectKey ??
      (config.ok ? config.value.project_key : undefined);
    if (!projectKey) {
      return {
        ok: false as const,
        error: new Error('Jira project key is required'),
      };
    }

    return syncWithJira({
      email,
      apiToken,
      site,
      projectKey,
      metaDir: options.metaDir,
      strategy: options.strategy,
      dryRun: options.dryRun,
    });
  },
};
