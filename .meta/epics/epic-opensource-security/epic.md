---
type: epic
id: bZoJF6Th8vEU
title: "[Epic] Open-Source Readiness & Security Hardening"
status: todo
priority: high
owner: null
labels:
  - security
  - docs
milestone_ref:
  id: lFNL-hn79Edx
github:
  issue_number: 64
  repo: yevheniidehtiar/gitpm
  synced_at: 2026-04-06T12:53:26.000Z
created_at: 2026-04-06T00:00:00Z
updated_at: 2026-04-06T00:00:00Z
---

## Overview
Establish the foundational security posture and community files required for a credible open-source project. Without LICENSE, the code is legally "all rights reserved." The XSS vulnerability in the UI is exploitable now. These are table-stakes for public adoption.

## Goals
- Add proper LICENSE file (MIT) to make the project legally open-source
- Create vulnerability disclosure policy (SECURITY.md)
- Add community contribution guidelines and code of conduct
- Fix known XSS vulnerability in markdown preview component
- Add dependency scanning and SBOM generation to CI/CD
- Document branch protection and signed-commit policies

## Priority
P0 — Critical/Blocking. Must be completed before v1.0 release.

## Sub-issues
- [ ] Add LICENSE file (MIT)
- [ ] Add SECURITY.md with vulnerability disclosure policy
- [ ] Add CONTRIBUTING.md with development setup guide
- [ ] Add CODE_OF_CONDUCT.md (Contributor Covenant)
- [ ] Fix XSS in MarkdownPreview: sanitize HTML in entity-editor.tsx
- [ ] Add dependency scanning to CI (npm audit + Dependabot config)
- [ ] Add SBOM generation to release workflow
- [ ] Document branch protection rules and signed-commit policy
