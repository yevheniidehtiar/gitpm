import { relative, resolve } from 'node:path';
import { moveStory } from '@gitpm/core';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

export const moveCommand = new Command('move')
  .description('Move a story between epics or to standalone')
  .argument('<file>', 'Path to the story file')
  .option('--to-epic <epic>', 'Move to an epic (by ID or directory slug)')
  .option('--to-orphan', 'Move out of an epic to .meta/stories/')
  .action(async (file: string, opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    const filePath = resolve(process.cwd(), file);

    if (!opts.toEpic && !opts.toOrphan) {
      printError('Specify --to-epic or --to-orphan');
      process.exit(1);
    }

    const result = await moveStory(metaDir, filePath, {
      toEpic: opts.toEpic,
      toOrphan: opts.toOrphan,
    });

    if (!result.ok) {
      printError(result.error.message);
      process.exit(1);
    }

    const oldRel = relative(process.cwd(), result.value.oldPath);
    const newRel = relative(process.cwd(), result.value.newPath);
    printSuccess(`Moved ${oldRel} → ${newRel}`);
  });
