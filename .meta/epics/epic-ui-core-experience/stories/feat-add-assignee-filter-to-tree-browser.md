---
type: story
id: e6Mnoo3iNwiv
title: "feat: add assignee filter to Tree Browser"
status: in_progress
priority: high
assignee: null
labels:
  - enhancement
  - ui
estimate: null
epic_ref:
  id: K-RoyLf07OKQ
github:
  issue_number: 39
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:d66058f930eb9bed6092154d8eb20b622faf3d76ffe4958e383db44eeee77059
  synced_at: 2026-04-26T20:12:36.337Z
created_at: 2026-04-05T09:48:52.000Z
updated_at: 2026-04-05T09:48:52.000Z
---

## Problem
Can filter by status and type but not by assignee. 'Show me my tasks' is the most common daily query.

## Proposed Solution
Add assignee dropdown filter next to existing status/type filters. Auto-populate from unique assignees in the tree. Support multi-select.

Also add an `--assignee` flag to the CLI validate/list commands.
