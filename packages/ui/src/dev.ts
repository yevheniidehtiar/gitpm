import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './server/index.js';

// Parse --meta-dir argument
const metaDirArg =
  process.argv.find((a) => a.startsWith('--meta-dir='))?.split('=')[1] ??
  process.argv[process.argv.indexOf('--meta-dir') + 1] ??
  process.env.META_DIR ??
  '.meta';

const metaDir = resolve(metaDirArg);
const port = Number(process.env.PORT) || 4747;

// Start API server
const app = createApp(metaDir);
serve({ fetch: app.fetch, port });
console.log(`[GitPM] API server listening on http://localhost:${port}`);
console.log(`[GitPM] Meta directory: ${metaDir}`);

// Start Vite dev server
const uiDir = new URL('..', import.meta.url).pathname;
const vite = spawn('npx', ['vite', '--host'], {
  cwd: uiDir,
  stdio: 'inherit',
  env: { ...process.env },
});

vite.on('exit', (code) => {
  console.log(`[GitPM] Vite exited with code ${code}`);
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  vite.kill('SIGINT');
  process.exit(0);
});
