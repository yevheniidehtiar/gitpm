---
type: epic
id: irf1l_XLbkDl
title: "[Epic] Plugin & Extension System"
status: done
priority: medium
owner: null
labels:
  - architecture
milestone_ref:
  id: lFNL-hn79Edx
github:
  issue_number: 13
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:f2574a91aae46e8e51667809780eea4d313084903e261903e42f6dc3ed9c1fad
  synced_at: 2026-04-12T11:18:07.981Z
created_at: 2026-04-04T20:07:29.000Z
updated_at: 2026-04-04T20:07:29.000Z
---

## Overview
Design a plugin architecture that allows third-party sync adapters, custom schema extensions, and CLI plugins.

## Goals
- Plugin discovery and loading via `gitpm.config.ts`
- Adapter interface that Jira/GitLab/Linear plugins implement
- Custom field definitions via schema extensions
- CLI plugin commands (e.g. `gitpm jira import`)
- Hook system for pre/post sync events
