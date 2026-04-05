/**
 * E2E UI test + screencast capture for GitPM UI
 * Runs against a real .meta/ directory, captures screenshots + video.
 *
 * Usage:
 *   bun packages/ui/scripts/e2e-capture.ts --meta-dir /path/to/.meta --out /path/to/output
 */
import { spawn } from 'node:child_process';
import { mkdir, readdir, rename } from 'node:fs/promises';
import type { Server } from 'node:http';
import { join, resolve } from 'node:path';

import { serve } from '@hono/node-server';
import { chromium } from 'playwright';

import { createApp } from '../src/server/index.js';

// --- Config ---
const META_DIR = getArg('--meta-dir') ?? '/tmp/hyper-admin/.meta';
const OUT_DIR = getArg('--out') ?? resolve('docs/demos/hyper-admin');
const API_PORT = 4747; // Must match vite.config.ts proxy target
const VITE_PORT = 5198;
const VIEWPORT = { width: 1440, height: 900 };

function getArg(flag: string): string | undefined {
	const idx = process.argv.indexOf(flag);
	return idx !== -1 ? process.argv[idx + 1] : undefined;
}

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

async function main() {
	await mkdir(OUT_DIR, { recursive: true });

	console.log('[e2e] Starting API server...');
	console.log(`[e2e] Meta dir: ${META_DIR}`);
	const app = createApp(META_DIR);
	const apiServer: Server = serve({ fetch: app.fetch, port: API_PORT });

	console.log('[e2e] Starting Vite dev server...');
	const uiDir = resolve('packages/ui');
	const vite = spawn(
		'npx',
		['vite', '--port', String(VITE_PORT), '--strictPort'],
		{ cwd: uiDir, stdio: 'pipe', env: { ...process.env } },
	);

	let viteOutput = '';
	vite.stdout?.on('data', (d) => {
		viteOutput += d.toString();
	});
	vite.stderr?.on('data', (d) => {
		viteOutput += d.toString();
	});

	try {
		await waitForServer(`http://localhost:${API_PORT}/api/tree`);
		console.log('[e2e] API server ready.');

		await waitForServer(`http://localhost:${VITE_PORT}/`);
		console.log('[e2e] Vite server ready.');

		console.log('[e2e] Launching Chromium...');
		const browser = await chromium.launch({ headless: true });
		const context = await browser.newContext({
			viewport: VIEWPORT,
			recordVideo: { dir: OUT_DIR, size: VIEWPORT },
		});

		const page = await context.newPage();
		const baseUrl = `http://localhost:${VITE_PORT}`;

		// --- 1. Tree Browser (full entity list) ---
		console.log('[e2e] 1/7 Tree Browser (all entities)...');
		await page.goto(`${baseUrl}/#/`, { waitUntil: 'networkidle' });
		await wait(2000);
		await page.screenshot({
			path: join(OUT_DIR, '01-tree-browser.png'),
			fullPage: false,
		});
		console.log('[e2e]   ✓ 01-tree-browser.png');

		// --- 2. Tree Browser — search ---
		console.log('[e2e] 2/7 Tree Browser (search)...');
		const searchInput = page.locator('input[type="text"]').first();
		if (await searchInput.count()) {
			await searchInput.fill('websocket');
			await wait(1000);
			await page.screenshot({
				path: join(OUT_DIR, '02-tree-search.png'),
				fullPage: false,
			});
			console.log('[e2e]   ✓ 02-tree-search.png');
			await searchInput.clear();
			await wait(500);
		}

		// --- 3. Epic detail ---
		console.log('[e2e] 3/7 Epic detail...');
		const epicLink = page.locator('a[href*="entity"]').first();
		if (await epicLink.count()) {
			await epicLink.click();
			await wait(1500);
			await page.screenshot({
				path: join(OUT_DIR, '03-epic-detail.png'),
				fullPage: false,
			});
			console.log('[e2e]   ✓ 03-epic-detail.png');
		}

		// --- 4. Story detail ---
		console.log('[e2e] 4/7 Story detail...');
		await page.goto(`${baseUrl}/#/`, { waitUntil: 'networkidle' });
		await wait(1000);
		const storyLink = page.locator('a[href*="entity"]').nth(5);
		if (await storyLink.count()) {
			await storyLink.click();
			await wait(1500);
			await page.screenshot({
				path: join(OUT_DIR, '04-story-detail.png'),
				fullPage: false,
			});
			console.log('[e2e]   ✓ 04-story-detail.png');
		}

		// --- 5. Roadmap timeline ---
		console.log('[e2e] 5/7 Roadmap timeline...');
		await page.goto(`${baseUrl}/#/roadmap`, { waitUntil: 'networkidle' });
		await wait(2000);
		await page.screenshot({
			path: join(OUT_DIR, '05-roadmap.png'),
			fullPage: false,
		});
		console.log('[e2e]   ✓ 05-roadmap.png');

		// --- 6. Sync dashboard ---
		console.log('[e2e] 6/7 Sync dashboard...');
		await page.goto(`${baseUrl}/#/sync`, { waitUntil: 'networkidle' });
		await wait(1500);
		await page.screenshot({
			path: join(OUT_DIR, '06-sync-dashboard.png'),
			fullPage: false,
		});
		console.log('[e2e]   ✓ 06-sync-dashboard.png');

		// --- 7. Scroll through tree browser (for video) ---
		console.log('[e2e] 7/7 Scrolling through entities for video...');
		await page.goto(`${baseUrl}/#/`, { waitUntil: 'networkidle' });
		await wait(1000);
		// Slow scroll for screencast
		for (let i = 0; i < 10; i++) {
			await page.mouse.wheel(0, 300);
			await wait(400);
		}
		// Click a few entities for the video
		const entities = page.locator('a[href*="entity"]');
		const count = await entities.count();
		for (let i = 0; i < Math.min(3, count); i++) {
			await entities.nth(i * 3).click();
			await wait(1500);
		}
		// Back to roadmap
		await page.goto(`${baseUrl}/#/roadmap`, { waitUntil: 'networkidle' });
		await wait(2000);
		await page.screenshot({
			path: join(OUT_DIR, '07-roadmap-final.png'),
			fullPage: false,
		});

		console.log('[e2e] Closing browser...');
		await page.close();
		await context.close();
		await browser.close();

		// Rename video file
		const files = await readdir(OUT_DIR);
		const videoFile = files.find((f) => f.endsWith('.webm'));
		if (videoFile) {
			await rename(
				join(OUT_DIR, videoFile),
				join(OUT_DIR, 'screencast.webm'),
			);
			console.log('[e2e]   ✓ screencast.webm');
		}

		console.log(`\n[e2e] Done! All captures saved to ${OUT_DIR}/`);
		const outFiles = await readdir(OUT_DIR);
		for (const f of outFiles.sort()) {
			console.log(`  - ${f}`);
		}
	} finally {
		vite.kill('SIGTERM');
		apiServer.close();
	}

	process.exit(0);
}

main().catch((err) => {
	console.error('[e2e] Error:', err);
	process.exit(1);
});
