---
type: story
id: _u2fRh8sseDh
title: Implement .meta → Bitbucket export flow
status: backlog
priority: high
assignee: null
labels:
  - integration
  - story
estimate: 3
epic_ref:
  id: KVvXwhgJEyic
created_at: 2026-10-17T08:22:44.682Z
updated_at: 2026-10-17T08:22:44.682Z
---

`gitpm push` for the Bitbucket adapter:
- Create or update issues for stories and epics and keep the `bitbucket.*` sync block in frontmatter
- Milestones: create them if the API allows, otherwise warn and only link to existing ones
- Ensure components exist when components are the epic linkage strategy
- Dry-run mode prints the planned changes
- Fixture-based tests
