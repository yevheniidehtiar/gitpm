---
type: story
id: e6Mnoo3iNwiv
title: "feat: add assignee filter to Tree Browser"
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
  issue_number: 39
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:b9bf81aaa9228d0f33fb932f25d48685e0c4427cc6622f82753c6012ca6e7680
  synced_at: 2026-04-12T11:18:12.331Z
created_at: 2026-04-05T09:48:52.000Z
updated_at: 2026-04-12T10:52:42.502Z
---

## Problem
Can filter by status and type but not by assignee. 'Show me my tasks' is the most common daily query.

## Proposed Solution
Add assignee dropdown filter next to existing status/type filters. Auto-populate from unique assignees in the tree. Support multi-select.

Also add an `--assignee` flag to the CLI validate/list commands.
