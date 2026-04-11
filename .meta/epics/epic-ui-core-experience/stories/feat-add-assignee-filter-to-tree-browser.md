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
  last_sync_hash: sha256:aa8cf89f0ba8f04ef22ec598d0f41fbbbda67844ff5d4f3cb2a184c0fc0ad313
  synced_at: 2026-04-05T17:24:12.493Z
created_at: 2026-04-05T09:48:52Z
updated_at: 2026-04-05T09:48:52Z
---

## Problem
Can filter by status and type but not by assignee. 'Show me my tasks' is the most common daily query.

## Proposed Solution
Add assignee dropdown filter next to existing status/type filters. Auto-populate from unique assignees in the tree. Support multi-select.

Also add an `--assignee` flag to the CLI validate/list commands.
