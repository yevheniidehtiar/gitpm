import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEMO_MODE, demoFetch } from './demoApi.js';

const BASE = '/api';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  if (DEMO_MODE) {
    return demoFetch<T>(url, init);
  }
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as T;
}

// --- Tree ---

export interface TreeResponse {
  stories: Entity[];
  epics: Entity[];
  milestones: Entity[];
  roadmaps: Entity[];
  prds: Entity[];
  errors: { filePath: string; message: string }[];
  counts: Record<string, number>;
}

export interface Entity {
  type: string;
  id: string;
  title: string;
  status?: string;
  priority?: string;
  assignee?: string | null;
  owner?: string | null;
  labels?: string[];
  estimate?: number | null;
  epic_ref?: { id: string; path?: string } | null;
  milestone_ref?: { id: string; path?: string } | null;
  target_date?: string;
  github?: {
    issue_number?: number;
    repo: string;
    synced_at: string;
  } | null;
  body: string;
  filePath: string;
  created_at?: string;
  updated_at?: string;
  // resolved fields
  resolvedStories?: Entity[];
  resolvedEpic?: Entity;
  resolvedMilestone?: Entity;
  resolvedEpics?: Entity[];
  resolvedMilestones?: Entity[];
}

export function useTree() {
  return useQuery<TreeResponse>({
    queryKey: ['tree'],
    queryFn: () => fetchJson('/tree'),
    refetchOnWindowFocus: true,
  });
}

export function useEntity(id: string) {
  return useQuery<Entity>({
    queryKey: ['entity', id],
    queryFn: () => fetchJson(`/entity/${id}`),
    enabled: !!id,
  });
}

export function useUpdateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Entity> }) =>
      fetchJson<Entity>(`/entity/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['tree'] });
      qc.invalidateQueries({ queryKey: ['entity', vars.id] });
    },
  });
}

export function useCreateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type: string;
      title: string;
      [key: string]: unknown;
    }) =>
      fetchJson<Entity>('/entity', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tree'] });
    },
  });
}

export function useDeleteEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/entity/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tree'] });
    },
  });
}

// --- Progress ---

export interface EpicProgress {
  epicId: string;
  title: string;
  status: string;
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  progress: number;
}

export interface MilestoneProgress {
  milestoneId: string;
  title: string;
  targetDate?: string;
  epics: EpicProgress[];
  total: number;
  done: number;
  progress: number;
}

export interface ProjectProgress {
  milestones: MilestoneProgress[];
  orphanEpics: EpicProgress[];
  overall: { total: number; done: number; progress: number };
}

export function useProgress() {
  return useQuery<ProjectProgress>({
    queryKey: ['progress'],
    queryFn: () => fetchJson('/progress'),
    refetchOnWindowFocus: true,
  });
}

// --- Graph ---

export interface GraphNode {
  id: string;
  title: string;
  type: string;
  status: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function useGraphData() {
  return useQuery<GraphData>({
    queryKey: ['graph'],
    queryFn: () => fetchJson('/graph'),
  });
}

// --- Validation ---

export interface ValidationResponse {
  valid: boolean;
  errors: {
    entityId: string;
    filePath: string;
    code: string;
    message: string;
  }[];
  warnings: {
    entityId: string;
    filePath: string;
    code: string;
    message: string;
  }[];
}

export function useValidation() {
  return useQuery<ValidationResponse>({
    queryKey: ['validation'],
    queryFn: () => fetchJson('/validate'),
    enabled: false, // manual trigger only
  });
}

// --- Sync ---

export interface SyncStatusResponse {
  configured: boolean;
  message?: string;
  repo?: string;
  lastSync?: string | null;
  entities?: {
    id: string;
    title: string;
    type: string;
    status?: string;
    syncStatus: string;
    lastSynced?: string;
  }[];
}

export function useSyncStatus() {
  return useQuery<SyncStatusResponse>({
    queryKey: ['syncStatus'],
    queryFn: () => fetchJson('/sync/status'),
  });
}

export function useSyncPush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      fetchJson('/sync/push', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['syncStatus'] });
    },
  });
}

export function useSyncPull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      fetchJson('/sync/pull', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['syncStatus'] });
      qc.invalidateQueries({ queryKey: ['tree'] });
    },
  });
}

export function useSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      fetchJson('/sync/sync', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['syncStatus'] });
      qc.invalidateQueries({ queryKey: ['tree'] });
    },
  });
}
