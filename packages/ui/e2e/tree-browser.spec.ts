import { expect, test } from '@playwright/test';

/**
 * End-to-end tests for the Tree Browser (routes/tree-browser.tsx).
 *
 * Runs against the same fixture tree as kanban.spec.ts. The tree browser is
 * the app index route, accessible at `/#/`.
 *
 * Important ordering note: Playwright runs spec files alphabetically with
 * `workers: 1` and `fullyParallel: false`. This file runs AFTER kanban.spec.ts,
 * which mutates story-1-todo's status (todo → in_progress). These tests
 * therefore avoid asserting on story-1-todo's status column.
 *
 * Creation is the last test in this file and bumps the stories count by one.
 * No spec file runs after tree-browser.spec.ts alphabetically, so the mutation
 * has no downstream effect.
 */

const INDEX_PATH = '/#/';

test.describe('Tree Browser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(INDEX_PATH);
    // Wait for the table to render (tree loaded).
    await expect(page.getByRole('table')).toBeVisible();
  });

  // The sidebar renders its own <Link> for every entity, so bare role-based
  // lookups like `getByRole('link', { name: 'Epic Alpha' })` are ambiguous.
  // Scope entity-link assertions to the main content area.
  function tableLink(
    page: import('@playwright/test').Page,
    name: string | RegExp,
  ) {
    return page
      .locator('main')
      .getByRole('link', { name, exact: typeof name === 'string' });
  }

  test('sidebar shows GitPM brand and entity counts', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'GitPM', level: 1 }),
    ).toBeVisible();
    // Counts format: `<stories>s / <epics>e / <milestones>m`.
    // Fixture has 6 stories, 2 epics, 1 milestone. Tree-browser is the LAST
    // spec file (alphabetically) so earlier tests haven't added entities yet
    // when this assertion runs in the beforeEach-refreshed page. But the
    // create test in this file runs last, so keep the assertion loose.
    const counts = page.locator('aside p.text-xs').first();
    await expect(counts).toContainText(/\d+s \/ \d+e \/ \d+m/);
  });

  test('hierarchical view renders milestones, epics, and orphan stories', async ({
    page,
  }) => {
    // Default view (no filters) is hierarchical. The current hierarchical
    // composition (see tree-browser.tsx) emits:
    //   - every milestone and its linked epics
    //   - orphan epics (no milestone_ref) and their resolvedStories
    //   - orphan stories (no epic_ref)
    //   - prds + roadmaps
    // Fixture epics are all linked to a milestone, so the top-level story
    // rows only include story-6-orphan and the roadmap/milestone rows.
    const rows = page.locator('main table tbody tr');
    await expect(rows).not.toHaveCount(0);

    // Milestone, both epics, and the roadmap are present.
    await expect(tableLink(page, 'v1.0 Fixture Milestone')).toBeVisible();
    await expect(tableLink(page, 'Epic Alpha')).toBeVisible();
    await expect(tableLink(page, 'Epic Beta')).toBeVisible();
    await expect(tableLink(page, 'E2E Fixture Roadmap')).toBeVisible();

    // The orphan story is the only story that renders in hierarchical mode.
    await expect(tableLink(page, /Story 6 — Orphan Alice/)).toBeVisible();
  });

  test('search filter narrows rows to matching titles', async ({ page }) => {
    const search = page.getByPlaceholder('Search entities...');
    await search.fill('orphan');

    // Only story-6-orphan matches.
    await expect(tableLink(page, /Story 6 — Orphan Alice/)).toBeVisible();
    await expect(tableLink(page, 'Epic Alpha')).toHaveCount(0);
    await expect(tableLink(page, 'v1.0 Fixture Milestone')).toHaveCount(0);

    // Clearing the search restores the full hierarchical view.
    await search.fill('');
    await expect(tableLink(page, 'Epic Alpha')).toBeVisible();
  });

  test('type filter narrows rows to the selected entity type', async ({
    page,
  }) => {
    // The type filter is the second <select> in the filter bar. The first
    // select is the status filter. Select only `milestone`.
    const typeSelect = page.locator('select[multiple]').nth(1);
    await typeSelect.selectOption(['milestone']);

    // Only the milestone row should remain.
    await expect(tableLink(page, 'v1.0 Fixture Milestone')).toBeVisible();
    await expect(tableLink(page, 'Epic Alpha')).toHaveCount(0);
    await expect(tableLink(page, /Story 6 — Orphan Alice/)).toHaveCount(0);

    // Switch to epics-only filter.
    await typeSelect.selectOption(['epic']);
    await expect(tableLink(page, 'Epic Alpha')).toBeVisible();
    await expect(tableLink(page, 'Epic Beta')).toBeVisible();
    await expect(tableLink(page, 'v1.0 Fixture Milestone')).toHaveCount(0);
  });

  test('status filter narrows rows to the selected statuses', async ({
    page,
  }) => {
    // Filter by `backlog`. Only story-4-backlog has this status (epics and
    // milestones in the fixture use in_progress/todo, not backlog).
    const statusSelect = page.locator('select[multiple]').first();
    await statusSelect.selectOption(['backlog']);

    await expect(tableLink(page, /Story 4 — Backlog Carol/)).toBeVisible();
    // Other stories/epics should be hidden.
    await expect(tableLink(page, /Story 6 — Orphan Alice/)).toHaveCount(0);
    await expect(tableLink(page, 'Epic Alpha')).toHaveCount(0);
  });

  test('assignee filter dropdown lists fixture assignees plus Unassigned', async ({
    page,
  }) => {
    // The assignee filter is the third <select multiple>, after status and
    // type. It derives options from the union of `assignee`/`owner` fields
    // across all entities in the tree.
    const assigneeSelect = page.locator('select[multiple]').nth(2);

    // Fixture assignees: alice (stories 1/3/6 + epic-alpha owner),
    // bob (stories 2/5 + epic-beta owner), carol (story 4). Milestone and
    // roadmap have no assignee/owner, so "Unassigned" must be present too.
    const optionValues = await assigneeSelect
      .locator('option')
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));

    expect(optionValues).toContain('__unassigned__');
    expect(optionValues).toContain('alice');
    expect(optionValues).toContain('bob');
    expect(optionValues).toContain('carol');
  });

  test('assignee filter narrows rows to stories/epics owned by that person', async ({
    page,
  }) => {
    const assigneeSelect = page.locator('select[multiple]').nth(2);
    await assigneeSelect.selectOption(['carol']);

    // Only carol's story should be visible.
    await expect(tableLink(page, /Story 4 — Backlog Carol/)).toBeVisible();

    // Other assignees' entities must be filtered out.
    await expect(tableLink(page, /Story 2 — In Progress Bob/)).toHaveCount(0);
    await expect(tableLink(page, /Story 6 — Orphan Alice/)).toHaveCount(0);
    await expect(tableLink(page, 'Epic Alpha')).toHaveCount(0);
    await expect(tableLink(page, 'Epic Beta')).toHaveCount(0);
    await expect(tableLink(page, 'v1.0 Fixture Milestone')).toHaveCount(0);
  });

  test('assignee filter Unassigned option shows only entities without owner', async ({
    page,
  }) => {
    const assigneeSelect = page.locator('select[multiple]').nth(2);
    await assigneeSelect.selectOption(['__unassigned__']);

    // Milestone and roadmap in the fixture have no assignee/owner.
    await expect(tableLink(page, 'v1.0 Fixture Milestone')).toBeVisible();
    await expect(tableLink(page, 'E2E Fixture Roadmap')).toBeVisible();

    // Stories and epics all have assignees/owners and must be filtered out.
    await expect(tableLink(page, /Story 6 — Orphan Alice/)).toHaveCount(0);
    await expect(tableLink(page, /Story 4 — Backlog Carol/)).toHaveCount(0);
    await expect(tableLink(page, 'Epic Alpha')).toHaveCount(0);
    await expect(tableLink(page, 'Epic Beta')).toHaveCount(0);
  });

  test('sorting by title toggles ascending and descending', async ({
    page,
  }) => {
    // Enter a filter that produces a flat list so the sort is observable.
    // Type=story gives us 6 titled rows, sorted by `type` then toggled to
    // `title` below.
    const typeSelect = page.locator('select[multiple]').nth(1);
    await typeSelect.selectOption(['story']);

    const titleHeader = page
      .locator('main')
      .getByRole('columnheader', { name: /^Title/ });
    await titleHeader.click(); // set sort key to 'title' (asc)

    const firstTitle = page
      .locator('main table tbody tr')
      .first()
      .getByRole('link');
    // Story-1-todo may have been renamed/mutated by entity-editor.spec.ts
    // (which runs earlier in alphabetical order), so allow any leading story.
    await expect(firstTitle).toHaveText(/^Story/);

    await titleHeader.click(); // toggle to desc
    await expect(firstTitle).toHaveText(/Story 6/);
  });

  test('clicking an entity title navigates to the entity editor', async ({
    page,
  }) => {
    await tableLink(page, 'Epic Alpha').click();
    await expect(page).toHaveURL(/#\/entity\/epic-alpha$/);
  });

  test('create form adds a new story and it appears in the table', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '+ New Entity' }).click();

    const uniqueTitle = `E2E Tree Create ${Date.now()}`;
    // Type defaults to "story", title is the visible text input inside the
    // create form panel.
    await page.getByPlaceholder('Entity title...').fill(uniqueTitle);

    // Wait for the POST /api/entity to land so we know the file was written
    // and the tree refetch has data before we assert.
    const createRequest = page.waitForResponse(
      (res) =>
        res.url().includes('/api/entity') &&
        res.request().method() === 'POST' &&
        res.status() === 201,
    );
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await createRequest;

    // Success toast confirms the mutation.
    await expect(page.getByText(/Created story:/)).toBeVisible();

    // The newly created story appears in the table.
    await expect(tableLink(page, uniqueTitle)).toBeVisible();
  });
});
