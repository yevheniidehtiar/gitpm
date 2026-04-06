import type { ConflictStrategy } from '@gitpm/core';
import { runHooks } from '@gitpm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveAdapter } from '../utils/adapters.js';
import { resolveToken } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { promptConflictResolution } from '../utils/conflict-ui.js';
import { printError, printSuccess } from '../utils/output.js';

export const pullCommand = new Command('pull')
  .description('Pull changes from remote platform into local .meta/')
  .option('--token <token>', 'Personal access token')
  .option(
    '--strategy <strategy>',
    'Conflict resolution strategy (local-wins, remote-wins, ask)',
    'remote-wins',
  )
  .option('--adapter <name>', 'Force a specific adapter (e.g. github, gitlab)')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    const strategy = opts.strategy as ConflictStrategy;
    const { adapter, config } = await resolveAdapter(metaDir, opts.adapter);

    let token: string | undefined;
    try {
      token = await resolveToken(opts.token);
    } catch {
      // Token resolution failed — adapter may use other credentials
    }

    // Run pre-sync hook (pull is a sync operation with remote-wins bias)
    const preHook = await runHooks(config, 'pre-sync', {
      metaDir,
      event: 'pre-sync',
      adapterName: adapter.name,
    });
    if (!preHook.ok) {
      printError(`Pre-sync hook failed: ${preHook.error.message}`);
      process.exit(1);
    }

    const spinner = ora(`Pulling from ${adapter.displayName}...`).start();
    const result = await adapter.sync({
      token,
      metaDir,
      strategy: strategy === 'ask' ? 'ask' : strategy,
    });

    if (!result.ok) {
      spinner.fail('Pull failed.');
      printError(result.error.message);
      process.exit(1);
    }

    spinner.succeed('Pull complete.');
    await handleConflictsAndPrint(result.value, strategy);

    // Run post-sync hook
    await runHooks(config, 'post-sync', {
      metaDir,
      event: 'post-sync',
      adapterName: adapter.name,
    });
  });

async function handleConflictsAndPrint(
  result: {
    pulled: { milestones: number; issues: number };
    conflicts: unknown[];
    resolved: number;
    skipped: number;
  },
  strategy: ConflictStrategy,
): Promise<void> {
  const { pulled, conflicts, resolved, skipped } = result;

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

  console.log();
  console.log(chalk.bold('Pull Summary:'));
  console.log(`  Pulled: ${pulled.milestones + pulled.issues} changes`);
  console.log(`  Conflicts resolved: ${resolved}`);
  console.log(`  Skipped: ${skipped}`);
  console.log();
  printSuccess('Pull complete.');
}
