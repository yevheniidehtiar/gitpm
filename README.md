# GitPM

Git-native project management — store roadmaps, PRDs, epics, and issues as structured files in your monorepo, with bidirectional GitHub/GitLab sync and a local web UI. Built for AI-agentic workflows where code and project context live in one traversable file tree.

## What is GitPM?

GitPM turns your repository's `.meta/` directory into a full project management system. Roadmaps, epics, stories, and milestones are stored as Markdown files with YAML frontmatter — editable by humans, parseable by AI agents, and kept in bidirectional sync with GitHub, GitLab, or Jira.

## Why GitPM?

**AI-agentic development with full project context.** Your roadmap, epics, and tasks live as files in the repo — right next to the code. AI agents (Claude Code, Cursor, Copilot, custom agents) can read the entire project context from `.meta/` without any API calls. Works fully offline, in air-gapped environments, and on isolated networks with restricted access. The LLM sees what needs to be built, what's in progress, and what's done — all from the file tree.

**Let AI handle project management overhead.** Use Claude (or any LLM) to create, enrich, and resolve issues directly by editing `.meta/` files. Draft stories from a one-line description, auto-generate acceptance criteria, break epics into stories, update statuses as work completes — then sync to GitHub/GitLab/Jira in one command. Saves hours of PM bureaucracy per sprint.

**Single source of truth across tools.** Teams often split between GitHub Issues, Jira, spreadsheets, and Notion. GitPM unifies everything into version-controlled files that sync bidirectionally with your tracker. No more stale tickets or context scattered across tools.

**Code and project context in one PR.** When a developer opens a pull request, the `.meta/` changes travel with the code. Reviewers see *what* changed and *why* (the story/epic update) in the same diff. Branch-based project management becomes natural.

**Auditable project history via Git.** Every status change, priority update, and scope modification is a Git commit. You get full blame, diff, and log history on your project management data — something no SaaS tool provides natively.

**Offline-first for field teams and contractors.** Teams in low-connectivity environments (field engineering, defense, on-prem deployments) can manage their project boards locally and sync when connectivity is available. No always-on SaaS dependency.

## Quick Start

```bash
# Install the CLI with the sync adapter(s) you need
npm install -g @gitpm/cli @gitpm/sync-github

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

## Installation

Install the CLI and only the sync adapters you need — each platform adapter is a separate optional package:

```bash
# GitHub only
npm install -g @gitpm/cli @gitpm/sync-github

# GitLab only
npm install -g @gitpm/cli @gitpm/sync-gitlab

# Jira only
npm install -g @gitpm/cli @gitpm/sync-jira

# Multiple platforms
npm install -g @gitpm/cli @gitpm/sync-github @gitpm/sync-jira
```

Adapters are auto-detected at runtime — no extra configuration needed. The CLI discovers which adapters are installed and uses the one matching your `.meta/sync/` config.

## Key Features

- **File-based project management** — roadmaps, epics, stories, milestones, and PRDs as Markdown + YAML frontmatter in `.meta/`
- **Bidirectional sync** — keep `.meta/` in sync with GitHub Issues, GitLab Issues, or Jira
- **Plugin architecture** — install only the sync adapters you need; write custom adapters for any platform
- **CLI-first** — six commands cover the full workflow: `init`, `validate`, `import`, `push`, `pull`, `sync`
- **Local web UI** — browse, edit, and visualize your project tree with a React-based interface
- **AI-agent friendly** — structured files in your repo give AI agents full project context
- **Schema-validated** — all entities are validated with Zod schemas; catch errors before they hit your tracker
- **Custom schema extensions** — add project-specific fields (story points, team, etc.) via `.meta/.gitpm/schema-extensions.yaml`
- **Lifecycle hooks** — run scripts before/after import, export, or sync operations
- **Conflict resolution** — field-level diffing with `local-wins`, `remote-wins`, or interactive `ask` strategies

## CLI Commands

| Command | Description |
|---------|-------------|
| `gitpm init [name]` | Scaffold a new `.meta/` directory |
| `gitpm validate` | Validate the `.meta/` tree against schemas |
| `gitpm import --source <platform>` | Import from GitHub, GitLab, or Jira into `.meta/` |
| `gitpm push` | Push local `.meta/` changes to the remote platform |
| `gitpm pull` | Pull remote changes into local `.meta/` |
| `gitpm sync` | Bidirectional sync between `.meta/` and the remote |

Global options: `--meta-dir <path>` (default: `.meta`), `--token <token>`, `--adapter <name>`

See the full [CLI Reference](docs/cli-reference.md) for detailed usage and examples.

## Plugin System

GitPM uses a plugin architecture for sync adapters. Each platform (GitHub, GitLab, Jira) is a separate package that implements the `SyncAdapter` interface.

### Configuration

Optionally create a `gitpm.config.ts` (or `.js`/`.json`) in your project root to customize adapter loading and add lifecycle hooks:

```typescript
// gitpm.config.ts
export default {
  adapters: [
    '@gitpm/sync-github',
    '@gitpm/sync-jira',
    './custom-adapter.ts',    // local custom adapter
  ],
  hooks: {
    'pre-sync': './scripts/validate.ts',
    'post-import': './scripts/notify.ts',
  },
};
```

If no config file exists, GitPM auto-discovers installed adapter packages.

### Custom Adapters

Write your own sync adapter by implementing the `SyncAdapter` interface from `@gitpm/core`:

```typescript
import type { SyncAdapter } from '@gitpm/core';

export const myAdapter: SyncAdapter = {
  name: 'my-platform',
  displayName: 'My Platform',
  async detect(metaDir) { /* check if configured */ },
  async import(options) { /* import from remote */ },
  async export(options) { /* export to remote */ },
  async sync(options) { /* bidirectional sync */ },
};
```

### Schema Extensions

Extend entity schemas with project-specific custom fields by creating `.meta/.gitpm/schema-extensions.yaml`:

```yaml
story:
  fields:
    story_points:
      type: number
      required: false
    team:
      type: string
      enum: [platform, frontend, backend, infra]
epic:
  fields:
    department:
      type: string
      required: false
```

Custom fields are validated during parsing, preserved through sync, and appear in entity frontmatter.

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
