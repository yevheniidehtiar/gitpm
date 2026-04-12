import { relative } from 'node:path';
import type { Priority, Status } from '@gitpm/core';
import {
  createEpic,
  createMilestone,
  createStory,
  parseTree,
} from '@gitpm/core';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

const storySubcommand = new Command('story')
  .description('Create a new story')
  .requiredOption('--title <title>', 'Story title')
  .option(
    '--priority <priority>',
    'Priority (low, medium, high, critical)',
    'medium',
  )
  .option('--status <status>', 'Initial status', 'backlog')
  .option('--labels <labels>', 'Comma-separated labels')
  .option('--epic <epic>', 'Epic ID or directory slug to place story under')
  .option('--assignee <assignee>', 'Assignee')
  .option('--estimate <estimate>', 'Estimate (number)')
  .option('--body <body>', 'Body content')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

    let epicId: string | undefined;
    let epicSlug: string | undefined;

    if (opts.epic) {
      // Determine if it's an ID or slug by checking epics in the tree
      const parseResult = await parseTree(metaDir);
      if (!parseResult.ok) {
        printError(parseResult.error.message);
        process.exit(1);
      }

      const matchById = parseResult.value.epics.find((e) => e.id === opts.epic);
      if (matchById) {
        epicId = matchById.id;
        // Extract slug from the epic's filePath: .meta/epics/<slug>/epic.md
        const parts = matchById.filePath.split('/');
        const epicIdx = parts.indexOf('epics');
        if (epicIdx >= 0 && epicIdx + 1 < parts.length) {
          epicSlug = parts[epicIdx + 1];
        }
      } else {
        // Treat as directory slug, find the epic ID from the tree
        const matchBySlug = parseResult.value.epics.find((e) =>
          e.filePath.includes(`/epics/${opts.epic}/`),
        );
        if (matchBySlug) {
          epicId = matchBySlug.id;
          epicSlug = opts.epic;
        } else {
          printError(`Epic not found: ${opts.epic}`);
          process.exit(1);
        }
      }
    }

    const result = await createStory(metaDir, {
      title: opts.title,
      priority: opts.priority as Priority,
      status: opts.status as Status,
      labels: opts.labels
        ? opts.labels.split(',').map((s: string) => s.trim())
        : undefined,
      epicId,
      epicSlug,
      assignee: opts.assignee,
      estimate: opts.estimate ? Number(opts.estimate) : undefined,
      body: opts.body,
    });

    if (!result.ok) {
      printError(result.error.message);
      process.exit(1);
    }

    const rel = relative(process.cwd(), result.value.filePath);
    printSuccess(`Created story ${result.value.id} at ${rel}`);
  });

const epicSubcommand = new Command('epic')
  .description('Create a new epic')
  .requiredOption('--title <title>', 'Epic title')
  .option(
    '--priority <priority>',
    'Priority (low, medium, high, critical)',
    'medium',
  )
  .option('--status <status>', 'Initial status', 'backlog')
  .option('--labels <labels>', 'Comma-separated labels')
  .option('--milestone <milestone>', 'Milestone ID to link')
  .option('--owner <owner>', 'Owner')
  .option('--body <body>', 'Body content')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

    const result = await createEpic(metaDir, {
      title: opts.title,
      priority: opts.priority as Priority,
      status: opts.status as Status,
      labels: opts.labels
        ? opts.labels.split(',').map((s: string) => s.trim())
        : undefined,
      milestoneId: opts.milestone,
      owner: opts.owner,
      body: opts.body,
    });

    if (!result.ok) {
      printError(result.error.message);
      process.exit(1);
    }

    const rel = relative(process.cwd(), result.value.filePath);
    printSuccess(`Created epic ${result.value.id} at ${rel}`);
  });

const milestoneSubcommand = new Command('milestone')
  .description('Create a new milestone')
  .requiredOption('--title <title>', 'Milestone title')
  .option('--status <status>', 'Initial status', 'backlog')
  .option('--target-date <date>', 'Target date (ISO format)')
  .option('--body <body>', 'Body content')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

    const result = await createMilestone(metaDir, {
      title: opts.title,
      status: opts.status as Status,
      targetDate: opts.targetDate,
      body: opts.body,
    });

    if (!result.ok) {
      printError(result.error.message);
      process.exit(1);
    }

    const rel = relative(process.cwd(), result.value.filePath);
    printSuccess(`Created milestone ${result.value.id} at ${rel}`);
  });

export const createCommand = new Command('create')
  .description('Create a new .meta/ entity')
  .addCommand(storySubcommand)
  .addCommand(epicSubcommand)
  .addCommand(milestoneSubcommand);
