---
type: story
id: 86a2BVBmRChj
title: Add SBOM generation to release workflow
status: todo
priority: medium
assignee: null
labels:
  - security
  - ci/cd
estimate: null
epic_ref:
  id: bZoJF6Th8vEU
created_at: 2026-04-06T00:00:00Z
updated_at: 2026-04-06T00:00:00Z
---

## Problem
The release workflow publishes with `--provenance` (good — OIDC attestation), but generates no Software Bill of Materials (SBOM). Enterprise adopters increasingly require SBOM for compliance.

## Proposed Solution
Add a step to `.github/workflows/release.yml` using `@cyclonedx/bun` or `cyclonedx-npm` to generate and attach SBOM artifact to the GitHub Release.

## Acceptance Criteria
- [ ] SBOM in CycloneDX or SPDX format generated during release
- [ ] SBOM artifact attached to GitHub Release
- [ ] SBOM includes all production dependencies with versions

## Impact
Supply chain transparency. Required by many enterprise security policies.
