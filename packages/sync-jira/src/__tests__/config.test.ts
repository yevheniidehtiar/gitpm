import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultConfig, loadConfig, saveConfig } from '../config.js';

const TEST_DIR = join(import.meta.dirname, '__tmp_config_test__');
const META_DIR = join(TEST_DIR, '.meta');

beforeEach(() => {
  mkdirSync(join(META_DIR, 'sync'), { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
});

describe('createDefaultConfig', () => {
  it('creates config with default status mapping', () => {
    const config = createDefaultConfig('test.atlassian.net', 'TEST');
    expect(config.site).toBe('test.atlassian.net');
    expect(config.project_key).toBe('TEST');
    expect(config.status_mapping['To Do']).toBe('todo');
    expect(config.status_mapping['In Progress']).toBe('in_progress');
    expect(config.issue_type_mapping.epic_types).toEqual(['Epic']);
    expect(config.auto_sync).toBe(false);
  });

  it('merges custom status mapping', () => {
    const config = createDefaultConfig(
      'test.atlassian.net',
      'TEST',
      undefined,
      {
        'In QA': 'in_review',
      },
    );
    expect(config.status_mapping['In QA']).toBe('in_review');
    expect(config.status_mapping['To Do']).toBe('todo');
  });

  it('stores board_id when provided', () => {
    const config = createDefaultConfig('test.atlassian.net', 'TEST', 42);
    expect(config.board_id).toBe(42);
  });
});

describe('saveConfig and loadConfig', () => {
  it('round-trips config to YAML', async () => {
    const config = createDefaultConfig('test.atlassian.net', 'TEST', 5);
    const saveResult = await saveConfig(META_DIR, config);
    expect(saveResult.ok).toBe(true);

    const loadResult = await loadConfig(META_DIR);
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.value.site).toBe('test.atlassian.net');
      expect(loadResult.value.project_key).toBe('TEST');
      expect(loadResult.value.board_id).toBe(5);
    }
  });

  it('returns error when config does not exist', async () => {
    const result = await loadConfig(join(TEST_DIR, 'nonexistent'));
    expect(result.ok).toBe(false);
  });

  it('returns an error result when the config cannot be written', async () => {
    // Create a file where we want to create a directory — mkdir will fail.
    mkdirSync(TEST_DIR, { recursive: true });
    const blocker = join(TEST_DIR, 'blocker-config');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(blocker, 'x');
    // Passing a path under the blocker file forces mkdir to fail.
    const result = await saveConfig(
      join(blocker, 'sub-meta'),
      createDefaultConfig('s', 'p'),
    );
    expect(result.ok).toBe(false);
  });
});
