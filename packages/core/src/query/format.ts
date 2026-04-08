import { relative } from 'node:path';
import type { ParsedEntity } from '../parser/types.js';

export interface FormatOptions {
  fields: string[];
  format: 'table' | 'json' | 'csv';
  cwd?: string;
}

function getField(entity: ParsedEntity, field: string): string {
  if (field === 'filePath' && entity.filePath) {
    return relative(process.cwd(), entity.filePath);
  }
  if (field === 'epic_ref') {
    const ref = (entity as Record<string, unknown>).epic_ref as
      | { id: string }
      | null
      | undefined;
    return ref?.id ?? '';
  }
  if (field === 'milestone_ref') {
    const ref = (entity as Record<string, unknown>).milestone_ref as
      | { id: string }
      | null
      | undefined;
    return ref?.id ?? '';
  }
  if (field === 'labels') {
    const labels = (entity as Record<string, unknown>).labels;
    if (Array.isArray(labels)) return labels.join(', ');
    return '';
  }
  const val = (entity as Record<string, unknown>)[field];
  if (val === null || val === undefined) return '';
  return String(val);
}

export function formatEntities(
  entities: ParsedEntity[],
  options: FormatOptions,
): string {
  const { fields, format } = options;

  if (format === 'json') {
    const rows = entities.map((e) => {
      const row: Record<string, string> = {};
      for (const f of fields) {
        row[f] = getField(e, f);
      }
      return row;
    });
    return JSON.stringify(rows, null, 2);
  }

  if (format === 'csv') {
    const header = fields.join(',');
    const rows = entities.map((e) =>
      fields
        .map((f) => {
          const val = getField(e, f);
          return val.includes(',') || val.includes('"')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        })
        .join(','),
    );
    return [header, ...rows].join('\n');
  }

  // Table format
  if (entities.length === 0) {
    return 'No matching entities found.';
  }

  const widths: number[] = fields.map((f) => f.length);
  const rows = entities.map((e) =>
    fields.map((f, i) => {
      const val = getField(e, f);
      if (val.length > widths[i]) widths[i] = Math.min(val.length, 60);
      return val;
    }),
  );

  const header = fields
    .map((f, i) => f.toUpperCase().padEnd(widths[i]))
    .join('  ');
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');
  const body = rows
    .map((row) =>
      row
        .map((val, i) => {
          const truncated = val.length > 60 ? `${val.slice(0, 57)}...` : val;
          return truncated.padEnd(widths[i]);
        })
        .join('  '),
    )
    .join('\n');

  return `${header}\n${separator}\n${body}`;
}
