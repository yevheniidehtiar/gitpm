# Claude Review CI

`.github/workflows/claude-review.yml` reviews every non-draft, same-repo PR to `master` with the official `/code-review` skill and posts the findings as inline comments.

## How it works

Runs [`anthropics/claude-code-action@v1`](https://github.com/anthropics/claude-code-action) with the `code-review@claude-code-plugins` plugin:

```
/code-review:code-review --comment <owner/repo>/pull/<n>
```

- Findings are posted as **inline review comments** by `github-actions[bot]` (the action is given `GITHUB_TOKEN`, so no Claude GitHub App install is needed). With no findings it posts a single "No issues found" comment.
- `--allowedTools "mcp__github_inline_comment__create_inline_comment"` is required: the action only starts the inline-comment MCP server when that tool is allowed.
- The review reads `CLAUDE.md`, which imports `AGENTS.md`, so it applies the repo conventions automatically.
- **Advisory only.** The check passes regardless of findings; it fails only if the action itself errors.
- Skipped for fork PRs (no secrets), drafts, and docs-only (`docs/`, `zensical.toml`), `.meta/`, `LICENSE`, `.gitignore` and `.editorconfig` changes. **Caveat:** if "Claude Review" ever becomes a required status check, replace `paths-ignore` with a per-job paths filter, since required checks that never run block merge.
- Concurrency group `claude-review-<pr>` with `cancel-in-progress: true`: only the latest push is reviewed.

## Acting on findings

There is no automatic fixer. Address findings yourself, or locally with Claude Code:

- `/code-review <pr-number>` reproduces the CI review.
- `/code-review <pr-number> --fix` applies the findings to your working tree.

## Required secrets

| Secret | Purpose |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude auth, from `claude setup-token`. Billed against the subscription of whoever generated it (dollar costs in the logs are notional); an `ANTHROPIC_API_KEY` is the alternative for shared CI. |
| `GITHUB_TOKEN` (default) | Posting the inline review comments. |
