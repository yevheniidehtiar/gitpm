package github

// Phase 2: GitHub sync adapter.
// Will replace packages/sync-github using google/go-github.
//
// Key components to port:
// - client.go — GitHub API wrapper with rate limiting and pagination
// - diff.go — field-level 3-way merge diffing
// - state.go — sync state persistence and content hashing
// - mapper.go — entity ↔ GitHub issue/milestone mapping
// - sync.go — bidirectional sync with checkpoint/resume
// - export.go — one-way push from .meta/ to GitHub
// - import.go — one-way import from GitHub to .meta/
