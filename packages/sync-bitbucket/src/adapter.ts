import type {
  AdapterExportOptions,
  AdapterImportOptions,
  AdapterSyncOptions,
  Result,
  SyncAdapter,
} from '@gitpm/core';
import type { BitbucketAuth } from './client.js';
import type { BitbucketConfig } from './config.js';
import { epicLinkageSchema, loadConfig } from './config.js';
import { exportToBitbucket } from './export.js';
import { importFromBitbucket } from './import.js';
import { syncWithBitbucket } from './sync.js';

type AdapterOptions =
  | AdapterImportOptions
  | AdapterExportOptions
  | AdapterSyncOptions;

interface Target {
  auth: BitbucketAuth;
  workspace: string;
  repoSlug: string;
  baseUrl?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * An `email` alongside the token means an Atlassian API token (HTTP Basic);
 * a bare token is a workspace or repository access token (Bearer).
 */
function resolveAuth(options: AdapterOptions): Result<BitbucketAuth> {
  const token = options.token ?? options.credentials?.token;
  if (!token) {
    return { ok: false, error: new Error('Bitbucket token is required') };
  }
  const email = str(options.email) ?? options.credentials?.email;
  return {
    ok: true,
    value: email ? { kind: 'basic', email, token } : { kind: 'bearer', token },
  };
}

/**
 * Workspace and repo come from explicit `workspace`/`repoSlug`, then a
 * `repo` or `project` of the form `workspace/repo_slug`, then credentials,
 * then the config file.
 */
function resolveTarget(
  options: AdapterOptions,
  config: BitbucketConfig | undefined,
): Result<Target> {
  const auth = resolveAuth(options);
  if (!auth.ok) return auth;

  const [pathWorkspace, pathRepo] = (
    str(options.repo) ??
    str(options.project) ??
    ''
  ).split('/');
  const workspace =
    str(options.workspace) ??
    str(pathWorkspace) ??
    options.credentials?.workspace ??
    config?.workspace;
  const repoSlug =
    str(options.repoSlug) ??
    str(pathRepo) ??
    options.credentials?.repo_slug ??
    config?.repo_slug;
  if (!workspace || !repoSlug) {
    return {
      ok: false,
      error: new Error(
        'Bitbucket repository is required (workspace/repo_slug)',
      ),
    };
  }
  return {
    ok: true,
    value: {
      auth: auth.value,
      workspace,
      repoSlug,
      baseUrl: str(options.baseUrl) ?? config?.base_url,
    },
  };
}

export const bitbucketAdapter: SyncAdapter = {
  name: 'bitbucket',
  displayName: 'Bitbucket',

  async detect(metaDir: string): Promise<boolean> {
    const config = await loadConfig(metaDir);
    return config.ok;
  },

  async import(options: AdapterImportOptions) {
    const loaded = await loadConfig(options.metaDir);
    const config = loaded.ok ? loaded.value : undefined;
    const target = resolveTarget(options, config);
    if (!target.ok) return target;
    const linkage = epicLinkageSchema.safeParse(options.linkStrategy);
    return importFromBitbucket({
      ...target.value,
      metaDir: options.metaDir,
      config,
      epicLinkage: linkage.success ? linkage.data : undefined,
    });
  },

  async export(options: AdapterExportOptions) {
    const loaded = await loadConfig(options.metaDir);
    const target = resolveTarget(options, loaded.ok ? loaded.value : undefined);
    if (!target.ok) return target;
    if (!loaded.ok) return loaded;
    return exportToBitbucket({
      ...target.value,
      metaDir: options.metaDir,
      config: loaded.value,
      dryRun: options.dryRun,
    });
  },

  async sync(options: AdapterSyncOptions) {
    const loaded = await loadConfig(options.metaDir);
    const target = resolveTarget(options, loaded.ok ? loaded.value : undefined);
    if (!target.ok) return target;
    if (!loaded.ok) return loaded;
    return syncWithBitbucket({
      ...target.value,
      metaDir: options.metaDir,
      config: loaded.value,
      strategy: options.strategy,
      dryRun: options.dryRun,
    });
  },
};
