import { serve } from '@hono/node-server';
import { createApp } from './index.js';

const metaDir =
  process.argv.find((a) => a.startsWith('--meta-dir='))?.split('=')[1] ??
  process.argv[process.argv.indexOf('--meta-dir') + 1] ??
  process.env.META_DIR ??
  '.meta';

const port = Number(process.env.PORT) || 4747;

const app = createApp(metaDir);

console.log(`GitPM API server listening on http://localhost:${port}`);
console.log(`Meta directory: ${metaDir}`);

serve({ fetch: app.fetch, port });
