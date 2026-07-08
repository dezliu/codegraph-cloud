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
  lastSyncedCommit: string | null;
  lastSyncedAt: string | null;
  lastIndexedAt: string | null;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

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
        {/* Project Info */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Project Info</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Repository</dt>
              <dd className="font-mono text-sm">{project.repoUrl}</dd>
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

        {/* Sync Status */}
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

        {/* Polling Config */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Polling</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pollEnabled"
                checked={project.pollEnabled}
                readOnly
                className="rounded"
              />
              <label htmlFor="pollEnabled">Enable polling</label>
            </div>
            <div>
              <label className="block text-sm text-gray-500">Interval (seconds)</label>
              <input
                type="number"
                value={project.pollIntervalSec}
                readOnly
                className="w-full px-3 py-2 border rounded bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="space-y-2">
            <button
              onClick={handleTriggerSync}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Trigger Sync
            </button>
            <button className="w-full px-4 py-2 border rounded hover:bg-gray-50">
              Edit Project
            </button>
            <a
              href={`/projects/${projectId}/sync-status`}
              className="block w-full px-4 py-2 text-center border rounded hover:bg-gray-50"
            >
              View Sync History
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
