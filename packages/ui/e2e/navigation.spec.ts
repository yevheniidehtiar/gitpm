import { expect, test } from '@playwright/test';

/**
 * End-to-end tests for the global layout in App.tsx — the fixed sidebar with
 * primary navigation links and the top bar with breadcrumbs.
 *
 * The kanban spec runs earlier (alphabetical order) and mutates story-1-todo,
 * but the assertions here are route- and count-based, not status-based.
 */

test.describe('Global layout', () => {
  test('sidebar lists all primary navigation links', async ({ page }) => {
    await page.goto('/#/');

    const sidebar = page.locator('aside');
    for (const label of [
      'Tree Browser',
      'Board',
      'Roadmap',
      'Sync Dashboard',
    ]) {
      await expect(
        sidebar.getByRole('link', { name: new RegExp(label) }),
      ).toBeVisible();
    }
  });

  test('sidebar shows entity counts in the "s / e / m" format', async ({
    page,
  }) => {
    await page.goto('/#/');
    // The format is `<stories>s / <epics>e / <milestones>m`. Values depend on
    // how many entities exist at the time this test runs (earlier mutations
    // can bump the stories count), so the assertion is format-only.
    await expect(page.locator('aside').locator('p.text-xs').first()).toHaveText(
      /^\d+s \/ \d+e \/ \d+m$/,
    );
  });

  test('clicking sidebar navigation updates route and breadcrumbs', async ({
    page,
  }) => {
    await page.goto('/#/');
    const sidebar = page.locator('aside');

    // Tree Browser → Board
    await sidebar.getByRole('link', { name: /Board/ }).click();
    await expect(page).toHaveURL(/#\/board$/);
    await expect(page.getByTestId('kanban-board')).toBeVisible();
    await expect(
      page.locator('header').getByRole('link', { name: 'Board' }),
    ).toBeVisible();

    // Board → Roadmap
    await sidebar.getByRole('link', { name: /Roadmap/ }).click();
    await expect(page).toHaveURL(/#\/roadmap$/);
    await expect(
      page.getByRole('heading', { name: 'Roadmap Timeline' }),
    ).toBeVisible();
    await expect(
      page.locator('header').getByRole('link', { name: 'Roadmap' }),
    ).toBeVisible();

    // Roadmap → Sync
    await sidebar.getByRole('link', { name: /Sync Dashboard/ }).click();
    await expect(page).toHaveURL(/#\/sync$/);
    // The breadcrumb "Sync" link collides with the top-bar "Sync Now" pill
    // that also matches `{ name: 'Sync' }`, so match exactly.
    await expect(
      page.locator('header').getByRole('link', { name: 'Sync', exact: true }),
    ).toBeVisible();

    // Sync → Tree Browser (index)
    await sidebar.getByRole('link', { name: /Tree Browser/ }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(
      page.locator('header').getByRole('link', { name: 'Tree' }),
    ).toBeVisible();
  });

  test('validate button shows a result after clicking', async ({ page }) => {
    await page.goto('/#/');
    const validateButton = page.getByRole('button', { name: /Validate/ });
    await validateButton.click();

    // The result paragraph is the only one rendered with `text-center` in
    // the sidebar — either "All valid" (ok) or "N error(s)" (zod errors).
    const result = page.locator('aside p.text-center');
    await expect(result).toHaveText(/All valid|error\(s\)/);
  });
});
