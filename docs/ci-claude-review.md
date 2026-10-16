# Claude Review + Autofix Loop CI

This page documents `.github/workflows/claude-review.yml`, which runs on every non-draft, same-repo PR to `master`. It (a) reviews the diff with the official `/code-review` skill and (b) tries to fix failing CI checks.

The workflow is skipped for docs-only, `docs-site/`, `.meta/`, `LICENSE`, `.gitignore` and `.editorconfig` changes. **Caveat:** if "Claude Review" ever becomes a required status check, replace `paths-ignore` with a per-job paths filter, since required checks that never run block merge.

## `review` job

Runs [`anthropics/claude-code-action@v1`](https://github.com/anthropics/claude-code-action) with the `code-review@claude-code-plugins` plugin:

```
/code-review:code-review --comment <owner/repo>/pull/<n>
```

- Findings are posted as **inline review comments** by `github-actions[bot]` (the action is given `GITHUB_TOKEN`, so no Claude GitHub App install is needed).
- `--allowedTools "mcp__github_inline_comment__create_inline_comment"` is required: the action only starts the inline-comment MCP server when that tool is allowed.
- The review reads `CLAUDE.md`, which imports `AGENTS.md`, so it applies the repo conventions automatically.
- **Advisory only.** The check passes regardless of findings; it fails only if the action itself errors.
- Skipped when HEAD is an autofix commit, so the loop never re-reviews its own output.

Run the same review locally with `/code-review <pr-number>` (add `--comment` to post, `--fix` to apply).

## `autofix-loop` job

Runs after `review` (even if it errored), never on fork PRs.

**Pre-check** (one `gh api` round, before any install): decides whether there is work.

| Condition | Result |
|---|---|
| 5 or more consecutive autofix commits at the PR tip | stop — manual intervention required |
| checks pending or failing | run the loop |
| Claude left review comments on HEAD, and HEAD is a human push | run one pass on the comments |
| otherwise | skip |

**Loop** (up to `MAX_ITERATIONS=5`, 45 s between polls):

1. Poll check-runs on HEAD (excluding this job). Wait while any are pending.
2. All green → done.
3. Otherwise write failing checks to `/tmp/autofix/failing-checks.json` and, on the first pass only, the review's inline comments on HEAD to `/tmp/autofix/review-comments.json`.
4. Run `claude -p` to fix root causes (never weakening tests) and verify with `bun run lint && bun run build && bun run test`. Claude does not commit or push.
5. Clean tree → stop. Otherwise `git add -u`, commit as `claude-autofix[bot]`, push (5 retries).

Each autofix push starts a new workflow run, which cancels the current one (`cancel-in-progress`). The consecutive-autofix-commit cap in the pre-check is what actually bounds the loop across runs.

Pushes use a GitHub App token (`RELEASE_APP_ID` / `RELEASE_APP_PRIVATE_KEY`), because pushes made with `GITHUB_TOKEN` do not trigger new workflow runs.

Autofix commits are unsigned. That is fine: PRs are squash-merged and GitHub signs the squash commit, which satisfies the `required_signatures` rule on `master`.

## Required secrets

| Secret | Used by | Purpose |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | both jobs | Claude auth, from `claude setup-token`. Tied to the subscription of whoever generated it; an `ANTHROPIC_API_KEY` is the alternative for shared CI. |
| `RELEASE_APP_ID`, `RELEASE_APP_PRIVATE_KEY` | `autofix-loop` | App token so autofix pushes trigger new runs. |
| `GITHUB_TOKEN` (default) | both | Inline review comments, reading check-runs and comments. |

## Concurrency

`claude-review-<pr>` with `cancel-in-progress: true`: only the latest push to a PR is reviewed and fixed.
