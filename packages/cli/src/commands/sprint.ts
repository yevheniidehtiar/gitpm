import { relative } from 'node:path';
import {
  createSprint,
  parseTree,
  type ResolvedSprint,
  resolveRefs,
} from '@gitpm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

function progressBar(ratio: number, width = 16): string {
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  if (ratio >= 0.75) return chalk.green(bar);
  if (ratio >= 0.25) return chalk.yellow(bar);
  return chalk.red(bar);
}

function sprintProgress(sprint: ResolvedSprint): {
  done: number;
  total: number;
  ratio: number;
} {
  const total = sprint.resolvedStories.length;
  const done = sprint.resolvedStories.filter(
    (s) => s.status === 'done' || s.status === 'cancelled',
  ).length;
  return { done, total, ratio: total > 0 ? done / total : 0 };
}

const sprintCreateCommand = new Command('create')
  .description('Create a new sprint')
  .requiredOption('--title <title>', 'Sprint title')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--capacity <points>', 'Story point capacity', Number.parseInt)
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    const result = await createSprint(metaDir, {
      title: opts.title,
      startDate: opts.start,
      endDate: opts.end,
      capacity: opts.capacity,
    });

    if (!result.ok) {
      printError(result.error.message);
      process.exit(1);
    }

    const rel = relative(process.cwd(), result.value.filePath);
    printSuccess(`Created sprint: ${rel} (${result.value.id})`);
  });

const sprintListCommand = new Command('list')
  .description('List all sprints with progress')
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

    const sprints = resolveResult.value.sprints;

    if (opts.json) {
      const data = sprints.map((sp) => {
        const { done, total, ratio } = sprintProgress(sp);
        return {
          id: sp.id,
          title: sp.title,
          status: sp.status,
          start_date: sp.start_date,
          end_date: sp.end_date,
          capacity: sp.capacity,
          stories: total,
          done,
          progress: ratio,
        };
      });
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (sprints.length === 0) {
      console.log(
        chalk.dim('  No sprints found. Create one with: gitpm sprint create'),
      );
      return;
    }

    console.log();
    console.log(chalk.bold('  Sprints'));
    console.log(chalk.dim(`  ${'─'.repeat(7)}`));

    for (const sp of sprints) {
      const { done, total, ratio } = sprintProgress(sp);
      const pct = Math.round(ratio * 100);
      const dateRange = chalk.dim(
        `${sp.start_date.slice(0, 10)} → ${sp.end_date.slice(0, 10)}`,
      );
      const cap = sp.capacity ? chalk.dim(` (cap: ${sp.capacity}pts)`) : '';

      console.log(
        `  ${progressBar(ratio)} ${pct}% ${sp.title} ${dateRange}${cap}`,
      );
      console.log(
        `  ${' '.repeat(16)}  ${chalk.dim(`${done}/${total} stories`)} ${chalk.cyan(sp.status)}`,
      );
    }
    console.log();
  });

const sprintShowCommand = new Command('show')
  .description('Show sprint details')
  .argument('<sprint-id>', 'Sprint ID')
  .action(async (sprintId, _opts, cmd) => {
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

    const sprint = resolveResult.value.sprints.find((s) => s.id === sprintId);
    if (!sprint) {
      printError(`Sprint not found: ${sprintId}`);
      process.exit(1);
    }

    const { done, total, ratio } = sprintProgress(sprint);
    const pct = Math.round(ratio * 100);

    console.log();
    console.log(chalk.bold(`  ${sprint.title}`));
    console.log(chalk.dim(`  ${'─'.repeat(sprint.title.length)}`));
    console.log(`  Status: ${chalk.cyan(sprint.status)}`);
    console.log(
      `  Period: ${sprint.start_date.slice(0, 10)} → ${sprint.end_date.slice(0, 10)}`,
    );
    if (sprint.capacity) console.log(`  Capacity: ${sprint.capacity} pts`);
    console.log(`  Progress: ${progressBar(ratio)} ${pct}% (${done}/${total})`);
    console.log();

    if (sprint.resolvedStories.length > 0) {
      console.log(chalk.bold('  Stories:'));
      for (const story of sprint.resolvedStories) {
        const statusColor =
          story.status === 'done'
            ? chalk.green
            : story.status === 'in_progress'
              ? chalk.yellow
              : chalk.dim;
        console.log(
          `    ${statusColor('●')} ${story.title} ${chalk.dim(`[${story.status}]`)}`,
        );
      }
    } else {
      console.log(chalk.dim('  No stories assigned.'));
    }
    console.log();
  });

export const sprintCommand = new Command('sprint')
  .description('Manage sprints (time-boxed iterations)')
  .addCommand(sprintCreateCommand)
  .addCommand(sprintListCommand)
  .addCommand(sprintShowCommand);
