import { relative } from 'node:path';
import { parseTree, resolveRefs, validateTree } from '@gitpm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess, printWarning } from '../utils/output.js';

export const validateCommand = new Command('validate')
  .description('Validate the .meta/ project tree')
  .action(async (_opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

    // Parse tree
    const parseResult = await parseTree(metaDir);
    if (!parseResult.ok) {
      printError(parseResult.error.message);
      process.exit(1);
    }

    const tree = parseResult.value;

    // Check for parse errors
    if (tree.errors.length > 0) {
      for (const err of tree.errors) {
        const rel = relative(process.cwd(), err.filePath);
        console.log(chalk.red(`  ✗ ${rel}: ${err.message}`));
      }
    }

    // Resolve refs
    const resolveResult = resolveRefs(tree);
    if (!resolveResult.ok) {
      printError(resolveResult.error.message);
      process.exit(1);
    }

    // Validate
    const result = validateTree(resolveResult.value);

    // Print validation errors
    for (const err of result.errors) {
      const rel = err.filePath ? relative(process.cwd(), err.filePath) : '';
      const location = rel ? `${rel}: ` : '';
      const id = err.entityId ? `[${err.entityId}] ` : '';
      console.log(chalk.red(`  ✗ ${location}${id}${err.code}: ${err.message}`));
    }

    // Print validation warnings
    for (const warn of result.warnings) {
      const rel = warn.filePath ? relative(process.cwd(), warn.filePath) : '';
      const location = rel ? `${rel}: ` : '';
      const id = warn.entityId ? `[${warn.entityId}] ` : '';
      console.log(
        chalk.yellow(`  ⚠ ${location}${id}${warn.code}: ${warn.message}`),
      );
    }

    if (!result.valid) {
      console.log();
      printError(
        `Validation failed with ${result.errors.length} error(s) and ${result.warnings.length} warning(s)`,
      );
      process.exit(1);
    }

    const entityCount =
      tree.stories.length +
      tree.epics.length +
      tree.milestones.length +
      tree.roadmaps.length +
      tree.prds.length;

    if (result.warnings.length > 0) {
      console.log();
      printWarning(`${result.warnings.length} warning(s)`);
    }

    printSuccess(`.meta/ tree is valid (${entityCount} entities)`);
  });
