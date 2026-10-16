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
    const config = createDefaultConfig('team-1');
    expect(config.team_id).toBe('team-1');
    expect(config.status_mapping.backlog).toBe('backlog');
    expect(config.status_mapping.unstarted).toBe('todo');
    expect(config.status_mapping.started).toBe('in_progress');
    expect(config.status_mapping.completed).toBe('done');
    expect(config.status_mapping.canceled).toBe('cancelled');
    expect(config.auto_sync).toBe(false);
  });

  it('merges custom status mapping', () => {
    const config = createDefaultConfig('team-1', {
      triage: 'todo',
    });
    expect(config.status_mapping.triage).toBe('todo');
    expect(config.status_mapping.backlog).toBe('backlog');
  });
});

describe('saveConfig and loadConfig', () => {
  it('round-trips config to YAML', async () => {
    const config = createDefaultConfig('team-1');
    const saveResult = await saveConfig(META_DIR, config);
    expect(saveResult.ok).toBe(true);

    const loadResult = await loadConfig(META_DIR);
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.value.team_id).toBe('team-1');
    }
  });

  it('returns error when config does not exist', async () => {
    const result = await loadConfig(join(TEST_DIR, 'nonexistent'));
    expect(result.ok).toBe(false);
  });

  it('returns an error result when the config cannot be written', async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const blocker = join(TEST_DIR, 'blocker-config');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(blocker, 'x');
    const result = await saveConfig(
      join(blocker, 'sub-meta'),
      createDefaultConfig('team-1'),
    );
    expect(result.ok).toBe(false);
  });
});
