import {
  loadConfig as loadGitHubConfig,
  syncWithGitHub,
} from '@gitpm/sync-github';
import type { ConflictStrategy } from '@gitpm/sync-github';
import {
  loadConfig as loadGitLabConfig,
  syncWithGitLab,
} from '@gitpm/sync-gitlab';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveToken } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { promptConflictResolution } from '../utils/conflict-ui.js';
import { printError, printSuccess } from '../utils/output.js';

export const pullCommand = new Command('pull')
  .description('Pull changes from GitHub or GitLab into local .meta/')
  .option('--token <token>', 'Personal access token')
  .option(
    '--strategy <strategy>',
    'Conflict resolution strategy (local-wins, remote-wins, ask)',
    'remote-wins',
  )
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    const strategy = opts.strategy as ConflictStrategy;

    // Detect platform
    const ghConfig = await loadGitHubConfig(metaDir);
    const glConfig = await loadGitLabConfig(metaDir);

    if (glConfig.ok) {
      await pullFromGitLab(opts, metaDir, glConfig.value, strategy);
    } else if (ghConfig.ok) {
      await pullFromGitHub(opts, metaDir, ghConfig.value.repo, strategy);
    } else {
      printError(
        'No sync config found. Run `gitpm import` first to set up sync.',
      );
      process.exit(1);
    }
  });

async function pullFromGitHub(
  opts: Record<string, string | undefined>,
  metaDir: string,
  repo: string,
  strategy: ConflictStrategy,
): Promise<void> {
  let token: string;
  try {
    token = await resolveToken(opts.token);
  } catch (err) {
    printError(err instanceof Error ? err.message : 'Failed to resolve token.');
    process.exit(1);
  }

  const spinner = ora('Pulling from GitHub...').start();
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
  await handleConflictsAndPrint(result.value, strategy);
}

async function pullFromGitLab(
  opts: Record<string, string | undefined>,
  metaDir: string,
  config: { project: string; project_id: number; base_url: string },
  strategy: ConflictStrategy,
): Promise<void> {
  const token = opts.token ?? process.env.GITLAB_TOKEN;
  if (!token) {
    printError(
      'No GitLab token found. Provide via --token flag or GITLAB_TOKEN env var.',
    );
    process.exit(1);
  }

  const spinner = ora('Pulling from GitLab...').start();
  const result = await syncWithGitLab({
    token,
    project: config.project,
    projectId: config.project_id,
    baseUrl: config.base_url,
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
}

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
