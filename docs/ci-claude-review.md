# Claude Review + Autofix CI

Two workflows:

| Workflow | Runs when | Does |
|---|---|---|
| `.github/workflows/claude-review.yml` | every non-draft, same-repo PR push to `master` | Reviews the diff with the official `/code-review` skill and posts inline comments |
| `.github/workflows/claude-autofix.yml` | a CI workflow fails on a PR, or the review left inline comments | One Claude fix pass, pushed back to the PR branch |

A green PR with a clean review starts no autofix runner at all.

## Claude Review

Runs [`anthropics/claude-code-action@v1`](https://github.com/anthropics/claude-code-action) with the `code-review@claude-code-plugins` plugin:

```
/code-review:code-review --comment <owner/repo>/pull/<n>
```

- Findings are posted as **inline review comments** by `github-actions[bot]` (the action is given `GITHUB_TOKEN`, so no Claude GitHub App install is needed).
- `--allowedTools "mcp__github_inline_comment__create_inline_comment"` is required: the action only starts the inline-comment MCP server when that tool is allowed.
- The review reads `CLAUDE.md`, which imports `AGENTS.md`, so it applies the repo conventions automatically.
- **Advisory only.** The check passes regardless of findings; it fails only if the action itself errors.
- Skipped when HEAD is an autofix commit, so autofix output is never re-reviewed.
- If it left inline comments on HEAD, it dispatches `claude-autofix.yml` (`gh workflow run`, needs `actions: write`).
- Skipped for docs-only, `docs-site/`, `.meta/`, `LICENSE`, `.gitignore` and `.editorconfig` changes. **Caveat:** if "Claude Review" ever becomes a required status check, replace `paths-ignore` with a per-job paths filter, since required checks that never run block merge.

Run the same review locally with `/code-review <pr-number>` (add `--comment` to post, `--fix` to apply).

## Claude Autofix

Triggers:

- `workflow_run` of **PR Validation** or **Build Matrix** with `conclusion: failure`, for same-repo PRs only (it runs with secrets, so never on forks).
- `workflow_dispatch` from Claude Review, with `pr`, `branch` and `sha`.

**Both triggers use the copy of `claude-autofix.yml` on `master`**, so changes to it take effect only after they merge.

One run = one fix pass, no polling. A "Gather context" step decides, before any token mint, checkout or install, whether there is work:

| Condition | Result |
|---|---|
| PR is not open | skip |
| PR head moved past the triggering commit | skip — CI re-runs on the new commit |
| 5 or more consecutive autofix commits at the PR tip | stop — manual intervention required |
| no failing checks and no review comments on the commit | skip |
| otherwise | fix |

Review comments are only passed to Claude when the commit is a human push, so autofix never chases its own output.

Fix pass: `claude -p` reads `/tmp/autofix/failing-checks.json` and `/tmp/autofix/review-comments.json`, fixes root causes (never weakening tests), and verifies with `bun run lint && bun run build && bun run test`. Claude does not commit or push. If it changed tracked files, the workflow commits them as `claude-autofix[bot]` and pushes (5 retries). That push re-runs CI; if CI fails again, autofix fires again, bounded by the 5-commit cap.

Pushes use a GitHub App token (`RELEASE_APP_ID` / `RELEASE_APP_PRIVATE_KEY`), because pushes made with `GITHUB_TOKEN` do not trigger CI.

Autofix commits are unsigned. That is fine: PRs are squash-merged and GitHub signs the squash commit, which satisfies the `required_signatures` rule on `master`.

## Concurrency

- Review: `claude-review-<pr>`, `cancel-in-progress: true`. Only the latest push is reviewed.
- Autofix: `claude-autofix-<branch>`, `cancel-in-progress: false`. When PR Validation and Build Matrix both fail on one commit, the second run queues, sees the branch has moved after the first fix, and exits.

## Required secrets

| Secret | Used by | Purpose |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | both | Claude auth, from `claude setup-token`. Billed against the subscription of whoever generated it (reported dollar costs in logs are notional); an `ANTHROPIC_API_KEY` is the alternative for shared CI. |
| `RELEASE_APP_ID`, `RELEASE_APP_PRIVATE_KEY` | autofix | App token so autofix pushes trigger CI. |
| `GITHUB_TOKEN` (default) | both | Inline review comments, dispatching autofix, reading check-runs and comments. |
