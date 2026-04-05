---
type: story
id: TV3XlZdBYm91
title: Implement Jira Cloud REST v3 client
status: done
priority: medium
assignee: null
labels:
  - integration
  - story
estimate: null
epic_ref:
  id: Zd3_Edq4ltwq
github:
  issue_number: 19
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:eae93f2527b52b06813d123491681ce136b76c1fb12d37498d87952e05161e12
  synced_at: 2026-04-05T22:49:14.314Z
created_at: 2026-04-04T20:07:53.000Z
updated_at: 2026-04-04T20:07:53.000Z
---

Create `@gitpm/sync-jira` package with a Jira Cloud API client:
- Authentication via API token + email
- List projects, epics, stories, sprints
- Create/update issues
- Handle pagination and rate limiting
- Map Jira issue types → GitPM entity types

Part of #11
