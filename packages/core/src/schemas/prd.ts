import { z } from 'zod';
import { entityIdSchema, entityRefSchema, statusSchema } from './common.js';

export const prdFrontmatterSchema = z.object({
  type: z.literal('prd'),
  id: entityIdSchema,
  title: z.string().min(1),
  status: statusSchema,
  owner: z.string().nullable().optional(),
  epic_refs: z.array(entityRefSchema).default([]),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const prdSchema = prdFrontmatterSchema.extend({
  body: z.string().default(''),
  filePath: z.string(),
});

export type PrdFrontmatter = z.infer<typeof prdFrontmatterSchema>;
export type Prd = z.infer<typeof prdSchema>;
