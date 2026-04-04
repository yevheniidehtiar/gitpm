import { importFromGitHub } from '@gitpm/sync-github';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { resolveToken } from '../utils/auth.js';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

export const importCommand = new Command('import')
  .description('Import project data from GitHub into .meta/')
  .requiredOption('--repo <owner/repo>', 'GitHub repository (owner/repo)')
  .option('--project <number>', 'GitHub Project number', Number.parseInt)
  .option('--token <token>', 'GitHub personal access token')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

    // Validate repo format
    const repo: string = opts.repo;
    if (!repo.includes('/') || repo.split('/').length !== 2) {
      printError('Invalid repo format. Expected "owner/repo".');
      process.exit(1);
    }

    let token: string;
    try {
      token = await resolveToken(opts.token);
    } catch (err) {
      printError(
        err instanceof Error ? err.message : 'Failed to resolve token.',
      );
      process.exit(1);
    }

    const spinner = ora('Importing from GitHub...').start();

    const result = await importFromGitHub({
      token,
      repo,
      projectNumber: opts.project,
      metaDir,
    });

    if (!result.ok) {
      spinner.fail('Import failed.');
      printError(result.error.message);
      process.exit(1);
    }

    spinner.succeed('Import complete.');

    const { milestones, epics, stories, totalFiles } = result.value;
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
  });
