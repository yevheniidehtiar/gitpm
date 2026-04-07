import {
  writeFile as fsWriteFile,
  mkdir,
  readFile,
  rm,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Result } from '@gitpm/core';
import type { SyncCheckpoint } from './types.js';

const CHECKPOINT_PATH = '.gitpm/sync-checkpoint.json';

function checkpointFilePath(metaDir: string): string {
  return join(metaDir, CHECKPOINT_PATH);
}

export async function hasCheckpoint(metaDir: string): Promise<Result<boolean>> {
  try {
    const filePath = checkpointFilePath(metaDir);
    await readFile(filePath, 'utf-8');
    return { ok: true, value: true };
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return { ok: true, value: false };
    }
    return {
      ok: false,
      error: new Error(`Failed to check for checkpoint: ${err}`),
    };
  }
}

export async function loadCheckpoint(
  metaDir: string,
): Promise<Result<SyncCheckpoint>> {
  try {
    const filePath = checkpointFilePath(metaDir);
    const raw = await readFile(filePath, 'utf-8');
    const checkpoint = JSON.parse(raw) as SyncCheckpoint;
    return { ok: true, value: checkpoint };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to load checkpoint: ${err}`),
    };
  }
}

export async function saveCheckpoint(
  metaDir: string,
  checkpoint: SyncCheckpoint,
): Promise<Result<void>> {
  try {
    const filePath = checkpointFilePath(metaDir);
    await mkdir(dirname(filePath), { recursive: true });
    const json = JSON.stringify(checkpoint, null, 2);
    await fsWriteFile(filePath, `${json}\n`, 'utf-8');
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to save checkpoint: ${err}`),
    };
  }
}

export async function clearCheckpoint(metaDir: string): Promise<Result<void>> {
  try {
    const filePath = checkpointFilePath(metaDir);
    await rm(filePath, { force: true });
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to clear checkpoint: ${err}`),
    };
  }
}
