import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Home = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    // After logout, ProtectedRoute will redirect to /login
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-4xl w-full grid gap-8 md:grid-cols-[1.4fr,1fr] items-center">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 px-8 py-10 shadow-xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400 mb-3">
            AI Knowledge Saver
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-3">
            Welcome back,{' '}
            <span className="text-emerald-400 break-all">{user.email}</span>
          </h1>
          <p className="text-sm text-slate-300 mb-3">
            Your authentication is set up and ready. This workspace is now your personal
            hub for saving articles, threads, and videos you don&apos;t want to forget.
          </p>
          <p className="text-xs text-slate-400 mb-8">
            Start by exploring your dashboard or manually adding a URL. Later, you can
            plug in AI features like auto-tagging, semantic search, and a knowledge graph
            without changing this flow.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              Go to dashboard
            </Link>
            <Link
              to="/add"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:border-emerald-500 hover:bg-slate-900 transition-colors"
            >
              + Add a URL
            </Link>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-xs text-slate-300">
            <p className="font-medium mb-1">Chrome extension flow</p>
            <ol className="space-y-1 list-decimal list-inside text-slate-400">
              <li>Open any article, tweet, or video.</li>
              <li>Click the &quot;AI Knowledge Saver&quot; browser extension.</li>
              <li>Hit &quot;Save Current Page&quot; to send it here.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-[11px] text-slate-400">
            <p className="font-medium text-slate-200 mb-1">Future-ready design</p>
            <p>
              Items are stored in MongoDB with fields for <span className="font-semibold">title</span>,{' '}
              <span className="font-semibold">url</span>, <span className="font-semibold">description</span>,{' '}
              <span className="font-semibold">userId</span>, and <span className="font-semibold">createdAt</span>,
              so you can later plug in embeddings, auto-tags, and graph views.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-900 transition-colors"
          >
            Logout
          </button>
        </aside>
      </div>
    </div>
  );
};

export default Home;

