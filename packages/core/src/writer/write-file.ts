import { writeFile as fsWriteFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import YAML from 'yaml';
import type { Result } from '../schemas/common.js';
import type { ParsedEntity } from '../schemas/index.js';

export async function writeFile(
  entity: ParsedEntity,
  filePath: string,
): Promise<Result<void>> {
  try {
    await mkdir(dirname(filePath), { recursive: true });

    if (entity.type === 'roadmap') {
      const { filePath: _fp, ...data } = entity;
      const content = YAML.stringify(data, { lineWidth: 0 });
      await fsWriteFile(filePath, content, 'utf-8');
      return { ok: true, value: undefined };
    }

    const {
      body,
      filePath: _fp,
      ...frontmatter
    } = entity as Record<string, unknown>;
    const yamlStr = YAML.stringify(frontmatter, { lineWidth: 0 });
    const bodyStr = typeof body === 'string' ? body : '';
    const content = `---\n${yamlStr}---\n${bodyStr ? `\n${bodyStr}\n` : ''}`;
    await fsWriteFile(filePath, content, 'utf-8');
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to write ${filePath}: ${err}`),
    };
  }
}
