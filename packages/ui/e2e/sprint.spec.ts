import { expect, test } from '@playwright/test';

/**
 * End-to-end tests for the Sprint Planning view (routes/sprint.tsx).
 *
 * Fixture sprint (see e2e/fixtures/.meta/sprints/e2e-sprint-1.md):
 *   e2e-sprint-1  capacity=10pts  stories: story-sprint-a (5pts), story-sprint-b (8pts)
 *
 * The two fixture stories are `cancelled` so they don't show up in (and
 * don't perturb the column counts of) the Kanban board fixture, while still
 * counting toward the sprint's points total: 5 + 8 = 13 pts > 10 pt
 * capacity, so the capacity bar renders in its "over capacity" state.
 * Their titles ("Story 3 — Sprint Fixture A" / "Story 4 — Sprint Fixture B")
 * deliberately sort between "Story 1" and "Story 6" so they don't disturb
 * tree-browser.spec.ts's title-sort assertions.
 */

const SPRINT_PATH = '/#/sprint';

test.describe('Sprint Planning view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SPRINT_PATH);
    await expect(
      page.getByRole('heading', { name: 'Sprint Planning' }),
    ).toBeVisible();
  });

  test('renders the sprint board with the fixture sprint column', async ({
    page,
  }) => {
    // Scoped to <main> because story titles also appear in the sidebar's
    // "Entities" quick-nav list (see App.tsx), which would otherwise make
    // these locators ambiguous.
    const main = page.locator('main');
    await expect(main.getByText('E2E Sprint 1')).toBeVisible();
    await expect(main.getByText(/Story 3 — Sprint Fixture A/)).toBeVisible();
    await expect(main.getByText(/Story 4 — Sprint Fixture B/)).toBeVisible();
  });

  test('capacity indicator shows the expected points total', async ({
    page,
  }) => {
    const capacity = page.getByTestId('sprint-capacity-e2e-sprint-1');
    await expect(capacity).toBeVisible();
    await expect(capacity).toHaveText('13/10 pts');
  });

  test('shows an over-capacity indicator when points exceed capacity', async ({
    page,
  }) => {
    const bar = page.getByTestId('sprint-capacity-bar-e2e-sprint-1');
    await expect(bar).toHaveAttribute('data-over-capacity', 'true');

    await expect(
      page.getByTestId('sprint-over-capacity-e2e-sprint-1'),
    ).toHaveText('Over capacity');
  });

  test('keeps the count-based done progress alongside the points capacity', async ({
    page,
  }) => {
    // Both fixture stories are `cancelled`, which counts as "done" for the
    // existing count-based progress indicator: 2/2 (100%).
    await expect(page.locator('main').getByText('100% (2/2)')).toBeVisible();
  });
});
