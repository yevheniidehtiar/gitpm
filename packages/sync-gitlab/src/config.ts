import { writeFile as fsWriteFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Result, Status } from '@gitpm/core';
import YAML from 'yaml';
import type { GitLabConfig } from './types.js';
import { DEFAULT_EPIC_LABELS, DEFAULT_STATUS_MAPPING } from './types.js';

export async function loadConfig(
  metaDir: string,
): Promise<Result<GitLabConfig>> {
  try {
    const configPath = join(metaDir, 'sync', 'gitlab-config.yaml');
    const raw = await readFile(configPath, 'utf-8');
    const config = YAML.parse(raw) as GitLabConfig;
    return { ok: true, value: config };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to load GitLab config: ${err}`),
    };
  }
}

export async function saveConfig(
  metaDir: string,
  config: GitLabConfig,
): Promise<Result<void>> {
  try {
    const configPath = join(metaDir, 'sync', 'gitlab-config.yaml');
    await mkdir(dirname(configPath), { recursive: true });
    const content = YAML.stringify(config, { lineWidth: 0 });
    await fsWriteFile(configPath, content, 'utf-8');
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to save GitLab config: ${err}`),
    };
  }
}

export function createDefaultConfig(
  project: string,
  projectId: number,
  baseUrl: string,
  groupId?: number,
  statusMapping?: Record<string, Status>,
): GitLabConfig {
  return {
    project,
    project_id: projectId,
    group_id: groupId,
    base_url: baseUrl,
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
