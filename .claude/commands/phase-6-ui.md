# Phase 6: @gitpm/ui — Local Web Interface

Read `CLAUDE.md` for project context and `docs/IMPLEMENTATION_PLAN.md` Phase 6 for detailed tasks.

Depends on: Phase 1 (@gitpm/core), Phase 3 & 4 (@gitpm/sync-github) for sync dashboard.

## Execute in order

### Step 1: API Server

Create `packages/ui/src/server/` using Hono framework:

`packages/ui/src/server/index.ts`:
- Create a Hono app with the following routes.
- Accept `--meta-dir` from the CLI/env to know where to read the tree.
- All routes use `@gitpm/core` and `@gitpm/sync-github` under the hood.

Routes:
- `GET /api/tree` — call `parseTree()` → `resolveRefs()`, return the full `ResolvedTree` as JSON. Include entity counts in the response.
- `GET /api/entity/:id` — find a single entity by ID from the parsed tree. Return 404 if not found.
- `PUT /api/entity/:id` — accept a partial entity update (JSON body with changed fields). Load the existing entity, merge changes, call `writeFile()` to persist. Return the updated entity.
- `POST /api/entity` — accept a new entity (JSON body with type, title, and optional fields). Generate an ID, determine file path using slug, call `writeFile()`. Return the created entity with its ID and path.
- `DELETE /api/entity/:id` — delete the entity's file from disk. Return 204.
- `GET /api/validate` — call full validation pipeline, return `ValidationResult`.
- `GET /api/sync/status` — load sync state, parse tree, compute diffs for all synced entities. Return a summary: `{ lastSync, entities: [{ id, title, syncStatus }] }`.
- `POST /api/sync/push` — call `exportToGitHub()`. Return result.
- `POST /api/sync/pull` — call sync with direction pull. Return result.
- `POST /api/sync/sync` — call `syncWithGitHub()` with `strategy: "local-wins"` (non-interactive for UI — UI handles conflict resolution separately). Return result with any conflicts.
- `POST /api/sync/resolve` — accept conflict resolutions and apply them.

Add CORS middleware for local dev (Vite dev server runs on different port).

Create `packages/ui/src/server/start.ts` — start the Hono server on port 4747 (configurable via `PORT` env var). Accept `--meta-dir` argument.

### Step 2: Vite + React Setup

Configure `packages/ui/vite.config.ts`:
- React plugin, Tailwind CSS.
- Dev server proxy: `/api` → `http://localhost:4747`.
- Alias `@/` to `src/`.

Create `packages/ui/index.html` — minimal HTML shell with `<div id="root">`.

Create `packages/ui/src/main.tsx` — React root with TanStack Router and Query providers.

Create `packages/ui/tailwind.config.ts` — content paths, custom colors for status badges:
```
status-backlog: '#9CA3AF',   // gray-400
status-todo: '#60A5FA',      // blue-400
status-in_progress: '#FBBF24', // amber-400
status-in_review: '#A78BFA',  // violet-400
status-done: '#34D399',      // emerald-400
status-cancelled: '#F87171', // red-400
```

### Step 3: Layout Shell

Create `packages/ui/src/App.tsx`:

Layout structure:
- **Left sidebar** (w-64, fixed): project name at top, tree navigator below, "Validate" button and "Sync" button at bottom.
- **Top bar** (h-12): breadcrumb showing current location, sync status indicator (colored dot + "Last synced X ago" text), "Sync Now" button.
- **Main content** (flex-1): renders the active route/view.

Use TanStack Router with routes: `/` (tree browser), `/entity/:id` (entity editor), `/roadmap` (timeline), `/sync` (sync dashboard).

### Step 4: Data Layer

Create `packages/ui/src/lib/api.ts`:
- Typed fetch wrapper for all API endpoints. Use `@tanstack/react-query` for caching and refetching.
- `useTree()` — query hook for `GET /api/tree`. Refetch on window focus.
- `useEntity(id)` — query hook for single entity.
- `useUpdateEntity()` — mutation hook for `PUT /api/entity/:id`. Invalidates tree query on success.
- `useCreateEntity()` — mutation hook for `POST /api/entity`.
- `useDeleteEntity()` — mutation hook for `DELETE /api/entity/:id`.
- `useValidation()` — query hook for validation results.
- `useSyncStatus()` — query hook for sync status.
- `useSyncPush()`, `useSyncPull()`, `useSync()` — mutation hooks for sync actions.

### Step 5: Tree Browser View (route: `/`)

Create `packages/ui/src/routes/tree-browser.tsx`:

A table/list view of all entities with hierarchy awareness.

