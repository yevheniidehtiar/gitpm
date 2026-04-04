import { loadConfig, syncWithGitHub } from '@gitpm/sync-github';
import type { ConflictStrategy } from '@gitpm/sync-github';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveToken } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { promptConflictResolution } from '../utils/conflict-ui.js';
import { printError, printSuccess } from '../utils/output.js';

export const syncCommand = new Command('sync')
  .description('Bidirectional sync between local .meta/ and GitHub')
  .option('--token <token>', 'GitHub personal access token')
  .option(
    '--strategy <strategy>',
    'Conflict resolution strategy (local-wins, remote-wins, ask)',
    'ask',
  )
  .option('--dry-run', 'Preview changes without syncing')
  .option('--yes', 'Skip confirmation prompt')
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

    if (opts.dryRun) {
      const spinner = ora('Calculating sync changes...').start();
      const result = await syncWithGitHub({
        token,
        repo,
        metaDir,
        strategy,
        dryRun: true,
      });

      if (!result.ok) {
        spinner.fail('Dry run failed.');
        printError(result.error.message);
        process.exit(1);
      }

      spinner.succeed('Dry run complete.');
      printSyncSummary(result.value);
      return;
    }

    if (!opts.yes) {
      const confirmed = await confirm({
        message: 'Run bidirectional sync with GitHub?',
        default: true,
      });
      if (!confirmed) {
        console.log(chalk.dim('Sync cancelled.'));
        return;
      }
    }

    const spinner = ora('Syncing with GitHub...').start();
    const result = await syncWithGitHub({
      token,
      repo,
      metaDir,
      strategy: strategy === 'ask' ? 'ask' : strategy,
    });

    if (!result.ok) {
      spinner.fail('Sync failed.');
      printError(result.error.message);
      process.exit(1);
    }

    spinner.succeed('Sync complete.');

    const { conflicts } = result.value;

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

    printSyncSummary(result.value);
  });

function printSyncSummary(result: {
  pushed: { milestones: number; issues: number };
  pulled: { milestones: number; issues: number };
  conflicts: unknown[];
  resolved: number;
  skipped: number;
}): void {
  const pushedTotal = result.pushed.milestones + result.pushed.issues;
  const pulledTotal = result.pulled.milestones + result.pulled.issues;

  console.log();
  console.log(chalk.bold('┌──────────────────────────────────────┐'));
  console.log(chalk.bold('│           Sync Complete              │'));
  console.log(chalk.bold('├──────────────────┬───────────────────┤'));
  console.log(
    `${chalk.bold('│')} Pushed to GitHub │ ${String(pushedTotal).padEnd(17)} ${chalk.bold('│')}`,
  );
  console.log(
    `${chalk.bold('│')} Pulled to local  │ ${String(pulledTotal).padEnd(17)} ${chalk.bold('│')}`,
  );
  console.log(
    `${chalk.bold('│')} Conflicts        │ ${String(`${result.resolved} resolved`).padEnd(17)} ${chalk.bold('│')}`,
  );
  console.log(
    `${chalk.bold('│')} Errors           │ ${String(result.skipped).padEnd(17)} ${chalk.bold('│')}`,
  );
  console.log(chalk.bold('└──────────────────┴───────────────────┘'));
  console.log();
  printSuccess('Sync complete.');
}
