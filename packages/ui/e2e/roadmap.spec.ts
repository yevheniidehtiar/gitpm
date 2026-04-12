import { expect, test } from '@playwright/test';

/**
 * End-to-end tests for the Roadmap view (routes/roadmap.tsx).
 *
 * The roadmap renders a single SVG timeline with a diamond marker per
 * milestone and a horizontal bar per linked epic. Only milestones with a
 * populated `target_date` field are rendered.
 *
 * Fixture milestones (see e2e/fixtures/.meta/roadmap/milestones/v1.md):
 *   e2e-milestone-v1  target_date=2026-06-30  linked: epic-alpha, epic-beta
 */

const ROADMAP_PATH = '/#/roadmap';

test.describe('Roadmap timeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ROADMAP_PATH);
    await expect(
      page.getByRole('heading', { name: 'Roadmap Timeline' }),
    ).toBeVisible();
  });

  test('renders the timeline SVG with month markers', async ({ page }) => {
    const svg = page.getByRole('img', { name: 'Roadmap Timeline' });
    await expect(svg).toBeVisible();

    // At least a handful of month grid lines (the component pads minDate /
    // maxDate by one month, so at minimum 3 month labels appear).
    const monthLabels = svg.locator('text[fill="#6b7280"]');
    expect(await monthLabels.count()).toBeGreaterThan(2);
  });

  test('renders the fixture milestone title in the SVG', async ({ page }) => {
    const svg = page.getByRole('img', { name: 'Roadmap Timeline' });
    // Milestone titles are rendered as <text> elements with the dark heading
    // color. Match by text content.
    await expect(
      svg.locator('text', { hasText: 'v1.0 Fixture Milestone' }),
    ).toBeVisible();
  });

  test('renders a bar for each epic linked to a milestone', async ({
    page,
  }) => {
    const svg = page.getByRole('img', { name: 'Roadmap Timeline' });
    // Epic labels are truncated at 18 chars + "..." — the fixture epic names
    // are 10 characters ("Epic Alpha"/"Epic Beta") and fit without truncation.
    await expect(svg.locator('text', { hasText: /Epic Alpha/ })).toBeVisible();
    await expect(svg.locator('text', { hasText: /Epic Beta/ })).toBeVisible();
  });

  test('renders the status color legend', async ({ page }) => {
    // The legend below the SVG renders a StatusBadge for every status color.
    // The Badge renders labels "Backlog", "Todo", etc.
    const legend = page.locator('main').locator('.flex.items-center.gap-4');
    for (const label of [
      'Backlog',
      'Todo',
      'In Progress',
      'In Review',
      'Done',
    ]) {
      await expect(legend.getByText(label, { exact: true })).toBeVisible();
    }
  });
});
