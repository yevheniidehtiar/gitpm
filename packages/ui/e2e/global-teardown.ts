import { rmSync } from 'node:fs';

/**
 * Removes the temporary fixture directory created at the top of
 * playwright.config.ts. Idempotent — safe to re-run.
 */
export default function globalTeardown(): void {
  const tmp = process.env.GITPM_E2E_TMP_FIXTURE_DIR;
  if (!tmp) return;
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; don't fail the run on teardown errors.
  }
}
