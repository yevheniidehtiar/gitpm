---
type: story
id: Y3F85ULIFfUy
title: Upgrade UI to React 19
status: in_review
priority: medium
assignee: null
labels:
  - dependencies
  - ui
estimate: null
epic_ref:
  id: 3xy8aacTSvZu
github:
  issue_number: 263
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:5cf5da16faf4a65123199558891f58bd6c6783bd1a94fa02b040534fb2a63fa5
  synced_at: 2026-10-16T21:52:47.883Z
created_at: 2026-10-16T21:51:40.859Z
updated_at: 2026-10-17T07:44:06.757Z
---

## Why

`@gitpm/ui` runs React 18 (`react` / `react-dom` ^18.3.0) but already uses `@types/react` 19, so its types and runtime disagree. Dependabot proposed React 19.2 in #239.

## Scope

- Bump `react` and `react-dom` to 19.x in packages/ui.
- Check `@tanstack/react-router`, `@tanstack/react-query` and other React-dependent libs for React 19 compatible versions.
- Fix removed or changed APIs (string refs, `defaultProps` on function components, legacy context, `ReactDOM.render`). The app should already use `createRoot`.

## Acceptance criteria

- [ ] `bun run build` and `bun run test` pass
- [ ] UI E2E (Playwright) passes
- [ ] Manual smoke test of tree browser, kanban board, entity editor and graph view with `bun run dev:ui`
