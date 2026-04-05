---
type: epic
id: 0KmESSRSd002
title: "[Epic] CI/CD Pipelines & Build System"
status: done
priority: medium
owner: null
labels:
  - ci/cd
milestone_ref:
  id: lFNL-hn79Edx
github:
  issue_number: 10
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:25cf41c3276d787eff0c3557b946431bd7b7f0a7b03ae9ec134661fd2e6344c7
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:07:19Z
updated_at: 2026-04-04T20:07:19Z
---

## Overview
Implement GitHub Actions CI/CD pipelines for automated testing, linting, building, and publishing of all GitPM packages.

## Goals
- Automated quality gates on every PR
- Automated package publishing to npm
- Build verification across Node.js and Bun runtimes
- Release automation with changelogs

## Sub-issues
- [ ] PR validation pipeline (lint + test + build)
- [ ] Release pipeline (version bump + npm publish)
- [ ] Nightly integration tests
- [ ] Build matrix (Node 20/22, Bun latest)
- [ ] Docker image for gitpm CLI

