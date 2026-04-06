# GitPM

Git-native project management — store roadmaps, PRDs, epics, and issues as structured files in your monorepo, with bidirectional GitHub/GitLab sync and a local web UI. Built for AI-agentic workflows where code and project context live in one traversable file tree.

## What is GitPM?

GitPM turns your repository's `.meta/` directory into a full project management system. Roadmaps, epics, stories, and milestones are stored as Markdown files with YAML frontmatter — editable by humans, parseable by AI agents, and kept in bidirectional sync with GitHub, GitLab, or Jira.

## Quick Start

```bash
# Install
bun install -g gitpm

# Initialize a new .meta/ tree in your repo
gitpm init my-project

# Or import an existing GitHub project
export GITHUB_TOKEN="ghp_..."
gitpm import --repo owner/repo

# Validate the .meta/ tree
gitpm validate

# Edit files in .meta/ (or use the web UI)
gitpm dev:ui

# Push local changes to GitHub
gitpm push

# Pull remote changes
gitpm pull

# Full bidirectional sync
gitpm sync
```

## Key Features

- **File-based project management** — roadmaps, epics, stories, milestones, and PRDs as Markdown + YAML frontmatter in `.meta/`
- **Bidirectional sync** — keep `.meta/` in sync with GitHub Issues, GitLab Issues, or Jira
- **CLI-first** — six commands cover the full workflow: `init`, `validate`, `import`, `push`, `pull`, `sync`
- **Local web UI** — browse, edit, and visualize your project tree with a React-based interface
- **AI-agent friendly** — structured files in your repo give AI agents full project context
- **Schema-validated** — all entities are validated with Zod schemas; catch errors before they hit your tracker
- **Conflict resolution** — field-level diffing with `local-wins`, `remote-wins`, or interactive `ask` strategies

## CLI Commands

| Command | Description |
|---------|-------------|
| `gitpm init [name]` | Scaffold a new `.meta/` directory |
| `gitpm validate` | Validate the `.meta/` tree against schemas |
| `gitpm import` | Import from GitHub or GitLab into `.meta/` |
| `gitpm push` | Push local `.meta/` changes to the remote platform |
| `gitpm pull` | Pull remote changes into local `.meta/` |
| `gitpm sync` | Bidirectional sync between `.meta/` and the remote |

Global options: `--meta-dir <path>` (default: `.meta`), `--token <token>`

See the full [CLI Reference](docs/cli-reference.md) for detailed usage and examples.

## The `.meta/` Directory

```
.meta/
├── roadmap/
│   ├── roadmap.yaml              # Roadmap definition
│   └── milestones/
│       └── q2-2026-launch.md     # Milestone
├── epics/
│   └── my-epic/
│       ├── epic.md               # Epic
│       └── stories/
│           └── my-story.md       # Story (under epic)
├── stories/
│   └── standalone-task.md        # Story (standalone)
├── prds/
│   └── my-prd/
│       └── prd.md                # Product Requirements Document
└── sync/
    ├── github-config.yaml        # Sync configuration
    └── github-state.json         # Sync state (auto-managed)
```

Each entity is a Markdown file with YAML frontmatter containing structured fields like `type`, `id`, `title`, `status`, `priority`, and sync metadata.

See the full [Schema Reference](docs/schema-reference.md) for all entity types and fields.

## Sync

GitPM keeps `.meta/` files and your issue tracker in bidirectional sync:

1. **Import** — pull your existing GitHub/GitLab issues into `.meta/` files
2. **Edit** — modify files locally (or via the web UI)
3. **Push** — send local changes to the remote platform
4. **Pull** — fetch remote changes into local files
5. **Sync** — bidirectional merge with conflict resolution

The sync engine uses content hashing for change detection and supports field-level conflict resolution.

See the full [Sync Configuration Guide](docs/sync-guide.md) for setup and customization.

## Web UI

GitPM includes a local web interface for browsing and editing your project tree:

```bash
bun run dev:ui
```

Features:
- **Tree browser** — search, filter, and sort entities by status, type, priority, or assignee
- **Entity editor** — form-based frontmatter editing with a Markdown body editor
- **Roadmap timeline** — visual timeline of milestones and epics
- **Sync dashboard** — view sync status and trigger push/pull/sync operations

## Documentation

| Document | Description |
|----------|-------------|
| [CLI Reference](docs/cli-reference.md) | Detailed command reference with examples |
| [Schema Reference](docs/schema-reference.md) | Entity types, frontmatter fields, directory conventions |
| [Sync Configuration Guide](docs/sync-guide.md) | Setup, configuration, conflict resolution |
| [Architecture Overview](docs/architecture.md) | System design, packages, conventions (for contributors) |
| [Migration Guide](docs/migration-guide.md) | Migrating from GitHub Issues, GitLab, or Jira |

## Contributing

```bash
# Clone and install
git clone https://github.com/yevheniidehtiar/gitpm.git
cd gitpm
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Lint
bun run lint

# Start the UI dev server
bun run dev:ui
```

See the [Architecture Overview](docs/architecture.md) for package structure, code conventions, and testing strategy.

## License

MIT
