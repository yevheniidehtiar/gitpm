import {
  exportToGitHub,
  loadConfig as loadGitHubConfig,
} from '@gitpm/sync-github';
import {
  exportToGitLab,
  loadConfig as loadGitLabConfig,
} from '@gitpm/sync-gitlab';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveToken } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

export const pushCommand = new Command('push')
  .description('Push local .meta/ changes to GitHub or GitLab')
  .option('--token <token>', 'Personal access token')
  .option('--dry-run', 'Preview changes without pushing')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

    // Detect which platform config exists
    const ghConfig = await loadGitHubConfig(metaDir);
    const glConfig = await loadGitLabConfig(metaDir);

    if (glConfig.ok) {
      await pushToGitLab(opts, metaDir, glConfig.value);
    } else if (ghConfig.ok) {
      await pushToGitHub(opts, metaDir, ghConfig.value.repo);
    } else {
      printError(
        'No sync config found. Run `gitpm import` first to set up sync.',
      );
      process.exit(1);
    }
  });

async function pushToGitHub(
  opts: Record<string, string | boolean | undefined>,
  metaDir: string,
  repo: string,
): Promise<void> {
  let token: string;
  try {
    token = await resolveToken(opts.token as string | undefined);
  } catch (err) {
    printError(err instanceof Error ? err.message : 'Failed to resolve token.');
    process.exit(1);
  }

  if (opts.dryRun) {
    const spinner = ora('Calculating changes...').start();
    const result = await exportToGitHub({ token, repo, metaDir, dryRun: true });

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
  const result = await exportToGitHub({ token, repo, metaDir, dryRun: false });

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
}

async function pushToGitLab(
  opts: Record<string, string | boolean | undefined>,
  metaDir: string,
  config: { project: string; project_id: number; base_url: string },
): Promise<void> {
  const token = (opts.token as string | undefined) ?? process.env.GITLAB_TOKEN;
  if (!token) {
    printError(
      'No GitLab token found. Provide via --token flag or GITLAB_TOKEN env var.',
    );
    process.exit(1);
  }

  if (opts.dryRun) {
    const spinner = ora('Calculating changes...').start();
    const result = await exportToGitLab({
      token,
      project: config.project,
      projectId: config.project_id,
      baseUrl: config.base_url,
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
  const preview = await exportToGitLab({
    token,
    project: config.project,
    projectId: config.project_id,
    baseUrl: config.base_url,
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
      message: 'Push these changes to GitLab?',
      default: false,
    });
    if (!confirmed) {
      console.log(chalk.dim('Push cancelled.'));
      return;
    }
  }

  const pushSpinner = ora('Pushing to GitLab...').start();
  const result = await exportToGitLab({
    token,
    project: config.project,
    projectId: config.project_id,
    baseUrl: config.base_url,
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
}

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
