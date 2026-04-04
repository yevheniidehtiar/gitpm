# GitPM — Agent Setup Guide

> **For AI agents (Claude Code, etc.):** Follow these steps to install GitPM and migrate a project's GitHub Issues into a git-native `.meta/` project management tree.

## Prerequisites

- **Bun** runtime installed (`curl -fsSL https://bun.sh/install | bash`)
- **GITHUB_TOKEN** environment variable set with `repo` scope
- A Git repository with GitHub Issues you want to migrate

## Step 1: Install GitPM

```bash
# Clone GitPM into a temp location and build it
git clone https://github.com/yevheniidehtiar/gitpm.git /tmp/gitpm-install
cd /tmp/gitpm-install
bun install
bun run build

# Verify the CLI works
bun /tmp/gitpm-install/packages/cli/dist/index.js --help
```

**Important:** Use `bun` (not `node`) to run the CLI — it requires Bun's native fetch for reliable GitHub API connectivity.

## Step 2: Initialize .meta/ in Your Project

```bash
cd /path/to/your/project

# Option A: Import directly from GitHub (recommended)
bun /tmp/gitpm-install/packages/cli/dist/index.js import \
  --repo OWNER/REPO \
  --token "$GITHUB_TOKEN" \
  --meta-dir .meta

# Option B: Start fresh, then import
bun /tmp/gitpm-install/packages/cli/dist/index.js init my-project
bun /tmp/gitpm-install/packages/cli/dist/index.js import \
  --repo OWNER/REPO \
  --token "$GITHUB_TOKEN"
```

## Step 3: Validate the Import

```bash
bun /tmp/gitpm-install/packages/cli/dist/index.js validate --meta-dir .meta
```

Expected output: `✓ .meta/ tree is valid (N entities)`

## Step 4: Verify the File Structure

After import, your project will have:

```
your-project/
├── .meta/
│   ├── roadmap/
│   │   ├── roadmap.yaml          # Top-level roadmap referencing milestones
│   │   └── milestones/
│   │       └── v1-launch.md      # One file per GitHub Milestone
│   ├── epics/
│   │   └── feature-name/
│   │       ├── epic.md           # GitHub Issue with "epic" label
│   │       └── stories/
│   │           └── task-name.md  # GitHub Issues linked to this epic
│   ├── stories/
│   │   └── standalone-task.md    # Issues not linked to any epic
│   └── sync/
│       ├── github-config.yaml    # Sync configuration
│       └── github-state.json     # Sync state (hashes, timestamps)
```

## Step 5: Add to .gitignore (Optional)

The `.meta/` directory is meant to be committed to git. However, you may want to ignore the sync state:

```bash
# Add to .gitignore if you don't want sync state in version control
echo ".meta/sync/github-state.json" >> .gitignore
```

## Step 6: Set Up Ongoing Sync

```bash
# Pull latest changes from GitHub → local .meta/
bun /tmp/gitpm-install/packages/cli/dist/index.js pull \
  --meta-dir .meta \
  --token "$GITHUB_TOKEN"

# Push local .meta/ changes → GitHub
bun /tmp/gitpm-install/packages/cli/dist/index.js push \
  --meta-dir .meta \
  --token "$GITHUB_TOKEN" \
  --dry-run    # Preview first, remove for actual push

# Bidirectional sync
bun /tmp/gitpm-install/packages/cli/dist/index.js sync \
  --meta-dir .meta \
  --token "$GITHUB_TOKEN" \
  --strategy local-wins   # or remote-wins, ask
```

## .meta/ Entity Format Reference

### Story (.md file)

```yaml
---
type: story
id: abc123
title: Implement user authentication
status: todo          # todo | in_progress | in_review | done | cancelled | backlog
priority: high        # low | medium | high | critical
assignee: username
labels:
  - backend
  - security
estimate: null
epic_ref:
  id: epic-id-here    # Links to parent epic
github:
  issue_number: 42
  repo: owner/repo
  last_sync_hash: sha256:...
  synced_at: 2026-01-01T00:00:00Z
created_at: 2026-01-01T00:00:00Z
updated_at: 2026-01-01T00:00:00Z
---

The markdown body of the issue goes here.
Supports full GitHub-flavored markdown.
```

### Epic (.md file)

```yaml
---
type: epic
id: xyz789
title: Authentication System
status: in_progress
priority: high
owner: username
labels:
  - backend
milestone_ref:
  id: milestone-id    # Links to parent milestone
github:
  issue_number: 10
  repo: owner/repo
---

Epic description in markdown.
```

### Milestone (.md file)

```yaml
---
type: milestone
id: ms-001
title: v1.0 Launch
target_date: 2026-06-01T00:00:00Z
status: in_progress
github:
  milestone_id: 1
  repo: owner/repo
---

Milestone description.
```

### Roadmap (.yaml file)

```yaml
type: roadmap
id: rm-001
title: Product Roadmap
description: Main product roadmap
milestones:
  - id: ms-001
  - id: ms-002
updated_at: 2026-01-01T00:00:00Z
```

## Working with .meta/ Files

### As an AI Agent (Claude Code)

The `.meta/` tree is plain files — you can read, edit, and create entities directly:

```bash
# Read all stories
find .meta -name "*.md" -path "*/stories/*"

# Read a specific entity
cat .meta/epics/auth-system/epic.md

# Create a new story (write the file with correct frontmatter)
# Then validate:
bun /tmp/gitpm-install/packages/cli/dist/index.js validate --meta-dir .meta

# Push changes to GitHub:
bun /tmp/gitpm-install/packages/cli/dist/index.js push --meta-dir .meta --token "$GITHUB_TOKEN"
```

### With Git Worktrees + Claude Code

GitPM is designed for worktree workflows. Each worktree gets its own copy of `.meta/`:

```bash
# Create a worktree for a feature
git worktree add ../feature-branch feature-branch

# The .meta/ directory is available in the worktree
ls ../feature-branch/.meta/

# Claude Code can read/edit .meta/ files in the worktree
# Changes sync back when pushed to GitHub
```

### Status Values

| Status | Meaning |
|--------|---------|
| `backlog` | Not yet planned |
| `todo` | Planned, not started |
| `in_progress` | Actively being worked on |
| `in_review` | In code review / QA |
| `done` | Completed |
| `cancelled` | Won't do |

### Priority Values

| Priority | Meaning |
|----------|---------|
| `low` | Nice to have |
| `medium` | Normal priority |
| `high` | Important |
| `critical` | Blocking / urgent |

## Troubleshooting

### "Connect Timeout Error" on import

Use `bun` instead of `node` to run the CLI. Bun's native fetch handles GitHub API connectivity better than Node.js undici in some environments.

### Validation errors after import

Run `bun /tmp/gitpm-install/packages/cli/dist/index.js validate --meta-dir .meta` to see specific errors. Common issues:
- `UNRESOLVED_REF`: An entity references a non-existent ID. Usually fixed by re-importing.
- `DUPLICATE_ID`: Two entities share the same ID. Delete one.

### Sync conflicts

Use `--strategy` flag:
- `local-wins`: Your local .meta/ changes take priority
- `remote-wins`: GitHub changes take priority
- `ask`: Interactive prompt for each conflict (CLI only)
