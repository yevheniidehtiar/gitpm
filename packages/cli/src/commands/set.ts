import { resolve } from 'node:path';
import {
  applyAssignments,
  parseAssignment,
  parseFile,
  writeFile,
} from '@gitpm/core';
import { Command } from 'commander';
import { printError, printSuccess } from '../utils/output.js';

export const setCommand = new Command('set')
  .description('Update frontmatter fields on a .meta/ entity')
  .argument('<file>', 'Path to the entity file')
  .argument(
    '<assignments...>',
    'Field assignments (field=value, field+=value, field-=value)',
  )
  .action(async (file: string, assignments: string[]) => {
    const filePath = resolve(process.cwd(), file);

    const parseResult = await parseFile(filePath);
    if (!parseResult.ok) {
      printError(parseResult.error.message);
      process.exit(1);
    }

    const parsed = [];
    for (const expr of assignments) {
      const result = parseAssignment(expr);
      if (!result.ok) {
        printError(result.error.message);
        process.exit(1);
      }
      parsed.push(result.value);
    }

    const applyResult = applyAssignments(parseResult.value, parsed);
    if (!applyResult.ok) {
      printError(applyResult.error.message);
      process.exit(1);
    }

    const writeResult = await writeFile(applyResult.value, filePath);
    if (!writeResult.ok) {
      printError(writeResult.error.message);
      process.exit(1);
    }

    printSuccess(`Updated ${file}`);
  });
