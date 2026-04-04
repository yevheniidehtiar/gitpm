# GitPM Entity Schemas Reference

This document defines the exact file format for every entity type in the `.meta/` directory. All entities use Markdown files with YAML frontmatter. Implement these as Zod schemas in `packages/core/src/schemas/`.

---

## Common Types

These types are shared across all entity schemas.

```typescript
// Unique identifier — use nanoid(12) for generation
type EntityId = string; // e.g., "a1b2c3d4e5f6"

// Status progression (universal across entity types)
type Status = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';

// Priority levels
type Priority = 'low' | 'medium' | 'high' | 'critical';

// Reference to another entity
interface EntityRef {
  id: EntityId;
  path?: string; // relative path within .meta/, resolved at read-time
}

// GitHub sync metadata (present only on synced entities)
interface GitHubSync {
  issue_number?: number;
  project_item_id?: string;
  milestone_id?: number;
  repo: string;              // "owner/repo"
  last_sync_hash: string;    // content hash at last sync
  synced_at: string;         // ISO 8601
}
```

---

## Story

**File location**: `/.meta/epics/<epic-slug>/stories/<story-slug>.md` or `/.meta/stories/<story-slug>.md` (orphan)

**Frontmatter**:
```yaml
---
type: story
id: "a1b2c3d4e5f6"
title: "Implement real-time price feed ingestion"
status: in_progress
priority: high
assignee: "john"
labels:
  - backend
  - data-pipeline
estimate: 5           # story points (optional)
epic_ref:             # nullable — links to parent epic
  id: "x9y8z7w6v5u4"
github:               # nullable — present only if synced
  issue_number: 42
  repo: "org/repo"
  last_sync_hash: "abc123"
  synced_at: "2026-03-15T10:00:00Z"
created_at: "2026-03-01T09:00:00Z"
updated_at: "2026-03-15T10:00:00Z"
---
```

**Body** (below frontmatter): Free-form markdown description. This maps to the GitHub Issue body.

**Example file** (`/.meta/epics/balancing-engine/stories/price-feed-ingestion.md`):
```markdown
---
type: story
id: "st_price_feed"
title: "Implement real-time price feed ingestion"
status: in_progress
priority: high
assignee: "john"
labels: [backend, data-pipeline]
estimate: 5
epic_ref:
  id: "ep_balancing"
created_at: "2026-03-01T09:00:00Z"
updated_at: "2026-03-15T10:00:00Z"
---

## Description

Connect to the EPEX SPOT API and ingest real-time day-ahead and intraday prices.

## Acceptance Criteria

- Prices are ingested every 15 minutes
- Data is stored in TimescaleDB
- Alerting on feed failures within 5 minutes
- Backfill capability for the last 30 days
```

---

## Epic

**File location**: `/.meta/epics/<epic-slug>/epic.md`

**Frontmatter**:
```yaml
---
type: epic
id: "x9y8z7w6v5u4"
title: "Balancing Engine v1"
status: in_progress
priority: critical
owner: "dmytro"
labels:
  - core
  - q2-2026
milestone_ref:        # nullable — links to parent milestone
  id: "ms_q2_launch"
github:               # nullable
  issue_number: 10
  repo: "org/repo"
  last_sync_hash: "def456"
  synced_at: "2026-03-15T10:00:00Z"
created_at: "2026-02-15T09:00:00Z"
updated_at: "2026-03-15T10:00:00Z"
---
```

**Body**: Epic description, goals, scope, and any high-level technical notes.

**Resolved fields** (populated by the resolver, not stored in file):
- `stories: Story[]` — all stories whose `epic_ref.id` matches this epic's `id`.

---

## Milestone

**File location**: `/.meta/roadmap/milestones/<milestone-slug>.md`

**Frontmatter**:
```yaml
---
type: milestone
id: "ms_q2_launch"
title: "Q2 2026 — Production Launch"
target_date: "2026-06-30"
status: in_progress
github:               # nullable
  milestone_id: 3
  repo: "org/repo"
  last_sync_hash: "ghi789"
  synced_at: "2026-03-15T10:00:00Z"
created_at: "2026-01-10T09:00:00Z"
updated_at: "2026-03-15T10:00:00Z"
---
```

**Body**: Milestone description, key objectives, success criteria.

**Resolved fields**:
- `epics: Epic[]` — all epics whose `milestone_ref.id` matches this milestone's `id`.

