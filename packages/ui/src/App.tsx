import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
  useRouterState,
} from '@tanstack/react-router';
import { useState } from 'react';
import { Spinner } from './components/Spinner.js';
import { ToastProvider } from './components/Toast.js';
import { TypeIcon } from './components/TypeIcon.js';
import {
  type TreeResponse,
  useSyncStatus,
  useTree,
  useValidation,
} from './lib/api.js';
import { EntityEditor } from './routes/entity-editor.js';
import { RoadmapView } from './routes/roadmap.js';
import { SyncDashboard } from './routes/sync-dashboard.js';
import { TreeBrowser } from './routes/tree-browser.js';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5000 } },
});

// --- Layout ---

function Sidebar() {
  const { data: tree } = useTree();
  const validation = useValidation();
  const [validating, setValidating] = useState(false);

  const navItems = [
    { to: '/', label: 'Tree Browser', icon: '🌳' },
    { to: '/roadmap', label: 'Roadmap', icon: '🗺️' },
    { to: '/sync', label: 'Sync Dashboard', icon: '🔄' },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-gray-200 flex flex-col h-screen fixed left-0 top-0">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">GitPM</h1>
        {tree && (
          <p className="text-xs text-gray-400 mt-1">
            {(tree as TreeResponse).counts.stories}s /{' '}
            {(tree as TreeResponse).counts.epics}e /{' '}
            {(tree as TreeResponse).counts.milestones}m
          </p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-gray-800 mb-0.5 [&.active]:bg-gray-700"
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {tree && (
          <div className="mt-4 border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 px-3">
              Entities
            </p>
            {(['milestones', 'epics', 'stories', 'prds'] as const).map(
              (key) => {
                const items = (tree as TreeResponse)[key] as Array<{
                  id: string;
                  title: string;
                  type: string;
                }>;
                if (!items?.length) return null;
                return (
                  <div key={key} className="mb-2">
                    {items.map((e) => (
                      <Link
                        key={e.id}
                        to="/entity/$id"
                        params={{ id: e.id }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded text-xs hover:bg-gray-800 truncate [&.active]:bg-gray-700"
                      >
                        <TypeIcon type={e.type} />
                        <span className="truncate">{e.title}</span>
                      </Link>
                    ))}
                  </div>
                );
              },
            )}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-gray-700 space-y-2">
        <button
          type="button"
          onClick={() => {
            setValidating(true);
            validation.refetch().finally(() => setValidating(false));
          }}
          className="w-full px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center gap-1"
        >
          {validating ? <Spinner className="h-3 w-3" /> : '✓'} Validate
        </button>
        {validation.data && (
          <p
            className={`text-xs text-center ${validation.data.valid ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {validation.data.valid
              ? 'All valid'
              : `${validation.data.errors.length} error(s)`}
          </p>
        )}
      </div>
    </aside>
  );
}

function TopBar() {
  const { data: syncStatus } = useSyncStatus();
  const router = useRouterState();
  const path = router.location.pathname;

  const breadcrumbs = [
    { label: 'GitPM', to: '/' },
    ...(path.startsWith('/entity')
      ? [{ label: 'Entity', to: path }]
      : path === '/roadmap'
        ? [{ label: 'Roadmap', to: '/roadmap' }]
        : path === '/sync'
          ? [{ label: 'Sync', to: '/sync' }]
          : [{ label: 'Tree', to: '/' }]),
  ];

  const lastSync = syncStatus?.lastSync;
  const syncAge = lastSync ? formatTimeAgo(lastSync) : null;

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 justify-between">
      <div className="flex items-center gap-1 text-sm text-gray-600">
        {breadcrumbs.map((b, i) => (
          <span key={b.to}>
            {i > 0 && <span className="mx-1 text-gray-300">/</span>}
            <Link to={b.to} className="hover:text-gray-900">
              {b.label}
            </Link>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3 text-sm">
        {syncStatus?.configured && (
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${syncAge ? 'bg-emerald-400' : 'bg-gray-300'}`}
            />
            <span className="text-gray-500 text-xs">
              {syncAge ? `Synced ${syncAge}` : 'Not synced'}
            </span>
          </div>
        )}
        <Link
          to="/sync"
          className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded font-medium"
        >
          Sync Now
        </Link>
      </div>
    </header>
  );
}

function Layout() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="ml-64 flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// --- Router ---

const rootRoute = createRootRoute({ component: Layout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: TreeBrowser,
});

const entityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entity/$id',
  component: EntityEditor,
});

const roadmapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/roadmap',
  component: RoadmapView,
});

const syncRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sync',
  component: SyncDashboard,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  entityRoute,
  roadmapRoute,
  syncRoute,
]);

const hashHistory = createHashHistory();

const router = createRouter({ routeTree, history: hashHistory });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// --- App ---

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
