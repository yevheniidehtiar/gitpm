---
type: epic
id: 7d7n5ZMxSPon
title: "[Epic] GitLab Integration"
status: todo
priority: medium
owner: null
labels:
  - integration
milestone_ref:
  id: lFNL-hn79Edx
github:
  issue_number: 12
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:808531c32391f9fcd7765fb1cbbd96f0be4dc69e1dcccd30b6d6138b4297bc7b
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:07:26Z
updated_at: 2026-04-04T20:07:26Z
---

## Overview
Add bidirectional sync between `.meta/` project tree and GitLab Issues/Milestones/Epics.

## Goals
- Import GitLab issues, milestones, and epics into `.meta/`
- Export `.meta/` entities to GitLab
- Support GitLab.com and self-hosted instances
- Map GitLab labels and weights to GitPM fields

## Architecture
New package: `@gitpm/sync-gitlab` following the same adapter pattern as `@gitpm/sync-github`.

