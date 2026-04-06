---
type: story
id: rXZaoWj9VnLl
title: "Fix XSS in MarkdownPreview: sanitize HTML in entity-editor.tsx"
status: todo
priority: high
assignee: null
labels:
  - security
  - bug
  - ui
estimate: null
epic_ref:
  id: bZoJF6Th8vEU
github:
  issue_number: 73
  repo: yevheniidehtiar/gitpm
  synced_at: 2026-04-06T12:53:26.000Z
created_at: 2026-04-06T00:00:00Z
updated_at: 2026-04-06T00:00:00Z
---

## Problem
The `MarkdownPreview` component in `packages/ui/src/routes/entity-editor.tsx` (lines ~388-407) uses `dangerouslySetInnerHTML` with naive regex-based markdown-to-HTML conversion. While basic `<`, `>`, `&` escaping is applied before transformations, the regex replacements can re-introduce injectable patterns.

## Proposed Solution
Either:
1. **Preferred:** Replace regex-based rendering with `marked` or `markdown-it` library + `DOMPurify` sanitization pass
2. **Minimum:** Wrap output with `DOMPurify.sanitize()` before setting innerHTML

## Acceptance Criteria
- [ ] No XSS possible via markdown content in entity bodies
- [ ] Markdown rendering still supports headers, bold, italic, code, links, lists
- [ ] Add unit test with XSS payload to verify sanitization

## Dependencies
- This MUST land before story #40 (markdown preview/split view enhancement)

## Impact
Security vulnerability fix. Exploitable in current UI.
