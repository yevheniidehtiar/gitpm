---
type: story
id: e6Mnoo3iNwiv
title: "feat: add assignee filter to Tree Browser"
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
  issue_number: 39
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:e7a24ca9d6b1753f0707e4daf0b02e5fdc68f73403cf684ec8ed5d8f9db4c026
  synced_at: 2026-04-06T13:34:04.325Z
created_at: 2026-04-05T09:48:52.000Z
updated_at: 2026-04-05T09:48:52.000Z
---

## Problem
Can filter by status and type but not by assignee. 'Show me my tasks' is the most common daily query.

## Proposed Solution
Add assignee dropdown filter next to existing status/type filters. Auto-populate from unique assignees in the tree. Support multi-select.

Also add an `--assignee` flag to the CLI validate/list commands.
