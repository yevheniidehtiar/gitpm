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
  last_sync_hash: sha256:0adf57de52c96855e43f83a7af958ad943f408bfcd205b2ce19340b8f2ad95df
  synced_at: 2026-10-18T19:54:45.700Z
created_at: 2026-10-17T08:22:44.682Z
updated_at: 2026-10-18T19:48:10.237Z
---

`gitpm push` for the Bitbucket adapter:
- Create or update issues for stories and epics and keep the `bitbucket.*` sync block in frontmatter
- Milestones: create them if the API allows, otherwise warn and only link to existing ones
- Ensure components exist when components are the epic linkage strategy
- Dry-run mode prints the planned changes
- Fixture-based tests
