import { z } from 'zod';
import { entityIdSchema, entityRefSchema } from './common.js';

export const roadmapSchema = z.object({
  type: z.literal('roadmap'),
  id: entityIdSchema,
  title: z.string().min(1),
  description: z.string().default(''),
  milestones: z.array(entityRefSchema).default([]),
  updated_at: z.string().optional(),
  filePath: z.string(),
});

export type Roadmap = z.infer<typeof roadmapSchema>;
