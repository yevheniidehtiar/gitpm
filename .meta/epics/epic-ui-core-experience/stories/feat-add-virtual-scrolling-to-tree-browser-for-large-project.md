---
type: story
id: DZS1X4xTJkZj
title: "feat: add virtual scrolling to Tree Browser for large projects (1000+ entities)"
status: todo
priority: high
assignee: null
labels:
  - enhancement
  - ui
estimate: null
epic_ref:
  id: K-RoyLf07OKQ
github:
  issue_number: 37
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:28bf8c0be0bfd45c1992734d9eee9013caf179e069c6ce621d9b8b645308278f
  synced_at: 2026-04-05T17:24:12.493Z
created_at: 2026-04-05T09:48:51Z
updated_at: 2026-04-05T09:48:51Z
---

## Problem
Tree Browser loads all entities at once. With hyper-admin (362 entities) it works but is slow. At 1000+ entities it will freeze the browser.

## Proposed Solution
Options (pick one):
1. **Virtual scrolling** — `@tanstack/react-virtual` to render only visible rows
2. **Server-side pagination** — add `?page=1&limit=50` to `/api/tree`
3. **Lazy loading** — load milestones/epics first, expand stories on click

Virtual scrolling is probably best since search/filter need the full dataset client-side.

## Acceptance Criteria
- Tree Browser renders smoothly with 2000+ entities
- No perceptible scroll lag
- Search and filter still work across all entities
