import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URL } from '../client.js';
import {
  createDefaultConfig,
  loadConfig,
  parseConfig,
  saveConfig,
} from '../config.js';

let metaDir: string;

beforeEach(async () => {
  metaDir = await mkdtemp(join(tmpdir(), 'gitpm-bb-config-'));
});

afterEach(async () => {
  await rm(metaDir, { recursive: true, force: true });
});

async function writeRaw(content: string): Promise<void> {
  await mkdir(join(metaDir, 'sync'), { recursive: true });
  await writeFile(join(metaDir, 'sync', 'bitbucket-config.yaml'), content);
}

describe('parseConfig', () => {
  it('applies defaults to a minimal config', () => {
    const result = parseConfig({ workspace: 'acme', repo_slug: 'web' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      workspace: 'acme',
      repo_slug: 'web',
      base_url: DEFAULT_BASE_URL,
      status_mapping: {},
      priority_mapping: {},
      kind_mapping: {},
      epic_linkage: 'both',
      auto_sync: false,
    });
  });

  it('accepts partial mapping overrides', () => {
    const result = parseConfig({
      workspace: 'acme',
      repo_slug: 'web',
      status_mapping: { open: 'in_progress' },
      priority_mapping: { trivial: 'medium' },
      kind_mapping: { bug: 'bug' },
      epic_linkage: 'component',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status_mapping).toEqual({ open: 'in_progress' });
    expect(result.value.epic_linkage).toBe('component');
  });

  it.each([
    ['missing workspace', { repo_slug: 'web' }],
    [
      'unknown state key',
      { workspace: 'a', repo_slug: 'b', status_mapping: { doing: 'todo' } },
    ],
    [
      'invalid status value',
      { workspace: 'a', repo_slug: 'b', status_mapping: { open: 'wip' } },
    ],
    [
      'invalid priority value',
      { workspace: 'a', repo_slug: 'b', priority_mapping: { major: 'urgent' } },
    ],
    [
      'invalid linkage',
      { workspace: 'a', repo_slug: 'b', epic_linkage: 'labels' },
    ],
    [
      'invalid base_url',
      { workspace: 'a', repo_slug: 'b', base_url: 'not a url' },
    ],
  ])('rejects %s', (_name, raw) => {
    const result = parseConfig(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Invalid Bitbucket config');
  });
});

describe('loadConfig / saveConfig', () => {
  it('round-trips through .meta/sync/bitbucket-config.yaml', async () => {
    const saved = await saveConfig(metaDir, {
      workspace: 'acme',
      repo_slug: 'web',
      status_mapping: { 'on hold': 'todo' },
    });
    expect(saved.ok).toBe(true);

    const raw = await readFile(
      join(metaDir, 'sync', 'bitbucket-config.yaml'),
      'utf-8',
    );
    expect(raw).toContain('workspace: acme');
    expect(raw).toContain('on hold: todo');

    const loaded = await loadConfig(metaDir);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.status_mapping).toEqual({ 'on hold': 'todo' });
    expect(loaded.value.epic_linkage).toBe('both');
  });

  it('refuses to save an invalid config', async () => {
    const saved = await saveConfig(metaDir, { workspace: '', repo_slug: 'x' });
    expect(saved.ok).toBe(false);
  });

  it('fails when the file is missing', async () => {
    const loaded = await loadConfig(metaDir);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.message).toContain('Failed to load Bitbucket config');
  });

  it('fails on malformed YAML', async () => {
    await writeRaw('workspace: [unclosed');
    const loaded = await loadConfig(metaDir);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.message).toContain('Failed to parse Bitbucket config');
  });

  it('fails on schema violations', async () => {
    await writeRaw('workspace: acme\n');
    const loaded = await loadConfig(metaDir);
    expect(loaded.ok).toBe(false);
  });
});

describe('createDefaultConfig', () => {
  it('builds a config with overrides', () => {
    const result = createDefaultConfig('acme', 'web', {
      epic_linkage: 'body-marker',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.workspace).toBe('acme');
    expect(result.value.repo_slug).toBe('web');
    expect(result.value.epic_linkage).toBe('body-marker');
  });

  it('returns an error for an empty workspace', () => {
    expect(createDefaultConfig('', 'web').ok).toBe(false);
  });
});
