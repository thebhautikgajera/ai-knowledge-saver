import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import ThemeToggle from '../ui/ThemeToggle.jsx';

const PillNavbar = memo(() => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-3">
      <div className="w-full max-w-4xl">
        <div className="glass-soft flex items-center justify-between gap-3 rounded-full px-4 py-2">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="group flex items-center gap-2 rounded-full px-2 py-1 transition hover:bg-white/5"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-highlight shadow-[0_0_18px_color-mix(in_oklab,var(--color-highlight)_55%,transparent)]" />
            <span className="text-sm font-semibold tracking-tight text-white/90">
              Auth Starter
            </span>
          </button>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <span className="hidden text-xs text-white/70 sm:inline">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/login', { replace: true });
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-highlight px-3 py-1.5 text-xs font-semibold text-slate-950 hover:brightness-110"
                >
                  <LogOut className="h-3 w-3" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="rounded-full bg-highlight px-3 py-1.5 text-xs font-semibold text-slate-950 hover:brightness-110"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

PillNavbar.displayName = 'PillNavbar';

export default PillNavbar;

