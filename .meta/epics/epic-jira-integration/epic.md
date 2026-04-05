---
type: epic
id: Zd3_Edq4ltwq
title: "[Epic] Jira Integration"
status: todo
priority: medium
owner: null
labels:
  - integration
milestone_ref:
  id: lFNL-hn79Edx
github:
  issue_number: 11
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:9e35b18bb93ed9a350d35296b0b3bb68465114909b5f9cd3b40330cf7eae4f0d
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:07:23Z
updated_at: 2026-04-04T20:07:23Z
---

## Overview
Add bidirectional sync between `.meta/` project tree and Jira Cloud/Server, similar to the existing GitHub sync adapter.

## Goals
- Import Jira epics, stories, and sprints into `.meta/`
- Export `.meta/` entities back to Jira
- Map Jira workflows to GitPM status fields
- Support both Jira Cloud (REST v3) and Jira Server (REST v2)

## Architecture
New package: `@gitpm/sync-jira` following the same adapter pattern as `@gitpm/sync-github`.

