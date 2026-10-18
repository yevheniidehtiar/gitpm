/**
 * Integration test for adapter loading and auto-detection.
 *
 * No mocks at the adapter boundary: `resolveAdapter` loads the default
 * adapter list from `@gitpm/core` and imports the real `@gitpm/sync-*`
 * packages, then auto-detects against a temp `.meta/` tree on disk.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TempProject } from './helpers/meta-tree.js';
import { createTempProject } from './helpers/meta-tree.js';

// Integration tests load the real adapter module graph per test; the 5s
// default flakes under full-suite transform load while passing in isolation.
vi.setConfig({ testTimeout: 30_000 });

let project: TempProject;

async function writeBitbucketSyncConfig(metaDir: string): Promise<void> {
  const configPath = join(metaDir, 'sync', 'bitbucket-config.yaml');
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, 'workspace: acme\nrepo_slug: widgets\n', 'utf-8');
}

describe('resolveAdapter with real adapters', () => {
  beforeEach(async () => {
    project = await createTempProject('adapters-');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(project.rootDir, { recursive: true, force: true });
  });

  it('auto-detects bitbucket from .meta/sync/bitbucket-config.yaml', async () => {
    await writeBitbucketSyncConfig(project.metaDir);
    const { resolveAdapter } = await import('../utils/adapters.js');

    const { adapter, config } = await resolveAdapter(project.metaDir);

    expect(config.adapters).toContain('@gitpm/sync-bitbucket');
    expect(adapter.name).toBe('bitbucket');
    expect(adapter.displayName).toBe('Bitbucket');
  });

  it('finds bitbucket by name', async () => {
    await mkdir(project.metaDir, { recursive: true });
    const { resolveAdapter } = await import('../utils/adapters.js');

    const { adapter } = await resolveAdapter(project.metaDir, 'bitbucket');

    expect(adapter.name).toBe('bitbucket');
  });
});
