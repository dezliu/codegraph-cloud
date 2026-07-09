'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '../../../lib/api';

interface Project {
  id: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  gitProvider: string;
  status: string;
  pollEnabled: boolean;
  pollIntervalSec: number;
  webhookSecret: string | null;
  webhookUrl: string | null;
  indexConfig: { exclude?: string[]; include?: string[]; extensions?: string[] };
  lastSyncedCommit: string | null;
  lastSyncedAt: string | null;
  lastIndexedAt: string | null;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  async function fetchProject() {
    try {
      const res = await apiClient.getProject(projectId);
      setProject(res.data);
    } catch (error) {
      console.error('Failed to fetch project:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerSync() {
    try {
      await apiClient.triggerSync(projectId);
      alert('Sync job scheduled');
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      alert('Failed to trigger sync');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!project) {
    return <div>Project not found</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <a href="/projects" className="text-blue-600 hover:underline">&larr; Back to projects</a>
      </div>

      <h1 className="text-2xl font-bold mb-6">{project.name}</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Project Info</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Repository</dt>
              <dd className="font-mono text-sm break-all">{project.repoUrl}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Branch</dt>
              <dd>{project.defaultBranch}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Provider</dt>
              <dd className="capitalize">{project.gitProvider}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Status</dt>
              <dd>
                <span className={`px-2 py-1 text-xs rounded ${
                  project.status === 'active' ? 'bg-green-100 text-green-800' :
                  project.status === 'error' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {project.status}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Sync Status</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Last Synced Commit</dt>
              <dd className="font-mono text-sm">
                {project.lastSyncedCommit ? project.lastSyncedCommit.slice(0, 8) : 'Never'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Last Synced At</dt>
              <dd>{project.lastSyncedAt ? new Date(project.lastSyncedAt).toLocaleString() : 'Never'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Last Indexed At</dt>
              <dd>{project.lastIndexedAt ? new Date(project.lastIndexedAt).toLocaleString() : 'Never'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Webhook</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500 mb-1">Webhook URL</dt>
              <dd className="flex gap-2 items-start">
                <code className="text-xs bg-gray-50 p-2 rounded flex-1 break-all">
                  {project.webhookUrl || 'Not configured'}
                </code>
                {project.webhookUrl ? (
                  <button
                    onClick={() => copyToClipboard(project.webhookUrl!)}
                    className="text-xs text-blue-600 hover:underline shrink-0"
                  >
                    Copy
                  </button>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 mb-1">Secret</dt>
              <dd className="flex gap-2 items-start">
                <code className="text-xs bg-gray-50 p-2 rounded flex-1 break-all font-mono">
                  {project.webhookSecret || '—'}
                </code>
                {project.webhookSecret ? (
                  <button
                    onClick={() => copyToClipboard(project.webhookSecret!)}
                    className="text-xs text-blue-600 hover:underline shrink-0"
                  >
                    Copy
                  </button>
                ) : null}
              </dd>
              <p className="text-xs text-gray-500 mt-2">
                GitLab: set as &quot;Secret token&quot;. GitHub: used for HMAC signature verification.
              </p>
            </div>
          </dl>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Polling</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={project.pollEnabled} readOnly className="rounded" />
              <span>{project.pollEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div>
              <span className="text-sm text-gray-500">Interval: </span>
              <span>{project.pollIntervalSec}s</span>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-6 col-span-2">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTriggerSync}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Trigger Sync
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Edit Project
            </button>
            <a
              href={`/projects/${projectId}/sync-status`}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Sync History
            </a>
            <a
              href={`/projects/${projectId}/index-status`}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Index History
            </a>
          </div>
        </div>
      </div>

      {showEditModal && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            fetchProject();
          }}
        />
      )}
    </div>
  );
}

function EditProjectModal({
  project,
  onClose,
  onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [defaultBranch, setDefaultBranch] = useState(project.defaultBranch);
  const [pollEnabled, setPollEnabled] = useState(project.pollEnabled);
  const [pollIntervalSec, setPollIntervalSec] = useState(project.pollIntervalSec);
  const [gitToken, setGitToken] = useState('');
  const [excludePaths, setExcludePaths] = useState(
    (project.indexConfig?.exclude || []).join('\n'),
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const exclude = excludePaths
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await apiClient.updateProject(project.id, {
        name,
        defaultBranch,
        pollEnabled,
        pollIntervalSec,
        indexConfig: { ...project.indexConfig, exclude },
        ...(gitToken ? { gitToken } : {}),
      });
      onSaved();
    } catch (error) {
      console.error('Failed to update project:', error);
      alert('Failed to update project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Edit Project</h2>
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
            <label className="block text-sm font-medium mb-1">Default Branch</label>
            <input
              type="text"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Git Token (optional)</label>
            <input
              type="password"
              value={gitToken}
              onChange={(e) => setGitToken(e.target.value)}
              placeholder="Leave blank to keep existing"
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">Personal access token for private repositories</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pollEnabled"
              checked={pollEnabled}
              onChange={(e) => setPollEnabled(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="pollEnabled">Enable polling</label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Poll Interval (seconds)</label>
            <input
              type="number"
              min={60}
              value={pollIntervalSec}
              onChange={(e) => setPollIntervalSec(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Exclude paths (one per line)</label>
            <textarea
              value={excludePaths}
              onChange={(e) => setExcludePaths(e.target.value)}
              placeholder="node_modules&#10;dist&#10;.git"
              rows={4}
              className="w-full px-3 py-2 border rounded font-mono text-sm"
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
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
