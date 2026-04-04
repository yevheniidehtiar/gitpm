import { loadConfig, syncWithGitHub } from '@gitpm/sync-github';
import type { ConflictStrategy } from '@gitpm/sync-github';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveToken } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { promptConflictResolution } from '../utils/conflict-ui.js';
import { printError, printSuccess } from '../utils/output.js';

export const pullCommand = new Command('pull')
  .description('Pull changes from GitHub into local .meta/')
  .option('--token <token>', 'GitHub personal access token')
  .option(
    '--strategy <strategy>',
    'Conflict resolution strategy (local-wins, remote-wins, ask)',
    'remote-wins',
  )
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    const strategy = opts.strategy as ConflictStrategy;

    let token: string;
    try {
      token = await resolveToken(opts.token);
    } catch (err) {
      printError(
        err instanceof Error ? err.message : 'Failed to resolve token.',
      );
      process.exit(1);
    }

    // Load config to get repo
    const configResult = await loadConfig(metaDir);
    if (!configResult.ok) {
      printError(
        'No sync config found. Run `gitpm import` first to set up sync.',
      );
      process.exit(1);
    }
    const repo = configResult.value.repo;

    const spinner = ora('Pulling from GitHub...').start();

    // Use sync with the given strategy — pull uses remote-wins by default
    const result = await syncWithGitHub({
      token,
      repo,
      metaDir,
      strategy: strategy === 'ask' ? 'ask' : strategy,
    });

    if (!result.ok) {
      spinner.fail('Pull failed.');
      printError(result.error.message);
      process.exit(1);
    }

    spinner.succeed('Pull complete.');

    const { pulled, conflicts, resolved, skipped } = result.value;

    // Handle interactive conflict resolution if strategy is 'ask'
    if (strategy === 'ask' && conflicts.length > 0) {
      console.log();
      console.log(
        chalk.yellow(`${conflicts.length} conflict(s) require resolution:`),
      );
      const resolutions = await promptConflictResolution(conflicts);
      console.log(
        chalk.dim(
          `Resolved ${resolutions.length}, skipped ${conflicts.length - resolutions.length}`,
        ),
      );
    }

    console.log();
    console.log(chalk.bold('Pull Summary:'));
    console.log(`  Pulled: ${pulled.milestones + pulled.issues} changes`);
    console.log(`  Conflicts resolved: ${resolved}`);
    console.log(`  Skipped: ${skipped}`);
    console.log();
    printSuccess('Pull complete.');
  });
