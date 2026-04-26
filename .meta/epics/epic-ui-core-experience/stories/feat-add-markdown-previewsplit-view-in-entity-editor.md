---
type: story
id: eb-9Va_neAdh
title: "feat: add markdown preview/split view in entity editor"
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
  issue_number: 40
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:16f5cd41e90e8749ddd20a436c2d851a75fc05f82a7a826a3c9411815c956a6b
  synced_at: 2026-04-26T20:12:37.603Z
created_at: 2026-04-05T09:48:53.000Z
updated_at: 2026-04-05T09:48:53.000Z
---

## Problem
Entity editor body field is a plain textarea. Real issues have rich markdown with code blocks, checklists, tables, images. Users can't see what the rendered issue looks like.

## Proposed Solution
Split view: left = textarea, right = rendered markdown preview. Use `react-markdown` with `remark-gfm` for GitHub-flavored markdown (tables, checklists, strikethrough).

Toggle between: Edit | Preview | Split
