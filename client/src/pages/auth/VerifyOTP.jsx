import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import http from '../../api/http';
import PillNavbar from '../../components/navbar/PillNavbar';
import Footer from '../../components/Footer';

const VerifyOTP = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const storedCooldown = localStorage.getItem('resendCooldown_verifyOTP');
    if (storedCooldown) {
      const cooldownEndTime = parseInt(storedCooldown, 10);
      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.ceil((cooldownEndTime - now) / 1000));

      if (remainingSeconds > 0) {
        setCountdown(remainingSeconds);
      } else {
        localStorage.removeItem('resendCooldown_verifyOTP');
      }
    }
  }, []);

  useEffect(() => {
    const emailFromState = location.state?.email;
    const emailFromStorage = localStorage.getItem('pendingVerificationEmail');

    if (emailFromState) {
      setVerificationEmail(emailFromState);
      localStorage.setItem('pendingVerificationEmail', emailFromState);
    } else if (emailFromStorage) {
      setVerificationEmail(emailFromStorage);
    } else {
      navigate('/register', { replace: true });
      return;
    }
  }, [navigate, location.state]);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);

      const cooldownEndTime = Date.now() + countdown * 1000;
      localStorage.setItem('resendCooldown_verifyOTP', cooldownEndTime.toString());
    } else {
      localStorage.removeItem('resendCooldown_verifyOTP');
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  const handleChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      document.getElementById('otp-5')?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const otpValue = otp.join('');

    if (otpValue.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      const response = await http.post('/user/verify-otp', {
        email: verificationEmail,
        otp: otpValue,
      });

      if (response.data.success) {
        toast.success('Email verified successfully! You can now sign in.');
        localStorage.removeItem('pendingVerificationEmail');
        localStorage.removeItem('resendCooldown_verifyOTP');
        navigate('/login', { replace: true });
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || 'Verification failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setResendLoading(true);

      if (!verificationEmail) {
        toast.error('No email address found for verification');
        return;
      }

      const response = await http.post('/user/resend-otp', {
        email: verificationEmail,
      });

      if (response.data.success) {
        toast.success('OTP resent successfully! Please check your email.');
        const cooldownEndTime = Date.now() + 30 * 1000;
        localStorage.setItem('resendCooldown_verifyOTP', cooldownEndTime.toString());
        setCountdown(30);
        setOtp(['', '', '', '', '', '']);
      } else {
        toast.error(response.data.message || 'Failed to resend OTP');
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || 'Failed to resend OTP. Please try again.';
      toast.error(errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();

    if (!newEmail) {
      toast.error('Please enter a new email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setChangeEmailLoading(true);

      const response = await http.post('/user/change-verification-email', {
        oldEmail: verificationEmail,
        newEmail,
      });

      if (response.data.success) {
        toast.success('Email updated successfully! A new verification code has been sent.');

        setVerificationEmail(response.data.email);
        localStorage.setItem('pendingVerificationEmail', response.data.email);

        setOtp(['', '', '', '', '', '']);
        setShowChangeEmail(false);
        setNewEmail('');

        const cooldownEndTime = Date.now() + 30 * 1000;
        localStorage.setItem('resendCooldown_verifyOTP', cooldownEndTime.toString());
        setCountdown(30);
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || 'Failed to update email address. Please try again.';
      toast.error(errorMessage);
    } finally {
      setChangeEmailLoading(false);
    }
  };

  if (!verificationEmail) {
    return null;
  }

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
              Email verification
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Enter your verification code
            </h2>
            <p className="text-sm text-white/70 sm:text-base">
              We&apos;ve sent a 6-digit code to{' '}
              <span className="font-medium text-text">{verificationEmail}</span>. Enter it
              below to activate your account.
            </p>
          </div>

          {showChangeEmail ? (
            <form onSubmit={handleChangeEmail} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="new-email" className="text-sm font-semibold text-white/80">
                  New email address
                </label>
                <input
                  id="new-email"
                  name="new-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white shadow-sm placeholder:text-white/40 focus:border-highlight/70 focus:outline-none focus:ring-2 focus:ring-highlight/30"
                  placeholder="name@company.com"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={changeEmailLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-highlight px-6 py-3.5 text-sm font-semibold text-black shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/60 disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
                >
                  {changeEmailLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{changeEmailLoading ? 'Updating...' : 'Update email'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowChangeEmail(false)}
                  className="flex-1 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/50 sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label className="block text-center text-sm font-semibold text-white/80">
                  Enter verification code
                </label>
                <div className="flex justify-center gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      className="h-11 w-11 rounded-xl border border-white/15 bg-white/5 text-center text-lg font-semibold text-white shadow-sm focus:border-highlight/70 focus:outline-none focus:ring-2 focus:ring-highlight/30 sm:h-12 sm:w-12 sm:text-xl"
                      autoComplete="off"
                    />
                  ))}
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
                    <span>Verifying...</span>
                  </span>
                ) : (
                  'Verify email'
                )}
              </button>

              <div className="space-y-2 text-center text-sm text-white/70">
                <p>Didn&apos;t receive the code?</p>
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resendLoading || countdown > 0}
                  className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight disabled:cursor-not-allowed disabled:no-underline disabled:text-white/40"
                >
                  {countdown > 0
                    ? `Resend code in ${countdown}s`
                    : resendLoading
                      ? 'Sending...'
                      : 'Resend code'}
                </button>
              </div>

              <div className="mt-2 border-t border-white/10 pt-4 text-center text-sm text-white/70">
                <p className="mb-2">Not your email address?</p>
                <button
                  type="button"
                  onClick={() => setShowChangeEmail(true)}
                  className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight"
                >
                  Change email address
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-white/70">
            Back to{' '}
            <Link
              to="/login"
              className="font-semibold text-highlight underline decoration-highlight/40 underline-offset-4 hover:decoration-highlight"
            >
              login
            </Link>
          </p>
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default VerifyOTP;

