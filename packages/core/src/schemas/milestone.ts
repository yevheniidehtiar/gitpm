import { z } from 'zod';
import {
  bitbucketSyncSchema,
  entityIdSchema,
  gitHubSyncSchema,
  gitLabSyncSchema,
  jiraSyncSchema,
  linearSyncSchema,
  statusSchema,
} from './common.js';

export const milestoneFrontmatterSchema = z.object({
  type: z.literal('milestone'),
  id: entityIdSchema,
  title: z.string().min(1),
  target_date: z.string().optional(),
  status: statusSchema,
  github: gitHubSyncSchema.nullable().optional(),
  jira: jiraSyncSchema.nullable().optional(),
  gitlab: gitLabSyncSchema.nullable().optional(),
  linear: linearSyncSchema.nullable().optional(),
  bitbucket: bitbucketSyncSchema.nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const milestoneSchema = milestoneFrontmatterSchema.extend({
  body: z.string().default(''),
  filePath: z.string(),
});

export type MilestoneFrontmatter = z.infer<typeof milestoneFrontmatterSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;
