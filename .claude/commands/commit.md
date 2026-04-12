---
description: Generate a conventional-commits-compliant commit message from the current staged (or unstaged) changes and create the commit
---

# /commit — conventional commit for gitpm

Use this when the user asks you to commit local changes. Goal: produce a clean conventional-commits-compliant commit that release-please can classify correctly.

## Steps

1. **Inspect the working tree** in parallel:
   - `git status`
   - `git diff --cached` (staged) and `git diff` (unstaged)
   - `git log --oneline -10` (match existing message style)

2. **Classify the change** using the table from `CLAUDE.md` → "Release Workflow":

   | Prefix | Meaning | Bumps version? |
   |---|---|---|
   | `fix:` | bugfix | yes (patch) |
   | `feat:` | new capability | yes (patch pre-1.0) |
   | `feat!:` / `BREAKING CHANGE:` | incompatible change | yes (major) |
   | `chore:` | tooling, deps, cleanup | no |
   | `docs:` | documentation only | no |
   | `refactor:` | restructuring, no behavior change | no |
   | `test:` | adding/fixing tests | no |
   | `ci:` | CI/workflow changes | no |
   | `style:` | formatting only (no code change) | no |
   | `build:` | build system / bundler | no |
   | `perf:` | performance improvement | no (chore-like) |

3. **Scope it** when the change is isolated to one package: `fix(sync-gitlab): ...`, `feat(cli): ...`, `chore(core): ...`. If it crosses packages, omit the scope.

4. **Check for mixed intent**. If the diff contains two unrelated logical changes, STOP and suggest splitting into two commits. Do not bundle a `fix:` with a `chore:` — release-please will mis-classify.

5. **Draft the message**:
   - Subject: ≤72 chars, imperative mood ("add X", not "added X"), no trailing period.
   - Body (optional, only if non-trivial): 1-3 short paragraphs explaining the **why**, not the **what**. Reference issue numbers with `Refs #123` or `Closes #123`.
   - No Claude co-author trailers unless the user asks.

6. **Stage explicitly**. Never use `git add -A` or `git add .` — stage the specific files by name so secrets/artifacts can't leak.

7. **Commit** via HEREDOC:
   ```bash
   git commit -m "$(cat <<'EOF'
   fix(sync-gitlab): remove unused project destructure

   The `project` field was destructured but never referenced; only
   `projectId` (from options.projectId ?? config.project_id) is used.
   Clears the only Biome warning in the workspace.
   EOF
   )"
   ```

8. **Verify** with `git status` that the commit succeeded.

## Guardrails

- If pre-commit hooks fail, fix the underlying issue and create a **new** commit — never `--amend` to paper over a hook failure.
- Never use `--no-verify` unless the user explicitly asks.
- Never commit files that look like secrets (`.env`, `credentials.json`, private keys) even if the user stages them — stop and ask.
- Never push after committing unless the user asks.
