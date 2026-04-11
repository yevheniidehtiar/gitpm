---
description: Structured review of a gitpm pull request — fetch diff, check conventions, run simplify, verify CI, and optionally post a review
---

# /review-pr — structured gitpm PR review

Usage: `/review-pr <pr-number>`

Run a thorough, opinionated review of a PR against the gitpm code conventions. Produce a short written report for the user. **Only post a GitHub comment if there is something genuinely actionable** — silence is fine.

## Steps

1. **Fetch PR metadata** via GitHub MCP:
   - `mcp__github__pull_request_read` on `yevheniidehtiar/gitpm` — get title, description, base/head refs, author, changed files, state
   - `mcp__github__list_commits` — get the commit list (for conventional-commit compliance check)

2. **Fetch the diff** — pull the list of changed files and read the content of each changed file at the head ref. Skip lockfiles, generated `dist/`, and `.meta/sync/` state files unless the user explicitly cares about them.

3. **Conventions audit** (from `CLAUDE.md` → "Code Conventions"):
   - [ ] All imports ESM with `.js` extensions
   - [ ] `type` imports used where applicable
   - [ ] No thrown exceptions in library code — `Result<T, E>` returned instead
   - [ ] `zod` used for validation (no manual type guards)
   - [ ] `node:fs/promises` used for file I/O
   - [ ] No `any` (Biome: `noExplicitAny: error`)
   - [ ] Test files colocated next to source
   - [ ] Commit subjects follow conventional commits

4. **Launch `simplify` skill** on the changed files for a reuse/quality scan. Use the output as input to your review, not as a direct comment.

5. **CI status** — read the PR's latest checks. If red, summarize which jobs failed and the likely cause. If green, note it briefly.

6. **Produce the report** for the user with these sections:
   - **Summary**: one-sentence description of what the PR does
   - **Correctness**: any bugs, edge cases, missing error handling
   - **Conventions**: any violations from the audit above
   - **Tests**: coverage of new code, missing edge cases
   - **Reuse opportunities**: from the simplify pass
   - **CI**: green/red + failing job summary
   - **Verdict**: approve / request changes / comment-only

7. **Posting to GitHub** — only if truly warranted:
   - Use `mcp__github__pull_request_review_write` for a single bundled review (not drive-by comments)
   - One review, multiple line comments if needed
   - Never approve unless the user asked you to
   - Never post nits (whitespace, naming preferences, subjective style)
   - Always tell the user before posting

## Guardrails

- **Never merge the PR.** Merging is a human decision.
- **Never request copilot review** unless the user asks.
- **Never re-request review from users** — that's the author's job.
- **Read-only by default.** Posting is opt-in per-review and must be confirmed with the user unless they said "post the review" upfront.
