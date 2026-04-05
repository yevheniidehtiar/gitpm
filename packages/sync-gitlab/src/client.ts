export class GitLabClient {
  private token: string;
  private baseUrl: string;

  constructor(token: string, baseUrl = 'https://gitlab.com') {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<{ data: T; headers: Headers }> {
    const url = `${this.baseUrl}/api/v4${path}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(url, {
        ...options,
        headers: {
          'PRIVATE-TOKEN': this.token,
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After') ?? '5');
        const waitMs = retryAfter * 1000;
        console.warn(
          `GitLab rate limited. Waiting ${retryAfter}s before retry.`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      // Retry on server errors
      if (response.status >= 500) {
        const backoff = 2 ** attempt * 1000;
        lastError = new Error(
          `GitLab API error ${response.status}: ${response.statusText}`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`GitLab API error ${response.status}: ${body}`);
      }

      // Check rate limit remaining
      const remaining = Number(
        response.headers.get('RateLimit-Remaining') ?? '100',
      );
      if (remaining < 10 && remaining > 0) {
        console.warn(
          `GitLab API rate limit low: ${remaining} requests remaining.`,
        );
      }

      const data = (await response.json()) as T;
      return { data, headers: response.headers };
    }

    throw lastError ?? new Error('GitLab API request failed after retries');
  }

  async paginate<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const queryParts: string[] = [`per_page=${perPage}`, `page=${page}`];
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined) {
            queryParts.push(
              `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
            );
          }
        }
      }
      const query = queryParts.join('&');
      const { data, headers } = await this.request<T[]>(`${path}?${query}`);

      results.push(...data);

      const nextPage = headers.get('x-next-page');
      if (!nextPage || data.length < perPage) break;
      page = Number(nextPage);
    }

    return results;
  }

  private encodeProject(projectId: string | number): string {
    if (typeof projectId === 'number') return String(projectId);
    return encodeURIComponent(projectId);
  }

  async getProject(projectId: string | number): Promise<GlProject> {
    const { data } = await this.request<GlProject>(
      `/projects/${this.encodeProject(projectId)}`,
    );
    return data;
  }

  async listMilestones(projectId: string | number): Promise<GlMilestone[]> {
    const active = await this.paginate<GlMilestone>(
      `/projects/${this.encodeProject(projectId)}/milestones`,
      { state: 'active' },
    );
    const closed = await this.paginate<GlMilestone>(
      `/projects/${this.encodeProject(projectId)}/milestones`,
      { state: 'closed' },
    );
    return [...active, ...closed];
  }

  async getMilestone(
    projectId: string | number,
    milestoneId: number,
  ): Promise<GlMilestone | null> {
    try {
      const { data } = await this.request<GlMilestone>(
        `/projects/${this.encodeProject(projectId)}/milestones/${milestoneId}`,
      );
      return data;
    } catch {
      return null;
    }
  }

  async createMilestone(
    projectId: string | number,
    params: {
      title: string;
      description?: string;
      due_date?: string;
      state_event?: 'close' | 'activate';
    },
  ): Promise<GlMilestone> {
    const { data } = await this.request<GlMilestone>(
      `/projects/${this.encodeProject(projectId)}/milestones`,
      { method: 'POST', body: JSON.stringify(params) },
    );
    return data;
  }

  async updateMilestone(
    projectId: string | number,
    milestoneId: number,
    params: {
      title?: string;
      description?: string;
      due_date?: string;
      state_event?: 'close' | 'activate';
    },
  ): Promise<GlMilestone> {
    const { data } = await this.request<GlMilestone>(
      `/projects/${this.encodeProject(projectId)}/milestones/${milestoneId}`,
      { method: 'PUT', body: JSON.stringify(params) },
    );
    return data;
  }

  async listIssues(
    projectId: string | number,
    options?: { state?: 'opened' | 'closed' | 'all' },
  ): Promise<GlIssue[]> {
    return this.paginate<GlIssue>(
      `/projects/${this.encodeProject(projectId)}/issues`,
      { state: options?.state ?? 'all', order_by: 'created_at', sort: 'asc' },
    );
  }

  async getIssue(
    projectId: string | number,
    issueIid: number,
  ): Promise<GlIssue | null> {
    try {
      const { data } = await this.request<GlIssue>(
        `/projects/${this.encodeProject(projectId)}/issues/${issueIid}`,
      );
      return data;
    } catch {
      return null;
    }
  }

  async createIssue(
    projectId: string | number,
    params: {
      title: string;
      description?: string;
      labels?: string;
      assignee_ids?: number[];
      milestone_id?: number;
      weight?: number;
    },
  ): Promise<GlIssue> {
    const { data } = await this.request<GlIssue>(
      `/projects/${this.encodeProject(projectId)}/issues`,
      { method: 'POST', body: JSON.stringify(params) },
    );
    return data;
  }

  async updateIssue(
    projectId: string | number,
    issueIid: number,
    params: {
      title?: string;
      description?: string;
      state_event?: 'close' | 'reopen';
      labels?: string;
      assignee_ids?: number[];
      milestone_id?: number | null;
      weight?: number;
    },
  ): Promise<GlIssue> {
    const { data } = await this.request<GlIssue>(
      `/projects/${this.encodeProject(projectId)}/issues/${issueIid}`,
      { method: 'PUT', body: JSON.stringify(params) },
    );
    return data;
  }

  async listGroupEpics(groupId: number): Promise<GlEpic[]> {
    try {
      return await this.paginate<GlEpic>(`/groups/${groupId}/epics`);
    } catch {
      // Epics require Premium — gracefully return empty on 403
      return [];
    }
  }

  async getGroupEpic(groupId: number, epicIid: number): Promise<GlEpic | null> {
    try {
      const { data } = await this.request<GlEpic>(
        `/groups/${groupId}/epics/${epicIid}`,
      );
      return data;
    } catch {
      return null;
    }
  }

  async createGroupEpic(
    groupId: number,
    params: {
      title: string;
      description?: string;
      labels?: string;
    },
  ): Promise<GlEpic> {
    const { data } = await this.request<GlEpic>(`/groups/${groupId}/epics`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return data;
  }

  async updateGroupEpic(
    groupId: number,
    epicIid: number,
    params: {
      title?: string;
      description?: string;
      state_event?: 'close' | 'reopen';
      labels?: string;
    },
  ): Promise<GlEpic> {
    const { data } = await this.request<GlEpic>(
      `/groups/${groupId}/epics/${epicIid}`,
      { method: 'PUT', body: JSON.stringify(params) },
    );
    return data;
  }

  async listEpicIssues(groupId: number, epicIid: number): Promise<GlIssue[]> {
    try {
      return await this.paginate<GlIssue>(
        `/groups/${groupId}/epics/${epicIid}/issues`,
      );
    } catch {
      return [];
    }
  }

  async listLabels(projectId: string | number): Promise<GlLabel[]> {
    return this.paginate<GlLabel>(
      `/projects/${this.encodeProject(projectId)}/labels`,
    );
  }
}

// GitLab API response types

export interface GlProject {
  id: number;
  name: string;
  path_with_namespace: string;
  namespace: {
    id: number;
    kind: 'group' | 'user';
    full_path: string;
  };
}

export interface GlMilestone {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: 'active' | 'closed';
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlIssue {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: 'opened' | 'closed';
  assignee: { id: number; username: string } | null;
  labels: string[];
  milestone: { id: number; iid: number; title: string } | null;
  weight: number | null;
  epic_iid: number | null;
  created_at: string;
  updated_at: string;
}

export interface GlEpic {
  id: number;
  iid: number;
  group_id: number;
  title: string;
  description: string | null;
  state: 'opened' | 'closed';
  labels: string[];
  created_at: string;
  updated_at: string;
}

export interface GlLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}
