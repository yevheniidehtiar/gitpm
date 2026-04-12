import { expect, test } from '@playwright/test';
import { dragCardToColumn } from './helpers/drag.js';

/**
 * End-to-end tests for the Kanban board (routes/board.tsx).
 *
 * Runs against a fresh copy of ./fixtures/.meta, served by the real UI
 * dev server (Hono API + Vite). The board's route is `/#/board` because
 * the router uses hash history (App.tsx).
 *
 * Fixture layout (see e2e/fixtures/.meta):
 *   Stories  — 6 total:
 *     story-1-todo           todo         alice  high      epic-alpha
 *     story-2-in-progress    in_progress  bob    medium    epic-alpha
 *     story-3-done           done         alice  low       epic-alpha
 *     story-4-backlog        backlog      carol  critical  epic-beta
 *     story-5-in-review      in_review    bob    high      epic-beta
 *     story-6-orphan         todo         alice  medium    (no epic_ref)
 *   Epics (also rendered as cards):
 *     epic-alpha             in_progress  —              (owner alice, no assignee)
 *     epic-beta              todo         —              (owner bob, no assignee)
 *
 * Column totals with no filters:
 *   backlog: 1   todo: 3   in_progress: 2   in_review: 1   done: 1
 */

const BOARD_PATH = '/#/board';

async function expectCardInColumn(
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  page: any,
  cardId: string,
  column: string,
): Promise<void> {
  const card = page
    .getByTestId(`kanban-column-${column}`)
    .getByTestId(`kanban-card-${cardId}`);
  await expect(card).toBeVisible();
}

