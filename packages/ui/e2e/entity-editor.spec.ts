import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * End-to-end tests for the Entity Editor (routes/entity-editor.tsx).
 *
 * Every test creates its own fresh story via the API and deletes it at the
 * end, so they are independent of each other and of the other spec files.
 * This is important: entity-editor.spec.ts runs FIRST in the alphabetical
 * order Playwright uses for serial runs, and any leftover entity here would
 * show up in the fixture state the later spec files observe.
 *
 * The editor is reached at `/#/entity/:id`. Fields displayed depend on the
 * entity type; we use `story` throughout.
 */

interface CreatedEntity {
  id: string;
  title: string;
  filePath: string;
}

async function createStory(
  request: APIRequestContext,
  title: string,
): Promise<CreatedEntity> {
  const res = await request.post('/api/entity', {
    data: {
      type: 'story',
      title,
      status: 'todo',
      priority: 'medium',
      assignee: 'tester',
      labels: ['e2e'],
      body: '# Hello\n\nOriginal body text.',
    },
  });
  expect(res.status(), 'create story succeeded').toBe(201);
  return (await res.json()) as CreatedEntity;
}

async function deleteEntity(
  request: APIRequestContext,
  id: string,
): Promise<void> {
  // Best-effort cleanup: if a test already deleted it via the UI, ignore 404s.
  const res = await request.delete(`/api/entity/${id}`);
  if (res.status() !== 204 && res.status() !== 404) {
    throw new Error(`cleanup delete failed: ${res.status()}`);
  }
}

async function openEditor(page: Page, id: string): Promise<void> {
  await page.goto(`/#/entity/${id}`);
  // The editor header (type icon + title heading) confirms the entity loaded.
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
}

