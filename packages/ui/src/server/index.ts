import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { ParsedEntity, Priority, ResolvedTree, Status } from '@gitpm/core';
import {
  parseTree,
  resolveRefs,
  toSlug,
  validateTree,
  writeFile,
} from '@gitpm/core';
import type {
  FieldConflict,
  GitHubConfig,
  Resolution,
  SyncState,
} from '@gitpm/sync-github';
import {
  exportToGitHub,
  loadConfig,
  loadState,
  syncWithGitHub,
} from '@gitpm/sync-github';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export function createApp(metaDir: string) {
  const app = new Hono();

  app.use('/api/*', cors());

  async function getResolvedTree(): Promise<ResolvedTree> {
    const parseResult = await parseTree(metaDir);
    if (!parseResult.ok) throw new Error(parseResult.error.message);
    const resolveResult = resolveRefs(parseResult.value);
    if (!resolveResult.ok) throw new Error(resolveResult.error.message);
    return resolveResult.value;
  }

  function findEntity(
    tree: ResolvedTree,
    id: string,
  ): ParsedEntity | undefined {
    for (const list of [
      tree.stories,
      tree.epics,
      tree.milestones,
      tree.roadmaps,
      tree.prds,
    ]) {
      const found = (list as ParsedEntity[]).find((e) => e.id === id);
      if (found) return found;
    }
    return undefined;
  }

  // GET /api/tree
  app.get('/api/tree', async (c) => {
    try {
      const tree = await getResolvedTree();
      return c.json({
        ...tree,
        counts: {
          stories: tree.stories.length,
          epics: tree.epics.length,
          milestones: tree.milestones.length,
          roadmaps: tree.roadmaps.length,
          prds: tree.prds.length,
          errors: tree.errors.length,
        },
      });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // GET /api/entity/:id
  app.get('/api/entity/:id', async (c) => {
    try {
      const tree = await getResolvedTree();
      const entity = findEntity(tree, c.req.param('id'));
      if (!entity) return c.json({ error: 'Not found' }, 404);
      return c.json(entity);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // PUT /api/entity/:id
  app.put('/api/entity/:id', async (c) => {
    try {
      const tree = await getResolvedTree();
      const entity = findEntity(tree, c.req.param('id'));
      if (!entity) return c.json({ error: 'Not found' }, 404);

      const updates = await c.req.json();
      const merged = {
        ...entity,
        ...updates,
        id: entity.id,
        type: entity.type,
      };
      merged.updated_at = new Date().toISOString();

      const result = await writeFile(merged as ParsedEntity, entity.filePath);
      if (!result.ok) return c.json({ error: result.error.message }, 500);

      return c.json(merged);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // POST /api/entity
  app.post('/api/entity', async (c) => {
    try {
      const body = await c.req.json();
      const { type, title, ...rest } = body as {
        type: string;
        title: string;
        [key: string]: unknown;
      };

      if (!type || !title) {
        return c.json({ error: 'type and title are required' }, 400);
      }

      const id = `${type}-${Date.now().toString(36)}`;
      const slug = toSlug(title);
      const now = new Date().toISOString();

      let filePath: string;
      let entity: ParsedEntity;

      const base = {
        id,
        title,
        body: (rest.body as string) || '',
        created_at: now,
        updated_at: now,
      };

      switch (type) {
        case 'story':
          filePath = join(metaDir, 'stories', `${slug}.md`);
          entity = {
            ...base,
            type: 'story',
            status: (rest.status as Status) || 'backlog',
            priority: (rest.priority as Priority) || 'medium',
            assignee: (rest.assignee as string) || null,
            labels: (rest.labels as string[]) || [],
            estimate: null,
            epic_ref: rest.epic_ref || null,
            filePath,
          } as ParsedEntity;
          break;
        case 'epic':
          filePath = join(metaDir, 'epics', `${slug}.md`);
          entity = {
            ...base,
            type: 'epic',
            status: (rest.status as Status) || 'backlog',
            priority: (rest.priority as Priority) || 'medium',
            owner: (rest.owner as string) || null,
            labels: (rest.labels as string[]) || [],
            milestone_ref: rest.milestone_ref || null,
            filePath,
          } as ParsedEntity;
          break;
        case 'milestone':
          filePath = join(metaDir, 'milestones', `${slug}.md`);
          entity = {
            ...base,
            type: 'milestone',
            status: (rest.status as Status) || 'backlog',
            target_date: (rest.target_date as string) || undefined,
            filePath,
          } as ParsedEntity;
          break;
        case 'prd':
          filePath = join(metaDir, 'prds', `${slug}.md`);
          entity = {
            ...base,
            type: 'prd',
            status: (rest.status as Status) || 'backlog',
            owner: (rest.owner as string) || '',
            filePath,
          } as ParsedEntity;
          break;
        default:
          return c.json({ error: `Unknown type: ${type}` }, 400);
      }

      const result = await writeFile(entity, filePath);
      if (!result.ok) return c.json({ error: result.error.message }, 500);

      return c.json({ ...entity, filePath }, 201);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // DELETE /api/entity/:id
  app.delete('/api/entity/:id', async (c) => {
    try {
      const tree = await getResolvedTree();
      const entity = findEntity(tree, c.req.param('id'));
      if (!entity) return c.json({ error: 'Not found' }, 404);

      await unlink(entity.filePath);
      return c.body(null, 204);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // GET /api/validate
  app.get('/api/validate', async (c) => {
    try {
      const tree = await getResolvedTree();
      const result = validateTree(tree);
      return c.json(result);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // GET /api/sync/status
  app.get('/api/sync/status', async (c) => {
    try {
      const configResult = await loadConfig(metaDir);
      if (!configResult.ok) {
        return c.json({
          configured: false,
          message: 'No GitHub sync configured',
        });
      }

      const stateResult = await loadState(metaDir);
      const state: SyncState | null = stateResult.ok ? stateResult.value : null;

      const tree = await getResolvedTree();
      const allEntities: ParsedEntity[] = [
        ...tree.stories,
        ...tree.epics,
        ...tree.milestones,
      ];

      const entities = allEntities.map((e) => {
        const entry = state?.entities[e.id];
        let syncStatus = 'not_synced';
        if (entry) {
          syncStatus = 'in_sync';
        }
        return {
          id: e.id,
          title: e.title,
          type: e.type,
          status: 'status' in e ? e.status : undefined,
          syncStatus,
          lastSynced: entry?.synced_at,
        };
      });

      return c.json({
        configured: true,
        repo: configResult.value.repo,
        lastSync: state?.last_sync ?? null,
        entities,
      });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // POST /api/sync/push
  app.post('/api/sync/push', async (c) => {
    try {
      const { token } = await c.req.json();
      if (!token) return c.json({ error: 'token is required' }, 400);

      const configResult = await loadConfig(metaDir);
      if (!configResult.ok)
        return c.json({ error: 'No sync config found' }, 400);

      const config = configResult.value;
      const result = await exportToGitHub({
        token,
        repo: config.repo,
        projectNumber: config.project_number,
        metaDir,
      });
      if (!result.ok) return c.json({ error: result.error.message }, 500);
      return c.json(result.value);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // POST /api/sync/pull
  app.post('/api/sync/pull', async (c) => {
    try {
      const { token } = await c.req.json();
      if (!token) return c.json({ error: 'token is required' }, 400);

      const configResult = await loadConfig(metaDir);
      if (!configResult.ok)
        return c.json({ error: 'No sync config found' }, 400);

      const config = configResult.value;
      const result = await syncWithGitHub({
        token,
        repo: config.repo,
        projectNumber: config.project_number,
        metaDir,
        strategy: 'remote-wins',
      });
      if (!result.ok) return c.json({ error: result.error.message }, 500);
      return c.json(result.value);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // POST /api/sync/sync
  app.post('/api/sync/sync', async (c) => {
    try {
      const { token } = await c.req.json();
      if (!token) return c.json({ error: 'token is required' }, 400);

      const configResult = await loadConfig(metaDir);
      if (!configResult.ok)
        return c.json({ error: 'No sync config found' }, 400);

      const config = configResult.value;
      const result = await syncWithGitHub({
        token,
        repo: config.repo,
        projectNumber: config.project_number,
        metaDir,
        strategy: 'local-wins',
      });
      if (!result.ok) return c.json({ error: result.error.message }, 500);
      return c.json(result.value);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // POST /api/sync/resolve
  app.post('/api/sync/resolve', async (c) => {
    try {
      const { resolutions } = (await c.req.json()) as {
        resolutions: Resolution[];
      };
      if (!resolutions || !Array.isArray(resolutions)) {
        return c.json({ error: 'resolutions array is required' }, 400);
      }
      // In a real implementation, we'd apply the resolutions to the entities
      // For now, acknowledge receipt
      return c.json({ applied: resolutions.length });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  return app;
}
