import { writeFile as fsWriteFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Result, Status } from '@gitpm/core';
import YAML from 'yaml';
import type { GitHubConfig } from './types.js';
import { DEFAULT_EPIC_LABELS, DEFAULT_STATUS_MAPPING } from './types.js';

export async function loadConfig(
  metaDir: string,
): Promise<Result<GitHubConfig>> {
  try {
    const configPath = join(metaDir, 'sync', 'github-config.yaml');
    const raw = await readFile(configPath, 'utf-8');
    const config = YAML.parse(raw) as GitHubConfig;
    return { ok: true, value: config };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to load GitHub config: ${err}`),
    };
  }
}

export async function saveConfig(
  metaDir: string,
  config: GitHubConfig,
): Promise<Result<void>> {
  try {
    const configPath = join(metaDir, 'sync', 'github-config.yaml');
    await mkdir(dirname(configPath), { recursive: true });
    const content = YAML.stringify(config, { lineWidth: 0 });
    await fsWriteFile(configPath, content, 'utf-8');
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to save GitHub config: ${err}`),
    };
  }
}

export function createDefaultConfig(
  repo: string,
  projectNumber?: number,
  statusMapping?: Record<string, Status>,
): GitHubConfig {
  return {
    repo,
    project_number: projectNumber,
    status_mapping: {
      ...DEFAULT_STATUS_MAPPING,
      ...statusMapping,
    },
    label_mapping: {
      epic_labels: [...DEFAULT_EPIC_LABELS],
    },
    auto_sync: false,
  };
}
