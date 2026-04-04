import type { FieldConflict, Resolution } from '@gitpm/sync-github';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';

/**
 * Interactively prompt the user to resolve each conflict.
 */
export async function promptConflictResolution(
  conflicts: FieldConflict[],
): Promise<Resolution[]> {
  const resolutions: Resolution[] = [];

  for (const conflict of conflicts) {
    console.log();
    console.log(chalk.yellow('━━━ CONFLICT ━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(
      `Entity: ${chalk.bold(`"${conflict.entityTitle}"`)} (${conflict.entityId})`,
    );
    console.log(`Type:   ${conflict.entityType}`);
    console.log(`Field:  ${conflict.field}`);
    console.log();
    console.log(`  Local:  ${chalk.green(String(conflict.localValue))}`);
    console.log(`  Remote: ${chalk.blue(String(conflict.remoteValue))}`);
    console.log(chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    const pick = await select({
      message: 'How do you want to resolve this conflict?',
      choices: [
        { name: '[l] Keep local', value: 'local' as const },
        { name: '[r] Keep remote', value: 'remote' as const },
        { name: '[s] Skip (leave unresolved)', value: 'skip' as const },
      ],
    });

    if (pick !== 'skip') {
      resolutions.push({
        entityId: conflict.entityId,
        field: conflict.field,
        pick,
      });
    }
  }

  return resolutions;
}
