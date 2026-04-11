#!/usr/bin/env tsx
/**
 * Bundles the repo's .meta/ tree into a static JSON payload consumed by the
 * public GitHub Pages demo build. Uses the same parseTree + resolveRefs
 * pipeline as packages/ui/src/server/index.ts so the shape is identical to
 * `GET /api/tree`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTree, resolveRefs } from '@gitpm/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const metaDir = resolve(repoRoot, '.meta');
const outPath = resolve(__dirname, '../public-demo/demo-data.json');

console.log(`[bundle-demo-data] Parsing ${metaDir}`);

const parseResult = await parseTree(metaDir);
if (!parseResult.ok) {
  console.error('[bundle-demo-data] Parse failed:', parseResult.error);
  process.exit(1);
}

const resolveResult = resolveRefs(parseResult.value);
if (!resolveResult.ok) {
  console.error('[bundle-demo-data] Resolve failed:', resolveResult.error);
  process.exit(1);
}

const tree = resolveResult.value;

// Strip absolute filesystem paths so the public JSON doesn't leak CI runner
// directory layouts. Keep the .meta/-relative portion for debuggability.
function sanitizePaths<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(sanitizePaths) as unknown as T;
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === 'filePath' && typeof v === 'string') {
        const idx = v.indexOf('.meta/');
        result[k] = idx >= 0 ? v.slice(idx) : v;
      } else {
        result[k] = sanitizePaths(v);
      }
    }
    return result as T;
  }
  return obj;
}

const sanitized = sanitizePaths(tree) as typeof tree;

// Drop parse errors entirely. Their messages embed absolute filesystem paths
// that would leak CI runner internals to the public demo, and the demo UI
// reports validation as clean via `demoApi.ts` anyway.
sanitized.errors = [];

const payload = {
  ...sanitized,
  counts: {
    stories: sanitized.stories.length,
    epics: sanitized.epics.length,
    milestones: sanitized.milestones.length,
    roadmaps: sanitized.roadmaps.length,
    prds: sanitized.prds.length,
    errors: 0,
  },
};

const json = JSON.stringify(payload);

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, json);

const bytes = json.length;
const kb = bytes / 1024;
const mb = kb / 1024;

console.log(
  `[bundle-demo-data] Wrote ${outPath} (${kb.toFixed(1)} KB, ${payload.counts.stories} stories, ${payload.counts.epics} epics, ${payload.counts.milestones} milestones, ${payload.counts.prds} prds)`,
);

if (mb > 1) {
  console.error(
    `[bundle-demo-data] ERROR: demo-data.json is ${mb.toFixed(2)} MB (> 1 MB limit). Refusing to bundle.`,
  );
  process.exit(1);
}
