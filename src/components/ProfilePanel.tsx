import React, { useState, useEffect } from 'react';
import {
  User,
  ShieldCheck,
  Smartphone,
  Key,
  Mail,
  Copy,
  Check,
  Sparkles,
  Award,
  Lock,
  RefreshCw,
  Zap,
  CheckCircle2,
  Calendar,
  CreditCard,
  Eye,
  EyeOff,
  Save,
  Trash2,
  MessageSquare
} from 'lucide-react';
import { UserAccount, SubscriptionPlan } from '../types/whatsapp';

interface ProfilePanelProps {
  currentUser: UserAccount | null;
  plans: SubscriptionPlan[];
  onOpenPinModal: () => void;
  onOpenUpgradeModal: (plan: SubscriptionPlan) => void;
  onUpdateUser: (updatedUser: UserAccount) => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({
  currentUser,
  plans,
  onOpenPinModal,
  onOpenUpgradeModal,
  onUpdateUser
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Personal AI Settings state
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [offlineMessageInput, setOfflineMessageInput] = useState('');
  const [allowedNumbersInput, setAllowedNumbersInput] = useState('');
  const [allowedNumbersList, setAllowedNumbersList] = useState<string[]>([]);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isDeletingKey, setIsDeletingKey] = useState(false);
  const [isSavingMsg, setIsSavingMsg] = useState(false);
  const [isSavingNumbers, setIsSavingNumbers] = useState(false);
  const [showKeyText, setShowKeyText] = useState(false);

  // Email and WhatsApp Verification States
  const [emailOtp, setEmailOtp] = useState('');
  const [waOtp, setWaOtp] = useState('');
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  const [isSendingWaOtp, setIsSendingWaOtp] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isVerifyingWa, setIsVerifyingWa] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showWaInput, setShowWaInput] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [emailCooldown, setEmailCooldown] = useState<number>(0);
  const [waCooldown, setWaCooldown] = useState<number>(0);

  // Change Password States (Default WhatsApp, 2nd option Verified Email)
  const [pwdResetMethod, setPwdResetMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [pwdOtpSent, setPwdOtpSent] = useState(false);
  const [pwdOtpCode, setPwdOtpCode] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSendingPwdOtp, setIsSendingPwdOtp] = useState(false);
  const [isSubmittingNewPwd, setIsSubmittingNewPwd] = useState(false);
  const [pwdChangeError, setPwdChangeError] = useState('');
  const [pwdChangeSuccess, setPwdChangeSuccess] = useState('');
  const [pwdOtpCooldown, setPwdOtpCooldown] = useState<number>(0);

  // 30 seconds countdown timers for OTP sending
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => setEmailCooldown(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  useEffect(() => {
    if (waCooldown <= 0) return;
    const timer = setInterval(() => setWaCooldown(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [waCooldown]);

  useEffect(() => {
    if (pwdOtpCooldown <= 0) return;
    const timer = setInterval(() => setPwdOtpCooldown(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [pwdOtpCooldown]);

  // Sync inputs with user account when it changes
  useEffect(() => {
    if (currentUser) {
      setGeminiKeyInput(currentUser.custom_gemini_key || '');
      setOfflineMessageInput(currentUser.custom_offline_message || '');
      setAllowedNumbersList(currentUser.allowed_numbers || []);
    }
  }, [currentUser]);

  const handleSendEmailOtp = async () => {
    if (!currentUser || emailCooldown > 0 || isSendingEmailOtp) return;
    setIsSendingEmailOtp(true);
    setVerificationError('');
    setEmailCooldown(30);
    try {
      const res = await fetch('/api/user/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id })
      });
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setShowEmailInput(true);
        setSuccessMsg('Kode verifikasi OTP telah dikirim ke email Anda!');
        if (data.cooldown_seconds) setEmailCooldown(data.cooldown_seconds);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else if (data && data.cooldown_seconds) {
        setEmailCooldown(data.cooldown_seconds);
        setVerificationError(data.error);
      } else {
        setVerificationError(data?.error || 'Gagal mengirim email OTP.');
      }
    } catch (err) {
      setVerificationError('Terjadi kesalahan koneksi.');
    } finally {
      setIsSendingEmailOtp(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!currentUser || !emailOtp) return;
    setIsVerifyingEmail(true);
    setVerificationError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, otp: emailOtp, type: 'email' })
      });
      const data = await res.json();
      if (data.success && data.user) {
        onUpdateUser(data.user);
        setShowEmailInput(false);
        setEmailOtp('');
        setSuccessMsg('✓ Email Anda berhasil diverifikasi!');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setVerificationError(data.error || 'Kode OTP tidak cocok atau sudah kadaluarsa.');
      }
    } catch (err) {
      setVerificationError('Terjadi kesalahan verifikasi.');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const handleSendWaOtp = async () => {
    if (!currentUser || waCooldown > 0 || isSendingWaOtp) return;
    setIsSendingWaOtp(true);
    setVerificationError('');
    setWaCooldown(30);
    try {
      const res = await fetch('/api/user/send-wa-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id })
      });
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setShowWaInput(true);
        setSuccessMsg('Kode verifikasi OTP telah dikirim ke nomor WhatsApp Anda!');
        if (data.cooldown_seconds) setWaCooldown(data.cooldown_seconds);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else if (data && data.cooldown_seconds) {
        setWaCooldown(data.cooldown_seconds);
        setVerificationError(data.error);
      } else {
        setVerificationError(data?.error || 'Gagal mengirim WhatsApp OTP.');
      }
    } catch (err) {
      setVerificationError('Terjadi kesalahan koneksi.');
    } finally {
      setIsSendingWaOtp(false);
    }
  };

  const handleVerifyWaOtp = async () => {
    if (!currentUser || !waOtp) return;
    setIsVerifyingWa(true);
    setVerificationError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, otp: waOtp, type: 'whatsapp' })
      });
      const data = await res.json();
      if (data.success && data.user) {
        onUpdateUser(data.user);
        setShowWaInput(false);
        setWaOtp('');
        setSuccessMsg('✓ Nomor WhatsApp Anda berhasil diverifikasi!');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setVerificationError(data.error || 'Kode OTP tidak cocok atau sudah kadaluarsa.');
      }
    } catch (err) {
      setVerificationError('Terjadi kesalahan verifikasi.');
    } finally {
      setIsVerifyingWa(false);
    }
  };

  const handleRequestPasswordOtp = async () => {
    if (!currentUser || pwdOtpCooldown > 0 || isSendingPwdOtp) return;
    setPwdChangeError('');
    setPwdChangeSuccess('');

    if (pwdResetMethod === 'email' && !currentUser.email_verified) {
      setPwdChangeError('Email Anda belum terverifikasi. Silakan verifikasi email terlebih dahulu pada bagian Verifikasi Alamat Email di atas, atau gunakan metode utama WhatsApp.');
      return;
    }

    const identifier = pwdResetMethod === 'whatsapp' ? (currentUser.phone || currentUser.email) : currentUser.email;
    if (!identifier) {
      setPwdChangeError('Nomor WhatsApp atau Email tidak ditemukan pada akun Anda.');
      return;
    }

    setIsSendingPwdOtp(true);
    setPwdOtpCooldown(30);
    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, method: pwdResetMethod })
      });
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setPwdOtpSent(true);
        setPwdChangeSuccess(
          pwdResetMethod === 'whatsapp'
            ? 'Kode OTP rahasia untuk ganti password telah dikirim ke nomor WhatsApp Anda.'
            : 'Kode OTP rahasia untuk ganti password telah dikirim ke alamat Email terverifikasi Anda.'
        );
        if (data.cooldown_seconds) setPwdOtpCooldown(data.cooldown_seconds);
      } else if (data && data.cooldown_seconds) {
        setPwdOtpCooldown(data.cooldown_seconds);
        setPwdChangeError(data.error);
      } else {
        setPwdChangeError(data?.error || 'Gagal mengirim kode OTP ganti password.');
      }
    } catch (err) {
      setPwdChangeError('Terjadi kesalahan koneksi saat meminta OTP.');
    } finally {
      setIsSendingPwdOtp(false);
    }
  };

  const handleResetPasswordWithOtp = async () => {
    if (!currentUser) return;
    setPwdChangeError('');
    setPwdChangeSuccess('');

    if (!pwdOtpCode || pwdOtpCode.trim().length < 6) {
      setPwdChangeError('Masukkan 6-digit kode OTP terlebih dahulu.');
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 6) {
      setPwdChangeError('Password baru minimal harus terdiri dari 6 karakter.');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setPwdChangeError('Konfirmasi password baru tidak cocok.');
      return;
    }

    const identifier = pwdResetMethod === 'whatsapp' ? (currentUser.phone || currentUser.email) : currentUser.email;
    setIsSubmittingNewPwd(true);
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          otp: pwdOtpCode.trim(),
          new_password: newPasswordInput
        })
      });
      const data = await res.json();
      if (data.success) {
        setPwdOtpSent(false);
        setPwdOtpCode('');
        setNewPasswordInput('');
        setConfirmNewPasswordInput('');
        setPwdChangeSuccess('✓ Password akun Anda berhasil diperbarui!');
        setSuccessMsg('✓ Password akun Anda berhasil diperbarui!');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setPwdChangeError(data.error || 'Kode OTP tidak valid atau gagal mengganti password.');
      }
    } catch (err) {
      setPwdChangeError('Terjadi kesalahan koneksi saat memperbarui password.');
    } finally {
      setIsSubmittingNewPwd(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const currentPlan = plans.find(p => p.id === currentUser?.plan_id) || plans[0];
  const dailyLimit = isAdmin ? 999999 : (currentPlan.daily_msg_limit || 100);
  const sentToday = currentUser?.daily_messages_sent || 0;
  const percentUsed = isAdmin ? 5 : Math.min(100, Math.round((sentToday / dailyLimit) * 100));

  const handleCopyApiKey = () => {
    if (!currentUser?.api_key) return;
    navigator.clipboard.writeText(currentUser.api_key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRegenerateKey = async () => {
    if (!currentUser) return;
    setIsRegeneratingKey(true);
    try {
      const res = await fetch('/api/user/api-key/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id })
      });
      const data = await res.json();
      if (data.success && data.api_key) {
        const updated = { ...currentUser, api_key: data.api_key };
        onUpdateUser(updated);
        setSuccessMsg('API Token baru berhasil digenerate!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Failed to regenerate API key:', err);
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  const handleSaveGeminiKey = async () => {
    if (!currentUser) return;
    setIsSavingKey(true);
    try {
      const res = await fetch('/api/user/custom-gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, api_key: geminiKeyInput })
      });
      const data = await res.json();
      if (data.success && data.user) {
        onUpdateUser(data.user);
        setSuccessMsg(data.message || 'Kunci API Gemini Pribadi berhasil disimpan!');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setVerificationError(data.error || 'Gagal menyimpan kunci.');
      }
    } catch (err) {
      console.error('Failed to save Gemini key:', err);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDeleteGeminiKey = async () => {
    if (!currentUser) return;
    setIsDeletingKey(true);
    try {
      const res = await fetch('/api/user/custom-gemini-key', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id })
      });
      const data = await res.json();
      if (data.success && data.user) {
        onUpdateUser(data.user);
        setGeminiKeyInput('');
        setSuccessMsg(data.message || 'Kunci API Gemini Pribadi berhasil dihapus!');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setVerificationError(data.error || 'Gagal menghapus kunci.');
      }
    } catch (err) {
      console.error('Failed to delete Gemini key:', err);
    } finally {
      setIsDeletingKey(false);
    }
  };

  const handleSaveOfflineMessage = async () => {
    if (!currentUser) return;
    setIsSavingMsg(true);
    try {
      const res = await fetch('/api/user/offline-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, message: offlineMessageInput })
      });
      const data = await res.json();
      if (data.success && data.user) {
        onUpdateUser(data.user);
        setSuccessMsg(data.message || 'Kata balasan kustom berhasil disimpan!');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setVerificationError(data.error || 'Gagal menyimpan pesan offline.');
      }
    } catch (err) {
      console.error('Failed to save offline message:', err);
    } finally {
      setIsSavingMsg(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Profile Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-center gap-6">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center font-black text-3xl sm:text-4xl shadow-inner shrink-0">
          {currentUser?.name?.charAt(0) || 'U'}
        </div>

        <div className="space-y-1.5 text-center sm:text-left flex-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h2 className="text-xl sm:text-2xl font-black">{currentUser?.name || 'Super Administrator'}</h2>
            <span className="px-3 py-0.5 rounded-full text-xs font-black bg-emerald-400 text-slate-950 uppercase">
              {isAdmin ? 'Administrator Pusat' : `Paket ${currentPlan.name}`}
            </span>
          </div>
          <p className="text-xs text-emerald-100 font-mono">
            @{currentUser?.username || 'superadmin'} · ID: {currentUser?.id || 'usr_super'}
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-[11px] text-emerald-200">
            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {currentUser?.email || 'admin@japriin.com'}</span>
            <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> {currentUser?.phone || '081234567890'}</span>
          </div>
        </div>

        {!isAdmin && (
          <button
            onClick={() => {
              const proPlan = plans.find(p => p.id === 'pro') || plans[plans.length - 1];
              onOpenUpgradeModal(proPlan);
            }}
            className="w-full sm:w-auto justify-center px-5 py-3 bg-white hover:bg-emerald-50 text-emerald-800 font-black text-xs rounded-2xl shadow-lg transition-all shrink-0 flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Upgrade Paket ⚡</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Subscription & Quota */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2.5">
              <span className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl shrink-0">
                <Award className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">{isAdmin ? 'Akses & Kuota Sistem' : 'Status Langganan & Kuota'}</h3>
                <span className="text-xs text-slate-500">{isAdmin ? 'Akses tanpa batas pengelola sistem' : 'Batas kirim pesan harian & bulanan'}</span>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 capitalize self-start sm:self-auto">
              {isAdmin ? 'Unlimited' : (currentUser?.plan_status || 'Aktif')}
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>{isAdmin ? 'Pesan Terkirim Sistem Hari Ini' : 'Penggunaan Kuota Hari Ini'}</span>
              <span>{sentToday} / {isAdmin ? '∞ (Unlimited)' : `${dailyLimit} Pesan`}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full transition-all duration-300" style={{ width: `${percentUsed}%` }}></div>
            </div>
            <p className="text-[11px] text-slate-500">
              {isAdmin ? 'Akun Administrator Pusat memiliki kuota tak terbatas (unlimited) untuk manajemen and pengiriman notifikasi sistem.' : 'Kuota harian akan direset otomatis setiap pukul 00.00 WIB. 100% tanpa watermark.'}
            </p>
          </div>

          {!isAdmin && (
            <div className="pt-2">
              <button
                onClick={() => {
                  const proPlan = plans.find(p => p.id === 'pro') || plans[plans.length - 1];
                  onOpenUpgradeModal(proPlan);
                }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs rounded-xl transition-all"
              >
                Lihat Pilihan Paket Lainnya
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Security & PIN */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2.5">
              <span className="p-2.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-2xl">
                <Lock className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Keamanan &amp; PIN Bot</h3>
                <span className="text-xs text-slate-500">PIN konfirmasi aksi sensitif via WhatsApp</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 py-2">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                <span>Status PIN Bot:</span>
                <span className="text-emerald-600 font-black">Aktif &amp; Terlindungi</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Setiap kali Anda mengirim pesan penting atau mengubah data via WhatsApp Bot, bot akan meminta konfirmasi PIN acak.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenPinModal}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
          >
            <Key className="w-4 h-4" />
            <span>Atur / Ganti PIN Keamanan</span>
          </button>
        </div>
      </div>

      {/* Card: Account Verification (Email & WhatsApp Verification) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <span className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Verifikasi Akun &amp; Dua Langkah</h3>
            <span className="text-xs text-slate-500">Verifikasi alamat email Anda setelah login dan kelola verifikasi nomor WhatsApp Anda</span>
          </div>
        </div>

        {verificationError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold">
            ⚠️ {verificationError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Email Verification Block */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-emerald-600 shrink-0" /> Verifikasi Alamat Email (Setelah Login)
              </span>
              <span className={`self-start sm:self-auto px-2.5 py-0.5 rounded-full text-[10px] font-black ${currentUser?.email_verified ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                {currentUser?.email_verified ? '✓ Terverifikasi' : 'Belum Verifikasi'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Email aktif Anda: <strong className="text-slate-700 dark:text-slate-300 font-extrabold break-all">{currentUser?.email}</strong>. Verifikasi email ini agar dapat digunakan sebagai opsi kedua saat ganti/reset password.
            </p>
            {!currentUser?.email_verified && (
              <div className="space-y-2.5 pt-1">
                {!showEmailInput ? (
                  <button
                    onClick={handleSendEmailOtp}
                    disabled={isSendingEmailOtp || emailCooldown > 0}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-55"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSendingEmailOtp || emailCooldown > 0 ? 'animate-spin' : ''}`} />
                    <span>
                      {isSendingEmailOtp
                        ? 'Mengirim...'
                        : emailCooldown > 0
                        ? `Kirim Ulang (${emailCooldown}s)`
                        : 'Kirim Kode OTP ke Email'}
                    </span>
                  </button>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={emailOtp}
                        onChange={e => setEmailOtp(e.target.value)}
                        placeholder="Masukkan 6-digit OTP"
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold tracking-widest text-center focus:outline-none"
                      />
                      <button
                        onClick={handleVerifyEmailOtp}
                        disabled={isVerifyingEmail || !emailOtp}
                        className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs disabled:opacity-55"
                      >
                        {isVerifyingEmail ? 'Verifikasi...' : 'Verifikasi'}
                      </button>
                    </div>
                    <button
                      onClick={handleSendEmailOtp}
                      disabled={isSendingEmailOtp || emailCooldown > 0}
                      className="text-[11px] text-slate-500 hover:underline block text-left disabled:opacity-50"
                    >
                      {emailCooldown > 0 ? `Kirim ulang kode OTP (${emailCooldown}s)` : 'Kirim ulang kode OTP'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* WhatsApp Verification Block */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" /> Verifikasi Nomor WhatsApp (Utama)
              </span>
              <span className={`self-start sm:self-auto px-2.5 py-0.5 rounded-full text-[10px] font-black ${currentUser?.wa_verified ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                {currentUser?.wa_verified ? '✓ Terverifikasi' : 'Belum Verifikasi'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Nomor WhatsApp Anda: <strong className="text-slate-700 dark:text-slate-300 font-extrabold">{currentUser?.phone || 'Belum Diatur'}</strong>. OTP dikirim secara rahasia melalui WhatsApp Sistem.
            </p>
            {!currentUser?.wa_verified && (
              <div className="space-y-2.5 pt-1">
                {!showWaInput ? (
                  <button
                    onClick={handleSendWaOtp}
                    disabled={isSendingWaOtp || !currentUser?.phone || waCooldown > 0}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-55"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSendingWaOtp || waCooldown > 0 ? 'animate-spin' : ''}`} />
                    <span>
                      {isSendingWaOtp
                        ? 'Mengirim...'
                        : waCooldown > 0
                        ? `Kirim Ulang (${waCooldown}s)`
                        : 'Kirim Kode OTP ke WhatsApp'}
                    </span>
                  </button>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={waOtp}
                        onChange={e => setWaOtp(e.target.value)}
                        placeholder="Masukkan 6-digit OTP"
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold tracking-widest text-center focus:outline-none"
                      />
                      <button
                        onClick={handleVerifyWaOtp}
                        disabled={isVerifyingWa || !waOtp}
                        className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs disabled:opacity-55"
                      >
                        {isVerifyingWa ? 'Verifikasi...' : 'Verifikasi'}
                      </button>
                    </div>
                    <button
                      onClick={handleSendWaOtp}
                      disabled={isSendingWaOtp || waCooldown > 0}
                      className="text-[11px] text-slate-500 hover:underline block text-left disabled:opacity-50"
                    >
                      {waCooldown > 0 ? `Kirim ulang kode OTP (${waCooldown}s)` : 'Kirim ulang kode OTP'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card: Ganti Password Akun (Default WhatsApp, Opsi Kedua Email Terverifikasi) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <span className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-2xl shrink-0">
              <Lock className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Ganti Password Akun</h3>
              <span className="text-xs text-slate-500">Verifikasi OTP default menggunakan WhatsApp atau opsi kedua menggunakan Email terverifikasi</span>
            </div>
          </div>
        </div>

        {pwdChangeError && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold leading-relaxed">
            ⚠️ {pwdChangeError}
          </div>
        )}

        {pwdChangeSuccess && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold leading-relaxed">
            {pwdChangeSuccess}
          </div>
        )}

        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
              Pilih Metode Pengiriman OTP Ganti Password:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPwdResetMethod('whatsapp');
                  setPwdChangeError('');
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                  pwdResetMethod === 'whatsapp'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Smartphone className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-xs font-black flex flex-wrap items-center gap-1.5">
                    <span>WhatsApp</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-600 text-white font-bold">Default Utama</span>
                  </div>
                  <p className="text-[11px] opacity-80">Kirim OTP ke nomor {currentUser?.phone || '-'}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPwdResetMethod('email');
                  setPwdChangeError('');
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                  pwdResetMethod === 'email'
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Mail className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-xs font-black flex flex-wrap items-center gap-1.5">
                    <span>Email (Opsi Kedua)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      currentUser?.email_verified
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : 'bg-amber-500/15 text-amber-600'
                    }`}>
                      {currentUser?.email_verified ? '✓ Email Terverifikasi' : 'Wajib Verif Dulu'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 break-all">
                    {currentUser?.email_verified
                      ? `Kirim OTP ke ${currentUser?.email}`
                      : 'Verifikasi email di atas terlebih dahulu agar bisa menerima OTP reset password'}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {!pwdOtpSent ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {pwdResetMethod === 'whatsapp'
                  ? 'Kode OTP rahasia akan dikirimkan langsung ke nomor WhatsApp Anda.'
                  : currentUser?.email_verified
                  ? 'Kode OTP rahasia akan dikirimkan ke alamat email terverifikasi Anda.'
                  : 'Alamat email Anda belum diverifikasi. Silakan verifikasi email di bagian atas atau pilih metode WhatsApp.'}
              </p>
              <button
                type="button"
                onClick={handleRequestPasswordOtp}
                disabled={isSendingPwdOtp || (pwdResetMethod === 'email' && !currentUser?.email_verified) || pwdOtpCooldown > 0}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-sm transition-all shrink-0 disabled:opacity-50"
              >
                {isSendingPwdOtp
                  ? 'Mengirim OTP...'
                  : pwdOtpCooldown > 0
                  ? `Tunggu (${pwdOtpCooldown}s)`
                  : `Kirim OTP via ${pwdResetMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}`}
              </button>
            </div>
          ) : (
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Kode OTP (6 Digit)</label>
                  <input
                    type="text"
                    value={pwdOtpCode}
                    onChange={e => setPwdOtpCode(e.target.value)}
                    placeholder="Masukkan OTP"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold tracking-widest text-center focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Password Baru</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPasswordInput}
                      onChange={e => setNewPasswordInput(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-3.5 pr-9 py-2.5 text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Ulangi Password Baru</label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmNewPasswordInput}
                    onChange={e => setConfirmNewPasswordInput(e.target.value)}
                    placeholder="Konfirmasi password"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleRequestPasswordOtp}
                  disabled={isSendingPwdOtp || pwdOtpCooldown > 0}
                  className="text-xs text-slate-500 hover:text-emerald-600 font-bold text-left disabled:opacity-50"
                >
                  {pwdOtpCooldown > 0 ? `Kirim ulang kode OTP (${pwdOtpCooldown}s)` : 'Kirim ulang kode OTP'}
                </button>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPwdOtpSent(false);
                      setPwdOtpCode('');
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPasswordWithOtp}
                    disabled={isSubmittingNewPwd}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-sm disabled:opacity-50"
                  >
                    {isSubmittingNewPwd ? 'Menyimpan...' : 'Simpan Password Baru'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card 3: Personal Gemini API Key & Custom Offline Message */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <span className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Pengaturan Balasan Bot AI &amp; Kata Kustom</h3>
            <span className="text-xs text-slate-500">Konfigurasi API Key Gemini Pribadi &amp; kata-kata balasan offline Anda</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gemini API Key */}
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-emerald-600" />
                API Key Gemini Pribadi
              </label>
              <p className="text-[11px] text-slate-500 mb-2.5 leading-relaxed">
                Masukkan API Key Gemini pribadi Anda di sini untuk mengaktifkan respons kecerdasan buatan (AI) pada nomor Anda. Berbeda dengan sebelumnya, sistem tidak lagi mengalokasikan kuota AI dari kunci sistem untuk menjamin keamanan &amp; kestabilan layanan. Jika kosong, respons otomatis akan dialihkan sepenuhnya ke <strong className="text-emerald-600">Pesan Offline / Default</strong> di sebelah kanan.
              </p>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    type={showKeyText ? 'text' : 'password'}
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder={currentUser?.custom_gemini_key ? "Kunci terpasang (Masukkan baru untuk ubah)" : "AIzaSy..."}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyText(!showKeyText)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                onClick={handleSaveGeminiKey}
                disabled={isSavingKey}
                className="w-full sm:w-auto justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm disabled:opacity-55"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingKey ? 'Menyimpan...' : 'Simpan Key'}</span>
              </button>
              {currentUser?.custom_gemini_key && (
                <button
                  onClick={handleDeleteGeminiKey}
                  disabled={isDeletingKey}
                  className="w-full sm:w-auto justify-center px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-xs font-bold rounded-xl flex items-center space-x-1.5 disabled:opacity-55 border border-rose-200 dark:border-rose-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingKey ? 'Menghapus...' : 'Hapus Key'}</span>
                </button>
              )}
            </div>

            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl text-[11px] text-blue-800 dark:text-blue-300 space-y-2">
              <div className="flex items-center gap-1.5 font-black text-blue-900 dark:text-blue-200">
                <span>💡 Cara Mendapatkan API Key Google Gemini (Gratis 100%):</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-blue-800/90 dark:text-blue-300/90">
                <li>Buka halaman <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="font-extrabold underline text-blue-600 dark:text-blue-400 hover:text-blue-500">Google AI Studio</a>.</li>
                <li>Masuk menggunakan akun Google Anda.</li>
                <li>Klik tombol hijau <strong>"Get API Key"</strong> di pojok kiri atas.</li>
                <li>Klik <strong>"Create API Key"</strong> lalu pilih <strong>"Create API Key in new project"</strong>.</li>
                <li>Salin kunci yang diawali dengan <code>AIzaSy...</code> tersebut.</li>
                <li>Tempelkan kunci tersebut di kolom input di atas lalu klik <strong>"Simpan Key"</strong>.</li>
              </ol>
              <p className="text-[10px] text-blue-500 dark:text-blue-400 leading-tight">
                *Catatan: API Key ini gratis dari Google dengan jatah rate limit bawaan yang sangat cukup untuk penggunaan harian bot Anda!
              </p>
            </div>
          </div>

          {/* Custom Offline Message */}
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                Pesan Offline / Di Luar Jam Operasional (Default)
              </label>
              <p className="text-[11px] text-slate-500 mb-2.5 leading-relaxed">
                Kustomisasi pesan otomatis yang dikirimkan saat pelanggan mengirimkan chat di luar kata kunci aturan yang ditentukan (atau di luar jam operasional) dan ketika AI dalam keadaan dinonaktifkan / belum memiliki Kunci API pribadi. Gunakan variabel <code className="bg-slate-100 dark:bg-slate-850 px-1 py-0.5 rounded text-emerald-600">{`{nama}`}</code> untuk menyapa nama pengirim.
              </p>
              <textarea
                value={offlineMessageInput}
                onChange={(e) => setOfflineMessageInput(e.target.value)}
                placeholder="Halo {nama}, maaf saat ini petugas kami sedang offline..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500 leading-relaxed"
              />
            </div>

            <button
              onClick={handleSaveOfflineMessage}
              disabled={isSavingMsg}
              className="w-full sm:w-auto justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm disabled:opacity-55"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingMsg ? 'Menyimpan...' : 'Simpan Balasan'}</span>
            </button>
          </div>

          {/* Allowed Numbers Section */}
          <div className="space-y-3.5 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                Nomor yang Diizinkan (Kirim Tanpa Web)
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={allowedNumbersInput}
                  onChange={e => setAllowedNumbersInput(e.target.value)}
                  placeholder="Contoh: 628123456789"
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm"
                />
                <button
                  onClick={() => {
                    if (allowedNumbersInput && !allowedNumbersList.includes(allowedNumbersInput)) {
                      setAllowedNumbersList([...allowedNumbersList, allowedNumbersInput]);
                      setAllowedNumbersInput('');
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold"
                >
                  Tambah
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {allowedNumbersList.map((num, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-xs font-mono">
                  {num}
                  <button onClick={() => setAllowedNumbersList(allowedNumbersList.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={async () => {
                setIsSavingNumbers(true);
                const res = await fetch('/api/user/allowed-numbers', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_id: currentUser!.id, allowed_numbers: allowedNumbersList })
                });
                const data = await res.json();
                setIsSavingNumbers(false);
                if (data.success) {
                  onUpdateUser(data.user);
                  setSuccessMsg('Nomor diizinkan berhasil disimpan!');
                  setTimeout(() => setSuccessMsg(''), 3000);
                }
              }}
              className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              {isSavingNumbers ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Simpan Nomor Diizinkan'}
            </button>
          </div>
        </div>
      </div>

      {/* Card 4: Developer API Token */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <span className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-2xl shrink-0">
              <Key className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Developer API Token v1</h3>
              <span className="text-xs text-slate-500">Token rahasia untuk integrasi aplikasi luar dengan Japriin</span>
            </div>
          </div>

          <button
            onClick={handleRegenerateKey}
            disabled={isRegeneratingKey}
            className="w-full sm:w-auto justify-center px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-xl flex items-center space-x-1.5 border border-slate-200 dark:border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingKey ? 'animate-spin' : ''}`} />
            <span>Generate Ulang</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            readOnly
            value={currentUser?.api_key || 'mgw_live_token_sample'}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-700 dark:text-slate-300"
          />
          <button
            onClick={handleCopyApiKey}
            className="w-full sm:w-auto justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm shrink-0"
          >
            {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedKey ? 'Tersalin' : 'Salin Token'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
