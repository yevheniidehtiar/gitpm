import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { archiveOldEntities } from '@gitpm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess, printWarning } from '../utils/output.js';

/**
 * Remove archived entity IDs from the GitHub sync state file
 * so that sync/push don't treat them as "locally deleted".
 */
async function cleanupSyncState(
  metaDir: string,
  entityIds: string[],
): Promise<number> {
  const statePath = join(metaDir, 'sync', 'github-state.json');
  let raw: string;
  try {
    raw = await readFile(statePath, 'utf-8');
  } catch {
    return 0; // No state file — nothing to clean up
  }

  const state = JSON.parse(raw);
  let removed = 0;
  for (const id of entityIds) {
    if (state.entities?.[id]) {
      delete state.entities[id];
      removed++;
    }
  }

  if (removed > 0) {
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
  }
  return removed;
}

export const archiveCommand = new Command('archive')
  .description(
    'Move done/cancelled entities older than N days to .meta/archive/',
  )
  .option(
    '-d, --days <number>',
    'Number of days after which done items are archived',
    '7',
  )
  .option('--dry-run', 'List files that would be archived without moving them')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    const daysOld = Number.parseInt(opts.days, 10);
    const dryRun = opts.dryRun ?? false;

    if (Number.isNaN(daysOld) || daysOld < 0) {
      printError('--days must be a non-negative integer');
      process.exit(1);
    }

    if (dryRun) {
      printWarning('Dry run — no files will be moved');
    }

    const result = await archiveOldEntities(metaDir, { daysOld, dryRun });

    if (!result.ok) {
      printError(result.error.message);
      process.exit(1);
    }

    const { archivedFiles, archivedEntityIds } = result.value;

    if (archivedFiles.length === 0) {
      console.log(
        chalk.dim(
          `No done/cancelled entities older than ${daysOld} day(s) found.`,
        ),
      );
      return;
    }

    for (const file of archivedFiles) {
      const label = dryRun ? 'would archive' : 'archived';
      console.log(chalk.dim(`  ${label}: ${file}`));
    }

    // Clean up sync state so push/pull/sync don't treat archived items as deleted
    if (!dryRun && archivedEntityIds.length > 0) {
      const removed = await cleanupSyncState(metaDir, archivedEntityIds);
      if (removed > 0) {
        console.log(chalk.dim(`  removed ${removed} entries from sync state`));
      }
    }

    console.log();
    if (dryRun) {
      printWarning(
        `${archivedFiles.length} file(s) would be archived (dry run)`,
      );
    } else {
      printSuccess(
        `Archived ${archivedFiles.length} file(s) to .meta/archive/`,
      );
    }
  });
