import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Circle, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { checkEmailAvailability } from '../../api/auth';
import toast from 'react-hot-toast';
import { registerSchema } from '../../utils/validation';
import PillNavbar from '../../components/navbar/PillNavbar';
import Footer from '../../components/Footer';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [emailError, setEmailError] = useState(null);
  const [emailValid, setEmailValid] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    }),
    [password]
  );

  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    const satisfiedChecks = Object.values(passwordChecks).filter(Boolean).length;
    return Math.min(satisfiedChecks, 4);
  }, [password, passwordChecks]);

  const validateEmail = (emailValue) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const checkEmail = useCallback(
    async (emailValue) => {
      if (!emailValue) {
        setEmailValid(false);
        setEmailAvailable(null);
        setEmailError(null);
        return;
      }

      if (!validateEmail(emailValue)) {
        setEmailValid(false);
        setEmailAvailable(null);
        setEmailError('Please enter a valid email address');
        return;
      }

      setEmailError(null);
      setEmailValid(true);
      setCheckingEmail(true);

      try {
        const available = await checkEmailAvailability(emailValue);
        setEmailAvailable(available);
        if (!available) {
          setEmailError('This email is already registered');
        }
      } catch {
        setEmailAvailable(null);
        setEmailError('Unable to verify email availability');
      } finally {
        setCheckingEmail(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (email) {
        checkEmail(email);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email, checkEmail]);

  useEffect(() => {
    if (!confirmPassword) {
      setPasswordMatch(null);
      return;
    }
    setPasswordMatch(password === confirmPassword);
  }, [password, confirmPassword]);

  const handleNextStep = () => {
    setError(null);
    setFieldErrors({});

    const errors = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    setLoading(true);

    const validationResult = registerSchema.safeParse({
      email: email.trim(),
      password,
      confirmPassword,
    });

    if (!validationResult.success) {
      const errors = {};
      for (const issue of validationResult.error.issues) {
        const path = issue.path[0];
        if (path && !errors[path]) {
          errors[path] = issue.message;
        }
      }
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    if (!emailValid || emailAvailable === false) {
      setError('Please enter a valid and available email address');
      return;
    }

    if (passwordStrength < 3) {
      setError('Password does not meet security requirements');
      return;
    }

    toast.loading('Creating account...');
    try {
      await register(email.trim(), password);
      toast.success('Registration successful! Please check your email for a verification code.');
      window.localStorage.setItem('pendingVerificationEmail', email.trim());
      setTimeout(() => {
        navigate('/verify-otp', { state: { email: email.trim() }, replace: true });
      }, 1500);
    } catch (error) {
      toast.error(error?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
      toast.dismiss();
    }
  };

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
              <p className="mb-6 text-xs uppercase tracking-[0.35em] text-white/60">Welcome</p>
              <h1 className="mb-4 text-4xl font-semibold leading-tight text-white">
                Create your CineScope account
              </h1>
              <p className="max-w-md text-base text-white/70">
                Set up a secure profile so you can discover movies beyond the screen, keep watchlists
                in sync, and never lose your place.
              </p>
            </div>
            <div className="space-y-4">
              {[
                'Real-time email checks to keep your account safe',
                'Strong password guidelines baked into sign-up',
                'Thoughtful safeguards around verification and access',
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
              Need assistance?{' '}
              <a
                href="mailto:support@cinescope.app"
                className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight"
              >
                Contact support
              </a>
            </div>
          </aside>

          <div className="border-t border-white/5 bg-transparent p-8 text-text sm:p-12 lg:border-l lg:border-t-0">
            <div className="mb-10 space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                {step === 1 ? 'Step 1 of 2' : 'Step 2 of 2'}
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-text">
                {step === 1 ? 'Create your account' : 'Secure your account'}
              </h2>
              <p className="text-sm text-white/65 sm:text-base">
                {step === 1
                  ? 'Start with your email so we can secure your CineScope account.'
                  : 'Set a strong password to protect your profile and watchlist.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="email" className="text-sm font-semibold text-white/80">
                        Work email
                      </label>
                      <span className="text-xs font-medium text-white/50">Required</span>
                    </div>
                    <div className="relative">
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        disabled={loading}
                        className={`w-full rounded-xl border px-4 py-3 pr-12 text-base text-white transition-all placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-highlight/30 ${emailError
                            ? 'border-red-400 focus:border-red-500'
                            : emailValid && emailAvailable
                              ? 'border-emerald-400 bg-emerald-500/10 focus:border-emerald-500'
                              : 'border-white/15 bg-white/5 focus:border-highlight/70'
                          }`}
                      />
                      {checkingEmail && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </span>
                      )}
                      {!checkingEmail && emailValid && emailAvailable !== null && (
                        <span
                          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${emailAvailable ? 'text-emerald-500' : 'text-red-500'
                            }`}
                        >
                          {emailAvailable ? <Check size={20} /> : <X size={20} />}
                        </span>
                      )}
                    </div>
                    {fieldErrors.email && (
                      <p className="text-sm font-medium text-red-400">{fieldErrors.email}</p>
                    )}
                    {!fieldErrors.email && emailError && (
                      <p className="text-sm font-medium text-red-400">{emailError}</p>
                    )}
                    {emailValid && emailAvailable && (
                      <p className="text-sm font-medium text-emerald-400">Email is available</p>
                    )}
                  </div>

                  {/* Phone number field removed – registration now uses only email and password */}
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-6">
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
                          placeholder="Create a strong password"
                          disabled={loading}
                          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 pr-12 text-base text-white placeholder:text-white/40 transition focus:border-highlight/70 focus:outline-none focus:ring-2 focus:ring-highlight/30"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-white/60 transition hover:bg-white/10 hover:text-white"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={loading}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p className="mt-1 text-sm font-medium text-red-600">
                          {fieldErrors.password}
                        </p>
                      )}
                    </div>

                    {password && (
                      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5/80 p-4">
                        <div>
                          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                            Strength
                          </p>
                          <div className="mb-2 flex gap-1.5">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className={`h-1 flex-1 rounded-full ${level <= passwordStrength
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
                      Confirm password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        disabled={loading}
                        className={`w-full rounded-xl border px-4 py-3 pr-12 text-base text-white transition placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-highlight/30 ${confirmPassword
                            ? passwordMatch
                              ? 'border-emerald-400 bg-emerald-500/10 focus:border-emerald-500'
                              : 'border-red-400 bg-red-500/10 focus:border-red-500'
                            : 'border-white/15 bg-white/5 focus:border-highlight/70'
                          }`}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-white/60 transition hover:bg-white/10 hover:text-white"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={loading}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                      {confirmPassword && passwordMatch !== null && (
                        <span
                          className={`pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 ${passwordMatch ? 'text-emerald-400' : 'text-red-400'
                            }`}
                        >
                          {passwordMatch ? <Check size={20} /> : <X size={20} />}
                        </span>
                      )}
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p className="mt-1 text-sm font-medium text-red-600">
                        {fieldErrors.confirmPassword}
                      </p>
                    )}
                    {confirmPassword && passwordMatch === false && (
                      <p className="text-sm font-medium text-red-400">Passwords do not match</p>
                    )}
                    {confirmPassword && passwordMatch && (
                      <p className="text-sm font-medium text-emerald-400">Passwords match</p>
                    )}
                  </div>
                </>
              )}

              {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <X size={18} />
                  <p>{error}</p>
                </div>
              )}
              {success && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  <Check size={18} />
                  <p>{success}</p>
                </div>
              )}

              <div className="flex gap-3">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={loading}
                  >
                    Back
                  </button>
                )}

                {step === 1 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full rounded-xl bg-highlight px-6 py-3.5 text-base font-semibold text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/60 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={loading || !validateEmail(email)}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-highlight px-6 py-3.5 text-base font-semibold text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/60 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={
                      loading ||
                      !emailValid ||
                      emailAvailable === false ||
                      passwordStrength < 3 ||
                      password !== confirmPassword ||
                      !confirmPassword
                    }
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        Creating account...
                      </span>
                    ) : (
                      'Create account'
                    )}
                  </button>
                )}
              </div>

              <p className="text-center text-sm text-white/70">
                Already onboarded?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight"
                >
                  Sign in here
                </Link>
              </p>
            </form>
          </div>
        </div>

        <Footer />
      </main>
    </div>
  );
};

export default Register;

