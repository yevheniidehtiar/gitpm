import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { scaffoldMeta } from '@gitpm/core';
import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import { GITPM_SKILL_TEMPLATE } from '../templates/claude-skill.js';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

async function collectFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(rel);
      const children = await collectFiles(join(dir, entry.name), rel);
      results.push(...children);
    } else {
      results.push(rel);
    }
  }
  return results;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Writes the Claude Code skill template into the consumer project so
 * Claude sessions running in that repo auto-discover `gitpm` commands
 * and use them instead of grep/read/Edit on .meta/ files.
 *
 * The skill lives at `<projectRoot>/.claude/skills/gitpm/SKILL.md`,
 * where projectRoot is the directory containing `.meta/` — not cwd —
 * so the behavior is stable when `--meta-dir` points outside cwd.
 *
 * If a skill file already exists, we leave it alone and return a
 * "skipped" result rather than clobbering user edits.
 */
async function scaffoldClaudeSkill(
  metaDir: string,
): Promise<
  | { status: 'created'; path: string }
  | { status: 'skipped'; path: string; reason: string }
> {
  const projectRoot = dirname(resolve(metaDir));
  const skillDir = join(projectRoot, '.claude', 'skills', 'gitpm');
  const skillPath = join(skillDir, 'SKILL.md');

  if (await fileExists(skillPath)) {
    return {
      status: 'skipped',
      path: skillPath,
      reason: 'already exists',
    };
  }

  await mkdir(skillDir, { recursive: true });
  await writeFile(skillPath, GITPM_SKILL_TEMPLATE, 'utf-8');
  return { status: 'created', path: skillPath };
}

export const initCommand = new Command('init')
  .description('Initialize a new .meta/ project structure')
  .argument('[project-name]', 'Name of the project')
  .option(
    '--no-claude-skill',
    'Skip writing the Claude Code skill into .claude/skills/gitpm/',
  )
  .action(
    async (
      nameArg: string | undefined,
      opts: { claudeSkill?: boolean },
      cmd,
    ) => {
      const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

      let projectName = nameArg;
      if (!projectName) {
        projectName = await input({
          message: 'Project name:',
          required: true,
        });
      }

      const result = await scaffoldMeta(metaDir, projectName);

      if (!result.ok) {
        printError(result.error.message);
        process.exit(1);
      }

      // Print created file tree
      const files = await collectFiles(metaDir);
      console.log();
      console.log(chalk.bold('.meta/'));
      for (const file of files) {
        const parts = file.split('/');
        const indent = '  '.repeat(parts.length);
        const name = parts[parts.length - 1];
        const isDir = !name.includes('.');
        console.log(`${indent}${isDir ? chalk.blue(`${name}/`) : name}`);
      }

      const fileCount = files.filter((f) => f.includes('.')).length;
      console.log();
      printSuccess(`Created ${fileCount} files in .meta/`);

      // Scaffold the Claude Code skill (opt-out via --no-claude-skill).
      // commander sets opts.claudeSkill = false when --no-claude-skill
      // is passed, and leaves it undefined otherwise — so we default to on.
      if (opts.claudeSkill !== false) {
        const skillResult = await scaffoldClaudeSkill(metaDir);
        const relPath =
          relative(process.cwd(), skillResult.path) || skillResult.path;
        if (skillResult.status === 'created') {
          printSuccess(`Installed Claude Code skill at ${relPath}`);
        } else {
          console.log(
            chalk.dim(
              `• Claude Code skill at ${relPath} ${skillResult.reason} — skipped`,
            ),
          );
        }
      }
    },
  );
