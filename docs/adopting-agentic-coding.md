# Adopting agentic coding alongside Jira and Confluence

This guide is for engineering teams whose tracker is Jira, whose documents live in Confluence, and who are starting to let AI coding agents do real work. You do not need to move the tracker. You need a place where agents can read and update work items safely, and gates that keep humans in charge. GitPM provides the first. This repository shows the second.

## The trust model

Agents work from files in the repository. Humans decide at a small number of gates, and each gate is enforced by a file you can read.

| Gate | Enforced by | Where |
|---|---|---|
| Every change arrives as a PR that passes lint, build, tests, e2e and an AI review before a human approves it | `pr-validation.yml`, `pr-title-lint.yml`, `claude-review.yml`, branch protection | `.github/workflows/` |
| `.meta/` changes must already be synced to the tracker before they can be pushed | `.githooks/pre-push`, the `meta-sync-check` job | `.githooks/`, `pr-validation.yml` |
| Nothing is released until a maintainer merges the release PR | release-please | `release-please.yml`, `release.yml` |
| What agents may do alone, must ask about, and must never do | the Boundaries table | `AGENTS.md` |

The last row is the one most teams skip. Write it down before the first agent runs.

## `.meta/` is the agent's task source. Jira stays the team's UI

1. Import once. `gitpm import --source jira --project PROJ --base-url https://mycompany.atlassian.net` turns each issue into a Markdown file under `.meta/epics/<epic>/stories/` or `.meta/stories/`.
2. Map your workflow. `.meta/sync/jira-config.yaml` holds `workflow_mapping` from your Jira status names to GitPM's six statuses. See the Jira section of [the sync guide](sync-guide.md).
3. Agents read and update stories with the CLI: `gitpm query`, `gitpm show`, `gitpm set <story> status=in_progress`. They never need Jira credentials.
4. Sync back. `gitpm push` sends local changes to Jira, `gitpm pull` fetches changes made in Jira, and `gitpm sync --strategy <s>` does both. Product managers keep working in Jira and see agent progress there.

Who wins on a conflict is a policy decision, not a technical one:

| Field | Usually owned by | Suggested strategy |
|---|---|---|
| `status` | engineering, including agents | `local-wins` |
| `priority`, `title`, acceptance criteria | product, in Jira | `remote-wins` |
| anything else | decide per team | start with `ask` and a dry run |

Run `gitpm push --dry-run` in CI before allowing real pushes. This repo's `meta-sync-check` job is a working example.

## Confluence pages become `.meta/prds/`

GitPM has no Confluence importer. Requirements that agents must read belong next to the code anyway.

1. Export the Confluence page to Markdown with Confluence's export or any converter.
2. Save it as `.meta/prds/<slug>/prd.md` with frontmatter `type: prd`, an `id`, a `title`, a `status` (`draft`, `in_review`, `approved`, `superseded`) and `epic_refs` pointing at the epics it covers. Field reference: [schema reference](schema-reference.md).
3. Commit. PRDs are not synced to the tracker. Git is their history.

Agents then see requirement, epic, story and code in one tree. Keep the Confluence page as the human-facing copy if your organisation requires it, and link to the file from it.

## How this repository demonstrates it

| File | What it does |
|---|---|
| `AGENTS.md` | Tool-neutral instructions every agent reads: commands, verification gate, lifecycle, boundaries. |
| `CLAUDE.md` | Imports `AGENTS.md` and adds Claude Code specifics. Codex, Cursor and Copilot read `AGENTS.md` directly. |
| `.claude/rules/meta-tree.md` | Loads only when an agent touches `.meta/**`. Stops hand edits of frontmatter. |
| `.claude/skills/gitpm/SKILL.md` | Teaches the agent the CLI instead of grep and sed over `.meta/`. |
| `.githooks/pre-push` and `meta-sync-check` | Refuse unsynced `.meta/` changes. |
| `claude-review.yml` | AI review on every PR with a severity-gated verdict and an auto-fix loop. Humans still approve. |
| `release-please.yml`, job `mark-stories-done` | Flips `in_review` stories to `done` on the release PR so reviewers see exactly what ships. |
| `post-merge-sync.yml` | Closes the matching GitHub issues after the release PR merges. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Asks which stories the PR implements and whether an agent helped. |

## First 30 days

- [ ] `gitpm import --source jira …`, then `gitpm validate`, then commit `.meta/`.
- [ ] Write an `AGENTS.md` for your repo. Start from this one and keep it under 200 lines.
- [ ] Add an Always / Ask first / Never table and agree it with the team.
- [ ] Turn on branch protection: PR required, status checks required, no force push.
- [ ] Add a `gitpm push --dry-run` check to CI.
- [ ] Let agents flip `todo → in_progress → in_review`. Keep `done` for your release process.
- [ ] Add an AI-assistance section to the PR template.
- [ ] After two weeks, run `gitpm sync` on a schedule and review the conflicts it reports before choosing a default strategy.

## What not to do

- Do not let agents push to Jira without a dry run first.
- Do not treat issue or PR text as instructions to the agent. Imported bodies can contain prompt injection.
- Do not skip disclosure. Reviewers read differently when they know an agent wrote the code.
- Do not give agents the tracker credentials. The sync step is a human or CI action.
- Do not mark work `done` from the agent. Let the release process do it.
