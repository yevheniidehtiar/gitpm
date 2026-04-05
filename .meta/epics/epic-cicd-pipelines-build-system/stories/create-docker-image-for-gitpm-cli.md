---
type: story
id: iEXlQWMdV7l0
title: Create Docker image for gitpm CLI
status: todo
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
  last_sync_hash: sha256:c9d520b3edf4448b644d7f9634057b60b57a19663e05fe1c9cb5731269a5624a
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:07:47Z
updated_at: 2026-04-04T20:07:47Z
---

Publish a Docker image so users can run `docker run gitpm import --repo owner/repo` without installing Bun/Node locally.

- Multi-stage build (Bun for build, distroless for runtime)
- Publish to GitHub Container Registry (ghcr.io)
- Auto-publish on release tags

Part of #10
