/**
 * GitPM UI Screenshot & Screencast Capture Tool
 *
 * Uses Playwright (headless Chromium) to start the dev servers,
 * navigate the UI, and capture screenshots + a screencast video.
 *
 * Usage:
 *   npx tsx packages/ui/scripts/capture.ts [--meta-dir path] [--out dir]
 *
 * Requires: npx playwright install chromium
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import type { Server } from 'node:http';
import { join, resolve } from 'node:path';

import { serve } from '@hono/node-server';
import { chromium } from 'playwright';

import { createApp } from '../src/server/index.js';

// --- Config ---

const META_DIR =
  getArg('--meta-dir') ??
  resolve('packages/core/src/__fixtures__/valid-tree/.meta');
const OUT_DIR = getArg('--out') ?? resolve('docs/demos/screenshots');
const API_PORT = 4747;
const VITE_PORT = 5199; // Use a non-standard port to avoid conflicts
const VIEWPORT = { width: 1280, height: 800 };

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

// --- Helpers ---

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url: string, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {}
    await wait(500);
  }
  throw new Error(`Server at ${url} not ready after ${timeoutMs}ms`);
}

// --- Main ---

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('[capture] Starting API server...');
  console.log(`[capture] Meta dir: ${META_DIR}`);

  // Start Hono API server
  const app = createApp(META_DIR);
  const apiServer: Server = serve({ fetch: app.fetch, port: API_PORT });

  // Start Vite dev server
  console.log('[capture] Starting Vite dev server...');
  const uiDir = resolve('packages/ui');
  const vite = spawn(
    'npx',
    ['vite', '--port', String(VITE_PORT), '--strictPort'],
    {
      cwd: uiDir,
      stdio: 'pipe',
      env: { ...process.env },
    },
  );

  let viteOutput = '';
  vite.stdout?.on('data', (d) => {
    viteOutput += d.toString();
  });
  vite.stderr?.on('data', (d) => {
    viteOutput += d.toString();
  });

  try {
    // Wait for both servers
    await waitForServer(`http://localhost:${API_PORT}/api/tree`);
    console.log('[capture] API server ready.');

    await waitForServer(`http://localhost:${VITE_PORT}/`);
    console.log('[capture] Vite server ready.');

    // Launch headless browser
    console.log('[capture] Launching Chromium...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: {
        dir: OUT_DIR,
        size: VIEWPORT,
      },
    });

    const page = await context.newPage();
    const baseUrl = `http://localhost:${VITE_PORT}`;

    // --- Screenshot: Tree Browser ---
    console.log('[capture] 1/5 Tree Browser...');
    await page.goto(`${baseUrl}/#/`, { waitUntil: 'networkidle' });
    await wait(1500); // Let React render + queries settle
    await page.screenshot({
      path: join(OUT_DIR, '01-tree-browser.png'),
      fullPage: false,
    });
    console.log('[capture]   ✓ 01-tree-browser.png');

    // --- Screenshot: Entity Editor (pick first entity from sidebar) ---
    console.log('[capture] 2/5 Entity Editor...');
    // Click on the first epic in the sidebar
    const epicLink = page.locator('aside a[href*="entity"]').first();
    if (await epicLink.count()) {
      await epicLink.click();
      await wait(1500);
    } else {
      // Fallback: navigate directly to a known entity
      await page.goto(`${baseUrl}/#/entity/ep_balancing`, {
        waitUntil: 'networkidle',
      });
      await wait(1500);
    }
    await page.screenshot({
      path: join(OUT_DIR, '02-entity-editor.png'),
      fullPage: false,
    });
    console.log('[capture]   ✓ 02-entity-editor.png');

    // --- Screenshot: Entity Editor with story ---
    console.log('[capture] 3/5 Story Editor...');
    await page.goto(`${baseUrl}/#/entity/st_price_feed`, {
      waitUntil: 'networkidle',
    });
    await wait(1500);
    await page.screenshot({
      path: join(OUT_DIR, '03-story-editor.png'),
      fullPage: false,
    });
    console.log('[capture]   ✓ 03-story-editor.png');

    // --- Screenshot: Roadmap ---
    console.log('[capture] 4/5 Roadmap Timeline...');
    await page.goto(`${baseUrl}/#/roadmap`, { waitUntil: 'networkidle' });
    await wait(1500);
    await page.screenshot({
      path: join(OUT_DIR, '04-roadmap.png'),
      fullPage: false,
    });
    console.log('[capture]   ✓ 04-roadmap.png');

    // --- Screenshot: Sync Dashboard ---
    console.log('[capture] 5/5 Sync Dashboard...');
    await page.goto(`${baseUrl}/#/sync`, { waitUntil: 'networkidle' });
    await wait(1500);
    await page.screenshot({
      path: join(OUT_DIR, '05-sync-dashboard.png'),
      fullPage: false,
    });
    console.log('[capture]   ✓ 05-sync-dashboard.png');

    // Close page to flush video recording
    await page.close();
    await context.close();
    await browser.close();

    // Rename the video file
    const { readdir, rename } = await import('node:fs/promises');
    const files = await readdir(OUT_DIR);
    const videoFile = files.find((f) => f.endsWith('.webm'));
    if (videoFile) {
      await rename(join(OUT_DIR, videoFile), join(OUT_DIR, 'screencast.webm'));
      console.log('[capture]   ✓ screencast.webm');
    }

    console.log(`\n[capture] Done! All captures saved to ${OUT_DIR}/`);
    console.log('[capture] Files:');
    const outFiles = await readdir(OUT_DIR);
    for (const f of outFiles.sort()) {
      console.log(`  - ${f}`);
    }
  } finally {
    // Cleanup
    vite.kill('SIGTERM');
    apiServer.close();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[capture] Error:', err);
  process.exit(1);
});
