import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { loginSchema } from '../../utils/validation';
import PillNavbar from '../../components/navbar/PillNavbar';
import Footer from '../../components/Footer';

const Login = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});

    const result = loginSchema.safeParse({
      email: email.trim(),
      password,
    });

    if (!result.success) {
      const errors = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0];
        if (path && !errors[path]) {
          errors[path] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      const redirectTo = state?.from?.pathname ?? '/home';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const error = err || {};
      const message = error.message ?? 'Login failed';

      if (error.requiresVerification) {
        toast.error(message);
        localStorage.setItem('pendingVerificationEmail', email.trim());
        navigate('/verify-email', { replace: true });
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    navigate('/home', { replace: true });
  }, [user, navigate]);

  return (
    <div className="relative min-h-screen cinematic-bg px-4 pt-20 pb-10 text-text">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-highlight/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />
      </div>

      <PillNavbar />

      <main className="relative mx-auto pt-12 w-full max-w-6xl">
        <div className="glass-soft grid gap-0 overflow-hidden rounded-[32px] shadow-[0_18px_60px_rgba(0,0,0,0.18)] lg:grid-cols-[1.05fr_0.95fr]">
          <aside className="auth-left-panel hidden flex-col justify-between bg-linear-to-b from-black/80 via-black/70 to-black/80 p-12 text-white lg:flex">
            <div>
              <p className="mb-6 text-xs uppercase tracking-[0.35em] text-white/40">
                Returning viewer
              </p>
              <h1 className="mb-4 text-4xl font-semibold leading-tight text-white">
                Dive back into your cinematic universe
              </h1>
              <p className="max-w-md text-base text-white/70">
                Pick up where you left off with watchlists, recommendations, and reviews all synced
                across your devices.
              </p>
            </div>
            <div className="space-y-4">
              {[
                'Curated picks based on what you love',
                'Seamless playback history across devices',
                'Instant access to your CineScope dashboard after sign-in',
              ].map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-highlight">
                    <Check size={16} />
                  </span>
                  <p className="text-sm text-white/80">{point}</p>
                </div>
              ))}
            </div>
            <div className="text-sm text-white/50">
              New to CineScope?{' '}
              <Link
                to="/register"
                className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight"
              >
                Create an account
              </Link>
            </div>
          </aside>

          <div className="border-t border-white/5 bg-transparent p-8 text-text sm:p-12 lg:border-l lg:border-t-0">
            <div className="mb-10 space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Sign in
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-text">
                Access your account
              </h2>
              <p className="text-sm text-white/65 sm:text-base">
                Use your registered email and password. We&apos;ll automatically route you back to
                the dashboard you last visited.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold text-white/80">
                  Work email
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    disabled={loading}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 pr-12 text-base text-white placeholder:text-white/40 transition focus:border-highlight/70 focus:outline-none focus:ring-2 focus:ring-highlight/30 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/5"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-highlight">
                    <Mail size={20} />
                  </span>
                </div>
                {fieldErrors.email && (
                  <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-semibold text-white/80">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={loading}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 pr-12 text-base text-white placeholder:text-white/40 transition focus:border-highlight/70 focus:outline-none focus:ring-2 focus:ring-highlight/30 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/5"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.password}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-highlight px-6 py-3.5 text-base font-semibold text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/60 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              <div className="space-y-2 text-center text-sm text-white/70">
                <p>
                  Don&apos;t have access yet?{' '}
                  <Link
                    to="/register"
                    className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight"
                  >
                    Register here
                  </Link>
                </p>
                <p>
                  Forgot your password?{' '}
                  <Link
                    to="/forgot-password"
                    className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight"
                  >
                    Reset it
                  </Link>
                </p>
                <p>
                  Didn&apos;t receive verification email?{' '}
                  <Link
                    to="/verify-email"
                    className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight"
                  >
                    Verify your email
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>

        <Footer />
      </main>
    </div>
  );
};

export default Login;