Components needed:
- `EntityRow` — single row showing: indent (based on hierarchy depth), type icon (📋 story, 🎯 epic, 🏁 milestone, 📄 PRD), title (clickable, navigates to editor), status badge (colored pill), priority badge, assignee text, GitHub link icon (opens issue in new tab if synced).
- `TreeBrowser` — renders all entities grouped by hierarchy. Epics show their stories indented below. Milestones group their epics. Orphan stories in a separate section.
- `FilterBar` — top bar with: text search input, status filter dropdown (multi-select), type filter dropdown, assignee filter.
- Sorting: click column headers to sort.

### Step 6: Entity Editor View (route: `/entity/:id`)

Create `packages/ui/src/routes/entity-editor.tsx`:

Two-panel layout:
- **Left panel** (w-1/3): structured form for frontmatter fields.
  - Title: text input.
  - Status: dropdown with colored options.
  - Priority: dropdown.
  - Assignee: text input.
  - Labels: tag input (type and press enter to add, click X to remove).
  - Epic ref (for stories): searchable dropdown of available epics.
  - Milestone ref (for epics): searchable dropdown of available milestones.
  - GitHub link: read-only display with "Open in GitHub" button (if synced).
  - Created/updated timestamps: read-only.
- **Right panel** (w-2/3): markdown editor for the body. Use a `<textarea>` with monospace font. Below it, a live markdown preview (rendered HTML). Toggle between edit and preview mode.

"Save" button at top right. On save, call `useUpdateEntity()`. Show a toast notification on success. "Delete" button with confirmation dialog.

"New Story" / "New Epic" button in the sidebar that opens a creation form (simplified version of the editor with just title, type, and parent selection). On create, navigate to the new entity's editor.

### Step 7: Roadmap Timeline View (route: `/roadmap`)

Create `packages/ui/src/routes/roadmap.tsx`:

Horizontal timeline visualization:
- X-axis: months (auto-range from earliest milestone target_date to latest + 1 month).
- Each milestone renders as a diamond marker on its target_date with title label.
- Epics under each milestone render as horizontal bars (width = arbitrary, just for visual grouping). Color by status.
- Hover on any element shows a tooltip with full details.

Implement using SVG within React. No external charting library needed. Keep it simple — this is read-only in MVP.

If no milestones exist, show an empty state: "No milestones defined. Create milestones in the tree browser to see the roadmap."

### Step 8: Sync Dashboard View (route: `/sync`)

Create `packages/ui/src/routes/sync-dashboard.tsx`:

Table showing all synced entities:
- Columns: title, type, local status, GitHub status, sync state (badge: "In Sync" green, "Local Ahead" blue, "Remote Ahead" orange, "Conflict" red), last synced time.
- Row background tinted by sync state.
- For conflict rows: expandable detail panel showing each conflicted field with both values and "Keep Local" / "Keep Remote" buttons.

Action bar at top:
- "Pull Remote Changes" button → calls `useSyncPull()`.
- "Push Local Changes" button → calls `useSyncPush()`.
- "Full Sync" button → calls `useSync()`.
- Spinner overlay during sync operations.
- After sync, show a result toast: "Pulled X, Pushed Y, Z conflicts".

If no sync is configured (no `github-config.yaml`), show a setup prompt: "No GitHub sync configured. Run `gitpm import` or `gitpm push` to set up sync."

### Step 9: Dev Server Script

Create `packages/ui/src/dev.ts`:
- Starts the API server (Step 1).
- Starts the Vite dev server.
- Both in the same process (or use `concurrently`).
- Accept `--meta-dir` argument, pass to API server.

Add script to `packages/ui/package.json`: `"dev": "tsx src/dev.ts"`.
Add script to root `package.json`: `"dev:ui": "bun run --filter @gitpm/ui dev"`.

Usage: `bun run dev:ui -- --meta-dir /path/to/project/.meta`

### Step 10: Shared Components

Create reusable components in `packages/ui/src/components/`:
- `StatusBadge.tsx` — colored pill showing status text.
- `PriorityBadge.tsx` — priority indicator.
- `TypeIcon.tsx` — icon for entity type.
- `Toast.tsx` — notification toast (use a simple state-based implementation, no library needed).
- `ConfirmDialog.tsx` — modal confirmation dialog.
- `Spinner.tsx` — loading spinner.
- `EmptyState.tsx` — reusable empty state with icon, message, and action.

## Verify

- `bun run dev:ui -- --meta-dir ./test-project/.meta` starts both API server and UI.
- Tree browser loads and displays all entities from the `.meta/` directory.
- Clicking an entity opens the editor with correct data.
- Editing and saving an entity persists the change to the file on disk.
- Creating a new entity creates the file in the correct location.
- Roadmap view renders milestones on a timeline.
- Sync dashboard shows accurate sync status.
- Sync actions (push/pull/sync) trigger correctly and update the UI.
- No console errors in Chrome DevTools.
