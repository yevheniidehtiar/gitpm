---
type: story
id: 9GXTQoJI7Ciz
title: Add PR validation pipeline (lint + test + build)
status: done
priority: medium
assignee: null
labels:
  - ci/cd
  - story
estimate: null
epic_ref:
  id: 0KmESSRSd002
github:
  issue_number: 14
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:29751e7059942f4b7ac881098027513928716e5e5868073d626056a30d9dadf2
  synced_at: 2026-04-05T22:49:12.119Z
created_at: 2026-04-04T20:07:37.000Z
updated_at: 2026-04-04T20:07:38.000Z
---

GitHub Actions workflow that runs on every PR:
1. `bun install`
2. `bun run lint` (Biome)
3. `bun run test` (Vitest)
4. `bun run build` (tsup + Vite)

Should block merge on failure. Use concurrency groups to cancel stale runs.

Part of #10
