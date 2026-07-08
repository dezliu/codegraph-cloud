'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '../../../../lib/api';

interface SyncJob {
  id: string;
  trigger: string;
  commitSha: string | null;
  status: string;
  changedFiles: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export default function SyncStatusPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, [projectId]);

  async function fetchJobs() {
    try {
      const res = await apiClient.listSyncJobs(projectId);
      setJobs(res.data || []);
    } catch (error) {
      console.error('Failed to fetch sync jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <a href={`/projects/${projectId}`} className="text-blue-600 hover:underline">&larr; Back to project</a>
      </div>

      <h1 className="text-2xl font-bold mb-6">Sync History</h1>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Time</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Trigger</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Commit</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Files Changed</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No sync history yet</td></tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3 text-sm">
                    {job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{job.trigger}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {job.commitSha ? job.commitSha.slice(0, 8) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 text-xs rounded ${
                      job.status === 'completed' ? 'bg-green-100 text-green-800' :
                      job.status === 'failed' ? 'bg-red-100 text-red-800' :
                      job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {job.changedFiles ?? '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
