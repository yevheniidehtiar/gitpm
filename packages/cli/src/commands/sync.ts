import type { ConflictStrategy } from '@gitpm/core';
import { runHooks } from '@gitpm/core';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveAdapter } from '../utils/adapters.js';
import { resolveToken } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { promptConflictResolution } from '../utils/conflict-ui.js';
import { printError, printSuccess } from '../utils/output.js';

const VALID_STRATEGIES = ['local-wins', 'remote-wins', 'ask'] as const;

export const syncCommand = new Command('sync')
  .description('Bidirectional sync between local .meta/ and remote platform')
  .option('--token <token>', 'Personal access token')
  .option(
    '--strategy <strategy>',
    'Conflict resolution strategy (local-wins, remote-wins, ask)',
    'ask',
  )
  .option('--dry-run', 'Preview changes without syncing')
  .option('--yes', 'Skip confirmation prompt')
  .option('--adapter <name>', 'Force a specific adapter (e.g. github, gitlab)')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    if (!VALID_STRATEGIES.includes(opts.strategy)) {
      printError(
        `Invalid strategy "${opts.strategy}". Must be one of: ${VALID_STRATEGIES.join(', ')}`,
      );
      process.exit(1);
    }
    const strategy = opts.strategy as ConflictStrategy;
    const { adapter, config } = await resolveAdapter(metaDir, opts.adapter);

    let token: string | undefined;
    try {
      token = await resolveToken(opts.token);
    } catch {
      // Token resolution failed — adapter may use other credentials
    }

    if (opts.dryRun) {
      const spinner = ora('Calculating sync changes...').start();
      const result = await adapter.sync({
        token,
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
      printSyncSummary(result.value, adapter.displayName);
      return;
    }

    if (!opts.yes) {
      const confirmed = await confirm({
        message: `Run bidirectional sync with ${adapter.displayName}?`,
        default: true,
      });
      if (!confirmed) {
        console.log(chalk.dim('Sync cancelled.'));
        return;
      }
    }

    // Run pre-sync hook (after confirmation, before actual sync)
    const preHook = await runHooks(config, 'pre-sync', {
      metaDir,
      event: 'pre-sync',
      adapterName: adapter.name,
    });
    if (!preHook.ok) {
      printError(`Pre-sync hook failed: ${preHook.error.message}`);
      process.exit(1);
    }

    const spinner = ora(`Syncing with ${adapter.displayName}...`).start();
    const result = await adapter.sync({
      token,
      metaDir,
      strategy,
    });

    if (!result.ok) {
      spinner.fail('Sync failed.');
      printError(result.error.message);
      process.exit(1);
    }

    spinner.succeed('Sync complete.');
    await handleConflicts(result.value, strategy);
    printSyncSummary(result.value, adapter.displayName);

    // Run post-sync hook
    await runHooks(config, 'post-sync', {
      metaDir,
      event: 'post-sync',
      adapterName: adapter.name,
    });
  });

async function handleConflicts(
  result: {
    conflicts: unknown[];
  },
  strategy: ConflictStrategy,
): Promise<void> {
  const { conflicts } = result;
  if (strategy === 'ask' && conflicts.length > 0) {
    console.log();
    console.log(
      chalk.yellow(`${conflicts.length} conflict(s) require resolution:`),
    );
    const resolutions = await promptConflictResolution(
      conflicts as Parameters<typeof promptConflictResolution>[0],
    );
    console.log(
      chalk.dim(
        `Resolved ${resolutions.length}, skipped ${conflicts.length - resolutions.length}`,
      ),
    );
  }
}

function printSyncSummary(
  result: {
    pushed: { milestones: number; issues: number };
    pulled: { milestones: number; issues: number };
    conflicts: unknown[];
    resolved: number;
    skipped: number;
  },
  platform: string,
): void {
  const pushedTotal = result.pushed.milestones + result.pushed.issues;
  const pulledTotal = result.pulled.milestones + result.pulled.issues;

  console.log();
  console.log(chalk.bold('┌──────────────────────────────────────┐'));
  console.log(chalk.bold('│           Sync Complete              │'));
  console.log(chalk.bold('├──────────────────┬───────────────────┤'));
  console.log(
    `${chalk.bold('│')} Pushed to ${platform.padEnd(6)} │ ${String(pushedTotal).padEnd(17)} ${chalk.bold('│')}`,
  );
  console.log(
    `${chalk.bold('│')} Pulled to local  │ ${String(pulledTotal).padEnd(17)} ${chalk.bold('│')}`,
  );
  console.log(
    `${chalk.bold('│')} Conflicts        │ ${String(`${result.resolved} resolved`).padEnd(17)} ${chalk.bold('│')}`,
  );
  console.log(
    `${chalk.bold('│')} Skipped          │ ${String(result.skipped).padEnd(17)} ${chalk.bold('│')}`,
  );
  console.log(chalk.bold('└──────────────────┴───────────────────┘'));
  console.log();
  printSuccess('Sync complete.');
}
