---
type: epic
id: 3xy8aacTSvZu
title: Dependency major upgrades
status: done
priority: medium
owner: null
labels:
  - dependencies
  - maintenance
milestone_ref: null
github:
  issue_number: 259
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:5a0ec783e8c972c97c05fd4c10730699525c1371e69ca749065346ba265dd3ee
  synced_at: 2026-10-20T06:51:02.848Z
created_at: 2026-10-16T21:51:21.847Z
updated_at: 2026-10-20T06:50:46.030Z
---

## Goal

Land the breaking (major) dependency upgrades one at a time, each as its own tested PR.

## Context

Dependabot bundled these with safe bumps in #239, so nothing in that group could merge. Since #256, Dependabot groups only minor/patch updates and opens each major separately; this epic tracks the ones that need real migration work. #239 was closed in favour of these stories.

## Scope

- zod 3 → 4 (`@gitpm/core` schema engine and every sync adapter)
- React 18 → 19 (`@gitpm/ui`)
- commander 14 → 15 (`@gitpm/cli`)
- @hono/node-server 1 → 2 (`@gitpm/ui` local server)
