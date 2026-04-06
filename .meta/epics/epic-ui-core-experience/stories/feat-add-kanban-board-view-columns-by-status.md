---
type: story
id: NdHIAmE7OeDa
title: "feat: add kanban board view (columns by status)"
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
  issue_number: 38
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:7c97ddabe9a953acdfe547e261d37446b2f12e88de3b32d1a525033eb2864e80
  synced_at: 2026-04-06T13:34:04.908Z
created_at: 2026-04-05T09:48:52.000Z
updated_at: 2026-04-05T09:48:52.000Z
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
