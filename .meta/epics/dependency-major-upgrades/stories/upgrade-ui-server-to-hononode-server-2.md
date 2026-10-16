---
type: story
id: YSpP2PWYVvU9
title: Upgrade UI server to @hono/node-server 2
status: todo
priority: medium
assignee: null
labels:
  - dependencies
  - ui
  - security
estimate: null
epic_ref:
  id: 3xy8aacTSvZu
created_at: 2026-10-16T21:51:41.876Z
updated_at: 2026-10-16T21:51:41.876Z
github:
  issue_number: 262
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:b02957d626d1fec7c9b80e56776c801c99a2afe033e33a850cf4358f89641c18
  synced_at: 2026-10-16T21:52:47.331Z
---

## Why

The `gitpm ui` local server runs on `@hono/node-server` 1.x and `hono` 4. Version 1.x has had repeated `serveStatic` path-traversal advisories (patched within 1.19 by the lockfile refresh in #257). Dependabot proposed 2.0 in #239.

## Scope

- packages/ui/src/server/index.ts, packages/ui/src/server/start.ts and packages/ui/src/dev.ts use the adapter. Check the 2.0 migration notes (`serve` options, `serveStatic` import path and options) and adapt.
- Keep `hono` on the latest 4.x.

## Acceptance criteria

- [ ] `gitpm ui` starts, serves the SPA and the API, and handles a deep-link refresh
- [ ] `bun run build`, `bun run test` and UI E2E pass
- [ ] `bun audit --audit-level=moderate` shows no hono or @hono advisories
