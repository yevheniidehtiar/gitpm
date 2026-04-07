import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { Result } from '../schemas/common.js';

const templateConfigSchema = z.object({
  required_sections: z.array(z.string().min(1)),
  min_coverage: z.number().min(0).max(1).default(0.5),
});

const thresholdConfigSchema = z.object({
  min_average: z.number().min(0).max(9),
});

export const qualityConfigSchema = z.object({
  template: templateConfigSchema.optional(),
  threshold: thresholdConfigSchema.optional(),
});

export type QualityConfig = z.infer<typeof qualityConfigSchema>;

export async function loadQualityConfig(
  metaDir: string,
): Promise<Result<QualityConfig | null>> {
  const configPath = join(metaDir, '.gitpm', 'quality.yaml');
  try {
    const raw = await readFile(configPath, 'utf-8');
    const parsed = parseYaml(raw);
    const result = qualityConfigSchema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false,
        error: new Error(
          `Invalid quality config at ${configPath}: ${result.error.message}`,
        ),
      };
    }
    return { ok: true, value: result.data };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return { ok: true, value: null };
    }
    return {
      ok: false,
      error: new Error(`Failed to read quality config: ${err}`),
    };
  }
}
