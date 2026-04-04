import { exportToGitHub, loadConfig } from '@gitpm/sync-github';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveToken } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

export const pushCommand = new Command('push')
  .description('Push local .meta/ changes to GitHub')
  .option('--token <token>', 'GitHub personal access token')
  .option('--dry-run', 'Preview changes without pushing')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

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
      const spinner = ora('Calculating changes...').start();
      const result = await exportToGitHub({
        token,
        repo,
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

    // First do a dry run to preview
    const previewSpinner = ora('Calculating changes...').start();
    const preview = await exportToGitHub({
      token,
      repo,
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
        message: 'Push these changes to GitHub?',
        default: false,
      });
      if (!confirmed) {
        console.log(chalk.dim('Push cancelled.'));
        return;
      }
    }

    const pushSpinner = ora('Pushing to GitHub...').start();
    const result = await exportToGitHub({
      token,
      repo,
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
    const unchanged =
      result.value.totalChanges -
      created.milestones -
      created.issues -
      updated.milestones -
      updated.issues;
    console.log(
      `  Created ${created.milestones + created.issues}, Updated ${updated.milestones + updated.issues}, Unchanged ${Math.max(0, unchanged)}`,
    );
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
