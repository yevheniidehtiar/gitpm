import { relative, resolve } from 'node:path';
import type { ParsedEntity } from '@gitpm/core';
import { parseTree, resolveRefs } from '@gitpm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError } from '../utils/output.js';

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return chalk.dim('—');
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : chalk.dim('[]');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (key === 'priority') {
    const p = String(value);
    switch (p) {
      case 'critical':
        return chalk.red(p);
      case 'high':
        return chalk.yellow(p);
      case 'medium':
        return chalk.blue(p);
      default:
        return chalk.dim(p);
    }
  }
  if (key === 'status') {
    const s = String(value);
    switch (s) {
      case 'done':
        return chalk.green(s);
      case 'in_progress':
      case 'in_review':
        return chalk.cyan(s);
      case 'cancelled':
        return chalk.strikethrough(chalk.dim(s));
      default:
        return s;
    }
  }
  return String(value);
}

const RESOLVED_KEYS = new Set([
  'resolvedStories',
  'resolvedEpic',
  'resolvedEpics',
  'resolvedMilestone',
  'resolvedMilestones',
  'resolvedPrds',
]);

function displayEntity(entity: ParsedEntity, full: boolean): void {
  const { filePath, body, ...frontmatter } = entity as Record<string, unknown>;

  console.log(chalk.bold(entity.title));
  console.log(chalk.dim(relative(process.cwd(), entity.filePath)));
  console.log();

  for (const [key, value] of Object.entries(frontmatter)) {
    if (key === 'title' || RESOLVED_KEYS.has(key)) continue;
    console.log(`  ${chalk.dim(`${key}:`)} ${formatFieldValue(key, value)}`);
  }

  if (full && typeof body === 'string' && body.trim()) {
    console.log();
    console.log(body);
  }
  console.log();
}

function displayStoryRow(story: Record<string, unknown>): void {
  const pri = story.priority as string;
  let priBullet: string;
  switch (pri) {
    case 'critical':
      priBullet = chalk.red('●');
      break;
    case 'high':
      priBullet = chalk.yellow('●');
      break;
    case 'medium':
      priBullet = chalk.blue('●');
      break;
    default:
      priBullet = chalk.dim('●');
  }
  const status = chalk.dim(`[${story.status}]`);
  const id = chalk.dim(`(${story.id})`);
  console.log(`  ${priBullet} ${status} ${story.title} ${id}`);
}

export const showCommand = new Command('show')
  .description('Display .meta/ entities with structured output')
  .argument('[target]', 'Entity file path or ID')
  .option('--epic <epic>', 'Show an epic and all its stories (by ID or slug)')
  .option(
    '--milestone <milestone>',
    'Show a milestone and linked epics (by ID)',
  )
  .option('--full', 'Include body content', false)
  .option('--format <format>', 'Output format: pretty, json', 'pretty')
  .action(async (target, opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

    const parseResult = await parseTree(metaDir);
    if (!parseResult.ok) {
      printError(parseResult.error.message);
      process.exit(1);
    }

    const tree = parseResult.value;
    const resolveResult = resolveRefs(tree);
    if (!resolveResult.ok) {
      printError(resolveResult.error.message);
      process.exit(1);
    }
    const resolved = resolveResult.value;

    if (opts.format === 'json') {
      if (opts.epic) {
        const epic = resolved.epics.find(
          (e) =>
            e.id === opts.epic || e.filePath.includes(`/epics/${opts.epic}/`),
        );
        if (!epic) {
          printError(`Epic not found: ${opts.epic}`);
          process.exit(1);
        }
        console.log(
          JSON.stringify({ epic, stories: epic.resolvedStories }, null, 2),
        );
        return;
      }
      if (opts.milestone) {
        const ms = resolved.milestones.find((m) => m.id === opts.milestone);
        if (!ms) {
          printError(`Milestone not found: ${opts.milestone}`);
          process.exit(1);
        }
        console.log(
          JSON.stringify({ milestone: ms, epics: ms.resolvedEpics }, null, 2),
        );
        return;
      }
      if (target) {
        const entity = findEntity(tree, target);
        if (!entity) {
          printError(`Entity not found: ${target}`);
          process.exit(1);
        }
        console.log(JSON.stringify(entity, null, 2));
        return;
      }
      printError('Specify a target, --epic, or --milestone');
      process.exit(1);
    }

    // Pretty format
    if (opts.epic) {
      const epic = resolved.epics.find(
        (e) =>
          e.id === opts.epic || e.filePath.includes(`/epics/${opts.epic}/`),
      );
      if (!epic) {
        printError(`Epic not found: ${opts.epic}`);
        process.exit(1);
      }
      displayEntity(epic, opts.full);

      if (epic.resolvedStories.length > 0) {
        console.log(chalk.bold(`Stories (${epic.resolvedStories.length}):`));
        for (const story of epic.resolvedStories) {
          displayStoryRow(story as unknown as Record<string, unknown>);
        }
        console.log();
      }
      return;
    }

    if (opts.milestone) {
      const ms = resolved.milestones.find((m) => m.id === opts.milestone);
      if (!ms) {
        printError(`Milestone not found: ${opts.milestone}`);
        process.exit(1);
      }
      displayEntity(ms, opts.full);

      if (ms.resolvedEpics.length > 0) {
        console.log(chalk.bold(`Epics (${ms.resolvedEpics.length}):`));
        for (const epic of ms.resolvedEpics) {
          displayStoryRow(epic as unknown as Record<string, unknown>);
        }
        console.log();
      }
      return;
    }

    if (target) {
      const entity = findEntity(tree, target);
      if (!entity) {
        printError(`Entity not found: ${target}`);
        process.exit(1);
      }
      displayEntity(entity, opts.full);
      return;
    }

    printError('Specify a target, --epic, or --milestone');
    process.exit(1);
  });

function findEntity(
  tree: {
    stories: ParsedEntity[];
    epics: ParsedEntity[];
    milestones: ParsedEntity[];
    roadmaps: ParsedEntity[];
    prds: ParsedEntity[];
  },
  target: string,
): ParsedEntity | undefined {
  const all = [
    ...tree.stories,
    ...tree.epics,
    ...tree.milestones,
    ...tree.roadmaps,
    ...tree.prds,
  ];

  // Try by file path (resolve relative to cwd)
  const resolved = resolve(process.cwd(), target);
  const byPath = all.find((e) => e.filePath === resolved);
  if (byPath) return byPath;

  // Try by ID
  return all.find((e) => e.id === target);
}
