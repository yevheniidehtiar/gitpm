---
type: story
id: fwUDrRLhBnJ9
title: Set up goreleaser for cross-platform binary distribution
status: backlog
priority: medium
assignee: null
labels:
  - go
  - migration
  - ci
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:11.340Z
updated_at: 2026-04-26T20:06:11.340Z
---

**Phase 1 — Distribution**

Set up `goreleaser` config and GitHub Actions workflow for cross-platform binary builds.

- `.goreleaser.yaml` with builds for linux/amd64, linux/arm64, darwin/amd64, darwin/arm64, windows/amd64
- GitHub Actions workflow triggered by tag push (matches existing release-please flow)
- Homebrew tap formula generation
- Checksum file generation
- Optional: npm wrapper package with platform-specific optionalDependencies (like Biome)

**Acceptance criteria**:
- `goreleaser release --snapshot` produces binaries for all platforms
- Binary size < 15MB per platform
- GitHub Release includes binaries, checksums, and Homebrew formula
