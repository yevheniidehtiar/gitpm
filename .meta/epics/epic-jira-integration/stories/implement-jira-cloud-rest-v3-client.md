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
  last_sync_hash: sha256:83da0b9a28dea8619bf959bf202789e69433a4086cfc7016f1abba992c7a836b
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:07:53Z
updated_at: 2026-04-04T20:07:53Z
---

Create `@gitpm/sync-jira` package with a Jira Cloud API client:
- Authentication via API token + email
- List projects, epics, stories, sprints
- Create/update issues
- Handle pagination and rate limiting
- Map Jira issue types → GitPM entity types

Part of #11
