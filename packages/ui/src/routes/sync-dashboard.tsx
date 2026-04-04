import { useState } from 'react';
import { EmptyState } from '../components/EmptyState.js';
import { Spinner } from '../components/Spinner.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { useToast } from '../components/Toast.js';
import { TypeIcon } from '../components/TypeIcon.js';
import {
  useSync,
  useSyncPull,
  useSyncPush,
  useSyncStatus,
} from '../lib/api.js';

const SYNC_STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  in_sync: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'In Sync' },
  local_changed: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    label: 'Local Ahead',
  },
  remote_changed: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    label: 'Remote Ahead',
  },
  conflict: { bg: 'bg-red-50', text: 'text-red-700', label: 'Conflict' },
  not_synced: { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Not Synced' },
};

export function SyncDashboard() {
  const { data: syncStatus, isLoading } = useSyncStatus();
  const pushMutation = useSyncPush();
  const pullMutation = useSyncPull();
  const syncMutation = useSync();
  const { toast } = useToast();

  const [token, setToken] = useState('');

  const isBusy =
    pushMutation.isPending || pullMutation.isPending || syncMutation.isPending;

  const handlePush = async () => {
    if (!token) {
      toast('GitHub token required', 'error');
      return;
    }
    try {
      await pushMutation.mutateAsync(token);
      toast('Push completed', 'success');
    } catch (err) {
      toast(String(err), 'error');
    }
  };

  const handlePull = async () => {
    if (!token) {
      toast('GitHub token required', 'error');
      return;
    }
    try {
      await pullMutation.mutateAsync(token);
      toast('Pull completed', 'success');
    } catch (err) {
      toast(String(err), 'error');
    }
  };

  const handleSync = async () => {
    if (!token) {
      toast('GitHub token required', 'error');
      return;
    }
    try {
      await syncMutation.mutateAsync(token);
      toast('Sync completed', 'success');
    } catch (err) {
      toast(String(err), 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!syncStatus?.configured) {
    return (
      <EmptyState
        icon="🔄"
        message="No GitHub sync configured. Run `gitpm import` or `gitpm push` to set up sync."
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Sync Dashboard</h2>
          <p className="text-sm text-gray-500">
            Repository: <span className="font-mono">{syncStatus.repo}</span>
            {syncStatus.lastSync && (
              <>
                {' '}
                &middot; Last synced:{' '}
                {new Date(syncStatus.lastSync).toLocaleString()}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Token + Actions */}
      <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <span className="block text-xs text-gray-500 mb-1">
              GitHub Token
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            type="button"
            onClick={handlePull}
            disabled={isBusy}
            className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {pullMutation.isPending ? (
              <Spinner className="h-4 w-4 text-white" />
            ) : (
              'Pull'
            )}
          </button>
          <button
            type="button"
            onClick={handlePush}
            disabled={isBusy}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {pushMutation.isPending ? (
              <Spinner className="h-4 w-4 text-white" />
            ) : (
              'Push'
            )}
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={isBusy}
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {syncMutation.isPending ? (
              <Spinner className="h-4 w-4 text-white" />
            ) : (
              'Full Sync'
            )}
          </button>
        </div>
      </div>

      {/* Entity table */}
      {syncStatus.entities && syncStatus.entities.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Sync State</th>
                <th className="px-4 py-2">Last Synced</th>
              </tr>
            </thead>
            <tbody>
              {syncStatus.entities.map((e) => {
                const style =
                  SYNC_STATUS_STYLES[e.syncStatus] ??
                  SYNC_STATUS_STYLES.not_synced;
                return (
                  <tr
                    key={e.id}
                    className={`border-b border-gray-100 ${style.bg}`}
                  >
                    <td className="px-4 py-2">
                      <TypeIcon type={e.type} />
                    </td>
                    <td className="px-4 py-2 font-medium">{e.title}</td>
                    <td className="px-4 py-2">
                      {e.status && <StatusBadge status={e.status} />}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${style.text} ${style.bg}`}
                      >
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {e.lastSynced
                        ? new Date(e.lastSynced).toLocaleString()
                        : 'Never'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon="📭"
          message="No entities are synced yet. Use Push or Pull to start syncing."
        />
      )}
    </div>
  );
}
