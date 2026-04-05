---
type: epic
id: Zd3_Edq4ltwq
title: "[Epic] Jira Integration"
status: done
priority: medium
owner: null
labels:
  - integration
milestone_ref:
  id: lFNL-hn79Edx
github:
  issue_number: 11
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:524ef1e0951b2e99e40c8d0f8289d1385b7de4d5d49711e6e57fe7212404da91
  synced_at: 2026-04-05T22:49:10.492Z
created_at: 2026-04-04T20:07:23.000Z
updated_at: 2026-04-04T20:07:23.000Z
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
