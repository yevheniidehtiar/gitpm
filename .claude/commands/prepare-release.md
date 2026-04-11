---
description: Pre-release audit for gitpm — run lint+build+test, classify commits since last tag, and predict which packages will bump
---

# /prepare-release — gitpm release audit

Run this before merging a branch to `master` to verify the release-please pipeline will do the right thing. **This command never tags, publishes, or merges anything.** It is read-only except for running local checks.

## Steps

1. **Pre-push checklist** — run in order, stop on first failure:
   ```bash
   bun run lint
   bun run build
   bun run test
   ```
   If any command fails, report the failure to the user and stop. Do not continue with the audit.

2. **Find the last release tag** for comparison:
   ```bash
   git fetch --tags
   git describe --tags --abbrev=0 2>/dev/null || echo "no tags"
   ```
   Also check `.release-please-manifest.json` for the current per-package versions.

3. **List commits since the last tag** that touch each package:
   ```bash
   git log <last-tag>..HEAD --oneline -- packages/core
   git log <last-tag>..HEAD --oneline -- packages/sync-github
   git log <last-tag>..HEAD --oneline -- packages/sync-gitlab
   git log <last-tag>..HEAD --oneline -- packages/sync-jira
   git log <last-tag>..HEAD --oneline -- packages/cli
   git log <last-tag>..HEAD --oneline -- packages/ui
   ```

4. **Classify each commit** using the conventional-commits mapping from `CLAUDE.md` → "Release Workflow":
   - `fix:` → patch
   - `feat:` → patch (pre-1.0 via `bump-patch-for-minor-pre-major: true`)
   - `feat!:` / `BREAKING CHANGE:` → major
   - `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `style:`, `build:`, `perf:` → no bump

5. **Predict version bumps**. For each of the 6 packages, compute:
   - Current version (from `packages/<name>/package.json`)
   - Highest-severity change since tag
   - Predicted next version

   Example output:
   ```
   @gitpm/core          0.1.5 → no bump (2 chore commits)
   @gitpm/sync-github   0.1.5 → no bump
   @gitpm/sync-gitlab   0.1.5 → 0.1.6 (1 fix commit)
   @gitpm/sync-jira     0.1.5 → no bump
   @gitpm/cli           0.1.5 → no bump
   @gitpm/ui            0.1.5 → no bump
   ```

6. **Sanity checks**:
   - [ ] `.release-please-manifest.json` versions match `packages/*/package.json` versions
   - [ ] Every package listed in `release-please-config.json` exists
   - [ ] Every package has a `CHANGELOG.md`
   - [ ] No uncommitted changes (`git status`)
   - [ ] Current branch is pushed to origin
   - [ ] No `feat!:` or `BREAKING CHANGE:` commits unless the user intended a major bump

7. **Report** to the user:
   - Predicted bumps (table above)
   - Any sanity-check failures
   - Next steps: "Merge the branch PR to master, then merge the release-please PR that appears, then `release.yml` will publish the tagged packages"

## Guardrails

- **Never run `npm publish`** — CI does that.
- **Never create or push tags** — release-please does that.
- **Never merge anything** — a maintainer does that.
- **Never edit `.release-please-manifest.json`** — it's managed by release-please.
- If the pre-push checklist fails, do NOT continue with commit classification. Fix first.
