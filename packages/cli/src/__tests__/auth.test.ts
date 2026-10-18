import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockExecSync = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

const ENV_KEYS = [
  'GITHUB_TOKEN',
  'GITLAB_TOKEN',
  'JIRA_TOKEN',
  'JIRA_EMAIL',
  'BITBUCKET_TOKEN',
  'BITBUCKET_EMAIL',
] as const;

describe('resolveCredentials', () => {
  const originalEnv: Partial<Record<string, string>> = {};

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  describe('github', () => {
    it('returns the CLI token when provided', async () => {
      process.env.GITHUB_TOKEN = 'env-token';
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('github', 'my-cli-token')).toEqual({
        token: 'my-cli-token',
        email: undefined,
      });
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('returns GITHUB_TOKEN when no CLI token', async () => {
      process.env.GITHUB_TOKEN = 'env-token';
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('github').token).toBe('env-token');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('falls back to gh auth token when env and CLI are missing', async () => {
      mockExecSync.mockReturnValue('gh-cli-token\n');
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('github').token).toBe('gh-cli-token');
      expect(mockExecSync).toHaveBeenCalledWith(
        'gh auth token',
        expect.any(Object),
      );
    });

    it('returns no token when gh returns an empty string', async () => {
      mockExecSync.mockReturnValue('   ');
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('github').token).toBeUndefined();
    });

    it('returns no token when gh auth token fails', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('gh not installed');
      });
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('github').token).toBeUndefined();
    });
  });

  describe('gitlab', () => {
    it('reads GITLAB_TOKEN and ignores GITHUB_TOKEN and gh', async () => {
      process.env.GITHUB_TOKEN = 'gh-env';
      process.env.GITLAB_TOKEN = 'gl-env';
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('gitlab').token).toBe('gl-env');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('returns no token rather than a GitHub token', async () => {
      process.env.GITHUB_TOKEN = 'gh-env';
      mockExecSync.mockReturnValue('gh-cli-token');
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('gitlab').token).toBeUndefined();
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('prefers the CLI token over GITLAB_TOKEN', async () => {
      process.env.GITLAB_TOKEN = 'gl-env';
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('gitlab', 'gl-cli').token).toBe('gl-cli');
    });
  });

  describe('jira', () => {
    it('reads JIRA_TOKEN and JIRA_EMAIL', async () => {
      process.env.GITHUB_TOKEN = 'gh-env';
      process.env.JIRA_TOKEN = 'jira-env';
      process.env.JIRA_EMAIL = 'dev@example.com';
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('jira')).toEqual({
        token: 'jira-env',
        email: 'dev@example.com',
      });
    });

    it('keeps JIRA_EMAIL when the token comes from --token', async () => {
      process.env.JIRA_EMAIL = 'dev@example.com';
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('jira', 'jira-cli')).toEqual({
        token: 'jira-cli',
        email: 'dev@example.com',
      });
    });

    it('treats empty env vars as unset', async () => {
      process.env.JIRA_TOKEN = '';
      process.env.JIRA_EMAIL = '';
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('jira')).toEqual({
        token: undefined,
        email: undefined,
      });
    });
  });

  describe('bitbucket', () => {
    it('reads BITBUCKET_TOKEN and BITBUCKET_EMAIL', async () => {
      process.env.GITHUB_TOKEN = 'gh-env';
      process.env.JIRA_TOKEN = 'jira-env';
      process.env.BITBUCKET_TOKEN = 'bb-env';
      process.env.BITBUCKET_EMAIL = 'dev@example.com';
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('bitbucket')).toEqual({
        token: 'bb-env',
        email: 'dev@example.com',
      });
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('returns no email for a bare access token', async () => {
      process.env.BITBUCKET_TOKEN = 'bb-env';
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('bitbucket')).toEqual({
        token: 'bb-env',
        email: undefined,
      });
    });

    it('prefers the CLI token over BITBUCKET_TOKEN and keeps the email', async () => {
      process.env.BITBUCKET_TOKEN = 'bb-env';
      process.env.BITBUCKET_EMAIL = 'dev@example.com';
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('bitbucket', 'bb-cli')).toEqual({
        token: 'bb-cli',
        email: 'dev@example.com',
      });
    });

    it('returns no token rather than a GitHub token', async () => {
      process.env.GITHUB_TOKEN = 'gh-env';
      mockExecSync.mockReturnValue('gh-cli-token');
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('bitbucket').token).toBeUndefined();
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('adapters without a table entry', () => {
    it('passes only the CLI token and never reads GitHub sources', async () => {
      process.env.GITHUB_TOKEN = 'gh-env';
      const { resolveCredentials } = await import('../utils/auth.js');
      expect(resolveCredentials('linear')).toEqual({
        token: undefined,
        email: undefined,
      });
      expect(resolveCredentials('linear', 'lin-cli').token).toBe('lin-cli');
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });
});
