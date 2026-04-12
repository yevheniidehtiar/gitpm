import { z } from 'zod';
import {
  entityIdSchema,
  entityRefSchema,
  gitHubSyncSchema,
  gitLabSyncSchema,
  jiraSyncSchema,
  statusSchema,
} from './common.js';

export const sprintFrontmatterSchema = z.object({
  type: z.literal('sprint'),
  id: entityIdSchema,
  title: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  status: statusSchema,
  stories: z.array(entityRefSchema).default([]),
  capacity: z.number().optional(),
  github: gitHubSyncSchema.optional(),
  jira: jiraSyncSchema.optional(),
  gitlab: gitLabSyncSchema.optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SprintFrontmatter = z.infer<typeof sprintFrontmatterSchema>;

export const sprintSchema = sprintFrontmatterSchema.extend({
  body: z.string(),
  filePath: z.string(),
});

export type Sprint = z.infer<typeof sprintSchema>;