test.describe('Entity Editor', () => {
  test('loads an entity and populates title, status, priority', async ({
    page,
    request,
  }) => {
    const created = await createStory(request, 'Editor Loads Fields');
    try {
      await openEditor(page, created.id);

      // Heading reflects the title.
      await expect(
        page.getByRole('heading', { name: 'Editor Loads Fields', level: 2 }),
      ).toBeVisible();

      // Title <input> is pre-filled with the entity title.
      const titleInput = page.locator('input[type="text"]').first();
      await expect(titleInput).toHaveValue('Editor Loads Fields');

      // Status and priority selects are present and match the fixture.
      const statusSelect = page.locator('main').locator('select').nth(0);
      await expect(statusSelect).toHaveValue('todo');
      const prioritySelect = page.locator('main').locator('select').nth(1);
      await expect(prioritySelect).toHaveValue('medium');

      // Sidebar metadata shows the entity's relative file path.
      await expect(page.locator('main').getByText(/File: /)).toContainText(
        /\.md$/,
      );
    } finally {
      await deleteEntity(request, created.id);
    }
  });

  test('editing the title and clicking Save persists the change', async ({
    page,
    request,
  }) => {
    const created = await createStory(request, 'Editor Title Before');
    try {
      await openEditor(page, created.id);

      const titleInput = page.locator('input[type="text"]').first();
      await titleInput.fill('Editor Title After');

      // Wait for the PUT to land before reloading.
      const putRequest = page.waitForResponse(
        (res) =>
          res.url().includes(`/api/entity/${created.id}`) &&
          res.request().method() === 'PUT' &&
          res.status() === 200,
      );
      await page.getByRole('button', { name: 'Save' }).click();
      await putRequest;

      // Success toast.
      await expect(page.getByText('Saved successfully')).toBeVisible();

      // Reload and verify the new title sticks.
      await page.reload();
      await expect(
        page.getByRole('heading', { name: 'Editor Title After', level: 2 }),
      ).toBeVisible();
    } finally {
      await deleteEntity(request, created.id);
    }
  });

  test('adding a label via Enter and removing it via the x button', async ({
    page,
    request,
  }) => {
    const created = await createStory(request, 'Editor Labels');
    try {
      await openEditor(page, created.id);

      // Add a new label via the "Add label..." input + Enter.
      const labelInput = page.getByPlaceholder('Add label...');
      await labelInput.fill('playwright-label');
      await labelInput.press('Enter');

      const labelChip = page
        .locator('main')
        .locator('span.inline-flex', { hasText: 'playwright-label' });
      await expect(labelChip).toBeVisible();

      // Save and confirm the label is persisted via reload.
      const putRequest = page.waitForResponse(
        (res) =>
          res.url().includes(`/api/entity/${created.id}`) &&
          res.request().method() === 'PUT' &&
          res.status() === 200,
      );
      await page.getByRole('button', { name: 'Save' }).click();
      await putRequest;

      await page.reload();
      await expect(labelChip).toBeVisible();

      // Remove the label by clicking its adjacent "x" button.
      await labelChip.getByRole('button', { name: 'x' }).click();
      await expect(labelChip).toHaveCount(0);
    } finally {
      await deleteEntity(request, created.id);
    }
  });

  test('toggling Preview renders the markdown body', async ({
    page,
    request,
  }) => {
    const created = await createStory(request, 'Editor Preview');
    try {
      await openEditor(page, created.id);

      // Replace the body with a known markdown snippet.
      const bodyTextarea = page.locator('textarea');
      await bodyTextarea.fill('# Heading one\n\n**Bold text** in a paragraph.');

      // Switch to preview mode.
      await page.getByRole('button', { name: 'Preview' }).click();

      const preview = page.locator('.markdown-preview');
      await expect(preview).toBeVisible();
      await expect(preview.locator('h1')).toHaveText('Heading one');
      await expect(preview.locator('strong')).toHaveText('Bold text');
    } finally {
      await deleteEntity(request, created.id);
    }
  });

  test('Split mode shows editor and preview side by side', async ({
    page,
    request,
  }) => {
    const created = await createStory(request, 'Editor Split View');
    try {
      await openEditor(page, created.id);

      const bodyTextarea = page.locator('textarea');
      await bodyTextarea.fill(
        '# Split Test\n\n| A | B |\n|---|---|\n| 1 | 2 |',
      );

      // Switch to split mode.
      await page.getByRole('button', { name: 'Split' }).click();

      // Both textarea and preview should be visible simultaneously.
      await expect(page.locator('textarea')).toBeVisible();
      const preview = page.locator('.markdown-preview');
      await expect(preview).toBeVisible();
      await expect(preview.locator('h1')).toHaveText('Split Test');
      await expect(preview.locator('table')).toBeVisible();
    } finally {
      await deleteEntity(request, created.id);
    }
  });

  test('Delete opens a confirm dialog that can be cancelled', async ({
    page,
    request,
  }) => {
    const created = await createStory(request, 'Editor Cancel Delete');
    try {
      await openEditor(page, created.id);

      // Click Delete → confirm dialog appears with the entity title.
      await page.getByRole('button', { name: 'Delete' }).click();
      const dialog = page
        .locator('.fixed.inset-0 >> text=Delete Entity')
        .first();
      await expect(dialog).toBeVisible();
      await expect(
        page.locator('.fixed.inset-0 p.text-sm.text-gray-600'),
      ).toContainText('Editor Cancel Delete');

      // Cancel dismisses the dialog; the entity still exists.
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);

      // Page still shows the same entity after cancel.
      await expect(
        page.getByRole('heading', { name: 'Editor Cancel Delete', level: 2 }),
      ).toBeVisible();

      // Confirm via API that the entity still exists.
      const getRes = await request.get(`/api/entity/${created.id}`);
      expect(getRes.status()).toBe(200);
    } finally {
      await deleteEntity(request, created.id);
    }
  });

  test('confirming Delete removes the entity and navigates to tree browser', async ({
    page,
    request,
  }) => {
    const created = await createStory(request, 'Editor Confirm Delete');
    let alreadyDeleted = false;
    try {
      await openEditor(page, created.id);

      await page.getByRole('button', { name: 'Delete' }).click();
      // The dialog's confirm button is labelled "Delete" (same as the header
      // button). Select it by scoping to the dialog root.
      const deleteRequest = page.waitForResponse(
        (res) =>
          res.url().includes(`/api/entity/${created.id}`) &&
          res.request().method() === 'DELETE' &&
          res.status() === 204,
      );
      await page
        .locator('.fixed.inset-0')
        .getByRole('button', { name: 'Delete', exact: true })
        .click();
      await deleteRequest;
      alreadyDeleted = true;

      // Navigation lands on the tree browser (index route).
      await expect(page).toHaveURL(/#\/$/);

      // Entity no longer fetchable.
      const getRes = await request.get(`/api/entity/${created.id}`);
      expect(getRes.status()).toBe(404);
    } finally {
      if (!alreadyDeleted) {
        await deleteEntity(request, created.id);
      }
    }
  });
});
