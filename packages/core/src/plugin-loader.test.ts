import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SyncAdapter } from './adapter.js';
import { createDefaultGitpmConfig, gitpmConfigSchema } from './config.js';
import type { GitpmConfig } from './config.js';
import {
  detectAdapter,
  findAdapterByName,
  loadGitpmConfig,
  runHooks,
} from './plugin-loader.js';

function createMockAdapter(name: string, detects = false): SyncAdapter {
  return {
    name,
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    detect: async () => detects,
    import: async () => ({
      ok: true as const,
      value: { milestones: 0, epics: 0, stories: 0, totalFiles: 0 },
    }),
    export: async () => ({
      ok: true as const,
      value: {
        created: { milestones: 0, issues: 0 },
        updated: { milestones: 0, issues: 0 },
        totalChanges: 0,
      },
    }),
    sync: async () => ({
      ok: true as const,
      value: {
        pushed: { milestones: 0, issues: 0 },
        pulled: { milestones: 0, issues: 0 },
        conflicts: [],
        resolved: 0,
        skipped: 0,
      },
    }),
  };
}

describe('GitpmConfig schema', () => {
  it('validates a full config', () => {
    const result = gitpmConfigSchema.safeParse({
      adapters: ['@gitpm/sync-github'],
      hooks: {
        'pre-sync': './scripts/validate.ts',
        'post-import': ['./scripts/a.ts', './scripts/b.ts'],
      },
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults for empty object', () => {
    const result = gitpmConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adapters).toHaveLength(3);
      expect(result.data.hooks).toEqual({});
    }
  });

  it('creates default config', () => {
    const config = createDefaultGitpmConfig();
    expect(config.adapters).toContain('@gitpm/sync-github');
    expect(config.adapters).toContain('@gitpm/sync-gitlab');
    expect(config.adapters).toContain('@gitpm/sync-jira');
    expect(config.hooks).toEqual({});
  });
});

describe('loadGitpmConfig', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gitpm-test-config-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when no config file exists', async () => {
    const result = await loadGitpmConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.adapters).toHaveLength(3);
    }
  });

  it('loads config from JSON file', async () => {
    await writeFile(
      join(tmpDir, 'gitpm.config.json'),
      JSON.stringify({
        adapters: ['@gitpm/sync-github'],
        hooks: {},
      }),
    );
    const result = await loadGitpmConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.adapters).toEqual(['@gitpm/sync-github']);
    }
  });

  it('loads config from JS file', async () => {
    await writeFile(
      join(tmpDir, 'gitpm.config.mjs'),
      'export default { adapters: ["custom-adapter"], hooks: {} };',
    );
    const result = await loadGitpmConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.adapters).toEqual(['custom-adapter']);
    }
  });

  it('returns error for invalid config', async () => {
    await writeFile(
      join(tmpDir, 'gitpm.config.json'),
      JSON.stringify({ adapters: 'not-an-array' }),
    );
    const result = await loadGitpmConfig(tmpDir);
    expect(result.ok).toBe(false);
  });
});

describe('detectAdapter', () => {
  it('returns null when no adapters detect', async () => {
    const adapters = [
      createMockAdapter('a', false),
      createMockAdapter('b', false),
    ];
    const result = await detectAdapter(adapters, '/tmp/meta');
    expect(result).toBeNull();
  });

  it('returns first adapter that detects', async () => {
    const adapters = [
      createMockAdapter('a', false),
      createMockAdapter('b', true),
      createMockAdapter('c', true),
    ];
    const result = await detectAdapter(adapters, '/tmp/meta');
    expect(result?.name).toBe('b');
  });

  it('returns null for empty adapter list', async () => {
    const result = await detectAdapter([], '/tmp/meta');
    expect(result).toBeNull();
  });

  it('skips adapters that throw during detect', async () => {
    const throwing: SyncAdapter = {
      ...createMockAdapter('bad'),
      detect: async () => {
        throw new Error('boom');
      },
    };
    const good = createMockAdapter('good', true);
    const result = await detectAdapter([throwing, good], '/tmp/meta');
    expect(result?.name).toBe('good');
  });
});

describe('findAdapterByName', () => {
  it('finds adapter by name', () => {
    const adapters = [createMockAdapter('github'), createMockAdapter('gitlab')];
    expect(findAdapterByName(adapters, 'gitlab')?.name).toBe('gitlab');
  });

  it('returns null when name not found', () => {
    const adapters = [createMockAdapter('github')];
    expect(findAdapterByName(adapters, 'jira')).toBeNull();
  });
});

describe('runHooks', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gitpm-test-hooks-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('succeeds when no hooks are configured', async () => {
    const config: GitpmConfig = { adapters: [], hooks: {} };
    const result = await runHooks(
      config,
      'pre-sync',
      { metaDir: '/tmp', event: 'pre-sync' },
      tmpDir,
    );
    expect(result.ok).toBe(true);
  });

  it('runs a valid hook script', async () => {
    const hookPath = join(tmpDir, 'hook.mjs');
    await writeFile(hookPath, 'export default function(ctx) { /* noop */ }');

    const config: GitpmConfig = {
      adapters: [],
      hooks: { 'pre-sync': hookPath },
    };
    const result = await runHooks(
      config,
      'pre-sync',
      { metaDir: '/tmp', event: 'pre-sync' },
      tmpDir,
    );
    expect(result.ok).toBe(true);
  });

  it('returns error for hook that throws', async () => {
    const hookPath = join(tmpDir, 'bad-hook.mjs');
    await writeFile(
      hookPath,
      'export default function() { throw new Error("hook error"); }',
    );

    const config: GitpmConfig = {
      adapters: [],
      hooks: { 'pre-sync': hookPath },
    };
    const result = await runHooks(
      config,
      'pre-sync',
      { metaDir: '/tmp', event: 'pre-sync' },
      tmpDir,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('hook error');
    }
  });

  it('returns error for hook that does not export a function', async () => {
    const hookPath = join(tmpDir, 'not-fn.mjs');
    await writeFile(hookPath, 'export default "not a function";');

    const config: GitpmConfig = {
      adapters: [],
      hooks: { 'pre-sync': hookPath },
    };
    const result = await runHooks(
      config,
      'pre-sync',
      { metaDir: '/tmp', event: 'pre-sync' },
      tmpDir,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('does not export a function');
    }
  });

  it('runs multiple hooks in array order', async () => {
    const hook1 = join(tmpDir, 'hook1.mjs');
    const hook2 = join(tmpDir, 'hook2.mjs');
    await writeFile(hook1, 'export default function() {}');
    await writeFile(hook2, 'export default function() {}');

    const config: GitpmConfig = {
      adapters: [],
      hooks: { 'post-import': [hook1, hook2] },
    };
    const result = await runHooks(
      config,
      'post-import',
      { metaDir: '/tmp', event: 'post-import' },
      tmpDir,
    );
    expect(result.ok).toBe(true);
  });
});
