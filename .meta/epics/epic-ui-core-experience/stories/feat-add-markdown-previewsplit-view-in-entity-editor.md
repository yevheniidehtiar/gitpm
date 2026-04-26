---
type: story
id: eb-9Va_neAdh
title: "feat: add markdown preview/split view in entity editor"
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
  issue_number: 40
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:f9a28266beaeac138b049ebf480496b33a7d83c97b16b35f022688f7256d08bc
  synced_at: 2026-04-26T09:40:17.465Z
created_at: 2026-04-05T09:48:53.000Z
updated_at: 2026-04-12T12:58:26.397Z
---

## Problem
Entity editor body field is a plain textarea. Real issues have rich markdown with code blocks, checklists, tables, images. Users can't see what the rendered issue looks like.

## Proposed Solution
Split view: left = textarea, right = rendered markdown preview. Use `react-markdown` with `remark-gfm` for GitHub-flavored markdown (tables, checklists, strikethrough).

Toggle between: Edit | Preview | Split
