import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultConfig, loadConfig, saveConfig } from '../config.js';

describe('config', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-config-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    it('loads a valid config file', async () => {
      await mkdir(join(tmpDir, 'sync'), { recursive: true });
      await writeFile(
        join(tmpDir, 'sync', 'github-config.yaml'),
        'repo: owner/name\nauto_sync: true\n',
        'utf-8',
      );
      const result = await loadConfig(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.repo).toBe('owner/name');
        expect(result.value.auto_sync).toBe(true);
      }
    });

    it('returns error when file does not exist', async () => {
      const result = await loadConfig(tmpDir);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to load GitHub config');
      }
    });
  });

  describe('saveConfig', () => {
    it('round-trips a config through save and load', async () => {
      const cfg = createDefaultConfig('owner/name', 3);
      const saveResult = await saveConfig(tmpDir, cfg);
      expect(saveResult.ok).toBe(true);

      const loadResult = await loadConfig(tmpDir);
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok) {
        expect(loadResult.value.repo).toBe('owner/name');
        expect(loadResult.value.project_number).toBe(3);
        expect(loadResult.value.auto_sync).toBe(false);
      }
    });

    it('returns error when target path is invalid', async () => {
      const result = await saveConfig(
        `${tmpDir}\u0000/bad`,
        createDefaultConfig('a/b'),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to save GitHub config');
      }
    });
  });

  describe('createDefaultConfig', () => {
    it('returns sensible defaults', () => {
      const cfg = createDefaultConfig('owner/name');
      expect(cfg.repo).toBe('owner/name');
      expect(cfg.auto_sync).toBe(false);
      expect(cfg.label_mapping.epic_labels).toContain('epic');
      expect(cfg.status_mapping).toMatchObject({ Todo: 'todo', Done: 'done' });
    });

    it('merges custom status mappings on top of defaults', () => {
      const cfg = createDefaultConfig('o/n', undefined, {
        Planned: 'todo',
      });
      expect(cfg.status_mapping.Planned).toBe('todo');
      expect(cfg.status_mapping.Done).toBe('done');
    });
  });
});
