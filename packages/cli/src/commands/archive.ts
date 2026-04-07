import { archiveOldEntities } from '@gitpm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess, printWarning } from '../utils/output.js';

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

    const { archivedFiles } = result.value;

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
