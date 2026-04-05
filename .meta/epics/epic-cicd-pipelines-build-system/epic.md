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
  last_sync_hash: sha256:d600f70fd2e03fd0fff22084fa0e8f9137866103b515f29fd778831d46931370
  synced_at: 2026-04-05T22:49:10.125Z
created_at: 2026-04-04T20:07:19.000Z
updated_at: 2026-04-04T20:07:19.000Z
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
