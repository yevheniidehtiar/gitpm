import type { ImportResult, Result } from '@gitpm/core';
import type { BitbucketAuth, BitbucketClient } from './client.js';
import type { BitbucketConfig, EpicLinkage } from './config.js';

export interface BitbucketImportOptions {
  auth: BitbucketAuth;
  workspace: string;
  repoSlug: string;
  /** REST 2.0 root; defaults to DEFAULT_BASE_URL. */
  baseUrl?: string;
  metaDir: string;
  /**
   * Existing `.meta/sync/bitbucket-config.yaml`, if any. Import writes a
   * default config when absent and keeps the user's mapping overrides when present.
   */
  config?: BitbucketConfig;
  /** Overrides `config.epic_linkage` for this run. */
  epicLinkage?: EpicLinkage;
  /** Injected for tests; built from `auth` and `baseUrl` when omitted. */
  client?: BitbucketClient;
}

/**
 * Import Bitbucket issues and milestones into `.meta/`, then write
 * `bitbucket-config.yaml` and `bitbucket-state.json`.
 *
 * Stub: implemented by story #286.
 */
export async function importFromBitbucket(
  _options: BitbucketImportOptions,
): Promise<Result<ImportResult>> {
  return { ok: false, error: new Error('not implemented') };
}
