import type { LinkStrategy } from '@gitpm/sync-github';
import { importFromGitHub } from '@gitpm/sync-github';
import type { LinkStrategy as GitLabLinkStrategy } from '@gitpm/sync-gitlab';
import { importFromGitLab } from '@gitpm/sync-gitlab';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveToken } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

const VALID_LINK_STRATEGIES = [
  'body-refs',
  'sub-issues',
  'milestone',
  'labels',
  'score',
  'all',
] as const;

const VALID_GITLAB_LINK_STRATEGIES = [
  'body-refs',
  'native-epics',
  'milestone',
  'labels',
  'all',
] as const;

export const importCommand = new Command('import')
  .description('Import project data from GitHub or GitLab into .meta/')
  .option(
    '--source <source>',
    'Source platform: github or gitlab (default: github)',
    'github',
  )
  .option('--repo <owner/repo>', 'GitHub repository (owner/repo)')
  .option(
    '--project <value>',
    'GitHub Project number or GitLab project path (namespace/project)',
  )
  .option('--token <token>', 'Personal access token')
  .option('--base-url <url>', 'GitLab base URL (default: https://gitlab.com)')
  .option(
    '--link-strategy <strategy>',
    'Epic-story linkage strategy (default: all)',
  )
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    const source: string = opts.source;

    if (source === 'gitlab') {
      await importGitLab(opts, metaDir);
    } else if (source === 'github') {
      await importGitHub(opts, metaDir);
    } else {
      printError(`Unknown source "${source}". Use "github" or "gitlab".`);
      process.exit(1);
    }
  });

async function importGitHub(
  opts: Record<string, string | undefined>,
  metaDir: string,
): Promise<void> {
  const repo = opts.repo;
  if (!repo?.includes('/') || repo.split('/').length !== 2) {
    printError('--repo is required for GitHub import. Expected "owner/repo".');
    process.exit(1);
  }

  let token: string;
  try {
    token = await resolveToken(opts.token);
  } catch (err) {
    printError(err instanceof Error ? err.message : 'Failed to resolve token.');
    process.exit(1);
  }

  const linkStrategy: LinkStrategy | undefined = opts.linkStrategy as
    | LinkStrategy
    | undefined;
  if (
    linkStrategy &&
    !VALID_LINK_STRATEGIES.includes(
      linkStrategy as (typeof VALID_LINK_STRATEGIES)[number],
    )
  ) {
    printError(
      `Invalid link strategy "${linkStrategy}". Must be one of: ${VALID_LINK_STRATEGIES.join(', ')}`,
    );
    process.exit(1);
  }

  const spinner = ora('Importing from GitHub...').start();

  const result = await importFromGitHub({
    token,
    repo,
    projectNumber: opts.project ? Number.parseInt(opts.project, 10) : undefined,
    metaDir,
    linkStrategy,
  });

  if (!result.ok) {
    spinner.fail('Import failed.');
    printError(result.error.message);
    process.exit(1);
  }

  spinner.succeed('Import complete.');
  printImportSummary(result.value);
}

async function importGitLab(
  opts: Record<string, string | undefined>,
  metaDir: string,
): Promise<void> {
  const project = opts.project ?? opts.repo;
  if (!project) {
    printError('--project (namespace/project) is required for GitLab import.');
    process.exit(1);
  }

  const token = opts.token ?? process.env.GITLAB_TOKEN;
  if (!token) {
    printError(
      'No GitLab token found. Provide via --token flag or GITLAB_TOKEN env var.',
    );
    process.exit(1);
  }

  const linkStrategy: GitLabLinkStrategy | undefined = opts.linkStrategy as
    | GitLabLinkStrategy
    | undefined;
  if (
    linkStrategy &&
    !VALID_GITLAB_LINK_STRATEGIES.includes(
      linkStrategy as (typeof VALID_GITLAB_LINK_STRATEGIES)[number],
    )
  ) {
    printError(
      `Invalid link strategy "${linkStrategy}". Must be one of: ${VALID_GITLAB_LINK_STRATEGIES.join(', ')}`,
    );
    process.exit(1);
  }

  const spinner = ora('Importing from GitLab...').start();

  const result = await importFromGitLab({
    token,
    project,
    baseUrl: opts.baseUrl,
    metaDir,
    linkStrategy,
  });

  if (!result.ok) {
    spinner.fail('Import failed.');
    printError(result.error.message);
    process.exit(1);
  }

  spinner.succeed('Import complete.');
  printImportSummary(result.value);
}

function printImportSummary(value: {
  milestones: number;
  epics: number;
  stories: number;
  totalFiles: number;
}): void {
  const { milestones, epics, stories, totalFiles } = value;
  console.log();
  console.log(chalk.bold('Summary:'));
  console.log(`  Milestones: ${milestones}`);
  console.log(`  Epics:      ${epics}`);
  console.log(`  Stories:    ${stories}`);
  console.log(`  Files:      ${totalFiles}`);
  console.log();
  printSuccess(
    `Imported ${milestones + epics + stories} entities (${totalFiles} files).`,
  );
  console.log(chalk.dim('Run `gitpm validate` to verify the imported tree.'));
}
