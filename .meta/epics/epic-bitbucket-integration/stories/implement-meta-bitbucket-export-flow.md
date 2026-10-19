---
type: story
id: _u2fRh8sseDh
title: Implement .meta → Bitbucket export flow
status: done
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
  last_sync_hash: sha256:bda5165aa21827ac1cb2510ff215100431de9e1ad48a03a3e64825ad47f53196
  synced_at: 2026-10-19T23:25:37.389Z
created_at: 2026-10-17T08:22:44.682Z
updated_at: 2026-10-18T20:47:38.945Z
---

`gitpm push` for the Bitbucket adapter:
- Create or update issues for stories and epics and keep the `bitbucket.*` sync block in frontmatter
- Milestones: create them if the API allows, otherwise warn and only link to existing ones
- Ensure components exist when components are the epic linkage strategy
- Dry-run mode prints the planned changes
- Fixture-based tests
