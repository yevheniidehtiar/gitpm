import {
  computeProjectProgress,
  type ProjectProgress,
  parseTree,
  resolveRefs,
} from '@gitpm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError } from '../utils/output.js';

function progressBar(ratio: number, width = 20): string {
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  if (ratio >= 0.75) return chalk.green(bar);
  if (ratio >= 0.25) return chalk.yellow(bar);
  return chalk.red(bar);
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function printProjectProgress(progress: ProjectProgress): void {
  console.log();
  console.log(chalk.bold('  Project Status'));
  console.log(chalk.dim(`  ${'─'.repeat(14)}`));

  const { overall } = progress;
  console.log(
    `  ${progressBar(overall.progress)} ${pct(overall.progress)} (${overall.done}/${overall.total} stories)`,
  );
  console.log();

  for (const ms of progress.milestones) {
    const dateStr = ms.targetDate
      ? chalk.dim(` — due ${ms.targetDate.slice(0, 10)}`)
      : '';
    console.log(
      chalk.bold(`  📌 ${ms.title}`) +
        dateStr +
        chalk.dim(` (${pct(ms.progress)})`),
    );

    for (const ep of ms.epics) {
      const counts = chalk.dim(
        `${ep.done}/${ep.total} done` +
          (ep.inProgress > 0 ? `, ${ep.inProgress} active` : '') +
          (ep.blocked > 0 ? `, ${ep.blocked} blocked` : ''),
      );
      console.log(
        `    ${progressBar(ep.progress, 16)} ${pct(ep.progress)} ${ep.title}`,
      );
      console.log(`    ${' '.repeat(16)}  ${counts}`);
    }

    if (ms.epics.length === 0) {
      console.log(chalk.dim('    (no epics linked)'));
    }
    console.log();
  }

  if (progress.orphanEpics.length > 0) {
    console.log(chalk.bold('  Unlinked Epics'));
    for (const ep of progress.orphanEpics) {
      const counts = chalk.dim(`${ep.done}/${ep.total} done`);
      console.log(
        `    ${progressBar(ep.progress, 16)} ${pct(ep.progress)} ${ep.title}  ${counts}`,
      );
    }
    console.log();
  }
}

export const statusCommand = new Command('status')
  .description('Show project progress across milestones and epics')
  .option('--json', 'Output as JSON')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

    const parseResult = await parseTree(metaDir);
    if (!parseResult.ok) {
      printError(parseResult.error.message);
      process.exit(1);
    }

    const resolveResult = resolveRefs(parseResult.value);
    if (!resolveResult.ok) {
      printError(resolveResult.error.message);
      process.exit(1);
    }

    const progress = computeProjectProgress(resolveResult.value);

    if (opts.json) {
      console.log(JSON.stringify(progress, null, 2));
      return;
    }

    if (progress.overall.total === 0) {
      console.log(chalk.dim('  No stories found in .meta/'));
      return;
    }

    printProjectProgress(progress);
  });
