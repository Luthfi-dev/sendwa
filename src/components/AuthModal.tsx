import React, { useState } from 'react';
import { X, UserPlus, LogIn, CheckCircle2, ShieldCheck, AlertCircle, CreditCard, Sparkles, KeyRound, Mail, Smartphone, RefreshCw, ArrowLeft } from 'lucide-react';
import { SubscriptionPlan, UserAccount, AppWhitelabelConfig } from '../types/whatsapp';

interface AuthModalProps {
  isOpen: boolean;
  mode: 'login' | 'register';
  defaultPlanId?: string;
  plans: SubscriptionPlan[];
  onClose: () => void;
  onLoginSuccess: (user: UserAccount) => void;
  onSwitchMode: (mode: 'login' | 'register') => void;
  whitelabel?: AppWhitelabelConfig | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  mode,
  defaultPlanId = 'free',
  plans,
  onClose,
  onLoginSuccess,
  onSwitchMode,
  whitelabel
}) => {
  // Views: 'login' | 'register' | 'verify_otp' | 'forgot_password_step1' | 'forgot_password_step2'
  const [currentView, setCurrentView] = useState<'login' | 'register' | 'verify_otp' | 'forgot_password_step1' | 'forgot_password_step2'>(mode);

  // Form Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('free');
  const [paymentNote, setPaymentNote] = useState('');

  // Verification & Forgot Password State
  const [userIdForVerification, setUserIdForVerification] = useState<string>('');
  const [verificationPhone, setVerificationPhone] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [verificationType, setVerificationType] = useState<'email' | 'whatsapp'>('whatsapp');
  const [otpCooldown, setOtpCooldown] = useState<number>(0);

  // Real-time Availability State
  const [availability, setAvailability] = useState<{
    usernameAvailable?: boolean;
    emailAvailable?: boolean;
    phoneAvailable?: boolean;
    usernameMessage?: string;
    emailMessage?: string;
    phoneMessage?: string;
  }>({});
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotMethod, setForgotMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [newPassword, setNewPassword] = useState('');

  // 2-Step WhatsApp Verification Login State
  const [show2faPrompt, setShow2faPrompt] = useState(false);
  const [userIdFor2fa, setUserIdFor2fa] = useState('');
  const [login2faOtp, setLogin2faOtp] = useState('');
  const [isVerifying2fa, setIsVerifying2fa] = useState(false);

  // Admin PIN Verification Login State
  const [showPinVerifyPrompt, setShowPinVerifyPrompt] = useState(false);
  const [userIdForPin, setUserIdForPin] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Status State
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Countdown timer for OTP sending (30 seconds)
  React.useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Sync mode changes from parent props
  React.useEffect(() => {
    setCurrentView(mode);
    setSelectedPlanId('free');
    setErrorMsg('');
    setSuccessMsg('');
  }, [mode, isOpen]);

  // Real-time debounced availability check
  React.useEffect(() => {
    if (currentView !== 'register') return;
    if (!username.trim() && !email.trim() && !phone.trim()) {
      setAvailability({});
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingAvailability(true);
      try {
        const res = await fetch('/api/auth/check-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined
          })
        });
        const data = await res.json();
        if (data.success) {
          setAvailability({
            usernameAvailable: data.usernameAvailable,
            emailAvailable: data.emailAvailable,
            phoneAvailable: data.phoneAvailable,
            usernameMessage: data.usernameMessage,
            emailMessage: data.emailMessage,
            phoneMessage: data.phoneMessage
          });
        }
      } catch {
      } finally {
        setIsCheckingAvailability(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username, email, phone, currentView]);

  if (!isOpen) return null;

  // 1. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    let deviceId = localStorage.getItem('japriin_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('japriin_device_id', deviceId);
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, device_id: deviceId })
      });
      const data = await res.json().catch(() => null);

      if (!data) {
        setErrorMsg('Gagal terhubung ke server login. Silakan periksa jaringan Anda.');
        return;
      }

      // If account is pending because WhatsApp is not yet verified:
      // Redirect directly to verify OTP view and start 30 seconds countdown
      if (data.requires_wa_verification) {
        setUserIdForVerification(data.user_id);
        setVerificationPhone(data.phone || '');
        setVerificationType('whatsapp');
        setOtpCode('');
        setErrorMsg('');
        setSuccessMsg(data.message || 'Akun Anda masih berstatus Pending. Silakan masukkan kode OTP yang telah dikirim ke nomor WhatsApp Anda.');
        setCurrentView('verify_otp');
        setOtpCooldown(30);
        return;
      }

      if (data.success) {
        if (data.requires_pin_verification) {
          setShowPinVerifyPrompt(true);
          setUserIdForPin(data.user_id);
          setSuccessMsg(data.message || 'Verifikasi PIN Admin aktif!');
        } else if (data.requires_2fa) {
          setShow2faPrompt(true);
          setUserIdFor2fa(data.user_id);
          setSuccessMsg(data.message || 'Verifikasi dua langkah aktif!');
        } else {
          const userObj = data.user || data.data;
          if (userObj) {
            onLoginSuccess(userObj);
            onClose();
          } else {
            setErrorMsg('Gagal memuat profil pengguna.');
          }
        }
      } else {
        setErrorMsg(data.error || 'Login gagal. Periksa username dan password Anda.');
      }
    } catch (err: any) {
      setErrorMsg('Gagal terhubung ke server login. Silakan periksa jaringan Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsVerifyingPin(true);

    let deviceId = localStorage.getItem('japriin_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('japriin_device_id', deviceId);
    }

    try {
      const res = await fetch('/api/auth/verify-login-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userIdForPin,
          pin: loginPin.trim(),
          device_id: deviceId
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setSuccessMsg('✓ Verifikasi PIN berhasil! Mengalihkan...');
        setTimeout(() => {
          onLoginSuccess(data.user);
          onClose();
          setShowPinVerifyPrompt(false);
          setUserIdForPin('');
          setLoginPin('');
          setSuccessMsg('');
        }, 1200);
      } else {
        setErrorMsg(data.error || 'PIN Keamanan salah.');
      }
    } catch (err) {
      setErrorMsg('Gagal melakukan verifikasi PIN. Coba lagi.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleLogin2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsVerifying2fa(true);

    let deviceId = localStorage.getItem('japriin_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('japriin_device_id', deviceId);
    }

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userIdFor2fa,
          otp: login2faOtp.trim(),
          type: 'whatsapp',
          device_id: deviceId
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setSuccessMsg('✓ Verifikasi berhasil! Mengalihkan...');
        setTimeout(() => {
          onLoginSuccess(data.user);
          onClose();
          // Reset 2FA state
          setShow2faPrompt(false);
          setUserIdFor2fa('');
          setLogin2faOtp('');
          setSuccessMsg('');
        }, 1200);
      } else {
        setErrorMsg(data.error || 'Kode verifikasi salah atau kadaluarsa.');
      }
    } catch (err) {
      setErrorMsg('Gagal melakukan verifikasi. Coba lagi.');
    } finally {
      setIsVerifying2fa(false);
    }
  };

  // 2. Handle Register (Defaults to Free Plan Automatically, with clear form after completion)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Pre-check availability before submitting
    if (availability.usernameAvailable === false) {
      setErrorMsg(availability.usernameMessage || 'Username sudah digunakan, silakan pilih username lain.');
      return;
    }
    if (availability.emailAvailable === false) {
      setErrorMsg(availability.emailMessage || 'Email sudah terdaftar pada akun lain.');
      return;
    }
    if (availability.phoneAvailable === false) {
      setErrorMsg(availability.phoneMessage || 'Nomor WhatsApp sudah terdaftar pada akun lain.');
      return;
    }

    setIsSubmitting(true);

    try {
      const regPhone = phone.trim();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          name: name.trim(),
          email: email.trim(),
          phone: regPhone,
          password,
          plan_id: 'free',
          payment_note: 'Pending - Menunggu Verifikasi Nomor WhatsApp'
        })
      });
      const data = await res.json();

      if (data.success) {
        setUserIdForVerification(data.user_id || data.data?.id);
        setVerificationPhone(regPhone);
        setVerificationType('whatsapp');
        setOtpCode('');
        setSuccessMsg(
          data.message ||
            `Pendaftaran berhasil! Kode OTP rahasia 6 digit telah dikirimkan ke nomor WhatsApp ${regPhone}. Silakan masukkan kode OTP untuk mengaktifkan akun Anda.`
        );

        // CLEAR FORM SETELAH SELESAI DAFTAR (User Request: "saat daftar buat clear form setelah selesai")
        setName('');
        setUsername('');
        setEmail('');
        setPhone('');
        setPassword('');
        setPaymentNote('');
        setAvailability({});

        setCurrentView('verify_otp');
        // Jeda hitungan mundur 30 detik untuk kirim ulang
        setOtpCooldown(30);
      } else {
        setErrorMsg(data.error || 'Pendaftaran gagal. Periksa data pendaftaran Anda.');
      }
    } catch (err) {
      setErrorMsg('Gagal terhubung ke server pendaftaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Handle Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userIdForVerification,
          otp: otpCode.trim(),
          type: verificationType
        })
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(`✓ Verifikasi ${verificationType === 'whatsapp' ? 'Nomor WhatsApp' : 'Email'} Berhasil! Akun Anda kini aktif.`);
        const userObj = data.user || data.data;

        // Clear OTP & inputs
        setOtpCode('');
        setName('');
        setUsername('');
        setEmail('');
        setPhone('');
        setPassword('');

        setTimeout(() => {
          if (userObj) onLoginSuccess(userObj);
          onClose();
        }, 1200);
      } else {
        setErrorMsg(data.error || 'Kode OTP tidak cocok atau sudah kadaluarsa.');
      }
    } catch (err) {
      setErrorMsg('Gagal memverifikasi OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend OTP with 30s Cooldown Countdown
  const handleResendOtp = async () => {
    if (otpCooldown > 0 || isSubmitting) return;
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    setOtpCooldown(30);

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userIdForVerification,
          method: verificationType
        })
      });
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setSuccessMsg(data.message || 'Kode OTP baru berhasil dikirimkan!');
        if (data.cooldown_seconds) setOtpCooldown(data.cooldown_seconds);
      } else if (data && data.cooldown_seconds) {
        setOtpCooldown(data.cooldown_seconds);
        setErrorMsg(data.error);
      } else {
        setErrorMsg(data?.error || 'Gagal mengirim ulang OTP.');
      }
    } catch (e) {
      setErrorMsg('Koneksi gagal saat mengirim ulang OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Handle Forgot Password Step 1 (Request OTP with Cooldown)
  const handleRequestForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCooldown > 0 || isSubmitting) return;
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    setOtpCooldown(30);

    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: forgotIdentifier.trim(),
          method: forgotMethod
        })
      });
      const data = await res.json().catch(() => null);

      if (data && data.success) {
        setSuccessMsg(data.message);
        setCurrentView('forgot_password_step2');
        if (data.cooldown_seconds) setOtpCooldown(data.cooldown_seconds);
      } else if (data && data.cooldown_seconds) {
        setOtpCooldown(data.cooldown_seconds);
        setErrorMsg(data.error);
      } else {
        setErrorMsg(data?.error || 'Akun tidak ditemukan.');
      }
    } catch (err) {
      setErrorMsg('Gagal menghubungi server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Handle Forgot Password Step 2 (Reset Password)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: forgotIdentifier.trim(),
          otp: otpCode.trim(),
          new_password: newPassword
        })
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg('Password berhasil diperbarui! Silakan masuk dengan password baru.');
        setTimeout(() => {
          setCurrentView('login');
          setUsername(forgotIdentifier);
          setPassword('');
          setSuccessMsg('Silakan masukkan password baru Anda.');
        }, 1500);
      } else {
        setErrorMsg(data.error || 'Gagal mereset password.');
      }
    } catch (err) {
      setErrorMsg('Gagal memproses reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-7 relative shadow-2xl space-y-5 my-auto text-slate-900 dark:text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2.5">
            <span className="p-2.5 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-2xl">
              {currentView === 'login' && <LogIn className="w-5 h-5" />}
              {currentView === 'register' && <UserPlus className="w-5 h-5" />}
              {currentView === 'verify_otp' && <ShieldCheck className="w-5 h-5" />}
              {(currentView === 'forgot_password_step1' || currentView === 'forgot_password_step2') && <KeyRound className="w-5 h-5" />}
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight pr-8">
                {currentView === 'login' && `Masuk Portal ${whitelabel?.app_name || 'Japriin'}`}
                {currentView === 'register' && 'Daftar Akun Otomatis (Paket Gratis)'}
                {currentView === 'verify_otp' && 'Verifikasi Nomor WhatsApp'}
                {currentView === 'forgot_password_step1' && 'Lupa / Ganti Password Akun'}
                {currentView === 'forgot_password_step2' && 'Atur Password Baru'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {currentView === 'login' && 'Masukkan username dan password Anda untuk mengakses portal.'}
                {currentView === 'register' && 'Akun langsung aktif di Paket Gratis (100 pesan/hari). Verifikasi via WhatsApp.'}
                {currentView === 'verify_otp' && 'Masukkan 6 digit kode OTP rahasia yang dikirim ke nomor WhatsApp Anda.'}
                {currentView === 'forgot_password_step1' && 'Verifikasi default menggunakan WhatsApp, atau opsi kedua via Email (jika email sudah diverifikasi).'}
                {currentView === 'forgot_password_step2' && 'Ketik kode verifikasi 6 digit rahasia dan buat password baru.'}
              </p>
            </div>
          </div>

          {/* Tab Switcher (Visible on Login & Register views) */}
          {(currentView === 'login' || currentView === 'register') && (
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCurrentView('login');
                  onSwitchMode('login');
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
                  currentView === 'login'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('register');
                  onSwitchMode('register');
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
                  currentView === 'register'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Daftar Akun Baru
              </button>
            </div>
          )}
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Notification */}
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block text-emerald-950 dark:text-emerald-200">Informasi Sistem</span>
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {/* Dev OTP Helper Box if provided */}
        {/* Helper removed for security */}

        {/* ---------------- VIEW 1: LOGIN ---------------- */}
        {currentView === 'login' && (
          showPinVerifyPrompt ? (
            <form onSubmit={handleLoginPinSubmit} className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-center space-y-2">
                <span className="text-2xl block">🔐</span>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">Verifikasi Dua Langkah Admin (PIN)</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Sistem mendeteksi login admin dari perangkat/browser baru. Masukkan PIN Keamanan Anda untuk masuk.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 text-center">
                  Masukkan PIN Keamanan Admin (4-8 Digit):
                </label>
                <input
                  type="password"
                  required
                  maxLength={8}
                  value={loginPin}
                  onChange={e => setLoginPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-black tracking-widest text-center text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifyingPin || !loginPin}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 min-h-[44px]"
              >
                {isVerifyingPin ? 'Memverifikasi PIN...' : 'Verifikasi PIN & Masuk'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPinVerifyPrompt(false);
                  setLoginPin('');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all"
              >
                Kembali ke Form Login
              </button>
            </form>
          ) : show2faPrompt ? (
            <form onSubmit={handleLogin2faSubmit} className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-center space-y-2">
                <span className="text-2xl block">🔒</span>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">Verifikasi Dua Langkah Aktif</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Sistem mendeteksi login dari browser/perangkat baru. Kami telah mengirimkan kode OTP keamanan login ke nomor WhatsApp terdaftar Anda.
                </p>
              </div>

              {login2faOtp && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 font-bold text-center">
                  Silakan masukkan kode OTP di bawah ini.
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 text-center">
                  Masukkan Kode Keamanan OTP WhatsApp:
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={login2faOtp}
                  onChange={e => setLogin2faOtp(e.target.value)}
                  placeholder="------"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-black tracking-widest text-center text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying2fa || !login2faOtp}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 min-h-[44px]"
              >
                {isVerifying2fa ? 'Memverifikasi...' : 'Selesaikan Login & Masuk'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShow2faPrompt(false);
                  setLogin2faOtp('');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all"
              >
                Kembali ke Form Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Username atau Email</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Masukkan username atau email Anda"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotIdentifier(username);
                      setCurrentView('forgot_password_step1');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Lupa Password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 min-h-[44px]"
              >
                {isSubmitting ? 'Memverifikasi...' : 'Masuk Sekarang'}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Belum punya akun? </span>
                <button
                  type="button"
                  onClick={() => setCurrentView('register')}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Daftar Akun Baru (Paket Gratis)
                </button>
              </div>
            </form>
          )
        )}

        {/* ---------------- VIEW 2: REGISTER (AUTO FREE TIER) ---------------- */}
        {currentView === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Automatic Free Plan Feature Banner */}
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-300 dark:border-emerald-500/30 rounded-2xl space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Paket Gratis Otomatis Aktif (Rp 0)</span>
                </span>
                <span className="text-[10px] font-black bg-emerald-600 text-white px-2.5 py-1 rounded-full self-start sm:self-auto">
                  100 Pesan / Hari
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Pendaftaran baru langsung aktif di <strong>Paket Gratis</strong> (100 pesan/hari &amp; 500 pesan/bulan), <strong>100% tanpa watermark</strong>. Verifikasi pendaftaran menggunakan <strong>Nomor WhatsApp</strong> (verifikasi Email dapat dilakukan setelah login di menu Profil).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Nama Lengkap / Bisnis</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Contoh: CS Toko Berkah"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Username Login</label>
                  {isCheckingAvailability && username && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      <span>Cek...</span>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="Contoh: tokoberkah"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none font-mono transition-colors ${
                    username && availability.usernameAvailable === false
                      ? 'border-rose-400 dark:border-rose-500/60 focus:border-rose-500'
                      : username && availability.usernameAvailable === true
                      ? 'border-emerald-400 dark:border-emerald-500/60 focus:border-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                  }`}
                />
                {username && availability.usernameAvailable === true && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>✓ Username tersedia</span>
                  </span>
                )}
                {username && availability.usernameAvailable === false && (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 font-bold">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{availability.usernameMessage || 'Username sudah digunakan'}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">No. WhatsApp Aktif (Wajib OTP)</label>
                  {isCheckingAvailability && phone && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      <span>Cek...</span>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="08123456789"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none font-mono transition-colors ${
                    phone && availability.phoneAvailable === false
                      ? 'border-rose-400 dark:border-rose-500/60 focus:border-rose-500'
                      : phone && availability.phoneAvailable === true
                      ? 'border-emerald-400 dark:border-emerald-500/60 focus:border-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                  }`}
                />
                {phone && availability.phoneAvailable === true && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>✓ Nomor WhatsApp tersedia</span>
                  </span>
                )}
                {phone && availability.phoneAvailable === false && (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 font-bold">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{availability.phoneMessage || 'Nomor WhatsApp sudah terdaftar'}</span>
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Email (Verif di Profil)</label>
                  {isCheckingAvailability && email && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      <span>Cek...</span>
                    </span>
                  )}
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@gmail.com"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none transition-colors ${
                    email && availability.emailAvailable === false
                      ? 'border-rose-400 dark:border-rose-500/60 focus:border-rose-500'
                      : email && availability.emailAvailable === true
                      ? 'border-emerald-400 dark:border-emerald-500/60 focus:border-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                  }`}
                />
                {email && availability.emailAvailable === true && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>✓ Email tersedia</span>
                  </span>
                )}
                {email && availability.emailAvailable === false && (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 font-bold">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{availability.emailMessage || 'Email sudah terdaftar'}</span>
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Password Baru</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Buat password aman"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || availability.usernameAvailable === false || availability.emailAvailable === false || availability.phoneAvailable === false}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? 'Mendaftarkan Akun...' : 'Daftar & Kirim OTP ke WhatsApp (Rp 0)'}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Sudah memiliki akun? </span>
              <button
                type="button"
                onClick={() => setCurrentView('login')}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Masuk di Sini
              </button>
            </div>
          </form>
        )}

        {/* ---------------- VIEW 3: VERIFY OTP (WHATSAPP ONLY AT REGISTRATION) ---------------- */}
        {currentView === 'verify_otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-black text-emerald-900 dark:text-emerald-200">
                <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Verifikasi Nomor WhatsApp ({verificationPhone || phone || 'Terdaftar'})</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Kode OTP 6 digit bersifat <strong>rahasia</strong> dan telah dikirim ke nomor WhatsApp Anda. Akun Anda akan aktif segera setelah nomor WhatsApp berhasil diverifikasi.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Kode OTP WhatsApp (6 Digit)
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otpCode.length < 4}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? 'Memverifikasi...' : 'Konfirmasi Verifikasi Nomor WhatsApp'}
            </button>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs pt-2">
              <button
                type="button"
                onClick={() => setCurrentView('register')}
                className="w-full sm:w-auto py-2.5 px-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center justify-center space-x-1.5 text-slate-700 dark:text-slate-300 font-bold transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ubah Data Pendaftaran</span>
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isSubmitting || otpCooldown > 0}
                className={`w-full sm:w-auto py-2.5 px-3.5 rounded-xl flex items-center justify-center space-x-1.5 font-bold text-xs transition-all ${
                  otpCooldown > 0
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                    : 'bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${otpCooldown > 0 ? 'animate-spin opacity-40' : ''}`} />
                <span>
                  {otpCooldown > 0
                    ? `Kirim Ulang (${otpCooldown}s)`
                    : 'Kirim Ulang OTP ke WA'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* ---------------- VIEW 4: FORGOT PASSWORD STEP 1 ---------------- */}
        {currentView === 'forgot_password_step1' && (
          <form onSubmit={handleRequestForgotOtp} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Username, No. WhatsApp, atau Email</label>
              <input
                type="text"
                required
                value={forgotIdentifier}
                onChange={e => setForgotIdentifier(e.target.value)}
                placeholder="Ketik username / no. WhatsApp / email terdaftar"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Pilih Metode Verifikasi Reset Password:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setForgotMethod('whatsapp')}
                  className={`p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold text-xs transition-all ${
                    forgotMethod === 'whatsapp'
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Smartphone className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>1. Kirim ke WhatsApp (Default)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setForgotMethod('email')}
                  className={`p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold text-xs transition-all ${
                    forgotMethod === 'email'
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Mail className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>2. Kirim ke Email (Opsi Kedua)</span>
                </button>
              </div>

              {forgotMethod === 'whatsapp' ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  ✅ <strong>Metode Default (WhatsApp):</strong> Kode OTP rahasia 6 digit akan dikirimkan langsung ke nomor WhatsApp yang terdaftar pada akun Anda.
                </p>
              ) : (
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60">
                  ⚠️ <strong>Syarat Opsi Kedua (Email):</strong> Anda hanya dapat menerima kode OTP reset password melalui Email apabila alamat email pada akun Anda <strong>sudah diverifikasi</strong> sebelumnya di halaman Profil. Jika belum, silakan gunakan opsi WhatsApp.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otpCooldown > 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting
                ? 'Mengirim Kode OTP...'
                : otpCooldown > 0
                ? `Tunggu (${otpCooldown}s) untuk Kirim Ulang`
                : `Kirim Kode OTP via ${forgotMethod === 'whatsapp' ? 'WhatsApp' : 'Email Terverifikasi'}`}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setCurrentView('login')}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Kembali ke Form Masuk
              </button>
            </div>
          </form>
        )}

        {/* ---------------- VIEW 5: FORGOT PASSWORD STEP 2 ---------------- */}
        {currentView === 'forgot_password_step2' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Kode OTP 6 Digit</label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-center text-base font-mono font-bold tracking-widest text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Password Baru</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Masukkan password baru Anda"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otpCode.length < 4 || newPassword.length < 3}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Password Baru & Masuk'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setCurrentView('forgot_password_step1')}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Ganti Metode / Akun
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
