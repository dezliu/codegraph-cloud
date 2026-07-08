'use client';

import { useParams } from 'next/navigation';

export default function SyncStatusPage() {
  const params = useParams();
  const projectId = params.id as string;

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
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No sync history yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
