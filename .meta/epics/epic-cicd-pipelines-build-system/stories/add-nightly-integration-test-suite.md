---
type: story
id: 0qT7YlfDd1VH
title: Add nightly integration test suite
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
  issue_number: 18
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:474de402ac726948b9b631a0a00cac601a9dc6f489fad4e00647936595452195
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:07:50Z
updated_at: 2026-04-04T20:07:50Z
---

Scheduled GitHub Actions workflow (cron: nightly) that:
- Creates a temp GitHub repo
- Runs `gitpm init` + `gitpm push` to populate issues
- Runs `gitpm pull` to verify round-trip
- Runs `gitpm sync` to test bidirectional flow
- Cleans up temp repo

Validates the full end-to-end flow against live GitHub API.

Part of #10
