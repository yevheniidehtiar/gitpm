import { expect, test } from '@playwright/test';

/**
 * End-to-end tests for the Sync Dashboard (routes/sync-dashboard.tsx).
 *
 * The fixture does NOT ship a `.meta/sync/github-config.yaml`, so
 * `/api/sync/status` returns `{ configured: false }` and the dashboard falls
 * back to the "no GitHub sync configured" empty state. Wiring up a real
 * configured state would require mocking `loadConfig`, which is out of scope
 * for a UI-level e2e test.
 */

const SYNC_PATH = '/#/sync';

test.describe('Sync Dashboard', () => {
  test('shows the not-configured empty state when no sync config exists', async ({
    page,
  }) => {
    await page.goto(SYNC_PATH);

    // The empty-state message from routes/sync-dashboard.tsx.
    await expect(page.getByText(/No GitHub sync configured/i)).toBeVisible();

    // Push / Pull / Full Sync buttons should NOT be rendered in the empty
    // state — they only appear after sync is configured.
    await expect(
      page.getByRole('button', { name: 'Push', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Pull', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Full Sync', exact: true }),
    ).toHaveCount(0);
  });

  test('top bar renders "Sync Now" link but hides the sync indicator', async ({
    page,
  }) => {
    await page.goto('/#/');

    // The "Sync Now" pill renders whenever the app is not in demo mode.
    const syncNow = page.getByRole('link', { name: 'Sync Now' });
    await expect(syncNow).toBeVisible();

    // The "Synced X ago" indicator only renders when syncStatus.configured is
    // true, so it should be absent in the fixture.
    await expect(page.getByText(/^Synced \d/)).toHaveCount(0);
    await expect(page.getByText('Not synced')).toHaveCount(0);

    // Clicking "Sync Now" navigates to the sync route.
    await syncNow.click();
    await expect(page).toHaveURL(/#\/sync$/);
  });
});
