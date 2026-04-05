import { z } from 'zod';
import {
  entityIdSchema,
  entityRefSchema,
  gitHubSyncSchema,
  gitLabSyncSchema,
  jiraSyncSchema,
  prioritySchema,
  statusSchema,
} from './common.js';

export const epicFrontmatterSchema = z.object({
  type: z.literal('epic'),
  id: entityIdSchema,
  title: z.string().min(1),
  status: statusSchema,
  priority: prioritySchema,
  owner: z.string().nullable().optional(),
  labels: z.array(z.string()).default([]),
  milestone_ref: entityRefSchema.nullable().optional(),
  github: gitHubSyncSchema.nullable().optional(),
  jira: jiraSyncSchema.nullable().optional(),
  gitlab: gitLabSyncSchema.nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const epicSchema = epicFrontmatterSchema.extend({
  body: z.string().default(''),
  filePath: z.string(),
});

export type EpicFrontmatter = z.infer<typeof epicFrontmatterSchema>;
export type Epic = z.infer<typeof epicSchema>;
