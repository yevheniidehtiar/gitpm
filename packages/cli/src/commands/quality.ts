import { relative } from 'node:path';
import {
  loadQualityConfig,
  parseTree,
  type QualityConfig,
  type QualityReport,
  resolveRefs,
  scoreEntities,
} from '@gitpm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { resolveMetaDir } from '../utils/config.js';
import { printError } from '../utils/output.js';

function gradeColor(grade: string): typeof chalk {
  switch (grade) {
    case 'A':
      return chalk.green;
    case 'B':
      return chalk.cyan;
    case 'C':
      return chalk.yellow;
    case 'D':
      return chalk.magenta;
    default:
      return chalk.red;
  }
}

function gradeForAverage(avg: number): string {
  if (avg >= 8) return 'A';
  if (avg >= 6) return 'B';
  if (avg >= 4) return 'C';
  if (avg >= 2) return 'D';
  return 'F';
}

function printReport(report: QualityReport): void {
  console.log();
  console.log(chalk.bold('  Entity Quality Report'));
  console.log(chalk.dim(`  ${'─'.repeat(21)}`));

  const grades = [
    { grade: 'A', range: '8-9', count: report.distribution.A },
    { grade: 'B', range: '6-7', count: report.distribution.B },
    { grade: 'C', range: '4-5', count: report.distribution.C },
    { grade: 'D', range: '2-3', count: report.distribution.D },
    { grade: 'F', range: '0-1', count: report.distribution.F },
  ];

  for (const { grade, range, count } of grades) {
    const label = `${grade} (${range}):`;
    const unit = count === 1 ? 'entity' : 'entities';
    console.log(`  ${gradeColor(grade)(label.padEnd(10))} ${count} ${unit}`);
  }

  const avgGrade = gradeForAverage(report.average);
  console.log();
  console.log(
    `  Average: ${report.average.toFixed(1)} (${gradeColor(avgGrade)(avgGrade)})`,
  );

  // Show lowest-scoring entities (score < 6, sorted ascending, max 10)
  const lowest = report.entities
    .filter((e) => e.score < 6)
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);

  if (lowest.length > 0) {
    console.log();
    console.log(chalk.bold('  Lowest scoring:'));
    for (const e of lowest) {
      const rel = relative(process.cwd(), e.filePath);
      const color = gradeColor(e.grade);
      console.log(
        `    ${color(`[${e.grade}]`)} ${e.id} (${e.score}/${e.maxScore}) ${chalk.dim('—')} ${chalk.dim(rel)}`,
      );
    }
  }

  console.log();
}

export const qualityCommand = new Command('quality')
  .description('Score entity quality across the .meta/ tree')
  .option(
    '--threshold <number>',
    'Minimum average score (overrides config)',
    Number.parseFloat,
  )
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);

    // Parse tree
    const parseResult = await parseTree(metaDir);
    if (!parseResult.ok) {
      printError(parseResult.error.message);
      process.exit(1);
    }

    // Resolve refs
    const resolveResult = resolveRefs(parseResult.value);
    if (!resolveResult.ok) {
      printError(resolveResult.error.message);
      process.exit(1);
    }

    // Load quality config
    const configResult = await loadQualityConfig(metaDir);
    if (!configResult.ok) {
      printError(configResult.error.message);
      process.exit(1);
    }

    const config: QualityConfig | null = configResult.value;

    // Score
    const report = scoreEntities(resolveResult.value, config);

    if (report.entities.length === 0) {
      console.log(chalk.dim('  No scorable entities found in .meta/'));
      return;
    }

    printReport(report);

    // Threshold check
    const threshold = opts.threshold ?? config?.threshold?.min_average;
    if (threshold != null && report.average < threshold) {
      printError(
        `Average score ${report.average.toFixed(1)} is below threshold ${threshold}`,
      );
      process.exit(1);
    }
  });
