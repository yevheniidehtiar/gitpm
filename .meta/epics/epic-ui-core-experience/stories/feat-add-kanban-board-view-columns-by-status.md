---
type: story
id: NdHIAmE7OeDa
title: "feat: add kanban board view (columns by status)"
status: done
priority: high
assignee: null
labels:
  - enhancement
  - ui
estimate: null
epic_ref:
  id: K-RoyLf07OKQ
github:
  issue_number: 38
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:d435fa691ee3fe67b5ea9c5952d32391cd54a4e62cdc3e33eea8d5c2b6135ef8
  synced_at: 2026-04-12T11:18:12.933Z
created_at: 2026-04-05T09:48:52.000Z
updated_at: 2026-04-12T10:52:40.343Z
---

## Problem
The Tree Browser is a flat table — useful for data but not for sprint planning or daily workflow. Every modern PM tool (Jira, Linear, GitHub Projects) has a board view.

## Proposed Solution
New route `/#/board` with columns:
- Backlog | Todo | In Progress | In Review | Done
- Cards show title, priority badge, assignee avatar
- Drag-and-drop between columns (updates status in .meta file)
- Filter by milestone/epic/assignee

## Libraries
- `@dnd-kit/core` for drag-and-drop
- Reuse existing `useTree()` and `useUpdateEntity()` hooks

## Impact
This is the #1 feature that would make the UI worth using daily instead of GitHub Issues.
