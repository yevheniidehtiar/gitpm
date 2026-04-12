import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { archiveCommand } from './commands/archive.js';
import { auditCommand } from './commands/audit.js';
import { commitCommand } from './commands/commit.js';
import { createCommand } from './commands/create.js';
import { importCommand } from './commands/import.js';
import { initCommand } from './commands/init.js';
import { moveCommand } from './commands/move.js';
import { nextCommand } from './commands/next.js';
import { pullCommand } from './commands/pull.js';
import { pushCommand } from './commands/push.js';
import { qualityCommand } from './commands/quality.js';
import { queryCommand } from './commands/query.js';
import { setCommand } from './commands/set.js';
import { showCommand } from './commands/show.js';
import { sprintCommand } from './commands/sprint.js';
import { statusCommand } from './commands/status.js';
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
program.addCommand(nextCommand);
program.addCommand(queryCommand);
program.addCommand(showCommand);
program.addCommand(setCommand);
program.addCommand(createCommand);
program.addCommand(moveCommand);
program.addCommand(commitCommand);
program.addCommand(importCommand);
program.addCommand(pushCommand);
program.addCommand(pullCommand);
program.addCommand(syncCommand);
program.addCommand(statusCommand);
program.addCommand(sprintCommand);
program.addCommand(auditCommand);
program.addCommand(archiveCommand);

program.parse();
