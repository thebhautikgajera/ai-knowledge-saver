import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import http from '../../api/http';
import PillNavbar from '../../components/navbar/PillNavbar';
import Footer from '../../components/Footer';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      const response = await http.post('/user/forgot-password', { email });

      if (response.data.success) {
        toast.success('Password reset OTP has been sent to your email');
        localStorage.setItem('resetPasswordEmail', email);
        navigate('/reset-password', { state: { email } });
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || 'Failed to send reset OTP. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen cinematic-bg px-4 pt-20 pb-10 text-text">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-highlight/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
      </div>

      <PillNavbar />

      <main className="relative mx-auto pt-12 w-full max-w-md">
        <div className="glass-soft rounded-[28px] px-6 py-8 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:px-10 sm:py-10">
          <div className="mb-8 space-y-3 text-center">
            <span className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Password reset
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Forgot your password?
            </h2>
            <p className="text-sm text-white/70 sm:text-base">
              Enter the email associated with your account and we&apos;ll send you a one-time code
              to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold text-white/80">
                Work email
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  onChange={(e) => setEmail(e.target.value)}
                  value={email}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white shadow-sm placeholder:text-white/40 focus:border-highlight/70 focus:outline-none focus:ring-2 focus:ring-highlight/30 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/5"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-highlight px-6 py-3.5 text-sm font-semibold text-black shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/60 disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sending reset code...</span>
                </span>
              ) : (
                'Send reset code'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/70">
            Remember your password?{' '}
            <Link
              to="/login"
              className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight"
            >
              Back to login
            </Link>
          </p>
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default ForgotPassword;

