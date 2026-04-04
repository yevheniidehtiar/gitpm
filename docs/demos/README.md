# GitPM — Phase Demo Gallery

Interactive demos showing each phase of GitPM's implementation with real terminal output, code examples, and usage instructions.

## Demos

| Phase | Name | Status | Tests | Link |
|-------|------|--------|-------|------|
| **0** | Scaffold Monorepo | Complete | N/A | [View Demo](./phase-0-demo.md) |
| **1** | @gitpm/core — Schema Engine | Complete | 55 passed | [View Demo](./phase-1-demo.md) |
| **2** | @gitpm/cli — Init & Validate | Pending | — | — |
| **3** | @gitpm/sync-github — Import | Complete | 42 passed | [View Demo](./phase-3-demo.md) |
| **4** | @gitpm/sync-github — Export & Sync | Complete | 32 passed | [View Demo](./phase-4-demo.md) |
| **5** | @gitpm/cli — Sync Commands | Complete | 129 passed | [View Demo](./phase-5-demo.md) |
| **6** | @gitpm/ui — Web Interface | Complete | 129 passed | [View Demo](./phase-6-demo.md) |

## How to Generate Demos

Use the `/demo-phase` skill in Claude Code:

```bash
# Generate demo for a specific phase
/demo-phase 1

# Generate demos for all completed phases
/demo-phase
```

Each demo includes:
- Architecture diagrams
- Key code excerpts with explanations
- Real terminal output (build, test, lint)
- Step-by-step usage instructions
- Preview of the next phase
