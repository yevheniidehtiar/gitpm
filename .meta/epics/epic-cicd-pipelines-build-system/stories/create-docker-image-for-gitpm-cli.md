---
type: story
id: iEXlQWMdV7l0
title: Create Docker image for gitpm CLI
status: done
priority: medium
assignee: null
labels:
  - ci/cd
  - story
estimate: null
epic_ref:
  id: 0KmESSRSd002
github:
  issue_number: 17
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:ebb457089ba2a5d1a6d9fb4619d6bb5aab6379a94cd8a6d3d9052d363955f622
  synced_at: 2026-04-05T22:49:12.995Z
created_at: 2026-04-04T20:07:47.000Z
updated_at: 2026-04-04T20:07:47.000Z
---

Publish a Docker image so users can run `docker run gitpm import --repo owner/repo` without installing Bun/Node locally.

- Multi-stage build (Bun for build, distroless for runtime)
- Publish to GitHub Container Registry (ghcr.io)
- Auto-publish on release tags

Part of #10
