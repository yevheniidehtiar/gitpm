import { execSync } from 'node:child_process';

export interface AdapterCredentialSpec {
  /** Environment variable holding the adapter's token. */
  tokenEnv: string;
  /** Environment variable holding the account email, for adapters that need one. */
  emailEnv?: string;
  /** Last-resort token source when neither --token nor tokenEnv is set. */
  fallback?: () => string | undefined;
}

export interface ResolvedCredentials {
  token?: string;
  email?: string;
}

function ghAuthToken(): string | undefined {
  try {
    const token = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return token || undefined;
  } catch {
    // gh CLI not installed or not authenticated
    return undefined;
  }
}

/**
 * Where each adapter reads its credentials from. Adding an adapter is one entry.
 * Adapters missing from this table (e.g. linear, which reads LINEAR_API_KEY
 * itself) only receive an explicit --token.
 */
export const ADAPTER_CREDENTIALS: Record<string, AdapterCredentialSpec> = {
  github: { tokenEnv: 'GITHUB_TOKEN', fallback: ghAuthToken },
  gitlab: { tokenEnv: 'GITLAB_TOKEN' },
  jira: { tokenEnv: 'JIRA_TOKEN', emailEnv: 'JIRA_EMAIL' },
};

function envValue(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return process.env[name] || undefined;
}

/**
 * Resolve credentials for an adapter in priority order:
 * 1. Explicit CLI --token flag
 * 2. The adapter's token environment variable
 * 3. The adapter's fallback (GitHub: `gh auth token`)
 *
 * Never throws: a missing token is reported by the adapter itself.
 */
export function resolveCredentials(
  adapterName: string,
  cliToken?: string,
): ResolvedCredentials {
  const spec = ADAPTER_CREDENTIALS[adapterName];
  const token =
    cliToken || envValue(spec?.tokenEnv) || spec?.fallback?.() || undefined;
  const email = envValue(spec?.emailEnv);
  return { token, email };
}
