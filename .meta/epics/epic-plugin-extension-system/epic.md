---
type: epic
id: irf1l_XLbkDl
title: "[Epic] Plugin & Extension System"
status: todo
priority: medium
owner: null
labels:
  - architecture
milestone_ref:
  id: lFNL-hn79Edx
github:
  issue_number: 13
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:b3c60a7ca9d7ac3a19b71b1837fd1173f5ba25aad99244922e7a7dfd90440646
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:07:29Z
updated_at: 2026-04-04T20:07:29Z
---

## Overview
Design a plugin architecture that allows third-party sync adapters, custom schema extensions, and CLI plugins.

## Goals
- Plugin discovery and loading via `gitpm.config.ts`
- Adapter interface that Jira/GitLab/Linear plugins implement
- Custom field definitions via schema extensions
- CLI plugin commands (e.g. `gitpm jira import`)
- Hook system for pre/post sync events

