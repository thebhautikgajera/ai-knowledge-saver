import { useEffect, useMemo, useState } from 'react';
import { getItems, deleteItem } from '../api/items';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const POLL_INTERVAL_MS = 8000;

const typeTabs = [
  { id: 'all', label: 'All', apiType: undefined },
  { id: 'article', label: 'Articles', apiType: 'article' },
  { id: 'video', label: 'Videos', apiType: 'video' },
  { id: 'tweet', label: 'Tweets', apiType: 'tweet' },
];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [activeType, setActiveType] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    if (!user) return;

    let isCancelled = false;

    const fetchItems = async () => {
      try {
        if (!isCancelled) {
          setError('');
          if (!items.length) {
            setLoading(true);
          }
        }

        const tabConfig = typeTabs.find((t) => t.id === activeType);
        const params = {};
        if (tabConfig?.apiType) {
          params.type = tabConfig.apiType;
        }
        if (search.trim()) {
          params.q = search.trim();
        }

        const data = await getItems(params);
        if (!isCancelled) {
          setItems(data);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message ?? 'Failed to load items');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    // Initial fetch immediately
    fetchItems();

    // Polling for near-real-time updates
    const intervalId = window.setInterval(fetchItems, POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user, activeType, search]);

  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      await deleteItem(id);
      setItems((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      setError(err.message ?? 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  // Debounce search input -> search query used for API
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput);
    }, 300);

    return () => window.clearTimeout(id);
  }, [searchInput]);

  const hasItems = items.length > 0;

  const emptyStateText = useMemo(
    () => (search.trim() || activeType !== 'all'
      ? 'No items match your filters yet.'
      : 'No items saved yet.'),
    [search, activeType]
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">AI Knowledge Saver</h1>
            <p className="text-xs text-slate-400">
              Saved items for <span className="font-medium">{user.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/add"
              className="inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              + Add URL
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-full bg-slate-900/80 p-1 border border-slate-800 overflow-hidden">
            {typeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveType(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  activeType === tab.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title, description, domain..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wide text-slate-500">
              Search
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading && !hasItems ? (
          <div className="flex justify-center py-16 text-slate-400 text-sm">
            Loading your saved items...
          </div>
        ) : !hasItems ? (
          <div className="mt-16 flex flex-col items-center text-center gap-3">
            <p className="text-slate-300 text-sm">
              {emptyStateText}
            </p>
            <p className="text-xs text-slate-500 max-w-sm">
              Use the browser extension or the{' '}
              <span className="font-medium">Add URL</span> page to save
              articles, tweets, videos, and more.
            </p>
            <Link
              to="/add"
              className="mt-3 inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              Save your first item
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              let previewSrc = '';
              if (item.type === 'tweet') {
                // For tweets, only show a real tweet image (no favicon fallback)
                if (typeof item.previewImage === 'string' && item.previewImage) {
                  previewSrc = item.previewImage;
                }
              } else {
                // For other types, fall back to favicon if no preview image
                previewSrc =
                  (typeof item.previewImage === 'string' && item.previewImage) ||
                  (typeof item.favicon === 'string' && item.favicon) ||
                  '';
              }

              const hasPreviewImage = !!previewSrc;
              const hasFavicon =
                typeof item.favicon === 'string' && item.favicon;

              return (
                <article
                  key={item._id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-sm hover:border-emerald-500/60 hover:shadow-emerald-500/10 transition-colors"
                >
                  {hasPreviewImage && (
                    <div className="relative h-32 w-full overflow-hidden bg-slate-900/80">
                      <img
                        src={previewSrc}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
                      {hasFavicon && (
                        <img
                          src={item.favicon}
                          alt={item.domain || 'Site icon'}
                          className="h-4 w-4 rounded-sm border border-slate-800 bg-slate-900 object-contain"
                          loading="lazy"
                        />
                      )}
                      {item.domain && (
                        <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          {item.domain}
                        </span>
                      )}
                      {item.type && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-400 border border-emerald-600/40">
                          {item.type}
                        </span>
                      )}
                    </div>

                    <h2 className="text-sm font-semibold mb-1 line-clamp-2 group-hover:text-emerald-400 transition-colors">
                      {item.title}
                    </h2>

                    {item.description && (
                      <p className="mt-1 text-xs text-slate-400 line-clamp-3">
                        {item.description}
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                      >
                        Open link
                      </a>
                      <button
                        onClick={() => handleDelete(item._id)}
                        disabled={deletingId === item._id}
                        className="inline-flex items-center justify-center rounded-xl border border-red-500/60 px-3 py-1.5 text-[11px] font-medium text-red-200 hover:bg-red-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deletingId === item._id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500">
                      Saved on{' '}
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : '—'}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