test.describe('Kanban board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_PATH);
    await expect(page.getByTestId('kanban-board')).toBeVisible();
  });

  test('renders all five columns with labels', async ({ page }) => {
    for (const status of [
      'backlog',
      'todo',
      'in_progress',
      'in_review',
      'done',
    ]) {
      await expect(page.getByTestId(`kanban-column-${status}`)).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Todo' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'In Progress' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'In Review' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Done' })).toBeVisible();
  });

  test('cards render in the correct columns', async ({ page }) => {
    await expectCardInColumn(page, 'story-1-todo', 'todo');
    await expectCardInColumn(page, 'story-2-in-progress', 'in_progress');
    await expectCardInColumn(page, 'story-3-done', 'done');
    await expectCardInColumn(page, 'story-4-backlog', 'backlog');
    await expectCardInColumn(page, 'story-5-in-review', 'in_review');
    await expectCardInColumn(page, 'story-6-orphan', 'todo');
    // Epics appear as cards too, in the column matching their status.
    await expectCardInColumn(page, 'epic-alpha', 'in_progress');
    await expectCardInColumn(page, 'epic-beta', 'todo');
  });

  test('column counts match rendered cards', async ({ page }) => {
    await expect(page.getByTestId('kanban-column-count-backlog')).toHaveText(
      '1',
    );
    await expect(page.getByTestId('kanban-column-count-todo')).toHaveText('3');
    await expect(
      page.getByTestId('kanban-column-count-in_progress'),
    ).toHaveText('2');
    await expect(page.getByTestId('kanban-column-count-in_review')).toHaveText(
      '1',
    );
    await expect(page.getByTestId('kanban-column-count-done')).toHaveText('1');
  });

  test('filter by epic narrows cards to that epic', async ({ page }) => {
    await page
      .getByTestId('kanban-filter-epic')
      .selectOption({ value: 'epic-alpha' });

    // Only stories with epic_ref=epic-alpha should be visible.
    await expectCardInColumn(page, 'story-1-todo', 'todo');
    await expectCardInColumn(page, 'story-2-in-progress', 'in_progress');
    await expectCardInColumn(page, 'story-3-done', 'done');

    // Orphan story, epic-beta stories, and epics themselves (no epic_ref) gone.
    await expect(page.getByTestId('kanban-card-story-6-orphan')).toHaveCount(0);
    await expect(page.getByTestId('kanban-card-story-4-backlog')).toHaveCount(
      0,
    );
    await expect(page.getByTestId('kanban-card-story-5-in-review')).toHaveCount(
      0,
    );
    await expect(page.getByTestId('kanban-card-epic-alpha')).toHaveCount(0);
    await expect(page.getByTestId('kanban-card-epic-beta')).toHaveCount(0);

    // Counts should reflect the filter.
    await expect(page.getByTestId('kanban-column-count-backlog')).toHaveText(
      '0',
    );
    await expect(page.getByTestId('kanban-column-count-todo')).toHaveText('1');
    await expect(
      page.getByTestId('kanban-column-count-in_progress'),
    ).toHaveText('1');
    await expect(page.getByTestId('kanban-column-count-in_review')).toHaveText(
      '0',
    );
    await expect(page.getByTestId('kanban-column-count-done')).toHaveText('1');
  });

  test('filter by assignee narrows cards to that person', async ({ page }) => {
    await page
      .getByTestId('kanban-filter-assignee')
      .selectOption({ value: 'alice' });

    // Alice's stories only: 1 (todo), 3 (done), 6 (todo).
    await expectCardInColumn(page, 'story-1-todo', 'todo');
    await expectCardInColumn(page, 'story-6-orphan', 'todo');
    await expectCardInColumn(page, 'story-3-done', 'done');

    await expect(
      page.getByTestId('kanban-card-story-2-in-progress'),
    ).toHaveCount(0);
    await expect(page.getByTestId('kanban-card-story-4-backlog')).toHaveCount(
      0,
    );
    await expect(page.getByTestId('kanban-card-story-5-in-review')).toHaveCount(
      0,
    );
    // Epics have no assignee field, so they should be hidden too.
    await expect(page.getByTestId('kanban-card-epic-alpha')).toHaveCount(0);
    await expect(page.getByTestId('kanban-card-epic-beta')).toHaveCount(0);

    await expect(page.getByTestId('kanban-column-count-todo')).toHaveText('2');
    await expect(page.getByTestId('kanban-column-count-done')).toHaveText('1');
  });

  test('combined epic + assignee filters intersect', async ({ page }) => {
    await page
      .getByTestId('kanban-filter-epic')
      .selectOption({ value: 'epic-alpha' });
    await page
      .getByTestId('kanban-filter-assignee')
      .selectOption({ value: 'alice' });

    // Alice ∩ epic-alpha = story-1-todo + story-3-done
    await expectCardInColumn(page, 'story-1-todo', 'todo');
    await expectCardInColumn(page, 'story-3-done', 'done');

    await expect(
      page.getByTestId('kanban-card-story-2-in-progress'),
    ).toHaveCount(0);
    await expect(page.getByTestId('kanban-card-story-6-orphan')).toHaveCount(0);

    await expect(page.getByTestId('kanban-column-count-todo')).toHaveText('1');
    await expect(
      page.getByTestId('kanban-column-count-in_progress'),
    ).toHaveText('0');
    await expect(page.getByTestId('kanban-column-count-done')).toHaveText('1');
  });

  test('clicking a card title navigates to entity editor', async ({ page }) => {
    const card = page.getByTestId('kanban-card-story-1-todo');
    await card.getByRole('link', { name: /Story 1/ }).click();

    await expect(page).toHaveURL(/#\/entity\/story-1-todo$/);
  });

  test('drag-and-drop updates a card status and persists', async ({ page }) => {
    // Baseline: story-1-todo in the todo column.
    await expectCardInColumn(page, 'story-1-todo', 'todo');

    // Drag from todo → in_progress. Wait for the PUT to land before
    // asserting, so we know the mutation flushed before React re-renders.
    const putRequest = page.waitForResponse(
      (res) =>
        res.url().includes('/api/entity/story-1-todo') &&
        res.request().method() === 'PUT' &&
        res.status() === 200,
    );
    await dragCardToColumn(
      page,
      'kanban-card-story-1-todo',
      'kanban-column-in_progress',
    );
    await putRequest;

    // After drop, card appears in new column and is gone from the old one.
    await expectCardInColumn(page, 'story-1-todo', 'in_progress');
    await expect(
      page
        .getByTestId('kanban-column-todo')
        .getByTestId('kanban-card-story-1-todo'),
    ).toHaveCount(0);

    // Column counts swing: todo 3 → 2, in_progress 2 → 3.
    await expect(page.getByTestId('kanban-column-count-todo')).toHaveText('2');
    await expect(
      page.getByTestId('kanban-column-count-in_progress'),
    ).toHaveText('3');

    // Reload and verify the change was persisted to the .meta fixture on disk.
    await page.reload();
    await expect(page.getByTestId('kanban-board')).toBeVisible();
    await expectCardInColumn(page, 'story-1-todo', 'in_progress');
  });
});
