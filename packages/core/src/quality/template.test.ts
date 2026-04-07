import { describe, expect, it } from 'vitest';
import { checkTemplateCoverage, hasChecklist } from './template.js';

describe('checkTemplateCoverage', () => {
  it('matches all required sections', () => {
    const body = `
## Motivation
Some motivation text.

## Acceptance Criteria
- Must do X
`;
    const result = checkTemplateCoverage(
      body,
      ['Motivation', 'Acceptance Criteria'],
      0.5,
    );
    expect(result.matched).toEqual(['Motivation', 'Acceptance Criteria']);
    expect(result.missing).toEqual([]);
    expect(result.coverage).toBe(1);
    expect(result.passes).toBe(true);
  });

  it('detects partial matches', () => {
    const body = `
## Motivation
Some text.

## Implementation Details
More text.
`;
    const result = checkTemplateCoverage(
      body,
      ['Motivation', 'Acceptance Criteria', 'Testing'],
      0.5,
    );
    expect(result.matched).toEqual(['Motivation']);
    expect(result.missing).toEqual(['Acceptance Criteria', 'Testing']);
    expect(result.coverage).toBeCloseTo(1 / 3);
    expect(result.passes).toBe(false);
  });

  it('passes when coverage meets threshold', () => {
    const body = `
## Motivation
Text.
`;
    const result = checkTemplateCoverage(
      body,
      ['Motivation', 'Acceptance Criteria'],
      0.5,
    );
    expect(result.coverage).toBe(0.5);
    expect(result.passes).toBe(true);
  });

  it('matches headings case-insensitively', () => {
    const body = `
## MOTIVATION
Loud heading.

## acceptance criteria
Lowercase heading.
`;
    const result = checkTemplateCoverage(
      body,
      ['Motivation', 'Acceptance Criteria'],
      0.5,
    );
    expect(result.matched).toEqual(['Motivation', 'Acceptance Criteria']);
    expect(result.coverage).toBe(1);
  });

  it('handles empty required sections', () => {
    const result = checkTemplateCoverage('some body', [], 0.5);
    expect(result.passes).toBe(true);
    expect(result.coverage).toBe(1);
  });

  it('handles body with no headings', () => {
    const result = checkTemplateCoverage(
      'Just plain text with no headings.',
      ['Motivation'],
      0.5,
    );
    expect(result.matched).toEqual([]);
    expect(result.missing).toEqual(['Motivation']);
    expect(result.passes).toBe(false);
  });

  it('matches substrings in headings', () => {
    const body = '## 1. Motivation and Background\n';
    const result = checkTemplateCoverage(body, ['Motivation'], 0.5);
    expect(result.matched).toEqual(['Motivation']);
  });
});

describe('hasChecklist', () => {
  it('detects unchecked items', () => {
    expect(hasChecklist('- [ ] First item')).toBe(true);
  });

  it('detects checked items', () => {
    expect(hasChecklist('- [x] Done item')).toBe(true);
  });

  it('detects uppercase X', () => {
    expect(hasChecklist('- [X] Done item')).toBe(true);
  });

  it('returns false for no checklist', () => {
    expect(hasChecklist('Just a list:\n- item one\n- item two')).toBe(false);
  });

  it('returns false for empty body', () => {
    expect(hasChecklist('')).toBe(false);
  });
});
