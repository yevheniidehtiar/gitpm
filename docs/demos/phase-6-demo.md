# GitPM — Phase 6 Demo: @gitpm/ui — Local Web Interface

> **Status**: Complete | **Tests**: 129 passed | **Build**: Passing | **New Files**: 18 source files | **Lines**: ~2,000

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [API Server](#api-server)
- [React Frontend Setup](#react-frontend-setup)
- [Layout Shell](#layout-shell)
- [Tree Browser View](#tree-browser-view)
- [Entity Editor View](#entity-editor-view)
- [Roadmap Timeline View](#roadmap-timeline-view)
- [Sync Dashboard View](#sync-dashboard-view)
- [Shared Components](#shared-components)
- [Dev Server](#dev-server)
- [Build Output](#build-output)
- [Full Test Results](#full-test-results)
- [How to Use](#how-to-use)
- [Summary](#summary)

---

## Overview

Phase 6 completes the GitPM implementation plan by adding a local web interface for browsing, editing, and managing `.meta/` project management entities. The UI runs entirely locally — a Hono API server reads/writes the `.meta/` tree on disk, and a React frontend provides an interactive experience.

```
┌──────────────────────────────────────────────────────────┐
│  Browser (http://localhost:5173)                         │
│  ┌─────────┐  ┌────────────────────────────────────────┐ │
│  │ Sidebar  │  │  Main Content Area                    │ │
│  │          │  │  ┌──────────────────────────────────┐ │ │
│  │ 🌳 Tree  │  │  │  Tree Browser / Entity Editor   │ │ │
│  │ 🗺️ Road  │  │  │  / Roadmap / Sync Dashboard     │ │ │
│  │ 🔄 Sync  │  │  └──────────────────────────────────┘ │ │
│  │          │  │                                        │ │
│  │ Entities │  │  [ Top Bar: breadcrumbs + sync status] │ │
│  │ 🏁 MS-1  │  │                                        │ │
│  │ 🎯 EP-1  │  │                                        │ │
│  │ 📋 ST-1  │  │                                        │ │
│  └─────────┘  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
        │                       │
        │   Vite dev proxy      │
        ▼      /api → :4747     ▼
┌──────────────────────────────────────────────────────────┐
│  Hono API Server (http://localhost:4747)                  │
│                                                          │
│  GET  /api/tree          → parseTree + resolveRefs       │
│  GET  /api/entity/:id    → find entity by ID             │
│  PUT  /api/entity/:id    → merge + writeFile             │
│  POST /api/entity        → create + writeFile            │
│  DEL  /api/entity/:id    → unlink file                   │
│  GET  /api/validate      → validateTree                  │
│  GET  /api/sync/status   → loadConfig + loadState        │
│  POST /api/sync/push     → exportToGitHub                │
│  POST /api/sync/pull     → syncWithGitHub (remote-wins)  │
│  POST /api/sync/sync     → syncWithGitHub (local-wins)   │
│  POST /api/sync/resolve  → apply conflict resolutions    │
└──────────────────────────────────────────────────────────┘
        │                       │
        ▼                       ▼
┌──────────────┐    ┌──────────────────────┐
│ @gitpm/core  │    │ @gitpm/sync-github   │
│ parseTree    │    │ exportToGitHub       │
│ writeFile    │    │ syncWithGitHub       │
│ validateTree │    │ loadConfig/loadState │
└──────────────┘    └──────────────────────┘
        │
        ▼
   .meta/ directory (on disk)
```

---

## Architecture

### File Structure

```
packages/ui/
├── package.json              # @gitpm/ui with Hono, React, TanStack
├── tsconfig.json             # JSX + noEmit (Vite handles bundling)
├── vite.config.ts            # React + Tailwind plugins, /api proxy
├── index.html                # HTML shell with #root
└── src/
    ├── main.tsx              # React root with App + styles
    ├── App.tsx               # Layout shell + TanStack Router setup
    ├── styles.css            # Tailwind imports + status colors + markdown
    ├── dev.ts                # Dev server: API + Vite in one process
    ├── server/
    │   ├── index.ts          # Hono app with all REST routes
    │   └── start.ts          # Standalone API server entry point
    ├── lib/
    │   └── api.ts            # Typed fetch wrapper + React Query hooks
    ├── routes/
    │   ├── tree-browser.tsx  # Entity table with hierarchy & filters
    │   ├── entity-editor.tsx # Two-panel form + markdown editor
    │   ├── roadmap.tsx       # SVG timeline visualization
    │   └── sync-dashboard.tsx# Sync status table + push/pull actions
    └── components/
        ├── StatusBadge.tsx   # Colored pill for entity status
        ├── PriorityBadge.tsx # Priority indicator
        ├── TypeIcon.tsx      # Emoji icon per entity type
        ├── Toast.tsx         # Notification toasts with provider
        ├── ConfirmDialog.tsx # Modal confirmation dialog
        ├── Spinner.tsx       # Loading spinner (SVG animation)
        └── EmptyState.tsx    # Reusable empty state placeholder
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| API Server | **Hono** (lightweight web framework) |
| Frontend | **React 18** with JSX |
| Routing | **TanStack Router** (hash-based) |
| Data Fetching | **TanStack React Query** |
| Styling | **Tailwind CSS v4** |
| Build | **Vite 6** with React & Tailwind plugins |
| Dev Runner | **tsx** (TypeScript execution for dev.ts) |

---

## API Server

The Hono API server wraps `@gitpm/core` and `@gitpm/sync-github` into REST endpoints. It reads a `--meta-dir` path and serves the entity tree as JSON.

### Key Implementation

```typescript
// packages/ui/src/server/index.ts
import { parseTree, resolveRefs, validateTree, writeFile, toSlug } from '@gitpm/core';
import { exportToGitHub, loadConfig, loadState, syncWithGitHub } from '@gitpm/sync-github';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export function createApp(metaDir: string) {
  const app = new Hono();
  app.use('/api/*', cors());

  async function getResolvedTree(): Promise<ResolvedTree> {
    const parseResult = await parseTree(metaDir);
    if (!parseResult.ok) throw new Error(parseResult.error.message);
    const resolveResult = resolveRefs(parseResult.value);
    if (!resolveResult.ok) throw new Error(resolveResult.error.message);
    return resolveResult.value;
  }

  // GET /api/tree — full resolved tree with entity counts
  app.get('/api/tree', async (c) => {
    const tree = await getResolvedTree();
    return c.json({
      ...tree,
      counts: {
        stories: tree.stories.length,
        epics: tree.epics.length,
        milestones: tree.milestones.length,
        roadmaps: tree.roadmaps.length,
        prds: tree.prds.length,
        errors: tree.errors.length,
      },
    });
  });

  // PUT /api/entity/:id — merge updates and write back to disk
  app.put('/api/entity/:id', async (c) => {
    const tree = await getResolvedTree();
    const entity = findEntity(tree, c.req.param('id'));
    if (!entity) return c.json({ error: 'Not found' }, 404);
    const updates = await c.req.json();
    const merged = { ...entity, ...updates, id: entity.id, type: entity.type };
    merged.updated_at = new Date().toISOString();
    await writeFile(merged as ParsedEntity, entity.filePath);
    return c.json(merged);
  });

  // ...11 routes total
  return app;
}
```

### API Routes Summary

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/tree` | Full parsed & resolved tree with counts |
| `GET` | `/api/entity/:id` | Single entity by ID |
| `PUT` | `/api/entity/:id` | Update entity fields, write to disk |
| `POST` | `/api/entity` | Create new entity (auto-generate ID & path) |
| `DELETE` | `/api/entity/:id` | Delete entity file from disk |
| `GET` | `/api/validate` | Run full validation pipeline |
| `GET` | `/api/sync/status` | Sync state for all entities |
| `POST` | `/api/sync/push` | Export local changes to GitHub |
| `POST` | `/api/sync/pull` | Pull remote changes (remote-wins) |
| `POST` | `/api/sync/sync` | Bidirectional sync (local-wins) |
| `POST` | `/api/sync/resolve` | Apply conflict resolutions |

---

## React Frontend Setup

### Vite Configuration

```typescript
// packages/ui/vite.config.ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@/': new URL('./src/', import.meta.url).pathname },
  },
  server: {
    proxy: { '/api': 'http://localhost:4747' },  // Proxy API calls to Hono
  },
});
```

### Data Layer (React Query Hooks)

```typescript
// packages/ui/src/lib/api.ts
export function useTree() {
  return useQuery<TreeResponse>({
    queryKey: ['tree'],
    queryFn: () => fetchJson('/tree'),
    refetchOnWindowFocus: true,  // Always fresh data when user returns
  });
}

export function useUpdateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) =>
      fetchJson(`/entity/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['tree'] });      // Refresh tree
      qc.invalidateQueries({ queryKey: ['entity', vars.id] }); // Refresh entity
    },
  });
}

// Also: useEntity, useCreateEntity, useDeleteEntity,
//       useValidation, useSyncStatus, useSyncPush, useSyncPull, useSync
```

### Tailwind CSS Custom Theme

```css
/* packages/ui/src/styles.css */
@import "tailwindcss";

@theme {
  --color-status-backlog: #9ca3af;     /* gray-400 */
  --color-status-todo: #60a5fa;        /* blue-400 */
  --color-status-in_progress: #fbbf24; /* amber-400 */
  --color-status-in_review: #a78bfa;   /* violet-400 */
  --color-status-done: #34d399;        /* emerald-400 */
  --color-status-cancelled: #f87171;   /* red-400 */
}
```

---

## Layout Shell

The app shell provides a fixed left sidebar, top bar with breadcrumbs, and a main content area rendered by the router.

### Route Structure

```typescript
// packages/ui/src/App.tsx
const rootRoute = createRootRoute({ component: Layout });

const indexRoute = createRoute({        // /
  path: '/', component: TreeBrowser
});
const entityRoute = createRoute({       // /entity/$id
  path: '/entity/$id', component: EntityEditor
});
const roadmapRoute = createRoute({      // /roadmap
  path: '/roadmap', component: RoadmapView
});
const syncRoute = createRoute({         // /sync
  path: '/sync', component: SyncDashboard
});
```

### Sidebar

The sidebar displays:
- **Project name** (GitPM) with entity count summary (e.g., "3s / 2e / 1m")
- **Navigation links**: Tree Browser, Roadmap, Sync Dashboard
- **Entity tree**: All milestones, epics, stories, and PRDs as clickable links
- **Validate button**: Triggers validation and shows pass/fail indicator

### Top Bar

Shows breadcrumbs for current route, sync status indicator (green dot + "Synced Xm ago"), and a "Sync Now" link.

---

## Tree Browser View

**Route**: `/` (index)

The tree browser is the main view, displaying all entities in a hierarchical table.

### Features

- **Hierarchy mode**: When no filters are active, entities display in tree order:
  Milestones → Epics → Stories, with indentation showing parent-child relationships
- **Search**: Text input filters entities by title
- **Status filter**: Multi-select dropdown for status values
- **Type filter**: Multi-select dropdown for entity types
- **Sortable columns**: Click Type, Title, Status, or Priority headers to sort
- **Inline create**: "+ New Entity" button reveals a form with type selector, title input, and Create button
- **GitHub links**: Synced entities show an external link icon opening the GitHub issue

```
┌─────────────────────────────────────────────────────────────┐
│ [Search...] [Status ▼] [Type ▼]              [+ New Entity] │
├──────┬──────────────────┬───────────┬──────────┬────────────┤
│ Type │ Title            │ Status    │ Priority │ Assignee   │
├──────┼──────────────────┼───────────┼──────────┼────────────┤
│ 🏁   │ v1.0 Launch      │ ● Todo    │          │            │
│  🎯  │   Auth System    │ ● In Prog │ High     │            │
│   📋 │     Login Page   │ ● Done    │ Medium   │ alice      │
│   📋 │     OAuth        │ ● Todo    │ High     │ bob        │
│  🎯  │   Dashboard      │ ● Backlog │ Medium   │            │
│ 📋   │ Orphan Story     │ ● Backlog │ Low      │            │
└──────┴──────────────────┴───────────┴──────────┴────────────┘
```

---

## Entity Editor View

**Route**: `/entity/$id`

A two-panel editor for viewing and modifying any entity.

### Left Panel (1/3 width) — Structured Form

- **Title**: text input
- **Status**: dropdown with all 6 status values
- **Priority**: dropdown (low / medium / high / critical)
- **Assignee** (stories): text input
- **Owner** (epics/PRDs): text input
- **Labels**: tag input — type and press Enter to add, click × to remove
- **Epic ref** (stories): searchable dropdown of available epics
- **Milestone ref** (epics): searchable dropdown of available milestones
- **Target date** (milestones): date picker
- **GitHub link**: read-only "Open in GitHub (#123)" link
- **Metadata**: created/updated timestamps, file path

### Right Panel (2/3 width) — Markdown Editor

- **Edit mode**: monospace textarea for raw markdown
- **Preview mode**: rendered HTML preview with styled headings, lists, code blocks
- Toggle between modes with Edit / Preview buttons

### Actions

- **Save**: persists changes via `PUT /api/entity/:id`, shows success toast
- **Delete**: confirmation dialog, then removes file from disk and navigates back

---

## Roadmap Timeline View

**Route**: `/roadmap`

An SVG-based horizontal timeline showing milestones and their associated epics.

### Features

- **Time axis**: auto-ranged from earliest to latest milestone `target_date`, with 1-month padding
- **Month grid**: vertical grid lines with month/year labels
- **Milestones**: diamond markers positioned at their target date
- **Epics**: horizontal bars below their parent milestone, color-coded by status
- **Status legend**: color key for all 6 status values
- **Empty state**: helpful message when no milestones have target dates

```
     Jan '26    Feb '26    Mar '26    Apr '26
        │          │          │          │
        │          │    ◆ v1.0 Launch    │
        │          │    ├─ Auth System ──┤
        │          │    ├─ Dashboard ────┤
        │          │          │          │
        │    ◆ v0.5 Beta      │          │
        │    ├─ API Layer ────┤          │
        │          │          │          │
```

---

## Sync Dashboard View

**Route**: `/sync`

Dashboard for managing GitHub synchronization.

### Features

- **Repository info**: shows configured repo and last sync timestamp
- **GitHub token input**: password field for authentication
- **Action buttons**: Pull (orange), Push (blue), Full Sync (green) — with spinner during operations
- **Entity table**: all synced entities with columns for type, title, status, sync state, and last synced time
- **Sync state badges**: "In Sync" (green), "Local Ahead" (blue), "Remote Ahead" (orange), "Not Synced" (gray)
- **Row highlighting**: background color tinted by sync state
- **Not configured state**: friendly message directing users to run `gitpm import` or `gitpm push`

---

## Shared Components

| Component | Purpose |
|-----------|---------|
| `StatusBadge` | Colored pill rendering status text with theme colors |
| `PriorityBadge` | Priority indicator (critical=red, high=orange, medium=yellow, low=gray) |
| `TypeIcon` | Emoji icon per entity type (📋 story, 🎯 epic, 🏁 milestone, 📄 PRD) |
| `Toast` | Context-based notification system with auto-dismiss (3s) |
| `ConfirmDialog` | Modal with title, message, Cancel + Confirm buttons |
| `Spinner` | Animated SVG loading indicator |
| `EmptyState` | Centered empty state with icon, message, and optional action |

### Toast System

```typescript
// Usage in any component:
const { toast } = useToast();

// Success notification
toast('Saved successfully', 'success');  // Green toast, auto-dismisses in 3s

// Error notification
toast('Failed to save', 'error');        // Red toast
```

---

## Dev Server

A single `dev.ts` script starts both the API server and Vite dev server in one process:

```typescript
// packages/ui/src/dev.ts
import { serve } from '@hono/node-server';
import { createApp } from './server/index.js';
import { spawn } from 'node:child_process';

const metaDir = resolve(metaDirArg);     // from --meta-dir or .meta
const app = createApp(metaDir);
serve({ fetch: app.fetch, port: 4747 }); // API server

const vite = spawn('npx', ['vite', '--host'], {  // Vite dev server
  cwd: uiDir, stdio: 'inherit',
});
```

**Usage**:
```bash
bun run dev:ui -- --meta-dir /path/to/project/.meta
```

---

## Build Output

```
$ bun run build

@gitpm/core build: ESM dist/index.js 20.20 KB
@gitpm/core build: ESM ⚡️ Build success in 43ms
@gitpm/core build: DTS dist/index.d.ts 25.40 KB

@gitpm/sync-github build: ESM dist/index.js 44.82 KB
@gitpm/sync-github build: ESM ⚡️ Build success in 24ms
@gitpm/sync-github build: DTS dist/index.d.ts 9.52 KB

gitpm build: ESM dist/index.js 18.42 KB
gitpm build: ESM ⚡️ Build success in 167ms

@gitpm/ui build: vite v6.4.1 building for production...
@gitpm/ui build: ✓ 175 modules transformed.
@gitpm/ui build: dist/index.html                   0.39 kB │ gzip:  0.26 kB
@gitpm/ui build: dist/assets/index-ARtsug1H.css   19.31 kB │ gzip:  4.63 kB
@gitpm/ui build: dist/assets/index-DF8XvQcf.js   306.28 kB │ gzip: 95.41 kB
@gitpm/ui build: ✓ built in 1.30s
```

**UI bundle**: 306 KB JS (95 KB gzipped) + 19 KB CSS (5 KB gzipped)

---

## Full Test Results

```
$ bun run test

 ✓ packages/sync-github/src/__tests__/diff.test.ts (14 tests) 8ms
 ✓ packages/sync-github/src/__tests__/state.test.ts (14 tests) 14ms
 ✓ packages/sync-github/src/__tests__/mapper.test.ts (20 tests) 10ms
 ✓ packages/core/src/schemas/__tests__/schemas.test.ts (20 tests) 22ms
 ✓ packages/sync-github/src/__tests__/import.test.ts (8 tests) 141ms
 ✓ packages/sync-github/src/__tests__/sync.test.ts (7 tests) 153ms
 ✓ packages/core/src/validator/validator.test.ts (6 tests) 31ms
 ✓ packages/core/src/resolver/resolver.test.ts (11 tests) 50ms
 ✓ packages/sync-github/src/__tests__/export.test.ts (4 tests) 98ms
 ✓ packages/sync-github/src/__tests__/conflict.test.ts (7 tests) 4ms
 ✓ packages/core/src/parser/parser.test.ts (10 tests) 33ms
 ✓ packages/core/src/writer/writer.test.ts (7 tests) 51ms
 ✓ packages/core/src/index.test.ts (1 test) 2ms

 Test Files  13 passed (13)
      Tests  129 passed (129)
   Duration  1.92s
```

> **Note**: Per the implementation plan, UI tests are not included in the MVP — manual QA is sufficient at this stage. The 129 tests cover `@gitpm/core` (55) and `@gitpm/sync-github` (74), ensuring the APIs the UI depends on are solid.

---

## How to Use

### Start the Dev Server

```bash
# From the repo root
bun run dev:ui -- --meta-dir /path/to/your/project/.meta

# Or from the UI package directly
cd packages/ui
npx tsx src/dev.ts --meta-dir ../../test-project/.meta
```

This starts:
- **API server** on `http://localhost:4747`
- **Vite dev server** on `http://localhost:5173` (with hot reload)

### Navigate the UI

| Route | What You See |
|-------|-------------|
| `/#/` | Tree browser — all entities in a hierarchical table |
| `/#/entity/{id}` | Entity editor — form fields + markdown editor |
| `/#/roadmap` | Roadmap timeline — milestones on a time axis |
| `/#/sync` | Sync dashboard — push/pull/sync with GitHub |

### Workflows

**Browse & Edit Entities**:
1. Open `http://localhost:5173` — see all entities in the tree browser
2. Click any entity title to open the editor
3. Modify fields, edit the markdown body
4. Click Save — changes are written directly to the `.meta/` file on disk

**Create New Entities**:
1. Click "+ New Entity" in the tree browser
2. Select type (Story, Epic, Milestone, PRD), enter title
3. Click Create — file is created in the correct `.meta/` subdirectory

**Validate**:
1. Click "Validate" in the sidebar
2. See pass/fail status with error details

**Sync with GitHub**:
1. Navigate to `/#/sync`
2. Enter your GitHub personal access token
3. Click Push, Pull, or Full Sync

---

## Summary

Phase 6 completes the GitPM implementation plan with a fully functional local web interface:

| Component | Count | Description |
|-----------|-------|-------------|
| API routes | 11 | Full CRUD + validation + sync operations |
| React views | 4 | Tree browser, entity editor, roadmap, sync dashboard |
| React Query hooks | 10 | Typed data fetching with auto-invalidation |
| Shared components | 7 | StatusBadge, PriorityBadge, TypeIcon, Toast, etc. |
| Source files | 18 | ~2,000 lines of TypeScript/TSX/CSS |
| Production bundle | 306 KB | 95 KB gzipped |

All 7 phases of the GitPM implementation plan are now complete:

| Phase | Package | Status |
|-------|---------|--------|
| 0 | Monorepo scaffold | Complete |
| 1 | `@gitpm/core` — Schema engine | Complete |
| 2 | `@gitpm/cli` — Init & validate | Complete |
| 3 | `@gitpm/sync-github` — Import | Complete |
| 4 | `@gitpm/sync-github` — Export & sync | Complete |
| 5 | `@gitpm/cli` — Sync commands | Complete |
| 6 | `@gitpm/ui` — Web interface | **Complete** |
