---
type: story
id: eb-9Va_neAdh
title: "feat: add markdown preview/split view in entity editor"
status: todo
priority: medium
assignee: null
labels:
  - enhancement
  - ui
estimate: null
epic_ref: null
github:
  issue_number: 40
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:463e7af6d6538a7fb5870f9b926cb95c85f9f41a0c94449679e416a65fff2139
  synced_at: 2026-04-05T17:24:12.493Z
created_at: 2026-04-05T09:48:53Z
updated_at: 2026-04-05T09:48:53Z
---

## Problem
Entity editor body field is a plain textarea. Real issues have rich markdown with code blocks, checklists, tables, images. Users can't see what the rendered issue looks like.

## Proposed Solution
Split view: left = textarea, right = rendered markdown preview. Use `react-markdown` with `remark-gfm` for GitHub-flavored markdown (tables, checklists, strikethrough).

Toggle between: Edit | Preview | Split
