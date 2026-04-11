import { describe, expect, it } from 'vitest';
import type { ParsedEntity } from '../schemas/index.js';
import { applyAssignments, parseAssignment } from './set-fields.js';

describe('prototype pollution guard', () => {
  it('parseAssignment accepts __proto__ as syntactically valid', () => {
    const result = parseAssignment('__proto__.polluted=true');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      field: '__proto__.polluted',
      operator: '=',
      value: 'true',
    });
  });

  it('applyAssignments rejects __proto__ in nested path', () => {
    const entity: ParsedEntity = {
      type: 'story',
      id: 'test_id',
      title: 'Test story',
      status: 'backlog',
      priority: 'medium',
      labels: [],
      body: '',
      filePath: '/tmp/test.md',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const result = applyAssignments(entity, [
      { field: '__proto__.polluted', operator: '=', value: 'true' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Dangerous field name');
    expect(result.error.message).toContain('prototype pollution');
  });

  it('applyAssignments rejects constructor as field name', () => {
    const entity: ParsedEntity = {
      type: 'story',
      id: 'test_id',
      title: 'Test story',
      status: 'backlog',
      priority: 'medium',
      labels: [],
      body: '',
      filePath: '/tmp/test.md',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const result = applyAssignments(entity, [
      { field: 'constructor', operator: '=', value: 'evil' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Dangerous field name');
  });

  it('applyAssignments rejects prototype as field name', () => {
    const entity: ParsedEntity = {
      type: 'story',
      id: 'test_id',
      title: 'Test story',
      status: 'backlog',
      priority: 'medium',
      labels: [],
      body: '',
      filePath: '/tmp/test.md',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const result = applyAssignments(entity, [
      { field: 'prototype.polluted', operator: '=', value: 'true' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Dangerous field name');
  });
});

describe('parseAssignment', () => {
  it('parses simple set assignment', () => {
    const result = parseAssignment('priority=high');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      field: 'priority',
      operator: '=',
      value: 'high',
    });
  });

  it('parses += assignment', () => {
    const result = parseAssignment('labels+=frontend');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      field: 'labels',
      operator: '+=',
      value: 'frontend',
    });
  });

  it('parses -= assignment', () => {
    const result = parseAssignment('labels-=legacy');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      field: 'labels',
      operator: '-=',
      value: 'legacy',
    });
  });

  it('parses dotted field names', () => {
    const result = parseAssignment('epic_ref.id=ABC123');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      field: 'epic_ref.id',
      operator: '=',
      value: 'ABC123',
    });
  });

  it('handles empty value', () => {
    const result = parseAssignment('assignee=');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      field: 'assignee',
      operator: '=',
      value: '',
    });
  });

  it('rejects invalid expressions', () => {
    const result = parseAssignment('no-equals-sign');
    expect(result.ok).toBe(false);
  });
});

describe('applyAssignments', () => {
  const baseStory: ParsedEntity = {
    type: 'story',
    id: 'test_id',
    title: 'Test story',
    status: 'backlog',
    priority: 'medium',
    labels: ['frontend'],
    body: '## Description\n\nTest body',
    filePath: '/tmp/test.md',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('sets a simple field', () => {
    const result = applyAssignments(baseStory, [
      { field: 'priority', operator: '=', value: 'high' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type === 'story' && result.value.priority).toBe('high');
  });

  it('sets multiple fields at once', () => {
    const result = applyAssignments(baseStory, [
      { field: 'priority', operator: '=', value: 'critical' },
      { field: 'status', operator: '=', value: 'todo' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const story = result.value as typeof baseStory;
    expect(story.priority).toBe('critical');
    expect(story.status).toBe('todo');
  });

  it('adds to an array with +=', () => {
    const result = applyAssignments(baseStory, [
      { field: 'labels', operator: '+=', value: 'responsive' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const story = result.value as typeof baseStory;
    expect(story.labels).toEqual(['frontend', 'responsive']);
  });

  it('removes from an array with -=', () => {
    const result = applyAssignments(baseStory, [
      { field: 'labels', operator: '-=', value: 'frontend' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const story = result.value as typeof baseStory;
    expect(story.labels).toEqual([]);
  });

  it('sets a nested field with dot notation', () => {
    const result = applyAssignments(baseStory, [
      { field: 'epic_ref.id', operator: '=', value: 'ep_test' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const story = result.value as typeof baseStory;
    expect((story as Record<string, unknown>).epic_ref).toEqual({
      id: 'ep_test',
    });
  });

  it('sets null via string "null"', () => {
    const storyWithEpic = {
      ...baseStory,
      epic_ref: { id: 'ep_old' },
    };
    const result = applyAssignments(storyWithEpic, [
      { field: 'epic_ref', operator: '=', value: 'null' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value as Record<string, unknown>).epic_ref).toBeNull();
  });

  it('auto-updates updated_at', () => {
    const before = new Date().toISOString();
    const result = applyAssignments(baseStory, [
      { field: 'priority', operator: '=', value: 'high' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const updatedAt = (result.value as Record<string, unknown>)
      .updated_at as string;
    expect(updatedAt >= before).toBe(true);
  });

  it('rejects invalid field values via Zod', () => {
    const result = applyAssignments(baseStory, [
      { field: 'status', operator: '=', value: 'invalid_status' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Validation failed');
  });

  it('fails += on non-array field', () => {
    const result = applyAssignments(baseStory, [
      { field: 'priority', operator: '+=', value: 'high' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('non-array');
  });

  it('preserves body content', () => {
    const result = applyAssignments(baseStory, [
      { field: 'priority', operator: '=', value: 'high' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value as Record<string, unknown>).body).toBe(
      '## Description\n\nTest body',
    );
  });

  it('rejects top-level __proto__ assignment without polluting prototype', () => {
    const before = ({} as Record<string, unknown>).polluted;
    const result = applyAssignments(baseStory, [
      { field: '__proto__', operator: '=', value: 'polluted' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Dangerous field name');
    // Confirm no pollution leaked
    expect(({} as Record<string, unknown>).polluted).toBe(before);
  });

  it('does not leak prototype pollution via intermediate object creation', () => {
    // Ensure Object.prototype is not polluted after a legitimate nested set
    applyAssignments(baseStory, [
      { field: 'epic_ref.id', operator: '=', value: 'safe_value' },
    ]);
    expect(({} as Record<string, unknown>).id).toBeUndefined();
    expect(({} as Record<string, unknown>).safe_value).toBeUndefined();
  });
});
