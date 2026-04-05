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

export const storyFrontmatterSchema = z.object({
  type: z.literal('story'),
  id: entityIdSchema,
  title: z.string().min(1),
  status: statusSchema,
  priority: prioritySchema,
  assignee: z.string().nullable().optional(),
  labels: z.array(z.string()).default([]),
  estimate: z.number().nullable().optional(),
  epic_ref: entityRefSchema.nullable().optional(),
  github: gitHubSyncSchema.nullable().optional(),
  jira: jiraSyncSchema.nullable().optional(),
  gitlab: gitLabSyncSchema.nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const storySchema = storyFrontmatterSchema.extend({
  body: z.string().default(''),
  filePath: z.string(),
});

export type StoryFrontmatter = z.infer<typeof storyFrontmatterSchema>;
export type Story = z.infer<typeof storySchema>;
