import type { Priority, QueryFilter, Status } from '@gitpm/core';
import { filterEntities, formatEntities, parseTree } from '@gitpm/core';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError } from '../utils/output.js';

const DEFAULT_FIELDS = [
  'id',
  'title',
  'type',
  'status',
  'priority',
  'filePath',
];

export const queryCommand = new Command('query')
  .description('Query and filter .meta/ entities')
  .option(
    '--type <types>',
    'Entity types (comma-separated: story,epic,milestone,prd)',
  )
  .option('--status <statuses>', 'Filter by status (comma-separated)')
  .option('--priority <priorities>', 'Filter by priority (comma-separated)')
  .option('--label <labels>', 'Filter by labels (comma-separated, match any)')
  .option('--epic <epic>', 'Filter stories by epic ID or directory slug')
  .option('--assignee <assignee>', 'Filter by assignee')
  .option('--search <text>', 'Text search in title and body')
  .option(
    '--fields <fields>',
    'Fields to display (comma-separated)',
    DEFAULT_FIELDS.join(','),
  )
  .option('--format <format>', 'Output format: table, json, csv', 'table')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

    const parseResult = await parseTree(metaDir);
    if (!parseResult.ok) {
      printError(parseResult.error.message);
      process.exit(1);
    }

    const filter: QueryFilter = {};

    if (opts.type) {
      filter.type = opts.type.split(',').map((s: string) => s.trim());
    }
    if (opts.status) {
      filter.status = opts.status
        .split(',')
        .map((s: string) => s.trim()) as Status[];
    }
    if (opts.priority) {
      filter.priority = opts.priority
        .split(',')
        .map((s: string) => s.trim()) as Priority[];
    }
    if (opts.label) {
      filter.labels = opts.label.split(',').map((s: string) => s.trim());
    }
    if (opts.epic) {
      filter.epic = opts.epic;
    }
    if (opts.assignee) {
      filter.assignee = opts.assignee;
    }
    if (opts.search) {
      filter.search = opts.search;
    }

    const entities = filterEntities(parseResult.value, filter);
    const fields = opts.fields.split(',').map((s: string) => s.trim());
    const output = formatEntities(entities, { fields, format: opts.format });

    console.log(output);
  });
