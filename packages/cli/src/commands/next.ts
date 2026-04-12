import { relative } from 'node:path';
import type { Story } from '@gitpm/core';
import { parseTree } from '@gitpm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError } from '../utils/output.js';

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PICKABLE_STATUSES = new Set(['backlog', 'todo']);

export const nextCommand = new Command('next')
  .description('Show the next stories ready to be picked up')
  .option('-n, --count <number>', 'Number of stories to show', '5')
  .option('-a, --assignee <name>', 'Filter by assignee')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    const count = Number.parseInt(opts.count, 10);

    const parseResult = await parseTree(metaDir);
    if (!parseResult.ok) {
      printError(parseResult.error.message);
      process.exit(1);
    }

    let stories = parseResult.value.stories
      .filter((s: Story) => PICKABLE_STATUSES.has(s.status))
      .sort((a: Story, b: Story) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 99;
        const pb = PRIORITY_ORDER[b.priority] ?? 99;
        if (pa !== pb) return pa - pb;
        // Within same priority, prefer todo over backlog
        if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
        return 0;
      });

    if (opts.assignee) {
      const needle = opts.assignee.toLowerCase();
      stories = stories.filter(
        (s: Story) => s.assignee != null && s.assignee.toLowerCase() === needle,
      );
    }

    stories = stories.slice(0, count);

    if (stories.length === 0) {
      console.log(chalk.yellow('No stories ready to be picked up.'));
      return;
    }

    console.log(chalk.bold(`Next ${stories.length} stories to pick up:\n`));

    for (const story of stories) {
      const file = relative(process.cwd(), story.filePath);
      const pri = formatPriority(story.priority);
      const status = chalk.dim(`[${story.status}]`);
      const assignee = story.assignee
        ? chalk.cyan(`@${story.assignee}`)
        : chalk.dim('unassigned');
      console.log(`  ${pri} ${status} ${story.title} ${assignee}`);
      console.log(`    ${chalk.dim(file)}\n`);
    }
  });

function formatPriority(p: string): string {
  switch (p) {
    case 'critical':
      return chalk.red('●');
    case 'high':
      return chalk.yellow('●');
    case 'medium':
      return chalk.blue('●');
    case 'low':
      return chalk.dim('●');
    default:
      return chalk.dim('○');
  }
}
