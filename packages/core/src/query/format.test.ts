import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ParsedEntity } from '../parser/types.js';
import { formatEntities } from './format.js';

const mockEntities: ParsedEntity[] = [
  {
    type: 'story',
    id: 'st_001',
    title: 'First story',
    status: 'todo',
    priority: 'high',
    labels: ['frontend', 'responsive'],
    body: '',
    filePath: '/project/.meta/stories/first-story.md',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  } as ParsedEntity,
  {
    type: 'story',
    id: 'st_002',
    title: 'Second story',
    status: 'done',
    priority: 'low',
    labels: [],
    epic_ref: { id: 'ep_001' },
    body: '',
    filePath: '/project/.meta/epics/my-epic/stories/second-story.md',
    created_at: '2026-01-03T00:00:00Z',
    updated_at: '2026-01-04T00:00:00Z',
  } as ParsedEntity,
];

describe('formatEntities', () => {
  describe('json format', () => {
    it('outputs valid JSON with requested fields', () => {
      const output = formatEntities(mockEntities, {
        fields: ['id', 'title', 'status'],
        format: 'json',
      });
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        id: 'st_001',
        title: 'First story',
        status: 'todo',
      });
      expect(parsed[1]).toEqual({
        id: 'st_002',
        title: 'Second story',
        status: 'done',
      });
    });

    it('outputs empty array for no entities', () => {
      const output = formatEntities([], {
        fields: ['id', 'title'],
        format: 'json',
      });
      expect(JSON.parse(output)).toEqual([]);
    });
  });

  describe('csv format', () => {
    it('outputs CSV with header and rows', () => {
      const output = formatEntities(mockEntities, {
        fields: ['id', 'title', 'status'],
        format: 'csv',
      });
      const lines = output.split('\n');
      expect(lines[0]).toBe('id,title,status');
      expect(lines[1]).toBe('st_001,First story,todo');
      expect(lines[2]).toBe('st_002,Second story,done');
    });

    it('quotes values containing commas', () => {
      const entities: ParsedEntity[] = [
        {
          type: 'story',
          id: 'st_003',
          title: 'Story with, comma',
          status: 'todo',
          priority: 'medium',
          labels: [],
          body: '',
          filePath: '/project/.meta/stories/story.md',
        } as ParsedEntity,
      ];
      const output = formatEntities(entities, {
        fields: ['id', 'title'],
        format: 'csv',
      });
      const lines = output.split('\n');
      expect(lines[1]).toBe('st_003,"Story with, comma"');
    });
  });

  describe('table format', () => {
    it('outputs formatted table with header and separator', () => {
      const output = formatEntities(mockEntities, {
        fields: ['id', 'title', 'status'],
        format: 'table',
      });
      const lines = output.split('\n');
      expect(lines[0]).toContain('ID');
      expect(lines[0]).toContain('TITLE');
      expect(lines[0]).toContain('STATUS');
      expect(lines[1]).toMatch(/^-+/); // separator line
      expect(lines[2]).toContain('st_001');
      expect(lines[2]).toContain('First story');
    });

    it('returns message for empty entities', () => {
      const output = formatEntities([], {
        fields: ['id', 'title'],
        format: 'table',
      });
      expect(output).toBe('No matching entities found.');
    });
  });

  describe('field extraction', () => {
    it('extracts labels as comma-separated string', () => {
      const output = formatEntities(mockEntities, {
        fields: ['id', 'labels'],
        format: 'json',
      });
      const parsed = JSON.parse(output);
      expect(parsed[0].labels).toBe('frontend, responsive');
      expect(parsed[1].labels).toBe('');
    });

    it('extracts epic_ref as ID', () => {
      const output = formatEntities(mockEntities, {
        fields: ['id', 'epic_ref'],
        format: 'json',
      });
      const parsed = JSON.parse(output);
      expect(parsed[0].epic_ref).toBe('');
      expect(parsed[1].epic_ref).toBe('ep_001');
    });

    it('handles null/undefined fields gracefully', () => {
      const output = formatEntities(mockEntities, {
        fields: ['id', 'estimate'],
        format: 'json',
      });
      const parsed = JSON.parse(output);
      expect(parsed[0].estimate).toBe('');
    });

    it('extracts filePath relative to cwd', () => {
      const absolutePath = join(process.cwd(), 'pkg', 'story.md');
      const entities: ParsedEntity[] = [
        {
          type: 'story',
          id: 'st_fp',
          title: 'Path story',
          status: 'todo',
          priority: 'medium',
          labels: [],
          body: '',
          filePath: absolutePath,
        } as ParsedEntity,
      ];
      const output = formatEntities(entities, {
        fields: ['id', 'filePath'],
        format: 'json',
      });
      const parsed = JSON.parse(output);
      expect(parsed[0].filePath).toBe(join('pkg', 'story.md'));
    });

    it('extracts milestone_ref as ID', () => {
      const entities: ParsedEntity[] = [
        {
          type: 'epic',
          id: 'ep_ms',
          title: 'Epic with milestone',
          status: 'todo',
          priority: 'medium',
          labels: [],
          milestone_ref: { id: 'ms_001' },
          body: '',
          filePath: '/project/.meta/epics/e/epic.md',
        } as ParsedEntity,
        {
          type: 'epic',
          id: 'ep_no_ms',
          title: 'Epic without milestone',
          status: 'todo',
          priority: 'medium',
          labels: [],
          body: '',
          filePath: '/project/.meta/epics/e2/epic.md',
        } as ParsedEntity,
      ];
      const output = formatEntities(entities, {
        fields: ['id', 'milestone_ref'],
        format: 'json',
      });
      const parsed = JSON.parse(output);
      expect(parsed[0].milestone_ref).toBe('ms_001');
      expect(parsed[1].milestone_ref).toBe('');
    });

    it('returns empty string for labels on entity types without a labels array', () => {
      const roadmap: ParsedEntity[] = [
        {
          type: 'roadmap',
          id: 'rm_1',
          title: 'Roadmap',
          description: '',
          milestones: [],
          filePath: '/project/.meta/roadmap.yaml',
        } as ParsedEntity,
      ];
      const output = formatEntities(roadmap, {
        fields: ['id', 'labels'],
        format: 'json',
      });
      const parsed = JSON.parse(output);
      expect(parsed[0].labels).toBe('');
    });
  });
});
