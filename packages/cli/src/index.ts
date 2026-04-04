import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { validateCommand } from './commands/validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
);

const program = new Command();

program
  .name('gitpm')
  .description('Git-native project management')
  .version(pkg.version)
  .option('--meta-dir <path>', 'Path to .meta directory', '.meta');

program.addCommand(initCommand);
program.addCommand(validateCommand);

program.parse();
