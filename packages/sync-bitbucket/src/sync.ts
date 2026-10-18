import type { ConflictStrategy, Result, SyncResult } from '@gitpm/core';
import type { BitbucketAuth, BitbucketClient } from './client.js';
import type { BitbucketConfig } from './config.js';

export interface BitbucketSyncOptions {
  auth: BitbucketAuth;
  workspace: string;
  repoSlug: string;
  /** REST 2.0 root; defaults to `config.base_url`, then DEFAULT_BASE_URL. */
  baseUrl?: string;
  metaDir: string;
  /** Loaded `.meta/sync/bitbucket-config.yaml`; sync requires one. */
  config: BitbucketConfig;
  strategy?: ConflictStrategy;
  dryRun?: boolean;
  /** Injected for tests; built from `auth` and `baseUrl` when omitted. */
  client?: BitbucketClient;
}

/**
 * Bidirectional sync between `.meta/` and Bitbucket issues using
 * `bitbucket-state.json` hashes for three-way diffing.
 *
 * Stub: implemented by story #283.
 */
export async function syncWithBitbucket(
  _options: BitbucketSyncOptions,
): Promise<Result<SyncResult>> {
  return { ok: false, error: new Error('not implemented') };
}
