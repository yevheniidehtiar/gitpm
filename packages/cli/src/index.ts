import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { importCommand } from './commands/import.js';
import { initCommand } from './commands/init.js';
import { pullCommand } from './commands/pull.js';
import { pushCommand } from './commands/push.js';
import { qualityCommand } from './commands/quality.js';
import { syncCommand } from './commands/sync.js';
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
  .option('--meta-dir <path>', 'Path to .meta directory', '.meta')
  .option('--token <token>', 'Personal access token (GitHub or GitLab)');

program.addCommand(initCommand);
program.addCommand(validateCommand);
program.addCommand(qualityCommand);
program.addCommand(importCommand);
program.addCommand(pushCommand);
program.addCommand(pullCommand);
program.addCommand(syncCommand);

program.parse();
