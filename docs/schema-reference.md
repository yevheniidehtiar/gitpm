# Schema Reference

All project management data in GitPM is stored as files in the `.meta/` directory. Each entity is a Markdown file with YAML frontmatter, validated against Zod schemas at runtime.

## Directory Structure

```
.meta/
├── roadmap/
│   ├── roadmap.yaml                    # Roadmap definition (YAML only)
│   └── milestones/
│       └── <milestone-slug>.md         # Milestone entities
├── epics/
│   └── <epic-slug>/
│       ├── epic.md                     # Epic entity
│       └── stories/
│           └── <story-slug>.md         # Stories belonging to this epic
├── stories/                            # Standalone stories (no parent epic)
│   └── <story-slug>.md
├── prds/
│   └── <prd-slug>/
│       └── prd.md                      # Product Requirements Document
└── sync/
    ├── github-config.yaml              # Sync configuration
    ├── gitlab-config.yaml              # GitLab sync configuration
    └── github-state.json               # Sync state (auto-managed, do not edit)
```

## Common Types

These types are shared across all entity schemas.

### Status

All entities use the same status progression:

| Value | Description |
|-------|-------------|
| `backlog` | Not yet prioritized |
| `todo` | Prioritized, ready to start |
| `in_progress` | Actively being worked on |
| `in_review` | Work complete, under review |
| `done` | Completed |
| `cancelled` | Will not be done |

### Priority

| Value | Description |
|-------|-------------|
| `low` | Nice to have |
| `medium` | Standard priority |
| `high` | Important |
| `critical` | Must be done immediately |

### EntityRef

A reference to another entity, used for cross-linking (e.g., a story referencing its parent epic):

```yaml
epic_ref:
  id: "a1b2c3d4e5f6"
  path: "epics/my-epic/epic.md"   # optional, resolved at read-time
```

### EntityId

