import chalk from 'chalk';

export function printSuccess(msg: string): void {
  console.log(chalk.green(`✓ ${msg}`));
}

export function printError(msg: string): void {
  console.error(chalk.red(`✗ ${msg}`));
}

export function printWarning(msg: string): void {
  console.warn(chalk.yellow(`⚠ ${msg}`));
}

export function progressBar(ratio: number, width: number): string {
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  if (ratio >= 0.75) return chalk.green(bar);
  if (ratio >= 0.25) return chalk.yellow(bar);
  return chalk.red(bar);
}

export function printTree(files: string[]): void {
  for (const file of files) {
    const parts = file.split('/');
    const indent = '  '.repeat(parts.length - 1);
    const name = parts[parts.length - 1];
    const isDir = !name.includes('.');
    console.log(`${indent}${isDir ? chalk.blue(`${name}/`) : name}`);
  }
}
