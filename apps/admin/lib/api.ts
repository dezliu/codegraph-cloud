/**
 * API client for the admin panel
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private apiKey: string | null = null;

  setApiKey(key: string) {
    this.apiKey = key;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Projects
  async listProjects(orgId?: string) {
    const query = orgId ? `?orgId=${orgId}` : '';
    return this.request<{ data: any[] }>(`/api/projects${query}`);
  }

  async getProject(id: string) {
    return this.request<{ data: any }>(`/api/projects/${id}`);
  }

  async createProject(data: {
    orgId: string;
    name: string;
    repoUrl: string;
    defaultBranch?: string;
    gitProvider?: string;
  }) {
    return this.request<{ data: any }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: Record<string, any>) {
    return this.request<{ data: any }>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string) {
    return this.request<{ success: boolean }>(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async triggerSync(id: string) {
    return this.request<{ data: { jobId: string } }>(`/api/projects/${id}/sync`, {
      method: 'POST',
    });
  }

  // API Keys
  async listApiKeys(orgId: string) {
    return this.request<{ data: any[] }>(`/api/api-keys?orgId=${orgId}`);
  }

  async createApiKey(data: {
    orgId: string;
    name: string;
    scopes?: string[];
    projectId?: string;
  }) {
    return this.request<{ data: any }>('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeApiKey(id: string) {
    return this.request<{ success: boolean }>(`/api/api-keys/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
