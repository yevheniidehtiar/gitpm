export interface JiraClientOptions {
  site: string;
  email: string;
  apiToken: string;
  apiVersion?: 'v2' | 'v3';
}

export class JiraClient {
  private baseUrl: string;
  private agileBaseUrl: string;
  private authHeader: string;

  constructor(private options: JiraClientOptions) {
    const version = options.apiVersion ?? 'v3';
    this.baseUrl = `https://${options.site}/rest/api/${version === 'v3' ? '3' : '2'}`;
    this.agileBaseUrl = `https://${options.site}/rest/agile/1.0`;
    this.authHeader = `Basic ${btoa(`${options.email}:${options.apiToken}`)}`;
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...init?.headers,
      },
    });

    await this.checkRateLimit(response);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Jira API error ${response.status}: ${response.statusText} — ${body}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private async checkRateLimit(response: Response): Promise<void> {
    const retryAfter = response.headers.get('Retry-After');
    if (response.status === 429 && retryAfter) {
      const waitMs = Number.parseInt(retryAfter, 10) * 1000;
      if (waitMs > 0) {
        console.warn(
          `Jira rate limit hit. Sleeping ${Math.ceil(waitMs / 1000)}s.`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  private async paginate<T>(url: string, resultKey: string): Promise<T[]> {
    const results: T[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const separator = url.includes('?') ? '&' : '?';
      const pagedUrl = `${url}${separator}startAt=${startAt}&maxResults=${maxResults}`;
      const response = await this.request<Record<string, unknown>>(pagedUrl);

      const items = (response[resultKey] ?? []) as T[];
      results.push(...items);

      const total = response.total as number | undefined;
      if (total !== undefined && startAt + items.length >= total) break;
      if (items.length < maxResults) break;

      startAt += items.length;
    }

    return results;
  }

  async listProjects(): Promise<JiraProject[]> {
    return this.request<JiraProject[]>(`${this.baseUrl}/project`);
  }

  async searchIssues(jql: string): Promise<JiraIssue[]> {
    const encodedJql = encodeURIComponent(jql);
    const fields =
      'summary,description,status,issuetype,assignee,labels,priority,parent,sprint,created,updated,project';
    return this.paginate<JiraIssue>(
      `${this.baseUrl}/search?jql=${encodedJql}&fields=${fields}`,
      'issues',
    );
  }

  async getIssue(issueKey: string): Promise<JiraIssue | null> {
    try {
      return await this.request<JiraIssue>(`${this.baseUrl}/issue/${issueKey}`);
    } catch {
      return null;
    }
  }

  async createIssue(params: CreateJiraIssueParams): Promise<JiraIssue> {
    const body: Record<string, unknown> = {
      fields: {
        project: { key: params.projectKey },
        summary: params.summary,
        issuetype: { name: params.issueType },
        ...(params.description !== undefined && {
          description: params.description,
        }),
        ...(params.labels && { labels: params.labels }),
        ...(params.assignee && {
          assignee: { accountId: params.assignee },
        }),
        ...(params.parentKey && { parent: { key: params.parentKey } }),
        ...(params.priority && { priority: { name: params.priority } }),
      },
    };

    return this.request<JiraIssue>(`${this.baseUrl}/issue`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateIssue(
    issueKey: string,
    params: UpdateJiraIssueParams,
  ): Promise<void> {
    const fields: Record<string, unknown> = {};
    if (params.summary !== undefined) fields.summary = params.summary;
    if (params.description !== undefined)
      fields.description = params.description;
    if (params.labels !== undefined) fields.labels = params.labels;
    if (params.assignee !== undefined)
      fields.assignee = params.assignee ? { accountId: params.assignee } : null;
    if (params.priority !== undefined)
      fields.priority = { name: params.priority };

    await this.request<void>(`${this.baseUrl}/issue/${issueKey}`, {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    });
  }

  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const result = await this.request<{ transitions: JiraTransition[] }>(
      `${this.baseUrl}/issue/${issueKey}/transitions`,
    );
    return result.transitions;
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.request<void>(`${this.baseUrl}/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
  }

  async getBoard(projectKey: string): Promise<JiraBoard | null> {
    try {
      const result = await this.request<{ values: JiraBoard[] }>(
        `${this.agileBaseUrl}/board?projectKeyOrId=${projectKey}`,
      );
      return result.values[0] ?? null;
    } catch {
      return null;
    }
  }

  async listSprints(boardId: number): Promise<JiraSprint[]> {
    return this.paginate<JiraSprint>(
      `${this.agileBaseUrl}/board/${boardId}/sprint`,
      'values',
    );
  }

  async listSprintIssues(sprintId: number): Promise<JiraIssue[]> {
    return this.paginate<JiraIssue>(
      `${this.agileBaseUrl}/sprint/${sprintId}/issue`,
      'issues',
    );
  }
}

// Lightweight types for Jira API responses
export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string | null;
    status: { name: string; id: string };
    issuetype: { name: string; id: string };
    assignee: { accountId: string; displayName: string } | null;
    labels: string[];
    priority: { name: string; id: string } | null;
    parent?: {
      key: string;
      fields?: { summary: string; issuetype: { name: string } };
    };
    sprint?: { id: number; name: string; state: string } | null;
    project: { key: string };
    created: string;
    updated: string;
  };
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: string;
  endDate?: string;
  goal?: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: { name: string; id: string };
}

export interface CreateJiraIssueParams {
  projectKey: string;
  summary: string;
  issueType: string;
  description?: string;
  labels?: string[];
  assignee?: string;
  parentKey?: string;
  priority?: string;
}

export interface UpdateJiraIssueParams {
  summary?: string;
  description?: string;
  labels?: string[];
  assignee?: string | null;
  priority?: string;
}
