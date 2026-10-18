---
type: story
id: _u2fRh8sseDh
title: Implement .meta → Bitbucket export flow
status: in_review
priority: high
assignee: null
labels:
  - integration
  - story
estimate: 3
epic_ref:
  id: KVvXwhgJEyic
github:
  issue_number: 287
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:a7c6aa4a171b24ede7780b8ea1039aef3e956924dcb49ae85e7cd9b5c5771b09
  synced_at: 2026-10-17T11:20:25.054Z
created_at: 2026-10-17T08:22:44.682Z
updated_at: 2026-10-18T19:48:10.237Z
---

`gitpm push` for the Bitbucket adapter:
- Create or update issues for stories and epics and keep the `bitbucket.*` sync block in frontmatter
- Milestones: create them if the API allows, otherwise warn and only link to existing ones
- Ensure components exist when components are the epic linkage strategy
- Dry-run mode prints the planned changes
- Fixture-based tests
