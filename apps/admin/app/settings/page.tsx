'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';

interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  async function fetchApiKeys() {
    try {
      const res = await apiClient.listApiKeys('default');
      setApiKeys(res.data || []);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await apiClient.revokeApiKey(id);
      setApiKeys((keys) => keys.filter((k) => k.id !== id));
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      alert('Failed to revoke API key');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* API Keys Section */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">API Keys</h2>
          <button
            onClick={() => setShowCreateKeyModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create API Key
          </button>
        </div>

        {newKeyValue && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800 mb-2">
              <strong>Important:</strong> Copy your API key now. You won't be able to see it again!
            </p>
            <code className="block p-2 bg-white border rounded font-mono text-sm break-all">
              {newKeyValue}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newKeyValue);
              }}
              className="mt-2 text-sm text-green-700 hover:underline"
            >
              Copy to clipboard
            </button>
          </div>
        )}

        {apiKeys.length === 0 ? (
          <p className="text-gray-500">No API keys yet</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left py-2 text-sm font-medium text-gray-500">Scopes</th>
                <th className="text-left py-2 text-sm font-medium text-gray-500">Last Used</th>
                <th className="text-left py-2 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id} className="border-b">
                  <td className="py-2">{key.name}</td>
                  <td className="py-2">
                    {key.scopes.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-gray-100 rounded text-xs mr-1">
                        {s}
                      </span>
                    ))}
                  </td>
                  <td className="py-2 text-sm text-gray-500">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MCP Configuration */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">MCP Configuration</h2>
        <p className="text-sm text-gray-500 mb-4">
          Use this configuration in your Cursor or Claude MCP settings:
        </p>
        <pre className="p-4 bg-gray-900 text-green-400 rounded overflow-x-auto text-sm">
{`{
  "mcpServers": {
    "codegraph-cloud": {
      "url": "https://your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer cgk_your_api_key",
        "X-Project-Id": "proj_your_project_id"
      }
    }
  }
}`}
        </pre>
      </div>

      {showCreateKeyModal && (
        <CreateApiKeyModal
          onClose={() => setShowCreateKeyModal(false)}
          onCreated={(key) => {
            setNewKeyValue(key);
            setShowCreateKeyModal(false);
          }}
        />
      )}
    </div>
  );
}

function CreateApiKeyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (key: string) => void;
}) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read']);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiClient.createApiKey({
        orgId: 'default',
        name,
        scopes,
      });
      onCreated(res.data.key);
    } catch (error) {
      console.error('Failed to create API key:', error);
      alert('Failed to create API key');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Create API Key</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cursor Integration"
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Scopes</label>
            <div className="space-y-1">
              {['read', 'write', 'admin'].map((scope) => (
                <label key={scope} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setScopes([...scopes, scope]);
                      } else {
                        setScopes(scopes.filter((s) => s !== scope));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="capitalize">{scope}</span>
                </label>
              ))}
            </div>
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
