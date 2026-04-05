import { writeFile as fsWriteFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Result, Status } from '@gitpm/core';
import YAML from 'yaml';
import type { JiraConfig } from './types.js';
import { DEFAULT_EPIC_TYPES, DEFAULT_STATUS_MAPPING } from './types.js';

export async function loadConfig(metaDir: string): Promise<Result<JiraConfig>> {
  try {
    const configPath = join(metaDir, 'sync', 'jira-config.yaml');
    const raw = await readFile(configPath, 'utf-8');
    const config = YAML.parse(raw) as JiraConfig;
    return { ok: true, value: config };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to load Jira config: ${err}`),
    };
  }
}

export async function saveConfig(
  metaDir: string,
  config: JiraConfig,
): Promise<Result<void>> {
  try {
    const configPath = join(metaDir, 'sync', 'jira-config.yaml');
    await mkdir(dirname(configPath), { recursive: true });
    const content = YAML.stringify(config, { lineWidth: 0 });
    await fsWriteFile(configPath, content, 'utf-8');
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to save Jira config: ${err}`),
    };
  }
}

export function createDefaultConfig(
  site: string,
  projectKey: string,
  boardId?: number,
  statusMapping?: Record<string, Status>,
): JiraConfig {
  return {
    site,
    project_key: projectKey,
    board_id: boardId,
    status_mapping: {
      ...DEFAULT_STATUS_MAPPING,
      ...statusMapping,
    },
    issue_type_mapping: {
      epic_types: [...DEFAULT_EPIC_TYPES],
    },
    auto_sync: false,
  };
}
