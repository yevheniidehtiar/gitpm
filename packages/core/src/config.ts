import { z } from 'zod';

export const hookEventSchema = z.enum([
  'pre-import',
  'post-import',
  'pre-export',
  'post-export',
  'pre-sync',
  'post-sync',
]);
export type HookEvent = z.infer<typeof hookEventSchema>;

export const HOOK_EVENTS = hookEventSchema.options;

export const gitpmConfigSchema = z.object({
  adapters: z
    .array(z.string())
    .default(['@gitpm/sync-github', '@gitpm/sync-gitlab', '@gitpm/sync-jira']),
  hooks: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .default({}),
});

export type GitpmConfig = z.infer<typeof gitpmConfigSchema>;

export function createDefaultGitpmConfig(): GitpmConfig {
  return {
    adapters: ['@gitpm/sync-github', '@gitpm/sync-gitlab', '@gitpm/sync-jira'],
    hooks: {},
  };
}
