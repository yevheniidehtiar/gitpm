import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { scaffoldMeta } from '@gitpm/core';
import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
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

export const initCommand = new Command('init')
  .description('Initialize a new .meta/ project structure')
  .argument('[project-name]', 'Name of the project')
  .action(async (nameArg: string | undefined, _opts, cmd) => {
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
  });
