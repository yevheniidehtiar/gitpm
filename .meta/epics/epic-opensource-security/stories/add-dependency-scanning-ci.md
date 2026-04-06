---
type: story
id: rgUON3L0FVoD
title: Add dependency scanning to CI (npm audit + Dependabot config)
status: done
priority: high
assignee: null
labels:
  - security
  - ci/cd
estimate: null
epic_ref:
  id: bZoJF6Th8vEU
github:
  issue_number: 74
  repo: yevheniidehtiar/gitpm
  synced_at: 2026-04-06T12:53:26.000Z
created_at: 2026-04-06T00:00:00Z
updated_at: 2026-04-06T00:00:00Z
---

## Problem
Neither `pr-validation.yml` nor `release.yml` runs any dependency audit. No `.github/dependabot.yml` or `renovate.json` exists. Vulnerable dependencies could be shipped without detection.

## Proposed Solution
1. Add `npm audit --audit-level=high` step to `.github/workflows/pr-validation.yml`
2. Create `.github/dependabot.yml` for automated dependency update PRs
3. Configure Dependabot for both npm and GitHub Actions ecosystems

## Acceptance Criteria
- [ ] PR validation fails if high/critical vulnerabilities found in dependencies
- [ ] Dependabot creates weekly update PRs for npm dependencies
- [ ] Dependabot monitors GitHub Actions versions for updates

## Impact
Supply chain security. Prevents shipping known vulnerable dependencies.