A unique string identifier, typically a 12-character [nanoid](https://github.com/ai/nanoid). Example: `"a1b2c3d4e5f6"`.

---

## Story

The basic unit of work. Stories can belong to an epic or stand alone.

**File locations:**
- Under an epic: `.meta/epics/<epic-slug>/stories/<story-slug>.md`
- Standalone: `.meta/stories/<story-slug>.md`

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"story"` | Yes | Entity type (literal) |
| `id` | string | Yes | Unique entity ID |
| `title` | string | Yes | Story title |
| `status` | Status | Yes | Current status |
| `priority` | Priority | Yes | Priority level |
| `assignee` | string \| null | No | Assigned person |
| `labels` | string[] | No | Tags/labels (default: `[]`) |
| `estimate` | number \| null | No | Story points |
| `epic_ref` | EntityRef \| null | No | Reference to parent epic |
| `github` | object \| null | No | GitHub sync metadata |
| `gitlab` | object \| null | No | GitLab sync metadata |
| `jira` | object \| null | No | Jira sync metadata |
| `created_at` | string | No | ISO 8601 creation timestamp |
| `updated_at` | string | No | ISO 8601 update timestamp |

### Example

```markdown
---
type: story
id: "a1b2c3d4e5f6"
title: "Implement real-time price feed ingestion"
status: in_progress
priority: high
assignee: "john"
labels: [backend, data-pipeline]
estimate: 5
epic_ref:
  id: "x9y8z7w6v5u4"
github:
  issue_number: 42
  repo: "org/repo"
  last_sync_hash: "sha256:abc123..."
  synced_at: "2026-03-15T10:00:00Z"
created_at: "2026-03-01T09:00:00Z"
updated_at: "2026-03-15T10:00:00Z"
---

## Description

Connect to the EPEX SPOT API and ingest real-time day-ahead and intraday prices.

## Acceptance Criteria

- Prices are ingested every 15 minutes
- Data is stored in TimescaleDB
- Alerting on feed failures within 5 minutes
```

---

## Epic

A collection of related stories representing a larger body of work.

**File location:** `.meta/epics/<epic-slug>/epic.md`

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"epic"` | Yes | Entity type (literal) |
| `id` | string | Yes | Unique entity ID |
| `title` | string | Yes | Epic title |
| `status` | Status | Yes | Current status |
| `priority` | Priority | Yes | Priority level |
| `owner` | string \| null | No | Owning team or person |
| `labels` | string[] | No | Tags/labels (default: `[]`) |
| `milestone_ref` | EntityRef \| null | No | Reference to parent milestone |
| `github` | object \| null | No | GitHub sync metadata |
| `gitlab` | object \| null | No | GitLab sync metadata |
| `jira` | object \| null | No | Jira sync metadata |
| `created_at` | string | No | ISO 8601 creation timestamp |
| `updated_at` | string | No | ISO 8601 update timestamp |

Child stories are stored in the `stories/` subdirectory and are automatically linked via the resolver.

### Example

```markdown
---
type: epic
id: "x9y8z7w6v5u4"
title: "Balancing Engine v1"
status: in_progress
priority: critical
owner: "dmytro"
labels: [core, q2-2026]
milestone_ref:
  id: "ms_q2_launch"
github:
  issue_number: 10
  repo: "org/repo"
  last_sync_hash: "sha256:def456..."
  synced_at: "2026-03-15T10:00:00Z"
created_at: "2026-02-15T09:00:00Z"
updated_at: "2026-03-15T10:00:00Z"
---

## Goals

Build the core balancing engine that optimizes energy portfolio dispatch.

## Scope

- Real-time price ingestion
- Optimization solver
- Dispatch API
```

---

## Milestone

A release target or time-based goal that groups epics together.

**File location:** `.meta/roadmap/milestones/<milestone-slug>.md`

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"milestone"` | Yes | Entity type (literal) |
| `id` | string | Yes | Unique entity ID |
| `title` | string | Yes | Milestone title |
| `target_date` | string | No | ISO 8601 date (e.g., `"2026-06-30"`) |
| `status` | Status | Yes | Current status |
| `github` | object \| null | No | GitHub sync metadata |
| `gitlab` | object \| null | No | GitLab sync metadata |
| `jira` | object \| null | No | Jira sync metadata |
| `created_at` | string | No | ISO 8601 creation timestamp |
| `updated_at` | string | No | ISO 8601 update timestamp |

Epics are linked to milestones via their `milestone_ref` field. The resolver populates the reverse reference automatically.

### Example

```markdown
---
type: milestone
id: "ms_q2_launch"
title: "Q2 2026 — Production Launch"
target_date: "2026-06-30"
status: in_progress
github:
  milestone_id: 3
  repo: "org/repo"
  last_sync_hash: "sha256:ghi789..."
  synced_at: "2026-03-15T10:00:00Z"
created_at: "2026-01-10T09:00:00Z"
updated_at: "2026-03-15T10:00:00Z"
---

## Key Objectives

- Launch balancing engine to production
- Complete forecasting module
- Achieve 99.9% uptime SLA
```

---

## Roadmap

The top-level entity that aggregates milestones into an ordered sequence. This is the only YAML-only entity (no Markdown body).

**File location:** `.meta/roadmap/roadmap.yaml`

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"roadmap"` | Yes | Entity type (literal) |
| `id` | string | Yes | Unique entity ID |
| `title` | string | Yes | Roadmap title |
| `description` | string | No | Brief description |
| `milestones` | EntityRef[] | No | Ordered list of milestone references |
| `updated_at` | string | No | ISO 8601 update timestamp |

### Example

```yaml
type: roadmap
id: "rm_main"
title: "Product Roadmap 2026"
description: "Main product roadmap"
milestones:
  - id: "ms_q2_launch"
  - id: "ms_q3_scale"
  - id: "ms_q4_enterprise"
updated_at: "2026-03-15T10:00:00Z"
```

---

## PRD (Product Requirements Document)

Long-form product documentation that references epics. PRDs are **not synced** to GitHub/GitLab Issues — they exist only in the `.meta/` tree.

**File location:** `.meta/prds/<prd-slug>/prd.md`

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"prd"` | Yes | Entity type (literal) |
| `id` | string | Yes | Unique entity ID |
| `title` | string | Yes | PRD title |
| `status` | Status | Yes | Typically: `draft`, `in_review`, `approved`, `superseded` |
| `owner` | string \| null | No | Document owner |
| `epic_refs` | EntityRef[] | No | Related epics |
| `created_at` | string | No | ISO 8601 creation timestamp |
| `updated_at` | string | No | ISO 8601 update timestamp |

### Example

```markdown
---
type: prd
id: "prd_balancing_v1"
title: "Balancing Engine v1 — Product Requirements"
status: approved
owner: "dmytro"
epic_refs:
  - id: "ep_balancing"
  - id: "ep_forecasting"
created_at: "2026-02-01T09:00:00Z"
updated_at: "2026-03-10T14:00:00Z"
---

## Problem Statement

...

## Proposed Solution

...
```

---

## Sync Metadata

When an entity is synced with a remote platform, sync metadata is stored in the frontmatter. This metadata is managed automatically by the sync engine.

### GitHub Sync

```yaml
github:
  issue_number: 42           # GitHub Issue number
  project_item_id: "PVTI_x"  # GitHub Project item ID (optional)
  milestone_id: 3             # GitHub Milestone ID (milestones only)
  repo: "owner/repo"          # Repository
  last_sync_hash: "sha256:…"  # Content hash at last sync
  synced_at: "2026-03-15T…"   # ISO 8601 timestamp of last sync
```

### GitLab Sync

```yaml
gitlab:
  issue_iid: 42              # GitLab Issue IID
  epic_iid: 5                # GitLab Epic IID (epics only)
  milestone_id: 3             # GitLab Milestone ID
  project_id: 123             # GitLab Project ID
  base_url: "https://gitlab.com"
  last_sync_hash: "sha256:…"
  synced_at: "2026-03-15T…"
```

### Jira Sync

```yaml
jira:
  issue_key: "PROJ-42"       # Jira Issue key
  project_key: "PROJ"        # Jira Project key
  sprint_id: 10              # Jira Sprint ID (optional)
  site: "mycompany.atlassian.net"
  last_sync_hash: "sha256:…"
  synced_at: "2026-03-15T…"
```

---

## Naming Conventions

File and directory names use **kebab-case** derived from the entity title:

1. Lowercase the title
2. Replace spaces and special characters with hyphens
3. Remove consecutive hyphens
4. Trim hyphens from start/end
5. Truncate to 60 characters max

Examples:
- `"Implement Real-Time Price Feed"` becomes `implement-real-time-price-feed.md`
- `"Q2 2026 — Production Launch"` becomes `q2-2026-production-launch.md`
