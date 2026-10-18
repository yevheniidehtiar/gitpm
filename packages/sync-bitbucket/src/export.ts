import type { ExportResult, Result } from '@gitpm/core';
import type { BitbucketAuth, BitbucketClient } from './client.js';
import type { BitbucketConfig } from './config.js';

export interface BitbucketExportOptions {
  auth: BitbucketAuth;
  workspace: string;
  repoSlug: string;
  /** REST 2.0 root; defaults to `config.base_url`, then DEFAULT_BASE_URL. */
  baseUrl?: string;
  metaDir: string;
  /** Loaded `.meta/sync/bitbucket-config.yaml`; export requires one. */
  config: BitbucketConfig;
  dryRun?: boolean;
  /** Injected for tests; built from `auth` and `baseUrl` when omitted. */
  client?: BitbucketClient;
}

/**
 * Create or update Bitbucket issues from `.meta/` stories and epics.
 *
 * Stub: implemented by story #287.
 */
export async function exportToBitbucket(
  _options: BitbucketExportOptions,
): Promise<Result<ExportResult>> {
  return { ok: false, error: new Error('not implemented') };
}
