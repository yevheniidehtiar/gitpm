import type { Locator, Page } from '@playwright/test';

/**
 * Simulate HTML5 drag-and-drop between two elements.
 *
 * Playwright's built-in `locator.dragTo()` relies on mouse events, which do
 * NOT reliably trigger the `dragstart` / `dragover` / `drop` handlers the
 * Kanban board uses (board.tsx — React's native onDragStart/onDrop). This
 * helper dispatches the real HTML5 drag events with a shared DataTransfer
 * so the board's handlers fire exactly as they would for a real user drag.
 *
 * Usage:
 *   await dragCardToColumn(page, 'kanban-card-story-1-todo', 'kanban-column-in_progress');
 */
export async function dragCardToColumn(
  page: Page,
  cardTestId: string,
  columnTestId: string,
): Promise<void> {
  const source: Locator = page.getByTestId(cardTestId);
  const target: Locator = page.getByTestId(columnTestId);

  await source.waitFor({ state: 'visible' });
  await target.waitFor({ state: 'visible' });

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());

  await source.dispatchEvent('dragstart', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
  await source.dispatchEvent('dragend', { dataTransfer });
}
