import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for @gitpm/ui end-to-end tests.
 *
 * Tests live in ./e2e/*.spec.ts. A Hono API server + Vite dev server are
 * launched via `tsx src/dev.ts`, backed by a copy of the static fixture tree
 * at ./e2e/fixtures/.meta that is materialized into a fresh temp dir at the
 * start of each test run (so tests that mutate files stay isolated and the
 * committed fixture is never touched).
 *
 * Note: the fixture is copied here, at config top-level (synchronously),
 * because Playwright starts the `webServer` BEFORE globalSetup runs — so we
 * can't defer fixture preparation to globalSetup. The tmp dir is removed by
 * global-teardown.ts after the run.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureSrc = resolve(__dirname, 'e2e/fixtures/.meta');
const tmpFixtureDir = mkdtempSync(join(tmpdir(), 'gitpm-e2e-'));
const tmpMetaDir = join(tmpFixtureDir, '.meta');
cpSync(fixtureSrc, tmpMetaDir, { recursive: true });
// Share with global-teardown so it can clean up.
process.env.GITPM_E2E_TMP_FIXTURE_DIR = tmpFixtureDir;

const API_PORT = Number(process.env.GITPM_E2E_API_PORT ?? 4748);
const VITE_PORT = Number(process.env.GITPM_E2E_VITE_PORT ?? 5174);
const BASE_URL = `http://localhost:${VITE_PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Local override: point at a system chromium when the bundled build
        // isn't available (offline dev environments). CI always uses the
        // bundled Playwright browser from `playwright install`.
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
              },
            }
          : {}),
      },
    },
  ],
  webServer: {
    command: 'tsx src/dev.ts',
    url: `${BASE_URL}/`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PORT: String(API_PORT),
      VITE_PORT: String(VITE_PORT),
      META_DIR: tmpMetaDir,
    },
  },
});
