import { relative, resolve as resolvePath } from 'node:path';
import {
  createSprint,
  parseTree,
  type ResolvedSprint,
  type ResolvedStory,
  resolveRefs,
  writeFile,
} from '@gitpm/core';
import { checkbox, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import {
  printError,
  printSuccess,
  printWarning,
  progressBar,
} from '../utils/output.js';

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

/** Stories eligible to be added to a sprint (not yet started, not archived). */
function isPickableStory(story: ResolvedStory): boolean {
  return story.status === 'todo' || story.status === 'backlog';
}

/** Find a sprint by ID or by file path (relative or absolute). */
function findSprintByIdOrPath(
  sprints: ResolvedSprint[],
  idOrPath: string,
): ResolvedSprint | undefined {
  const looksLikePath = idOrPath.includes('/') || idOrPath.endsWith('.md');
  if (looksLikePath) {
    const target = resolvePath(process.cwd(), idOrPath);
    return sprints.find((s) => resolvePath(s.filePath) === target);
  }
  return sprints.find((s) => s.id === idOrPath);
}

function printPointsSummary(
  totalPoints: number,
  capacity: number | undefined,
): void {
  if (capacity === undefined) {
    console.log(chalk.dim(`  Points: ${totalPoints} pts (no capacity set)`));
    return;
  }
  const ratio = capacity > 0 ? totalPoints / capacity : totalPoints > 0 ? 1 : 0;
  const bar = progressBar(Math.min(ratio, 1), 16);
  const label = `${totalPoints}/${capacity} pts`;
  if (totalPoints > capacity) {
    console.log(`  ${bar} ${chalk.red(`${label} — over capacity`)}`);
  } else {
    console.log(`  ${bar} ${label}`);
  }
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
        `  ${progressBar(ratio, 16)} ${pct}% ${sp.title} ${dateRange}${cap}`,
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
    console.log(
      `  Progress: ${progressBar(ratio, 16)} ${pct}% (${done}/${total})`,
    );
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

const sprintPlanCommand = new Command('plan')
  .description(
    'Plan a sprint by picking stories to include (interactively, or via --add/--remove)',
  )
  .argument('<sprint>', 'Sprint ID or file path')
  .option(
    '--add <story-id...>',
    'Add story IDs to the sprint (non-interactive)',
  )
  .option(
    '--remove <story-id...>',
    'Remove story IDs from the sprint (non-interactive)',
  )
  .action(
    async (
      sprintArg: string,
      opts: { add?: string[]; remove?: string[] },
      cmd,
    ) => {
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

      const sprint = findSprintByIdOrPath(
        resolveResult.value.sprints,
        sprintArg,
      );
      if (!sprint) {
        printError(`Sprint not found: ${sprintArg}`);
        process.exit(1);
      }

      const allStories = resolveResult.value.stories;
      const storyById = new Map(allStories.map((s) => [s.id, s]));
      const currentIds = new Set(sprint.stories.map((ref) => ref.id));

      // Story ID -> titles of the *other* active sprints that already
      // reference it. Assigning a story to more than one sprint is allowed
      // (e.g. carry-over), but double-counts its points, so we surface it to
      // the user. Finished (done/cancelled) sprints are ignored: carrying a
      // story over from a closed sprint is the expected case.
      const otherSprintsByStory = new Map<string, string[]>();
      for (const other of resolveResult.value.sprints) {
        if (other.id === sprint.id) continue;
        if (other.status === 'done' || other.status === 'cancelled') continue;
        for (const ref of other.stories) {
          const titles = otherSprintsByStory.get(ref.id) ?? [];
          if (!titles.includes(other.title)) titles.push(other.title);
          otherSprintsByStory.set(ref.id, titles);
        }
      }

      const pointsFor = (ids: Iterable<string>): number =>
        [...ids].reduce(
          (sum, id) => sum + (storyById.get(id)?.estimate ?? 0),
          0,
        );

      const warnAlreadyPlanned = (ids: Iterable<string>): void => {
        for (const id of ids) {
          if (currentIds.has(id)) continue;
          const others = otherSprintsByStory.get(id);
          if (others) {
            const title = storyById.get(id)?.title ?? id;
            const names = others.map((t) => `"${t}"`).join(', ');
            printWarning(
              others.length === 1
                ? `Story "${title}" is already in sprint ${names}; its points will count toward both.`
                : `Story "${title}" is already in ${others.length} other sprints (${names}); its points will count toward all of them.`,
            );
          }
        }
      };

      let nextIds: Set<string>;

      const nonInteractive = Boolean(opts.add?.length || opts.remove?.length);
      if (nonInteractive) {
        const addIds = opts.add ?? [];
        const unknownIds = addIds.filter((id) => !storyById.has(id));
        if (unknownIds.length > 0) {
          printError(
            `Unknown story ID${unknownIds.length > 1 ? 's' : ''}: ${unknownIds.join(', ')}`,
          );
          process.exit(1);
        }

        nextIds = new Set(currentIds);
        for (const id of addIds) nextIds.add(id);
        for (const id of opts.remove ?? []) nextIds.delete(id);
        warnAlreadyPlanned(nextIds);
      } else {
        const pickable = allStories.filter(isPickableStory);
        // Stories already in the sprint that aren't in the pickable list
        // (e.g. already in_progress/done) are left untouched.
        const untouchedIds = new Set(
          [...currentIds].filter(
            (id) =>
              !storyById.has(id) ||
              !isPickableStory(storyById.get(id) as ResolvedStory),
          ),
        );

        if (pickable.length === 0) {
          console.log(
            chalk.dim('  No todo/backlog stories available to plan.'),
          );
          nextIds = currentIds;
        } else {
          const selected = await checkbox({
            message: `Select stories for "${sprint.title}"`,
            choices: pickable.map((story) => {
              const others = otherSprintsByStory.get(story.id);
              const inOthers = others
                ? ` ${chalk.yellow(`(in ${others.join(', ')})`)}`
                : '';
              return {
                name: `${story.title} ${chalk.dim(`[${story.priority}]`)} ${chalk.dim(`(${story.estimate ?? '?'} pts)`)}${inOthers}`,
                value: story.id,
                checked: currentIds.has(story.id),
              };
            }),
          });
          nextIds = new Set([...untouchedIds, ...selected]);
          warnAlreadyPlanned(nextIds);

          // Show the running points-vs-capacity total for the selection
          // before writing, so the user can back out of an over-capacity plan.
          console.log();
          printPointsSummary(pointsFor(nextIds), sprint.capacity);
          const proceed = await confirm({
            message: `Save this selection to "${sprint.title}"?`,
            default: true,
          });
          if (!proceed) {
            console.log(chalk.dim('  Cancelled — no changes written.'));
            return;
          }
        }
      }

      const totalPoints = pointsFor(nextIds);

      // Preserve existing ref objects (including any `path` hint) and their
      // order; newly added stories are appended as bare `{ id }` refs.
      // Duplicate refs to the same story collapse to the first occurrence.
      const seenIds = new Set<string>();
      const keptRefs = sprint.stories.filter((ref) => {
        if (!nextIds.has(ref.id) || seenIds.has(ref.id)) return false;
        seenIds.add(ref.id);
        return true;
      });
      const addedRefs = [...nextIds]
        .filter((id) => !currentIds.has(id))
        .map((id) => ({ id }));

      const { resolvedStories: _resolvedStories, ...sprintBase } = sprint;
      const updatedSprint = {
        ...sprintBase,
        stories: [...keptRefs, ...addedRefs],
        updated_at: new Date().toISOString(),
      };

      const writeResult = await writeFile(updatedSprint, sprint.filePath);
      if (!writeResult.ok) {
        printError(writeResult.error.message);
        process.exit(1);
      }

      console.log();
      printSuccess(
        `Updated sprint "${sprint.title}" (${nextIds.size} ${nextIds.size === 1 ? 'story' : 'stories'})`,
      );
      printPointsSummary(totalPoints, sprint.capacity);
      console.log();
    },
  );

export const sprintCommand = new Command('sprint')
  .description('Manage sprints (time-boxed iterations)')
  .addCommand(sprintCreateCommand)
  .addCommand(sprintListCommand)
  .addCommand(sprintShowCommand)
  .addCommand(sprintPlanCommand);
