import { runHooks } from '@gitpm/core';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveAdapter } from '../utils/adapters.js';
import { resolveToken } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

export const pushCommand = new Command('push')
  .description('Push local .meta/ changes to remote platform')
  .option('--token <token>', 'Personal access token')
  .option('--dry-run', 'Preview changes without pushing')
  .option('--yes', 'Skip confirmation prompt')
  .option('--adapter <name>', 'Force a specific adapter (e.g. github, gitlab)')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    const { adapter, config } = await resolveAdapter(metaDir, opts.adapter);

    let token: string | undefined;
    try {
      token = await resolveToken(opts.token);
    } catch {
      // Token resolution failed — adapter may use other credentials
    }

    // Run pre-export hook
    const preHook = await runHooks(config, 'pre-export', {
      metaDir,
      event: 'pre-export',
      adapterName: adapter.name,
    });
    if (!preHook.ok) {
      printError(`Pre-export hook failed: ${preHook.error.message}`);
      process.exit(1);
    }

    if (opts.dryRun) {
      const spinner = ora('Calculating changes...').start();
      const result = await adapter.export({
        token,
        metaDir,
        dryRun: true,
      });

      if (!result.ok) {
        spinner.fail('Dry run failed.');
        printError(result.error.message);
        process.exit(1);
      }

      spinner.succeed('Dry run complete.');
      printPreview(result.value);
      return;
    }

    const previewSpinner = ora('Calculating changes...').start();
    const preview = await adapter.export({
      token,
      metaDir,
      dryRun: true,
    });

    if (!preview.ok) {
      previewSpinner.fail('Failed to calculate changes.');
      printError(preview.error.message);
      process.exit(1);
    }

    previewSpinner.succeed('Changes calculated.');
    printPreview(preview.value);

    if (preview.value.totalChanges === 0) {
      printSuccess('Nothing to push — already in sync.');
      return;
    }

    if (!opts.yes) {
      const confirmed = await confirm({
        message: `Push these changes to ${adapter.displayName}?`,
        default: false,
      });
      if (!confirmed) {
        console.log(chalk.dim('Push cancelled.'));
        return;
      }
    }

    const pushSpinner = ora(`Pushing to ${adapter.displayName}...`).start();
    const result = await adapter.export({
      token,
      metaDir,
      dryRun: false,
    });

    if (!result.ok) {
      pushSpinner.fail('Push failed.');
      printError(result.error.message);
      process.exit(1);
    }

    pushSpinner.succeed('Push complete.');
    const { created, updated } = result.value;
    console.log(
      `  Created ${created.milestones + created.issues}, Updated ${updated.milestones + updated.issues}`,
    );

    // Run post-export hook
    await runHooks(config, 'post-export', {
      metaDir,
      event: 'post-export',
      adapterName: adapter.name,
    });
  });

function printPreview(result: {
  created: { milestones: number; issues: number };
  updated: { milestones: number; issues: number };
  totalChanges: number;
}): void {
  console.log();
  console.log(chalk.bold('Changes to push:'));
  console.log(`  New milestones: ${result.created.milestones}`);
  console.log(`  New issues:     ${result.created.issues}`);
  console.log(`  Updated milestones: ${result.updated.milestones}`);
  console.log(`  Updated issues:     ${result.updated.issues}`);
  console.log(`  Total changes:  ${result.totalChanges}`);
  console.log();
}
