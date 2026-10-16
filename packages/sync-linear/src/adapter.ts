import type {
  AdapterExportOptions,
  AdapterImportOptions,
  AdapterSyncOptions,
  Result,
  SyncAdapter,
} from '@gitpm/core';
import { loadConfig } from './config.js';
import { exportToLinear } from './export.js';
import { importFromLinear } from './import.js';
import { syncWithLinear } from './sync.js';

interface LinearCredentials {
  apiKey: string;
  teamId: string;
}

function stringOption(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Resolves the Linear API key and team id.
 *
 * The API key comes only from `apiKey`, `credentials.apiKey` or the
 * `LINEAR_API_KEY` env var. The generic `token` option is deliberately
 * ignored: the CLI fills it from `--token` / `GITHUB_TOKEN` / `gh auth token`,
 * and sending a GitHub credential to api.linear.app would leak it.
 */
async function resolveCredentials(
  options: AdapterImportOptions | AdapterExportOptions | AdapterSyncOptions,
): Promise<Result<LinearCredentials>> {
  const apiKey =
    stringOption(options.apiKey) ??
    stringOption(options.credentials?.apiKey) ??
    stringOption(process.env.LINEAR_API_KEY);
  if (!apiKey) {
    return {
      ok: false,
      error: new Error(
        'Linear API key is required. Set LINEAR_API_KEY or pass --api-key.',
      ),
    };
  }

  let teamId =
    stringOption(options.teamId) ?? stringOption(options.credentials?.teamId);
  if (!teamId) {
    const config = await loadConfig(options.metaDir);
    teamId = config.ok ? stringOption(config.value.team_id) : undefined;
  }
  if (!teamId) {
    return {
      ok: false,
      error: new Error(
        'Linear team ID is required. Pass --team or set team_id in .meta/sync/linear-config.yaml.',
      ),
    };
  }

  return { ok: true, value: { apiKey, teamId } };
}

export const linearAdapter: SyncAdapter = {
  name: 'linear',
  displayName: 'Linear',

  async detect(metaDir: string): Promise<boolean> {
    const config = await loadConfig(metaDir);
    return config.ok;
  },

  async import(options) {
    const creds = await resolveCredentials(options);
    if (!creds.ok) return creds;
    return importFromLinear({ ...creds.value, metaDir: options.metaDir });
  },

  async export(options) {
    const creds = await resolveCredentials(options);
    if (!creds.ok) return creds;
    return exportToLinear({
      ...creds.value,
      metaDir: options.metaDir,
      dryRun: options.dryRun,
    });
  },

  async sync(options) {
    const creds = await resolveCredentials(options);
    if (!creds.ok) return creds;
    return syncWithLinear({
      ...creds.value,
      metaDir: options.metaDir,
      strategy: options.strategy,
      dryRun: options.dryRun,
    });
  },
};
