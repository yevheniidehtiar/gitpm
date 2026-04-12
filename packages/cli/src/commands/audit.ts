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

    if (opts.json) {
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
