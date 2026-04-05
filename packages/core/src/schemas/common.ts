import { z } from 'zod';

export const entityIdSchema = z.string().min(1);
export type EntityId = z.infer<typeof entityIdSchema>;

export const statusSchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
]);
export type Status = z.infer<typeof statusSchema>;

export const prioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type Priority = z.infer<typeof prioritySchema>;

export const entityRefSchema = z.object({
  id: entityIdSchema,
  path: z.string().optional(),
});
export type EntityRef = z.infer<typeof entityRefSchema>;

export const gitHubSyncSchema = z.object({
  issue_number: z.number().int().optional(),
  project_item_id: z.string().optional(),
  milestone_id: z.number().int().optional(),
  repo: z.string(),
  last_sync_hash: z.string(),
  synced_at: z.string(),
});
export type GitHubSync = z.infer<typeof gitHubSyncSchema>;

export const jiraSyncSchema = z.object({
  issue_key: z.string().optional(),
  project_key: z.string(),
  sprint_id: z.number().int().optional(),
  site: z.string(),
  last_sync_hash: z.string(),
  synced_at: z.string(),
});
export type JiraSync = z.infer<typeof jiraSyncSchema>;

export const gitLabSyncSchema = z.object({
  issue_iid: z.number().int().optional(),
  epic_iid: z.number().int().optional(),
  milestone_id: z.number().int().optional(),
  project_id: z.number().int(),
  base_url: z.string(),
  last_sync_hash: z.string(),
  synced_at: z.string(),
});
export type GitLabSync = z.infer<typeof gitLabSyncSchema>;

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
