import { writeFile as fsWriteFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Result, Status } from '@gitpm/core';
import YAML from 'yaml';
import type { LinearConfig } from './types.js';
import { DEFAULT_STATUS_MAPPING } from './types.js';

export async function loadConfig(
  metaDir: string,
): Promise<Result<LinearConfig>> {
  try {
    const configPath = join(metaDir, 'sync', 'linear-config.yaml');
    const raw = await readFile(configPath, 'utf-8');
    const config = YAML.parse(raw) as LinearConfig;
    return { ok: true, value: config };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to load Linear config: ${err}`),
    };
  }
}

export async function saveConfig(
  metaDir: string,
  config: LinearConfig,
): Promise<Result<void>> {
  try {
    const configPath = join(metaDir, 'sync', 'linear-config.yaml');
    await mkdir(dirname(configPath), { recursive: true });
    const content = YAML.stringify(config, { lineWidth: 0 });
    await fsWriteFile(configPath, content, 'utf-8');
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to save Linear config: ${err}`),
    };
  }
}

export function createDefaultConfig(
  teamId: string,
  statusMapping?: Record<string, Status>,
): LinearConfig {
  return {
    team_id: teamId,
    status_mapping: {
      ...DEFAULT_STATUS_MAPPING,
      ...statusMapping,
    },
    auto_sync: false,
  };
}
