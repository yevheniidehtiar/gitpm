import {
  loadConfig as loadGitHubConfig,
  syncWithGitHub,
} from '@gitpm/sync-github';
import type { ConflictStrategy } from '@gitpm/sync-github';
import {
  loadConfig as loadGitLabConfig,
  syncWithGitLab,
} from '@gitpm/sync-gitlab';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveToken } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { promptConflictResolution } from '../utils/conflict-ui.js';
import { printError, printSuccess } from '../utils/output.js';

export const syncCommand = new Command('sync')
  .description('Bidirectional sync between local .meta/ and GitHub/GitLab')
  .option('--token <token>', 'Personal access token')
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

    // Detect platform
    const ghConfig = await loadGitHubConfig(metaDir);
    const glConfig = await loadGitLabConfig(metaDir);

    if (glConfig.ok) {
      await syncGitLab(opts, metaDir, glConfig.value, strategy);
    } else if (ghConfig.ok) {
      await syncGitHub(opts, metaDir, ghConfig.value.repo, strategy);
    } else {
      printError(
        'No sync config found. Run `gitpm import` first to set up sync.',
      );
      process.exit(1);
    }
  });

async function syncGitHub(
  opts: Record<string, string | boolean | undefined>,
  metaDir: string,
  repo: string,
  strategy: ConflictStrategy,
): Promise<void> {
  let token: string;
  try {
    token = await resolveToken(opts.token as string | undefined);
  } catch (err) {
    printError(err instanceof Error ? err.message : 'Failed to resolve token.');
    process.exit(1);
  }

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
    printSyncSummary(result.value, 'GitHub');
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
  await handleConflicts(result.value, strategy);
  printSyncSummary(result.value, 'GitHub');
}

async function syncGitLab(
  opts: Record<string, string | boolean | undefined>,
  metaDir: string,
  config: { project: string; project_id: number; base_url: string },
  strategy: ConflictStrategy,
): Promise<void> {
  const token = (opts.token as string | undefined) ?? process.env.GITLAB_TOKEN;
  if (!token) {
    printError(
      'No GitLab token found. Provide via --token flag or GITLAB_TOKEN env var.',
    );
    process.exit(1);
  }

  if (opts.dryRun) {
    const spinner = ora('Calculating sync changes...').start();
    const result = await syncWithGitLab({
      token,
      project: config.project,
      projectId: config.project_id,
      baseUrl: config.base_url,
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
    printSyncSummary(result.value, 'GitLab');
    return;
  }

  if (!opts.yes) {
    const confirmed = await confirm({
      message: 'Run bidirectional sync with GitLab?',
      default: true,
    });
    if (!confirmed) {
      console.log(chalk.dim('Sync cancelled.'));
      return;
    }
  }

  const spinner = ora('Syncing with GitLab...').start();
  const result = await syncWithGitLab({
    token,
    project: config.project,
    projectId: config.project_id,
    baseUrl: config.base_url,
    metaDir,
    strategy: strategy === 'ask' ? 'ask' : strategy,
  });

  if (!result.ok) {
    spinner.fail('Sync failed.');
    printError(result.error.message);
    process.exit(1);
  }

  spinner.succeed('Sync complete.');
  await handleConflicts(result.value, strategy);
  printSyncSummary(result.value, 'GitLab');
}

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
    `${chalk.bold('│')} Errors           │ ${String(result.skipped).padEnd(17)} ${chalk.bold('│')}`,
  );
  console.log(chalk.bold('└──────────────────┴───────────────────┘'));
  console.log();
  printSuccess('Sync complete.');
}
