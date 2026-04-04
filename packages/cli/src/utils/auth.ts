import { execSync } from 'node:child_process';

/**
 * Resolve a GitHub token from multiple sources in priority order:
 * 1. Explicit CLI --token flag
 * 2. GITHUB_TOKEN environment variable
 * 3. GitHub CLI (`gh auth token`)
 */
export async function resolveToken(cliToken?: string): Promise<string> {
  if (cliToken) return cliToken;

  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) return envToken;

  try {
    const ghToken = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (ghToken) return ghToken;
  } catch {
    // gh CLI not installed or not authenticated — fall through
  }

  throw new Error(
    "No GitHub token found. Provide via --token flag, GITHUB_TOKEN env var, or install GitHub CLI (gh) and run 'gh auth login'.",
  );
}
