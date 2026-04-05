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
  last_sync_hash: sha256:f4226645ebfb5aed908d961e52b7d2274958f77eb91aa1a7d2f0c28a4fe50eb2
  synced_at: 2026-04-05T22:49:11.295Z
created_at: 2026-04-04T20:07:50.000Z
updated_at: 2026-04-04T20:07:50.000Z
---

Scheduled GitHub Actions workflow (cron: nightly) that:
- Creates a temp GitHub repo
- Runs `gitpm init` + `gitpm push` to populate issues
- Runs `gitpm pull` to verify round-trip
- Runs `gitpm sync` to test bidirectional flow
- Cleans up temp repo

Validates the full end-to-end flow against live GitHub API.

Part of #10
