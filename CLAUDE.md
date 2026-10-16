@AGENTS.md

# Claude Code notes

`AGENTS.md` is the tool-neutral contract for this repo. This file only adds Claude Code specifics.

## Interactive confirmations

- For yes/no or small multiple-choice questions ("Want me to…?", "X or Y?") use the **AskUserQuestion** tool, not prose.
- Use it when 2–4 discrete options cover the answer. Put the recommended option first with "(Recommended)" in its label.
- Keep labels to 1–5 words. Put trade-offs in the description.
- Do not use it for open-ended questions or to report progress.
- Bundle up to 4 related questions in one call when they share a decision point.

## Skills, commands and agents

| Capability | Use for |
|---|---|
| `gitpm` skill | Any read or write under `.meta/`. Prefer it over grep, Read or Edit on `.meta/` files. In this repo `gitpm` means `bun run gitpm` after `bun run build`. |
| `Plan` agent | Architecture and implementation planning, second opinions on design |
| `Explore` agent | Broad codebase research across many files or uncertain scope |
| `simplify` skill | Review changed code for reuse, quality and efficiency |
| `/commit` | Conventional-commit message from the staged diff, then commit |
| `/review-pr <n>` | Structured PR review: diff, conventions, simplify, CI status |
| `/prepare-release` | Pre-release audit: verification gate, classify commits, predict bumps |
| `mcp__github__*` | Read PRs, issues and checks freely (`pull_request_read`, `list_commits`). Write (`pull_request_review_write`) only after confirming with the user. |

## Review in CI

`.github/workflows/claude-review.yml` runs `/review-pr` headless on every PR and gates on severity. When you change `.claude/commands/review-pr.md`, keep `docs/ci-claude-review.md` accurate.

## Path-scoped rules

`.claude/rules/` holds rules that load only when you touch matching paths: `meta-tree.md` (`.meta/**`), `library-packages.md` (`packages/core/**`, `packages/sync-*/**`) and `ui.md` (`packages/ui/**`).
