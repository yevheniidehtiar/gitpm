import { Octokit } from '@octokit/rest';

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  private async checkRateLimit(response: {
    headers: Record<string, string | number | undefined>;
  }): Promise<void> {
    const remaining = Number(
      response.headers['x-ratelimit-remaining'] ?? '100',
    );
    const resetTimestamp = Number(response.headers['x-ratelimit-reset'] ?? '0');

    if (remaining === 0 && resetTimestamp > 0) {
      const waitMs = resetTimestamp * 1000 - Date.now();
      if (waitMs > 0) {
        console.warn(
          `Rate limit exhausted. Sleeping ${Math.ceil(waitMs / 1000)}s until reset.`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    } else if (remaining < 10) {
      console.warn(
        `GitHub API rate limit low: ${remaining} requests remaining.`,
      );
    }
  }

  async paginate<T>(
    method: (params: Record<string, unknown>) => Promise<{
      data: T[];
      headers: Record<string, string | number | undefined>;
    }>,
    params: Record<string, unknown>,
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await method({ ...params, per_page: perPage, page });
      await this.checkRateLimit(response);
      results.push(...response.data);
      if (response.data.length < perPage) break;
      page++;
    }

    return results;
  }

  async listMilestones(owner: string, repo: string): Promise<GhMilestone[]> {
    const open = await this.paginate(
      (params) =>
        this.octokit.issues.listMilestones(
          params as Parameters<typeof this.octokit.issues.listMilestones>[0],
        ),
      { owner, repo, state: 'open' },
    );
    const closed = await this.paginate(
      (params) =>
        this.octokit.issues.listMilestones(
          params as Parameters<typeof this.octokit.issues.listMilestones>[0],
        ),
      { owner, repo, state: 'closed' },
    );
    return [...open, ...closed] as GhMilestone[];
  }

  async listIssues(
    owner: string,
    repo: string,
    options?: { state?: 'open' | 'closed' | 'all' },
  ): Promise<GhIssue[]> {
    const issues = await this.paginate(
      (params) =>
        this.octokit.issues.listForRepo(
          params as Parameters<typeof this.octokit.issues.listForRepo>[0],
        ),
      { owner, repo, state: options?.state ?? 'all', direction: 'asc' },
    );
    // Filter out pull requests (GitHub API includes PRs in issues endpoint)
    return (issues as GhIssue[]).filter((issue) => !issue.pull_request);
  }

  async getProject(
    _owner: string,
    _repo: string,
    _projectNumber: number,
  ): Promise<GhProject | null> {
    // GitHub Projects v2 requires GraphQL API — stub for now
    return null;
  }

  async getProjectItems(_projectId: string): Promise<GhProjectItem[]> {
    // GitHub Projects v2 requires GraphQL API — stub for now
    return [];
  }

  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<GhIssue | null> {
    try {
      const response = await this.octokit.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });
      await this.checkRateLimit(response);
      return response.data as unknown as GhIssue;
    } catch {
      return null;
    }
  }

  async getMilestone(
    owner: string,
    repo: string,
    milestoneNumber: number,
  ): Promise<GhMilestone | null> {
    try {
      const response = await this.octokit.issues.getMilestone({
        owner,
        repo,
        milestone_number: milestoneNumber,
      });
      await this.checkRateLimit(response);
      return response.data as unknown as GhMilestone;
    } catch {
      return null;
    }
  }

  async createIssue(
    owner: string,
    repo: string,
    params: {
      title: string;
      body?: string;
      labels?: string[];
      assignees?: string[];
      milestone?: number;
    },
  ): Promise<GhIssue> {
    const response = await this.octokit.issues.create({
      owner,
      repo,
      ...params,
    });
    await this.checkRateLimit(response);
    return response.data as unknown as GhIssue;
  }

  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    params: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      labels?: string[];
      assignees?: string[];
      milestone?: number | null;
    },
  ): Promise<GhIssue> {
    const response = await this.octokit.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      ...params,
    });
    await this.checkRateLimit(response);
    return response.data as unknown as GhIssue;
  }

  async createMilestone(
    owner: string,
    repo: string,
    params: {
      title: string;
      description?: string;
      due_on?: string;
      state?: 'open' | 'closed';
    },
  ): Promise<GhMilestone> {
    const response = await this.octokit.issues.createMilestone({
      owner,
      repo,
      ...params,
    });
    await this.checkRateLimit(response);
    return response.data as unknown as GhMilestone;
  }

  async updateMilestone(
    owner: string,
    repo: string,
    milestoneNumber: number,
    params: {
      title?: string;
      description?: string;
      due_on?: string;
      state?: 'open' | 'closed';
    },
  ): Promise<GhMilestone> {
    const response = await this.octokit.issues.updateMilestone({
      owner,
      repo,
      milestone_number: milestoneNumber,
      ...params,
    });
    await this.checkRateLimit(response);
    return response.data as unknown as GhMilestone;
  }
}

// Lightweight types for GitHub API responses we use
export interface GhMilestone {
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  due_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface GhIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  assignee: { login: string } | null;
  labels: Array<{ name: string } | string>;
  milestone: { number: number; title: string } | null;
  pull_request?: unknown;
  created_at: string;
  updated_at: string;
}

export interface GhProject {
  id: string;
  title: string;
  number: number;
}

export interface GhProjectItem {
  id: string;
  content: { number: number; type: string } | null;
  fieldValues: Array<{ field: { name: string }; value: string }>;
}
