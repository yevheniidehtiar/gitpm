import { writeFile as fsWriteFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Result } from '@gitpm/core';
import { prioritySchema, statusSchema } from '@gitpm/core';
import YAML from 'yaml';
import { z } from 'zod';
import { DEFAULT_BASE_URL } from './client.js';

export const BITBUCKET_CONFIG_FILE = 'bitbucket-config.yaml';

export const bbIssueStateSchema = z.enum([
  'submitted',
  'new',
  'open',
  'resolved',
  'on hold',
  'invalid',
  'duplicate',
  'wontfix',
  'closed',
]);

export const bbIssueKindSchema = z.enum([
  'bug',
  'enhancement',
  'proposal',
  'task',
]);

export const bbIssuePrioritySchema = z.enum([
  'trivial',
  'minor',
  'major',
  'critical',
  'blocker',
]);

/**
 * How a story is linked to its epic, given Bitbucket has no issue hierarchy:
 * - `component`: the issue's component is named after the epic title
 * - `body-marker`: a hidden `<!-- gitpm:epic=<id> -->` marker in the issue body
 * - `both`: write both; on read the marker wins, the component is the fallback
 */
export const epicLinkageSchema = z.enum(['component', 'body-marker', 'both']);
export type EpicLinkage = z.infer<typeof epicLinkageSchema>;

export const bitbucketConfigSchema = z.object({
  workspace: z.string().min(1),
  repo_slug: z.string().min(1),
  base_url: z.url().default(DEFAULT_BASE_URL),
  /** Overrides merged over DEFAULT_STATUS_MAPPING (Bitbucket state → gitpm status). */
  status_mapping: z.partialRecord(bbIssueStateSchema, statusSchema).default({}),
  /** Overrides merged over DEFAULT_PRIORITY_MAPPING (Bitbucket priority → gitpm priority). */
  priority_mapping: z
    .partialRecord(bbIssuePrioritySchema, prioritySchema)
    .default({}),
  /** Overrides merged over DEFAULT_KIND_LABELS (Bitbucket kind → gitpm label). */
  kind_mapping: z
    .partialRecord(bbIssueKindSchema, z.string().min(1))
    .default({}),
  epic_linkage: epicLinkageSchema.default('both'),
  auto_sync: z.boolean().default(false),
});

/** Parsed config, with defaults applied. */
export type BitbucketConfig = z.infer<typeof bitbucketConfigSchema>;
/** Config as written in YAML, where every defaulted field is optional. */
export type BitbucketConfigInput = z.input<typeof bitbucketConfigSchema>;

function configPath(metaDir: string): string {
  return join(metaDir, 'sync', BITBUCKET_CONFIG_FILE);
}

export function parseConfig(raw: unknown): Result<BitbucketConfig> {
  const parsed = bitbucketConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: new Error(
        `Invalid Bitbucket config: ${z.prettifyError(parsed.error)}`,
      ),
    };
  }
  return { ok: true, value: parsed.data };
}

export async function loadConfig(
  metaDir: string,
): Promise<Result<BitbucketConfig>> {
  let raw: string;
  try {
    raw = await readFile(configPath(metaDir), 'utf-8');
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to load Bitbucket config: ${err}`),
    };
  }
  try {
    return parseConfig(YAML.parse(raw));
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to parse Bitbucket config: ${err}`),
    };
  }
}

export async function saveConfig(
  metaDir: string,
  config: BitbucketConfigInput,
): Promise<Result<void>> {
  const parsed = parseConfig(config);
  if (!parsed.ok) return parsed;
  try {
    const path = configPath(metaDir);
    await mkdir(dirname(path), { recursive: true });
    const content = YAML.stringify(parsed.value, { lineWidth: 0 });
    await fsWriteFile(path, content, 'utf-8');
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to save Bitbucket config: ${err}`),
    };
  }
}

export function createDefaultConfig(
  workspace: string,
  repoSlug: string,
  overrides: Partial<
    Omit<BitbucketConfigInput, 'workspace' | 'repo_slug'>
  > = {},
): Result<BitbucketConfig> {
  return parseConfig({
    ...overrides,
    workspace,
    repo_slug: repoSlug,
  });
}
