---
name: gitpm
description: Use when working with .meta/ project management entities (stories, epics, milestones, roadmaps, PRDs) in a project that uses GitPM. Provides commands to query, filter, read, update fields, create, move, and commit entities without manual file parsing. Prefer these over grep/read/Edit on .meta/ files.
---

# gitpm — Project management via .meta/ files

This project uses [GitPM](https://github.com/yevheniidehtiar/gitpm) to manage project management data (stories, epics, milestones, roadmaps, PRDs) as files under `.meta/`. Entities are Markdown files with YAML frontmatter, synced bidirectionally with GitHub Issues.

## When to use the `gitpm` CLI vs reading files directly

**Prefer `gitpm` commands** — they are 10× fewer tool calls than grep+read+Edit loops and validate writes against the schema:

| Goal | Use |
|---|---|
| Find tasks by status / priority / label / epic | `gitpm query` |
| Display one entity (or an epic + its stories) | `gitpm show` |
| Update a frontmatter field (status, priority, labels, assignee) | `gitpm set` |
| Create a new story / epic / milestone | `gitpm create` |
| Move a story between epics (or to/from orphan) | `gitpm move` |
| Stage + commit all .meta/ changes atomically | `gitpm commit` |
| Push local .meta/ to GitHub Issues | `gitpm push` |
| Pull GitHub Issues into local .meta/ | `gitpm pull` |
| Bidirectional sync | `gitpm sync` |
| Validate the whole tree | `gitpm validate` |

**Avoid** `grep` / `cat` / `Edit` directly on `.meta/*.md` unless you truly need a raw view. The CLI preserves frontmatter ordering, validates against Zod schemas, and keeps GitHub sync state consistent.

## Common recipes

### Find all in-progress stories
```bash
gitpm query --type story --status in_progress
```

### Find high/critical stories across all types
```bash
gitpm query --priority high,critical --format table
```

### Show an epic and every story under it
```bash
gitpm show --epic auth-system
```

### Show a specific story with its full body
```bash
gitpm show .meta/epics/auth/stories/login.md --full
```

### Change a story's status to in_progress
```bash
gitpm set .meta/epics/auth/stories/login.md status=in_progress
```

### Append labels (array operation)
```bash
gitpm set .meta/stories/onboarding.md labels+=backend labels+=security
```

### Remove a label
```bash
gitpm set .meta/stories/onboarding.md labels-=stale
```

### Create a new story under an existing epic
```bash
gitpm create story \
  --title "Add OAuth callback handler" \
  --epic auth-system \
  --priority high \
  --labels backend,oauth
```

### Create a standalone story (no epic)
```bash
gitpm create story --title "Flaky test in checkout" --priority medium
```

### Move a story from orphan into an epic
```bash
gitpm move .meta/stories/orphan.md --to-epic auth-system
```

### Commit all .meta/ changes
```bash
gitpm commit -m "feat(pm): progress auth-system stories"
```

### Push local changes to GitHub Issues
```bash
gitpm push --token "$GITHUB_TOKEN"
```

## Field update syntax for `gitpm set`

| Syntax | Effect |
|---|---|
| `field=value` | Replace the value |
| `field+=value` | Append to an array field (labels, dependencies) |
| `field-=value` | Remove from an array field |
| `field=null` | Clear the value |

Multiple assignments in one call are applied atomically:
```bash
gitpm set .meta/stories/auth.md status=in_progress assignee=alice labels+=urgent
```

## Entity layout

```
.meta/
├── roadmap/
│   ├── roadmap.yaml              # top-level roadmap
│   └── milestones/*.md           # milestones
├── epics/
│   └── <slug>/
│       ├── epic.md               # the epic
│       └── stories/*.md          # stories nested under this epic
├── stories/*.md                  # orphan stories (no epic)
├── prds/*.md                     # product requirements docs
└── sync/
    ├── github-config.yaml
    └── github-state.json
```

## Allowed field values

- **status**: `backlog` · `todo` · `in_progress` · `in_review` · `done` · `cancelled`
- **priority**: `low` · `medium` · `high` · `critical`

## After modifying .meta/ files

Always run `gitpm push` so GitHub Issues stay in sync:

```bash
gitpm push --token "$GITHUB_TOKEN"
```

Use `gitpm sync --strategy local-wins` when you have both local edits and remote changes.

## Story lifecycle (three-state flow)

Stories move through four states tied to the release pipeline:

```
todo ──► in_progress ──► in_review ──► done
```

**You are responsible for the first two transitions only** — the release-please
CI job promotes `in_review` → `done` automatically, and `post-merge-sync.yml`
closes the GitHub issue once the release PR merges.

| Transition | Who | When |
|---|---|---|
| `todo` → `in_progress` | **You** | Before writing any code for the story |
| `in_progress` → `in_review` | **You** | Inside the work PR itself, committed with the code |
| `in_review` → `done` | release-please bot | When the release PR is created/updated |
| GitHub issue closes | post-merge-sync bot | After the release PR merges |

**Rule 1 — When you start work on a story, flip it to in_progress:**
```bash
gitpm set .meta/epics/<epic>/stories/<story>.md status=in_progress
```

**Rule 2 — When you raise the PR that implements the story, do two things in the same PR:**

1. Flip the story's status in the diff:
   ```bash
   gitpm set .meta/epics/<epic>/stories/<story>.md status=in_review
   ```
2. Reference the story file path(s) in the PR body under "Related GitPM stories" (the PR template has a section for it).

**Do NOT manually set status=done or close GitHub issues** — both are handled by CI. Setting `status=done` yourself short-circuits the release PR audit surface.

If a PR has no `.meta/` story (docs, tooling, typo fix): skip both rules. CI will find 0 `in_review` stories and exit cleanly.

## Help

- `gitpm --help` — list all commands
- `gitpm <command> --help` — flags for a specific command
- `gitpm validate` — run before committing to catch schema errors
