'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '../../../../lib/api';

interface IndexJob {
  id: string;
  status: string;
  filesTotal: number | null;
  filesIndexed: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export default function IndexStatusPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [jobs, setJobs] = useState<IndexJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, [projectId]);

  async function fetchJobs() {
    try {
      const res = await apiClient.listIndexJobs(projectId);
      setJobs(res.data || []);
    } catch (error) {
      console.error('Failed to fetch index jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <a href={`/projects/${projectId}`} className="text-blue-600 hover:underline">&larr; Back to project</a>
      </div>

      <h1 className="text-2xl font-bold mb-6">Index History</h1>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Time</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Files Indexed</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No index history yet</td></tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3 text-sm">
                    {job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}
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
                    {job.filesIndexed ?? '-'}
                    {job.filesTotal != null && job.filesIndexed != null ? ` / ${job.filesTotal}` : ''}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate">
                    {job.error || '-'}
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
