---
type: story
id: rXKv8mPq2WZc
title: Reduce GitHub runner cost of Claude Review + Autofix Loop
status: in_review
priority: medium
assignee: null
labels:
  - ci/cd
  - cost
  - story
estimate: null
epic_ref:
  id: 0KmESSRSd002
github:
  issue_number: 216
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:99fda7a1c47d29932697759c1eafea4f1175f9e78cd492408b1a4e0e72897aee
  synced_at: 2026-04-26T19:23:28.129Z
created_at: 2026-04-26T00:00:00.000Z
updated_at: 2026-04-26T00:00:00.000Z
---

## Problem

`.github/workflows/claude-review.yml` runs on every PR push. Worst case
per push on a private-repo Linux runner:

- `review` job: up to 20 min cap (~5–6 min typical).
- `autofix-loop` job: up to 60 min cap, mostly **paid sleep** while the
  45 s polling loop waits for other CI to finish.

At ~$0.008/min for Linux 2-core, the loop alone can cost ~$0.48 per
push. Multiply by every push to every PR and the bill scales linearly
with developer activity, even when there is nothing for autofix to do.

## Plan

Stack the cheap wins first on this branch, defer the structural change
to a follow-up.

### Cheap wins (this branch)

1. **`paths-ignore`** on `claude-review.yml`: skip the workflow entirely
   for docs-only / `.meta/`-only / `*.md` / `LICENSE` PRs. These don't
   need a Claude review or autofix.
2. **`actions/cache`** for `~/.bun/install/cache` keyed on `bun.lock`.
   Both jobs currently do a fresh `bun install` and `bun run build` —
   caching the install shaves ~30 s off every job.
3. **Pre-check in `autofix-loop`** that exits the job before installing
   anything if either:
   - The `review` job's cache step already short-circuited (diff hash
     matches a known-green sentinel), or
   - All non-self check-runs on HEAD are already complete and green.

   This avoids paying for a runner that would otherwise spend the full
   45 s × N polling window discovering it has nothing to do.

### Structural change (separate PR)

Convert `autofix-loop` from a polling sleep loop into a job triggered
by the `workflow_run` event when the other PR workflows complete.
Eliminates billable idle time entirely. Tradeoffs:

- `workflow_run` always uses the workflow definition from the default
  branch (security feature) — wiring is fiddlier than `pull_request`.
- The job needs to map `workflow_run.pull_requests[0].number` back to
  the PR for context.
- App-token push pattern stays the same.

## Acceptance criteria

- [ ] Docs-only PRs do not trigger any `claude-review.yml` runner.
- [ ] `bun install` step in both jobs reports a cache hit on the second
      consecutive PR push.
- [ ] When `review` short-circuits via cache, `autofix-loop` exits in
      under 30 s without installing dependencies or sleeping.
- [ ] Worst-case end-to-end runner-minutes per push (measured on a
      red PR with one failing check) is unchanged or lower.

## Notes

The `workflow_run` migration is the bigger lever (eliminates the entire
polling window). Tracked here as the "next step" so we can ship the
cheap wins first and measure impact before committing to the rewrite.
