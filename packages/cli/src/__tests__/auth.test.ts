import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockExecSync = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

describe('resolveToken', () => {
  const originalEnv = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    process.env.GITHUB_TOKEN = undefined;
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv !== undefined) {
      process.env.GITHUB_TOKEN = originalEnv;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
  });

  it('returns the CLI token when provided', async () => {
    const { resolveToken } = await import('../utils/auth.js');
    const token = await resolveToken('my-cli-token');
    expect(token).toBe('my-cli-token');
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('returns GITHUB_TOKEN env var when no CLI token', async () => {
    process.env.GITHUB_TOKEN = 'env-token';
    const { resolveToken } = await import('../utils/auth.js');
    const token = await resolveToken();
    expect(token).toBe('env-token');
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('falls back to gh auth token when env and CLI are missing', async () => {
    mockExecSync.mockReturnValue('gh-cli-token\n');
    const { resolveToken } = await import('../utils/auth.js');
    const token = await resolveToken();
    expect(token).toBe('gh-cli-token');
    expect(mockExecSync).toHaveBeenCalledWith(
      'gh auth token',
      expect.any(Object),
    );
  });

  it('throws when gh returns an empty string', async () => {
    mockExecSync.mockReturnValue('   ');
    const { resolveToken } = await import('../utils/auth.js');
    await expect(resolveToken()).rejects.toThrow('No GitHub token found');
  });

  it('throws when gh auth token fails', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('gh not installed');
    });
    const { resolveToken } = await import('../utils/auth.js');
    await expect(resolveToken()).rejects.toThrow('No GitHub token found');
  });
});
