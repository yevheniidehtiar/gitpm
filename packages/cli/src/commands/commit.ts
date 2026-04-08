import { execSync } from 'node:child_process';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

export const commitCommand = new Command('commit')
  .description('Commit all .meta/ changes atomically')
  .requiredOption('-m, --message <message>', 'Commit message')
  .option('--author <author>', 'Git author (e.g. "Name <email>")')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

    try {
      // Stage all .meta/ changes
      execSync(`git add "${metaDir}"`, { stdio: 'pipe' });

      // Check if there are staged changes
      try {
        execSync('git diff --cached --quiet', { stdio: 'pipe' });
        // If the above succeeds, there are no staged changes
        printError('No changes to commit in .meta/');
        process.exit(1);
      } catch {
        // Good — there are staged changes
      }

      // Build commit command
      const args = ['git', 'commit', '-m', opts.message];
      if (opts.author) {
        args.push('--author', opts.author);
      }

      // Execute commit, bypassing commitizen hook which causes issues for agents
      const env = { ...process.env, SKIP: 'commitizen' };

      const result = execSync(args.join(' '), {
        stdio: 'pipe',
        env,
        encoding: 'utf-8',
      });

      // Extract commit hash from output
      const hashMatch = result.match(/\[[\w-/]+ ([a-f0-9]+)\]/);
      const hash = hashMatch ? hashMatch[1] : '';

      printSuccess(`Committed${hash ? ` (${hash})` : ''}: ${opts.message}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? (err as { stderr?: string }).stderr || err.message
          : String(err);
      printError(`Commit failed: ${message}`);
      process.exit(1);
    }
  });
