/**
 * In-memory demo API used when VITE_DEMO_MODE=1 (public GitHub Pages demo).
 *
 * - Reads come from a single bundled `demo-data.json` file fetched on first
 *   use and cached in a module-scoped variable.
 * - Writes mutate that in-memory clone only. No persistence — a page refresh
 *   re-fetches the JSON and rebuilds the module, wiping any changes.
 * - Sync routes are rejected with a friendly error so the real server's
 *   `/api/sync/*` handlers never run.
 *
 * This is the "guardrail" for the public demo: because nothing is shared
 * across visitors and nothing persists, there is no state anyone can destroy.
 */
import type {
  Entity,
  SyncStatusResponse,
  TreeResponse,
  ValidationResponse,
} from './api.js';

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1';

let treeState: TreeResponse | null = null;
let loadPromise: Promise<TreeResponse> | null = null;

async function loadInitial(): Promise<TreeResponse> {
  if (treeState) return treeState;
  if (!loadPromise) {
    const base = import.meta.env.BASE_URL || '/';
    const url = `${base}demo-data.json`.replace(/\/+/g, '/');
    loadPromise = fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load demo data: ${res.status}`);
        }
        return res.json() as Promise<TreeResponse>;
      })
      .then((data) => {
        treeState = data;
        return data;
      });
  }
  return loadPromise;
}

type EntityListKey = 'stories' | 'epics' | 'milestones' | 'roadmaps' | 'prds';
const ENTITY_LIST_KEYS: EntityListKey[] = [
  'stories',
  'epics',
  'milestones',
  'roadmaps',
  'prds',
];

function findEntity(
  tree: TreeResponse,
  id: string,
): { list: Entity[]; index: number; entity: Entity } | null {
  for (const key of ENTITY_LIST_KEYS) {
    const list = tree[key] as Entity[];
    const index = list.findIndex((e) => e.id === id);
    if (index >= 0) {
      return { list, index, entity: list[index] as Entity };
    }
  }
  return null;
}

function recalcCounts(tree: TreeResponse): void {
  tree.counts = {
    stories: tree.stories.length,
    epics: tree.epics.length,
    milestones: tree.milestones.length,
    roadmaps: tree.roadmaps.length,
    prds: tree.prds.length,
    errors: tree.errors.length,
  };
}

function typeToListKey(type: string): EntityListKey | null {
  switch (type) {
    case 'story':
      return 'stories';
    case 'epic':
      return 'epics';
    case 'milestone':
      return 'milestones';
    case 'roadmap':
      return 'roadmaps';
    case 'prd':
      return 'prds';
    default:
      return null;
  }
}

function generateId(type: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${type}-demo-${ts}${rand}`;
}

export async function demoFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const body =
    init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : null;

  const tree = await loadInitial();

  // GET /tree
  if (method === 'GET' && url === '/tree') {
    return tree as T;
  }

  // Entity CRUD
  if (url === '/entity' && method === 'POST') {
    const { type, title, ...rest } = (body ?? {}) as {
      type?: string;
      title?: string;
      [key: string]: unknown;
    };
    if (!type || !title) {
      throw new Error('type and title are required');
    }
    const listKey = typeToListKey(type);
    if (!listKey) {
      throw new Error(`Unknown type: ${type}`);
    }
    const now = new Date().toISOString();
    const newEntity: Entity = {
      type,
      id: generateId(type),
      title,
      body: typeof rest.body === 'string' ? rest.body : '',
      filePath: `.meta/${listKey}/demo-${Date.now()}.md`,
      created_at: now,
      updated_at: now,
      status: (rest.status as string) ?? 'backlog',
      priority: (rest.priority as string) ?? 'medium',
      labels: (rest.labels as string[]) ?? [],
      ...(rest as Partial<Entity>),
    };
    (tree[listKey] as Entity[]).push(newEntity);
    recalcCounts(tree);
    return newEntity as T;
  }

  const entityIdMatch = url.match(/^\/entity\/(.+)$/);
  if (entityIdMatch) {
    const id = decodeURIComponent(entityIdMatch[1] as string);
    const found = findEntity(tree, id);

    if (method === 'GET') {
      if (!found) throw new Error('Not found');
      return found.entity as T;
    }

    if (method === 'PUT') {
      if (!found) throw new Error('Not found');
      const updates = (body ?? {}) as Partial<Entity>;
      const merged: Entity = {
        ...found.entity,
        ...updates,
        id: found.entity.id,
        type: found.entity.type,
        updated_at: new Date().toISOString(),
      };
      found.list[found.index] = merged;
      return merged as T;
    }

    if (method === 'DELETE') {
      if (!found) throw new Error('Not found');
      found.list.splice(found.index, 1);
      recalcCounts(tree);
      return undefined as T;
    }
  }

  // Validation — always clean in demo mode
  if (method === 'GET' && url === '/validate') {
    const response: ValidationResponse = {
      valid: true,
      errors: [],
      warnings: [],
    };
    return response as T;
  }

  // Sync — disabled
  if (method === 'GET' && url === '/sync/status') {
    const response: SyncStatusResponse = {
      configured: false,
      message: 'Demo mode — GitHub sync is disabled',
    };
    return response as T;
  }

  if (method === 'POST' && url.startsWith('/sync/')) {
    throw new Error('Sync is disabled in the public demo');
  }

  throw new Error(`Demo API: unhandled route ${method} ${url}`);
}
