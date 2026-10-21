import { dirname } from 'node:path';
import {
  findAdapterByName,
  loadAdapters,
  loadGitpmConfig,
  runHooks,
} from '@gitpm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveCredentials } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

const VALID_LINK_STRATEGIES = [
  'body-refs',
  'sub-issues',
  'milestone',
  'labels',
  'score',
  'all',
  'native-epics',
] as const;

export const importCommand = new Command('import')
  .description('Import project data from a remote platform into .meta/')
  .option(
    '--source <source>',
    'Source platform: github, gitlab, jira, linear, or bitbucket (default: github)',
    'github',
  )
  .option('--repo <owner/repo>', 'GitHub repository (owner/repo)')
  .option(
    '--project <value>',
    'GitHub Project number, GitLab project path (namespace/project), or Jira project key',
  )
  .option('--token <token>', 'Personal access token')
  .option(
    '--base-url <url>',
    'GitLab base URL (default: https://gitlab.com) or Jira site URL',
  )
  .option('--site <host>', 'Jira site, e.g. mycompany.atlassian.net')
  .option('--project-key <key>', 'Jira project key, e.g. PROJ')
  .option('--board <id>', 'Jira board ID (optional, for sprint import)')
  .option('--team <id>', 'Linear team ID')
  .option(
    '--api-key <key>',
    'Linear API key (default: LINEAR_API_KEY environment variable)',
  )
  .option(
    '--link-strategy <strategy>',
    'Epic-story linkage strategy (default: all)',
  )
  .option('--adapter <name>', 'Force a specific adapter by name')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    const source: string = opts.adapter ?? opts.source;

    // Load config and adapters
    const rootDir = dirname(metaDir);
    const configResult = await loadGitpmConfig(rootDir);
    if (!configResult.ok) {
      printError(`Failed to load config: ${configResult.error.message}`);
      process.exit(1);
    }
    const config = configResult.value;

    const adaptersResult = await loadAdapters(config, rootDir);
    if (!adaptersResult.ok) {
      printError(`Failed to load adapters: ${adaptersResult.error.message}`);
      process.exit(1);
    }

    const adapter = findAdapterByName(adaptersResult.value, source);
    if (!adapter) {
      const available = adaptersResult.value.map((a) => a.name);
      if (available.length === 0) {
        printError(
          `Adapter "${source}" is not installed. Install it with:\n  npm install -g @gitpm/sync-${source}`,
        );
      } else {
        printError(
          `Adapter "${source}" not found. Available: ${available.join(', ')}\n` +
            `Install it with: npm install -g @gitpm/sync-${source}`,
        );
      }
      process.exit(1);
    }

    // Validate link strategy
    const linkStrategy = opts.linkStrategy;
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

    const { token, email } = resolveCredentials(adapter.name, opts.token);

    // Run pre-import hook
    const preHook = await runHooks(config, 'pre-import', {
      metaDir,
      event: 'pre-import',
      adapterName: adapter.name,
    });
    if (!preHook.ok) {
      printError(`Pre-import hook failed: ${preHook.error.message}`);
      process.exit(1);
    }

    const spinner = ora(`Importing from ${adapter.displayName}...`).start();

    const jira = resolveJiraOptions(adapter.name, opts);

    const result = await adapter.import({
      token,
      email,
      repo: opts.repo,
      project: opts.project ?? opts.repo,
      projectNumber:
        opts.project && !Number.isNaN(Number.parseInt(opts.project, 10))
          ? Number.parseInt(opts.project, 10)
          : undefined,
      baseUrl: opts.baseUrl,
      ...jira,
      teamId: opts.team,
      apiKey: opts.apiKey,
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

    // Run post-import hook
    await runHooks(config, 'post-import', {
      metaDir,
      event: 'post-import',
      adapterName: adapter.name,
      result: result.value,
    });
  });

interface JiraImportOptions {
  site?: string;
  projectKey?: string;
  boardId?: number;
}

/**
 * Resolve Jira-specific import options from CLI flags.
 * `--site` and `--project-key` win. When the source is Jira, `--base-url`
 * falls back to the site (protocol and trailing slash stripped) and
 * `--project` falls back to the project key, so older documented
 * invocations keep working.
 */
export function resolveJiraOptions(
  adapterName: string,
  opts: {
    site?: string;
    projectKey?: string;
    board?: string;
    baseUrl?: string;
    project?: string;
  },
): JiraImportOptions {
  const isJira = adapterName === 'jira';
  const site =
    opts.site ??
    (isJira && opts.baseUrl ? siteFromUrl(opts.baseUrl) : undefined);
  const projectKey = opts.projectKey ?? (isJira ? opts.project : undefined);
  const boardId =
    opts.board !== undefined && !Number.isNaN(Number.parseInt(opts.board, 10))
      ? Number.parseInt(opts.board, 10)
      : undefined;
  return { site, projectKey, boardId };
}

function siteFromUrl(url: string): string {
  return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '');
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
