import type {
  AdapterExportOptions,
  AdapterImportOptions,
  AdapterSyncOptions,
  SyncAdapter,
} from '@gitpm/core';
import { loadConfig } from './config.js';
import { exportToGitLab } from './export.js';
import { importFromGitLab } from './import.js';
import { syncWithGitLab } from './sync.js';

export const gitlabAdapter: SyncAdapter = {
  name: 'gitlab',
  displayName: 'GitLab',

  async detect(metaDir: string): Promise<boolean> {
    const config = await loadConfig(metaDir);
    return config.ok;
  },

  async import(options: AdapterImportOptions) {
    const token = options.token ?? options.credentials?.token;
    if (!token) {
      return {
        ok: false as const,
        error: new Error('GitLab token is required'),
      };
    }
    const project = (options.project as string) ?? options.credentials?.project;
    if (!project) {
      return {
        ok: false as const,
        error: new Error('GitLab project is required (namespace/project)'),
      };
    }
    return importFromGitLab({
      token,
      project,
      projectId: options.projectId as number | undefined,
      groupId: options.groupId as number | undefined,
      baseUrl: options.baseUrl as string | undefined,
      metaDir: options.metaDir,
      linkStrategy: options.linkStrategy as
        | 'body-refs'
        | 'native-epics'
        | 'milestone'
        | 'labels'
        | 'all'
        | undefined,
    });
  },

  async export(options: AdapterExportOptions) {
    const token = options.token ?? options.credentials?.token;
    if (!token) {
      return {
        ok: false as const,
        error: new Error('GitLab token is required'),
      };
    }
    const config = await loadConfig(options.metaDir);
    const project =
      (options.project as string) ??
      options.credentials?.project ??
      (config.ok ? config.value.project : undefined);
    if (!project) {
      return {
        ok: false as const,
        error: new Error('GitLab project is required (namespace/project)'),
      };
    }

    return exportToGitLab({
      token,
      project,
      projectId: config.ok ? config.value.project_id : undefined,
      groupId: config.ok ? config.value.group_id : undefined,
      baseUrl: config.ok ? config.value.base_url : undefined,
      metaDir: options.metaDir,
      dryRun: options.dryRun,
    });
  },

  async sync(options: AdapterSyncOptions) {
    const token = options.token ?? options.credentials?.token;
    if (!token) {
      return {
        ok: false as const,
        error: new Error('GitLab token is required'),
      };
    }
    const config = await loadConfig(options.metaDir);
    const project =
      (options.project as string) ??
      options.credentials?.project ??
      (config.ok ? config.value.project : undefined);
    if (!project) {
      return {
        ok: false as const,
        error: new Error('GitLab project is required (namespace/project)'),
      };
    }

    return syncWithGitLab({
      token,
      project,
      projectId: config.ok ? config.value.project_id : undefined,
      groupId: config.ok ? config.value.group_id : undefined,
      baseUrl: config.ok ? config.value.base_url : undefined,
      metaDir: options.metaDir,
      strategy: options.strategy,
      dryRun: options.dryRun,
    });
  },
};