---

## Roadmap

**File location**: `/.meta/roadmap/roadmap.yaml`

This is the only YAML-only entity (no markdown body needed).

```yaml
type: roadmap
id: "rm_main"
title: "GitPM Product Roadmap"
description: "Main product roadmap for 2026"
milestones:
  - id: "ms_q2_launch"
  - id: "ms_q3_scale"
  - id: "ms_q4_enterprise"
updated_at: "2026-03-15T10:00:00Z"
```

**Resolved fields**:
- `milestones: Milestone[]` — resolved from milestone refs.

---

## PRD (Product Requirements Document)

**File location**: `/.meta/prds/<prd-slug>/prd.md`

**Frontmatter**:
```yaml
---
type: prd
id: "prd_balancing_v1"
title: "Balancing Engine v1 — Product Requirements"
status: approved       # draft | in_review | approved | superseded
owner: "dmytro"
epic_refs:
  - id: "ep_balancing"
  - id: "ep_forecasting"
created_at: "2026-02-01T09:00:00Z"
updated_at: "2026-03-10T14:00:00Z"
---
```

**Body**: The full PRD document in markdown. This is expected to be long-form and detailed. PRDs are not synced to GitHub Issues — they are documentation-only entities that reference epics.

---

## Directory Structure Convention

```
/.meta/
├── roadmap/
│   ├── roadmap.yaml                    # The roadmap definition
│   └── milestones/
│       ├── q2-2026-launch.md
│       └── q3-2026-scale.md
├── prds/
│   ├── balancing-engine-v1/
│   │   └── prd.md
│   └── forecasting-module/
│       └── prd.md
├── epics/
│   ├── balancing-engine/
│   │   ├── epic.md
│   │   └── stories/
│   │       ├── price-feed-ingestion.md
│   │       ├── optimization-solver.md
│   │       └── dispatch-api.md
│   └── forecasting/
│       ├── epic.md
│       └── stories/
│           ├── weather-data-pipeline.md
│           └── ml-model-training.md
├── stories/                             # Orphan stories (no epic)
│   └── setup-ci-pipeline.md
└── sync/
    ├── github-config.yaml               # Sync configuration
    └── github-state.json                # Sync state (auto-managed)
```

### Naming Conventions

File names use kebab-case derived from the entity title. The slug generation function should handle: lowercasing, replacing spaces and special characters with hyphens, removing consecutive hyphens, trimming hyphens from start/end, truncating to 60 characters max.

---

## Sync Configuration File

**File location**: `/.meta/sync/github-config.yaml`

```yaml
repo: "org/repo-name"
project_number: 5                        # GitHub Project (v2) number, optional
status_mapping:                          # GitHub Project status → GitPM status
  "Todo": "todo"
  "In Progress": "in_progress"
  "In Review": "in_review"
  "Done": "done"
  "Backlog": "backlog"
label_mapping:                           # optional: label-based rules
  epic_labels: ["epic", "theme"]         # issues with these labels → Epic type
auto_sync: false                         # reserved for future webhook-based sync
```

---

## Sync State File

**File location**: `/.meta/sync/github-state.json`

```json
{
  "repo": "org/repo-name",
  "project_number": 5,
  "last_sync": "2026-03-15T10:00:00Z",
  "entities": {
    "st_price_feed": {
      "github_issue_number": 42,
      "github_project_item_id": "PVTI_abc123",
      "local_hash": "sha256:abc...",
      "remote_hash": "sha256:def...",
      "synced_at": "2026-03-15T10:00:00Z"
    }
  }
}
```

This file is auto-managed by the sync engine. It should be committed to Git (so all team members share sync state) but users should never edit it manually. Add a comment header in the JSON noting this.

---

## Content Hash Specification

The content hash is used for change detection during sync. It must be deterministic and only include semantically meaningful fields (not metadata like `synced_at`).

Hash algorithm: SHA-256 of a canonical JSON string.

For a Story entity, the hashed content is:
```json
{
  "title": "...",
  "status": "...",
  "priority": "...",
  "assignee": "...",
  "labels": ["...", "..."],
  "body": "..."
}
```

Sort object keys alphabetically. Sort arrays. Normalize whitespace in body (trim, collapse multiple newlines to double). This ensures the hash is stable regardless of YAML serialization order or minor formatting changes.
