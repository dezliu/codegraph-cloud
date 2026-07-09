'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';

interface Project {
  id: string;
  name: string;
  repoUrl: string;
  status: string;
  lastSyncedAt: string | null;
  lastIndexedAt: string | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    setError(null);
    try {
      const res = await apiClient.listProjects();
      setProjects(res.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch projects';
      setError(message);
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          New Project
        </button>
      </div>

      {error ? (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="font-medium text-amber-900">Unable to load projects</p>
          <p className="text-sm text-amber-800 mt-1">{error}</p>
          <a href="/settings" className="inline-block mt-3 text-sm text-blue-700 hover:underline">
            Configure API key in Settings →
          </a>
        </div>
      ) : null}

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No projects yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <a
              key={project.id}
              href={`/projects/${project.id}`}
              className="block p-4 border rounded-lg hover:border-blue-500 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-sm text-gray-500">{project.repoUrl}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded ${
                  project.status === 'active' ? 'bg-green-100 text-green-800' :
                  project.status === 'error' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {project.status}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {project.lastIndexedAt ? (
                  <span>Last indexed: {new Date(project.lastIndexedAt).toLocaleString()}</span>
                ) : (
                  <span>Not indexed yet</span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateProjectModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [gitProvider, setGitProvider] = useState('gitlab');
  const [gitToken, setGitToken] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiClient.createProject({
        orgId: 'default',
        name,
        repoUrl,
        gitProvider,
        defaultBranch,
        ...(gitToken ? { gitToken } : {}),
      });
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Create Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Repository URL</label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://gitlab.com/org/repo.git"
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Git Provider</label>
            <select
              value={gitProvider}
              onChange={(e) => setGitProvider(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="gitlab">GitLab</option>
              <option value="github">GitHub</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Default Branch</label>
            <input
              type="text"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Git Token (optional)</label>
            <input
              type="password"
              value={gitToken}
              onChange={(e) => setGitToken(e.target.value)}
              placeholder="For private repositories"
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
