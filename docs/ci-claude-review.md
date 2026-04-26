# Claude Review + Autofix Loop CI

This page documents `.github/workflows/claude-review.yml`, the workflow that runs Claude against every PR push to `master` to (a) post a code review and (b) attempt to auto-fix any failing CI checks.

## Overview

The workflow contains **two jobs**:

| Job | Wall-clock | Cap | Permissions | Purpose |
|---|---|---|---|---|
| `review` | 5–6 min typical | 20 min | `contents: read`, `pull-requests: write`, `issues: write` | Review the diff, post findings as a PR comment, gate the check on critical-severity findings |
| `autofix-loop` | up to 60 min | 60 min | `contents: write`, `checks: read`, `actions: read`, plus PR/issue write | Wait for every other check on HEAD to settle, then ask Claude to fix any failures and push the fix back to the PR branch |

`autofix-loop` declares `needs: review` so it does not start until `review` has finished. This avoids billing the autofix runner for the 5–6 min it would otherwise sleep through review's run.

The workflow itself is filtered with `paths-ignore` for docs-only / `.meta/`-only / `LICENSE` / `.gitignore` / `.editorconfig` PRs — those don't trigger any runner. **Caveat:** if you ever mark "Claude Review" as a required status check, switch this to a per-job `paths-changed` pre-step instead, since required checks that never get triggered will block merge on filtered PRs.

## `review` job

Inputs: `pull_request` event payload, the PR diff at HEAD.

Steps:

1. **Cache check.** Computes a SHA-256 of the three-dot diff against `master` (`git diff origin/master...HEAD`), excluding `*.lock` and `**/dist/**`. Searches prior PR comments authored by `github-actions[bot]` for a matching `<!-- claude-review-cache: <hash> -->` sentinel. A hit short-circuits the rest of the job and re-emits the sentinel so the cache lineage chains forward. This is invariant under rebase onto a newer `master`.
2. **Run Claude** in `-p` mode with an inlined prompt that tells it to follow `.claude/commands/review-pr.md`, classify findings into `critical` / `medium` / `low` / `nit`, and write the result to `/tmp/review-result.json`. The session transcript (`stream.jsonl`) is uploaded as an artifact.
3. **Gate.** Reads `/tmp/review-result.json`, posts a markdown summary as a PR comment, and:
   - Exits non-zero if `counts.critical > 0` (blocks the check).
   - Emits a warning if `counts.medium > 0` (advisory; does not block).
   - On a clean review (`critical == 0`), embeds the cache sentinel so the next push of the same diff hits the cache.

Failure modes the gate handles:

- Claude wrote `review-result.json` to the workspace root instead of `/tmp` → moved automatically.
- `review-result.json` missing entirely → posts a diagnostic PR comment with `ls /tmp`, the assistant transcript, tool calls, and stderr — visible without artifact download access.

## `autofix-loop` job

Skipped on fork PRs (`github.event.pull_request.head.repo.full_name == github.repository`), since the workflow can't push to a fork branch. Also skipped when `review` short-circuited on its diff-hash cache (no new code since a known-green review, so there's nothing for autofix to do) — the `if:` condition checks `needs.review.outputs.cache_hit`.

### Pre-check short-circuit

Before paying for the App-token mint, checkout, bun install, and Claude CLI install, the job runs a single `gh api .../check-runs` call. If every non-self check on HEAD is already complete and green, the rest of the steps are skipped via `steps.precheck.outputs.skip`. This catches the common "PR was green on first try" case where the loop would otherwise wake up, spin for 45 s, and exit having done nothing.

### App token (not `GITHUB_TOKEN`)

Checkout uses a token minted from the `RELEASE_APP_ID` / `RELEASE_APP_PRIVATE_KEY` GitHub App secrets (the same App release-please uses). This is **load-bearing**: pushes made with the default `GITHUB_TOKEN` do **not** trigger new `pull_request` events (anti-loop protection). With the App token, each autofix push triggers a fresh workflow run, the loop's next iteration sees new check-runs, and the loop can converge.

### Iteration budget

`MAX_ITERATIONS` is sized dynamically by total diff lines (`additions + deletions`):

