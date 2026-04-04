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

export function printTree(files: string[]): void {
  for (const file of files) {
    const parts = file.split('/');
    const indent = '  '.repeat(parts.length - 1);
    const name = parts[parts.length - 1];
    const isDir = !name.includes('.');
    console.log(`${indent}${isDir ? chalk.blue(`${name}/`) : name}`);
  }
}
