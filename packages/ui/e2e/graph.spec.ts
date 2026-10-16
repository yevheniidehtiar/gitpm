import { expect, test } from '@playwright/test';

/**
 * End-to-end tests for the Dependency Graph view (routes/graph.tsx).
 *
 * The graph renders a single force-directed SVG: one <g> node per entity
 * (with a <circle>) and one <line> per edge, positioned by a d3-force
 * simulation that ticks asynchronously after mount. Runs against the same
 * fixture tree as the other spec files (see kanban.spec.ts for the layout).
 */

const GRAPH_PATH = '/#/graph';

test.describe('Dependency graph', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GRAPH_PATH);
    await expect(
      page.getByRole('heading', { name: 'Dependency Graph' }),
    ).toBeVisible();
  });

  test('renders the graph SVG with entity nodes', async ({ page }) => {
    const svg = page.getByRole('img', { name: 'Entity Dependency Graph' });
    await expect(svg).toBeVisible();

    // Nodes are <g> elements each containing a <circle>; the force
    // simulation populates them asynchronously after the first tick.
    const nodeCircles = svg.locator('g circle');
    await expect(nodeCircles.first()).toBeVisible();
    expect(await nodeCircles.count()).toBeGreaterThan(0);
  });

  test('renders the legend including the critical path entry', async ({
    page,
  }) => {
    await expect(page.getByText('critical path')).toBeVisible();
    await expect(page.getByText('story', { exact: true })).toBeVisible();
    await expect(page.getByText('epic', { exact: true })).toBeVisible();
  });

  test('highlights the critical path in the critical color', async ({
    page,
  }) => {
    // The fixture has an active story -> epic -> milestone chain, so at
    // least one edge and its endpoint nodes must render as critical.
    const svg = page.getByRole('img', { name: 'Entity Dependency Graph' });
    await expect(svg).toBeVisible();
    await expect
      .poll(() => svg.locator('line[stroke="#DC2626"]').count())
      .toBeGreaterThan(0);
    await expect
      .poll(() => svg.locator('circle[stroke="#DC2626"]').count())
      .toBeGreaterThanOrEqual(2);
  });

  test('clicking a node navigates to the entity page', async ({ page }) => {
    const svg = page.getByRole('img', { name: 'Entity Dependency Graph' });
    const firstNode = svg.locator('g').first();
    await expect(firstNode).toBeVisible();

    await firstNode.click();

    await expect(page).toHaveURL(/#\/entity\/.+/);
    // The entity editor's header (type icon + title heading) confirms the
    // target entity loaded.
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});
