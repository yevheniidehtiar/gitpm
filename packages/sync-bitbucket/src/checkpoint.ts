import {
  writeFile as fsWriteFile,
  mkdir,
  readFile,
  rm,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Result } from '@gitpm/core';
import { z } from 'zod';

export const syncCheckpointSchema = z.object({
  startedAt: z.string(),
  workspace: z.string(),
  repo_slug: z.string(),
  processedEntityIds: z.array(z.string()),
  lastError: z.object({ entityId: z.string(), message: z.string() }).optional(),
});
export type SyncCheckpoint = z.infer<typeof syncCheckpointSchema>;

const CHECKPOINT_PATH = '.gitpm/bitbucket-sync-checkpoint.json';

function checkpointPath(metaDir: string): string {
  return join(metaDir, CHECKPOINT_PATH);
}

/** The saved checkpoint, or null when there is none. */
export async function loadCheckpoint(
  metaDir: string,
): Promise<Result<SyncCheckpoint | null>> {
  let raw: string;
  try {
    raw = await readFile(checkpointPath(metaDir), 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: true, value: null };
    }
    return {
      ok: false,
      error: new Error(`Failed to load sync checkpoint: ${err}`),
    };
  }
  try {
    const parsed = syncCheckpointSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return {
        ok: false,
        error: new Error(
          `Invalid sync checkpoint: ${z.prettifyError(parsed.error)}`,
        ),
      };
    }
    return { ok: true, value: parsed.data };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Invalid sync checkpoint: ${err}`),
    };
  }
}

export async function saveCheckpoint(
  metaDir: string,
  checkpoint: SyncCheckpoint,
): Promise<Result<void>> {
  try {
    const path = checkpointPath(metaDir);
    await mkdir(dirname(path), { recursive: true });
    await fsWriteFile(
      path,
      `${JSON.stringify(checkpoint, null, 2)}\n`,
      'utf-8',
    );
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to save sync checkpoint: ${err}`),
    };
  }
}

export async function clearCheckpoint(metaDir: string): Promise<Result<void>> {
  try {
    await rm(checkpointPath(metaDir), { force: true });
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to clear sync checkpoint: ${err}`),
    };
  }
}