| Diff size | Max iterations |
|---|---|
| ≤ 500 | 5 |
| ≤ 1500 | 7 |
| ≤ 3000 | 10 |
| ≤ 5000 | 12 |
| > 5000 | 15 |

### Loop body

Each iteration:

1. Sleep 45 seconds.
2. Fetch all check-runs for current HEAD via `gh api`, **excluding only `Claude Autofix Loop`** (the loop excludes itself but not the `review` job — failing reviews are something the loop will try to fix).
3. If no check-runs exist yet, or any are still `queued` / `in_progress` → continue (loop again).
4. If all completed and none failed → exit 0, write a success line to `$GITHUB_STEP_SUMMARY`.
5. If any failed:
   - Write the failing check metadata to `/tmp/autofix/failing-checks.json`.
   - **If `Claude Review` is among the failures**, fetch the latest "Claude Review" PR comment and write its body to `/tmp/autofix/review-findings.md`. Claude is told to prioritize critical/medium severity findings before build/test failures.
   - Run Claude with a prompt that tells it to read the failing-checks JSON, fetch logs via `gh run view`, fix the root cause (NOT modify tests to mask it), follow `CLAUDE.md` conventions, and verify locally with `bun run lint && bun run build && bun run test`. **Claude must not commit, push, or comment** — the workflow does that.
   - `--max-turns` is 30 if review-findings are present, 20 otherwise.
   - If the working tree is clean after Claude exits → break the loop with a "manual intervention required" summary.
   - Otherwise `git add -u` (tracked files only — avoids staging stray secrets or build artifacts), commit as `claude-autofix[bot]`, and push with up-to-5-attempt exponential backoff retry.

If the iteration budget is exhausted without going green, the job exits cleanly with a "Reached max iterations" summary; the PR is left in its current state for human review.

## Why two jobs instead of one

The two-job split is a deliberate trade-off:

- **Cache short-circuit.** The review job can skip the expensive Claude call entirely when the diff hash matches a known-green sentinel. Folding everything into the autofix loop would either lose this or require duplicating the cache logic per iteration.
- **Least privilege.** `review` runs read-only. Only `autofix-loop` carries `contents: write`. Merging them would give the reviewer push rights it does not need.
- **Independent timeouts.** Review's 20-minute cap kills hung sessions fast; autofix needs 60 minutes for the polling window plus multiple Claude calls.
- **Fast user-visible feedback.** The review comment lands within a few minutes of the push regardless of how long autofix takes (or whether autofix runs at all on a fork PR).

The "review feeds autofix" integration already exists — autofix detects when `Claude Review` is among the failing checks and pulls the structured findings into its prompt — so consolidation would not unlock new behaviour, only collapse the surface.

## Why you might see no autofix commits

Two common reasons:

1. **All non-self checks were green** when the loop polled. The loop exits after the first pass without invoking Claude.
2. **Claude could not produce a fix.** It exited with a clean working tree, the loop broke, and the job summary contains "Stopped at iteration N: Claude could not produce a fix". Manual intervention is required.

A third, rarer case: the push iteration succeeded but the next iteration polled before any new check-runs were registered against the new SHA, then saw no failures and exited. The 45 s sleep and the App-token push (which forces a new `pull_request` event) make this unlikely.

## Required secrets

| Secret | Used by | Purpose |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | both jobs | Authenticates the Claude Code CLI. Generated with `claude setup-token` on a trusted machine. |
| `RELEASE_APP_ID`, `RELEASE_APP_PRIVATE_KEY` | `autofix-loop` only | GitHub App credentials minted into a checkout token. Required for autofix pushes to dispatch new workflow runs. |
| `GITHUB_TOKEN` (default) | both | Posting PR comments, reading check-runs, the cache sentinel lookup. |

## Concurrency

`concurrency.group: claude-review-${{ github.event.pull_request.number }}` with `cancel-in-progress: true`. A new push to a PR cancels the in-flight review and autofix runs for that PR; only the latest push is reviewed and fixed.

## Artifacts

`review` uploads `/tmp/claude-review/` (containing `stream.jsonl` and `stderr.log`), the inline prompt, and `review-result.json` as `claude-review-pr-<n>` with 14-day retention.
