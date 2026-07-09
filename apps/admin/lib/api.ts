/**
 * API client for the admin panel
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const STORAGE_KEY = 'codegraph_admin_api_key';

class ApiClient {
  private apiKey: string | null = null;
  private loaded = false;

  private loadApiKey(): void {
    if (this.loaded) return;
    this.loaded = true;

    const fromEnv = process.env.NEXT_PUBLIC_ADMIN_API_KEY?.trim();
    if (fromEnv) {
      this.apiKey = fromEnv;
      return;
    }

    if (typeof window !== 'undefined') {
      this.apiKey = localStorage.getItem(STORAGE_KEY)?.trim() || null;
    }
  }

  setApiKey(key: string) {
    this.apiKey = key.trim();
    this.loaded = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, this.apiKey);
    }
  }

  clearApiKey() {
    this.apiKey = null;
    this.loaded = true;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  hasApiKey(): boolean {
    this.loadApiKey();
    return !!this.apiKey;
  }

  getMaskedApiKey(): string | null {
    this.loadApiKey();
    if (!this.apiKey) return null;
    if (this.apiKey.length <= 12) return '••••••••';
    return `${this.apiKey.slice(0, 8)}…${this.apiKey.slice(-4)}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    this.loadApiKey();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (!this.apiKey) {
      throw new Error(
        'API key not configured. Open Settings and paste your admin API key, or set NEXT_PUBLIC_ADMIN_API_KEY.',
      );
    }

    headers['Authorization'] = `Bearer ${this.apiKey}`;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (response.status === 401) {
        throw new Error(
          error.error ||
            'Unauthorized. Check your API key in Settings (or run `pnpm seed:admin` to create one).',
        );
      }
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
    gitToken?: string;
  }) {
    return this.request<{ data: any }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: Record<string, unknown>) {
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

  // Jobs
  async listSyncJobs(projectId: string) {
    return this.request<{ data: any[] }>(`/api/jobs/sync/${projectId}`);
  }

  async listIndexJobs(projectId: string) {
    return this.request<{ data: any[] }>(`/api/jobs/index/${projectId}`);
  }
}

export const apiClient = new ApiClient();
