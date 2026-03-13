import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Check, Circle, Eye, EyeOff, Loader2 } from 'lucide-react';
import http from '../../api/http';
import PillNavbar from '../../components/navbar/PillNavbar';
import Footer from '../../components/Footer';

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });

  const passwordChecks = useMemo(
    () => ({
      minLength: formData.newPassword.length >= 8,
      hasUpperCase: /[A-Z]/.test(formData.newPassword),
      hasLowerCase: /[a-z]/.test(formData.newPassword),
      hasNumber: /[0-9]/.test(formData.newPassword),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(formData.newPassword),
    }),
    [formData.newPassword]
  );

  const passwordStrength = useMemo(() => {
    if (!formData.newPassword) return 0;
    const satisfiedChecks = Object.values(passwordChecks).filter(Boolean).length;
    return Math.min(satisfiedChecks, 4);
  }, [formData.newPassword, passwordChecks]);

  useEffect(() => {
    const email = location.state?.email || localStorage.getItem('resetPasswordEmail');
    if (email) {
      setFormData((prev) => ({ ...prev, email }));
    } else {
      navigate('/forgot-password');
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const storedCooldown = localStorage.getItem('resendCooldown_resetPassword');
    if (storedCooldown) {
      const cooldownEndTime = parseInt(storedCooldown, 10);
      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.ceil((cooldownEndTime - now) / 1000));

      if (remainingSeconds > 0) {
        setResendCountdown(remainingSeconds);
      } else {
        localStorage.removeItem('resendCooldown_resetPassword');
      }
    }
  }, []);

  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((prev) => prev - 1), 1000);

      const cooldownEndTime = Date.now() + resendCountdown * 1000;
      localStorage.setItem('resendCooldown_resetPassword', cooldownEndTime.toString());
    } else {
      localStorage.removeItem('resendCooldown_resetPassword');
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resendCountdown]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'otp') {
      const numeric = value.replace(/\D/g, '').slice(0, 6);
      setFormData((prev) => ({
        ...prev,
        otp: numeric,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleResendOTP = async () => {
    if (!formData.email) {
      toast.error('No email address found');
      return;
    }

    try {
      setResendLoading(true);
      const response = await http.post('/user/forgot-password', {
        email: formData.email,
      });

      if (response.data.success) {
        toast.success('Password reset code has been resent to your email');
        const cooldownEndTime = Date.now() + 30 * 1000;
        localStorage.setItem('resendCooldown_resetPassword', cooldownEndTime.toString());
        setResendCountdown(30);
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || 'Failed to resend code. Please try again.';
      toast.error(errorMessage);

      const retryAfter = error?.response?.data?.retryAfter;
      if (retryAfter && typeof retryAfter === 'number') {
        const cooldownEndTime = Date.now() + retryAfter * 1000;
        localStorage.setItem('resendCooldown_resetPassword', cooldownEndTime.toString());
        setResendCountdown(Math.ceil(retryAfter));
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.otp || !formData.newPassword || !formData.confirmPassword) {
      toast.error('Please fill all required fields');
      return;
    }

    if (formData.otp.length !== 6) {
      toast.error('Verification code must be 6 digits');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordStrength < 3) {
      toast.error('Password does not meet security requirements');
      return;
    }

    try {
      setLoading(true);
      const response = await http.post('/user/reset-password', {
        email: formData.email,
        otp: formData.otp,
        newPassword: formData.newPassword,
      });

      if (response.data.success) {
        toast.success('Password reset successful');
        localStorage.removeItem('resetPasswordEmail');
        localStorage.removeItem('resendCooldown_resetPassword');
        navigate('/login');
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || 'Failed to reset password. Please try again.';
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

      <main className="relative pt-12 mx-auto w-full max-w-md">
        <div className="glass-soft rounded-[28px] px-6 py-8 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:px-10 sm:py-10">
          <div className="mb-8 space-y-3 text-center">
            <span className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Password reset
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Set a new password
            </h2>
            <p className="text-sm text-white/70 sm:text-base">
              Enter the one-time code sent to your email and choose a new password to secure your
              account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold text-white/80">
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                readOnly
                value={formData.email}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white shadow-sm placeholder:text-white/40 focus:border-highlight/60 focus:outline-none focus:ring-2 focus:ring-highlight/25"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="otp" className="text-sm font-semibold text-white/80">
                Verification code
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                required
                onChange={handleChange}
                value={formData.otp}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white shadow-sm placeholder:text-white/40 focus:border-highlight/70 focus:outline-none focus:ring-2 focus:ring-highlight/30"
                placeholder="Enter 6-digit code"
              />
              {formData.otp && formData.otp.length !== 6 && (
                <p className="text-xs font-medium text-red-400">
                  Verification code must be exactly 6 digits
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-semibold text-white/80">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    onChange={handleChange}
                    value={formData.newPassword}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 pr-11 text-base text-white shadow-sm placeholder:text-white/40 focus:border-highlight/70 focus:outline-none focus:ring-2 focus:ring-highlight/30"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/60 hover:text-white focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {formData.newPassword && (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5/80 p-4">
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                      Strength
                    </p>
                    <div className="mb-2 flex gap-1.5">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full ${
                            level <= passwordStrength
                              ? passwordStrength === 1
                                ? 'bg-red-500'
                                : passwordStrength === 2
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                              : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm font-semibold text-white/80">
                      {passwordStrength === 0 && 'Very weak'}
                      {passwordStrength === 1 && 'Weak'}
                      {passwordStrength === 2 && 'Fair'}
                      {passwordStrength === 3 && 'Good'}
                      {passwordStrength === 4 && 'Strong'}
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm text-white/75 md:grid-cols-2">
                    {[
                      { key: 'minLength', label: 'At least 8 characters' },
                      { key: 'hasUpperCase', label: 'One uppercase letter' },
                      { key: 'hasLowerCase', label: 'One lowercase letter' },
                      { key: 'hasNumber', label: 'One number' },
                      { key: 'hasSpecialChar', label: 'One special character' },
                    ].map((rule) => (
                      <div key={rule.key} className="flex items-center gap-2">
                        {passwordChecks[rule.key] ? (
                          <Check size={16} className="text-emerald-500" />
                        ) : (
                          <Circle size={16} className="text-slate-300" />
                        )}
                        <span>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-semibold text-white/80">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  onChange={handleChange}
                  value={formData.confirmPassword}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 pr-11 text-base text-white shadow-sm placeholder:text-white/40 focus:border-highlight/70 focus:outline-none focus:ring-2 focus:ring-highlight/30"
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/60 hover:text-white focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !formData.otp ||
                formData.otp.length !== 6 ||
                !formData.newPassword ||
                !formData.confirmPassword ||
                passwordStrength < 3 ||
                formData.newPassword !== formData.confirmPassword
              }
              className="w-full rounded-xl bg-highlight px-6 py-3.5 text-sm font-semibold text-black shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/60 disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Resetting password...</span>
                </span>
              ) : (
                'Reset password'
              )}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-white/70">
            <p>
              Didn&apos;t receive a code?{' '}
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendLoading || resendCountdown > 0}
                className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight disabled:cursor-not-allowed disabled:no-underline disabled:text-white/40"
              >
                {resendCountdown > 0
                  ? `Resend code in ${resendCountdown}s`
                  : resendLoading
                  ? 'Sending...'
                  : 'Resend code'}
              </button>
            </p>
            <p>
              Remember your password?{' '}
              <Link
                to="/login"
                className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight"
              >
                Back to login
              </Link>
            </p>
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default ResetPassword;

