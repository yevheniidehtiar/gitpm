import { relative } from 'node:path';
import {
  type AuditItem,
  type AuditReport,
  auditTree,
  type DuplicatePair,
  parseTree,
  resolveRefs,
} from '@gitpm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError, printSuccess } from '../utils/output.js';

function printSection(title: string, items: AuditItem[]): void {
  if (items.length === 0) return;
  console.log(chalk.bold.yellow(`  ${title} (${items.length})`));
  for (const item of items) {
    const rel = relative(process.cwd(), item.filePath);
    console.log(
      `    ${chalk.dim('•')} ${item.title} ${chalk.dim('—')} ${item.reason}`,
    );
    console.log(`      ${chalk.dim(rel)}`);
  }
  console.log();
}

function printDuplicates(pairs: DuplicatePair[]): void {
  if (pairs.length === 0) return;
  console.log(chalk.bold.yellow(`  Duplicate Candidates (${pairs.length})`));
  for (const { a, b, similarity } of pairs) {
    const pct = Math.round(similarity * 100);
    console.log(
      `    ${chalk.dim('•')} ${a.title} ${chalk.dim('↔')} ${b.title} ${chalk.cyan(`${pct}%`)}`,
    );
  }
  console.log();
}

function printReport(report: AuditReport): void {
  console.log();
  console.log(chalk.bold('  Project Audit'));
  console.log(chalk.dim(`  ${'─'.repeat(13)}`));
  console.log(
    `  ${report.summary.total} entities scanned, ${report.summary.issues} issue(s) found`,
  );
  console.log();

  printSection('Stale Stories', report.stale);
  printSection('Orphan Stories (no epic)', report.orphans);
  printSection('Empty Bodies', report.emptyBodies);
  printSection('Zombie Epics (all stories done)', report.zombieEpics);
  printDuplicates(report.duplicates);
}

// --- Markdown report (for CI artifacts) ---

const STALE_BUCKETS = [
  { label: '30-59 days', min: 30, max: 60 },
  { label: '60-89 days', min: 60, max: 90 },
  { label: '90+ days', min: 90, max: Number.POSITIVE_INFINITY },
] as const;

function staleBucketLabel(item: AuditItem): string {
  if (item.daysSinceUpdate == null) return 'Unknown age';
  if (item.daysSinceUpdate < STALE_BUCKETS[0].min) return '< 30 days';
  for (const bucket of STALE_BUCKETS) {
    if (
      item.daysSinceUpdate >= bucket.min &&
      item.daysSinceUpdate < bucket.max
    ) {
      return bucket.label;
    }
  }
  return STALE_BUCKETS[STALE_BUCKETS.length - 1].label;
}

function groupStaleByBucket(items: AuditItem[]): [string, AuditItem[]][] {
  const order = [
    '< 30 days',
    ...STALE_BUCKETS.map((b) => b.label),
    'Unknown age',
  ];
  const groups = new Map<string, AuditItem[]>();
  for (const item of items) {
    const label = staleBucketLabel(item);
    const bucket = groups.get(label) ?? [];
    bucket.push(item);
    groups.set(label, bucket);
  }
  return order
    .filter((label) => groups.has(label))
    .map((label) => [label, groups.get(label) as AuditItem[]]);
}

function escapeMdCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function mdTable(headers: string[], rows: string[][]): string {
  const headerLine = `| ${headers.join(' | ')} |`;
  const sepLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const rowLines = rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerLine, sepLine, ...rowLines].join('\n');
}

function itemToRow(item: AuditItem): string[] {
  return [
    escapeMdCell(item.id),
    escapeMdCell(item.title),
    escapeMdCell(relative(process.cwd(), item.filePath)),
    escapeMdCell(item.reason),
  ];
}

function mdItemSection(title: string, items: AuditItem[]): string[] {
  const lines = [`## ${title} (${items.length})`, ''];
  if (items.length === 0) {
    lines.push('None.', '');
    return lines;
  }
  lines.push(
    mdTable(['ID', 'Title', 'File', 'Reason'], items.map(itemToRow)),
    '',
  );
  return lines;
}

function buildMarkdownReport(report: AuditReport): string {
  const lines: string[] = [
    '# Project Audit',
    '',
    `${report.summary.total} entities scanned, ${report.summary.issues} issue(s) found.`,
    '',
  ];

  // Stale — tiered by age bucket.
  lines.push(`## Stale (${report.stale.length})`, '');
  if (report.stale.length === 0) {
    lines.push('None.', '');
  } else {
    for (const [label, items] of groupStaleByBucket(report.stale)) {
      lines.push(
        `### ${label} (${items.length})`,
        '',
        mdTable(['ID', 'Title', 'File', 'Reason'], items.map(itemToRow)),
        '',
      );
    }
  }

  lines.push(...mdItemSection('Orphans', report.orphans));

  lines.push(`## Duplicates (${report.duplicates.length})`, '');
  if (report.duplicates.length === 0) {
    lines.push('None.', '');
  } else {
    lines.push(
      mdTable(
        ['A', 'B', 'Similarity'],
        report.duplicates.map((d) => [
          escapeMdCell(`${d.a.title} (${d.a.id})`),
          escapeMdCell(`${d.b.title} (${d.b.id})`),
          `${Math.round(d.similarity * 100)}%`,
        ]),
      ),
      '',
    );
  }

  lines.push(...mdItemSection('Empty bodies', report.emptyBodies));
  lines.push(...mdItemSection('Zombie epics', report.zombieEpics));

  return lines.join('\n');
}

export const auditCommand = new Command('audit')
  .description(
    'Detect stale issues, orphans, duplicates, and project hygiene issues',
  )
  .option(
    '--stale-days <days>',
    'Days before a todo is considered stale',
    Number.parseInt,
    90,
  )
  .option('--json', 'Output as JSON')
  .option(
    '--markdown',
    'Output as a Markdown report with age-tiered stale sections (for CI artifacts)',
  )
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

    const report = auditTree(resolveResult.value, {
      staleDays: opts.staleDays,
    });

    if (opts.markdown) {
      console.log(buildMarkdownReport(report));
    } else if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else if (report.summary.issues === 0) {
      printSuccess('No issues found — project is clean!');
    } else {
      printReport(report);
    }

    if (report.summary.issues > 0) {
      process.exit(1);
    }
  });
