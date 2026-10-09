import React, { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  Smartphone,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Star,
  Plus,
  ShieldCheck,
  Send,
  Zap,
  Phone,
  AlertCircle,
  Clock,
  Radio,
  RotateCcw
} from 'lucide-react';
import { WhatsAppSession, UserAccount } from '../types/whatsapp';

function formatPhonePreview(input: string): string {
  if (!input) return '';
  let clean = input.replace(/\D/g, '');
  if (clean.startsWith('620')) clean = '62' + clean.slice(3);
  else if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  else if (clean.startsWith('8')) clean = '62' + clean;
  return clean ? `+${clean}` : '';
}

// Live Countdown Timer for Connected WhatsApp Account Session Expiry
function SessionExpiryCountdown({
  session,
  onRenew,
  onReLogin
}: {
  session: WhatsAppSession;
  onRenew: (sessionId: string) => void;
  onReLogin?: (session: WhatsAppSession) => void;
}) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
    isExpired: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isExpired: false });

  const [isRenewing, setIsRenewing] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const expiryTime = session.expires_at
        ? new Date(session.expires_at).getTime()
        : (session.connected_at
          ? new Date(session.connected_at).getTime() + 30 * 24 * 60 * 60 * 1000
          : Date.now() + 30 * 24 * 60 * 60 * 1000);

      const diff = expiryTime - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isExpired: true });
        return;
      }

      const totalSec = Math.floor(diff / 1000);
      const days = Math.floor(totalSec / (24 * 3600));
      const hours = Math.floor((totalSec % (24 * 3600)) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;

      setTimeLeft({ days, hours, minutes, seconds, totalSeconds: totalSec, isExpired: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [session.expires_at, session.connected_at]);

  const totalCycleSeconds = 30 * 24 * 3600;
  const progressPercent = Math.max(0, Math.min(100, (timeLeft.totalSeconds / totalCycleSeconds) * 100));

  let statusBadge = {
    label: 'Sesi Aktif & Normal (Aman)',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30',
    barColor: 'bg-emerald-500'
  };

  if (timeLeft.isExpired) {
    statusBadge = {
      label: 'Sesi Kedaluwarsa - Harap Login Ulang',
      bg: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30',
      barColor: 'bg-rose-500'
    };
  } else if (timeLeft.days <= 2) {
    statusBadge = {
      label: 'Kritis (< 48 Jam) - Segera Login Ulang',
      bg: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30',
      barColor: 'bg-rose-500 animate-pulse'
    };
  } else if (timeLeft.days <= 7) {
    statusBadge = {
      label: 'Perhatian: Masa Aktif Menipis (< 7 Hari)',
      bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30',
      barColor: 'bg-amber-500'
    };
  }

  const handleRenewClick = async () => {
    setIsRenewing(true);
    try {
      await onRenew(session.id);
    } finally {
      setIsRenewing(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Masa Berlaku Sesi:
        </span>
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusBadge.bg}`}>
          {statusBadge.label}
        </span>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/90 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Timer Mundur Kedaluwarsa:</span>
          {timeLeft.isExpired ? (
            <span className="text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800 self-start sm:self-auto">
              Sesi Berakhir (Kedaluwarsa)
            </span>
          ) : (
            <div className="flex items-center gap-1.5 font-mono text-xs font-black text-slate-900 dark:text-white bg-white dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs self-start sm:self-auto">
              <span className="text-emerald-600 dark:text-emerald-400">{timeLeft.days}</span>
              <span className="text-[10px] font-sans text-slate-400 font-bold">Hari</span>
              <span className="text-emerald-600 dark:text-emerald-400">{String(timeLeft.hours).padStart(2, '0')}</span>
              <span className="text-[10px] font-sans text-slate-400 font-bold">Jam</span>
              <span className="text-emerald-600 dark:text-emerald-400">{String(timeLeft.minutes).padStart(2, '0')}</span>
              <span className="text-[10px] font-sans text-slate-400 font-bold">Mnt</span>
              <span className="text-emerald-600 dark:text-emerald-400">{String(timeLeft.seconds).padStart(2, '0')}</span>
              <span className="text-[10px] font-sans text-slate-400 font-bold">Dtk</span>
            </div>
          )}
        </div>

        {/* Progress validity bar */}
        <div className="space-y-1">
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${statusBadge.barColor}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400">
            <span>Sisa masa aktif: {progressPercent.toFixed(0)}%</span>
            <span>Kedaluwarsa: {session.expires_at ? new Date(session.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '30 hari'}</span>
          </div>
        </div>

        {/* Status Notice if nearing expiration or expired */}
        {(timeLeft.days <= 5 || timeLeft.isExpired) && (
          <div className={`p-2 rounded-xl text-[11px] leading-relaxed border flex items-start gap-1.5 ${
            timeLeft.isExpired
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
          }`}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              {timeLeft.isExpired
                ? 'Sesi nomor ini telah berakhir. Silakan hubungkan ulang dengan tombol Login Ulang di bawah agar bot dapat aktif kembali.'
                : `Masa aktif tersisa ${timeLeft.days} hari lagi. Segera perpanjang atau persiapkan login ulang sebelum waktu habis.`}
            </span>
          </div>
        )}

        {/* Action buttons: Renew +30 days OR Re-Login */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <button
            onClick={handleRenewClick}
            disabled={isRenewing}
            className="w-full sm:w-auto justify-center text-[11px] bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Perpanjang masa aktif sesi +30 hari ke depan"
          >
            <RotateCcw className={`w-3 h-3 ${isRenewing ? 'animate-spin' : ''}`} />
            <span>{isRenewing ? 'Memproses...' : 'Perpanjang +30 Hari'}</span>
          </button>

          {onReLogin && (
            <button
              onClick={() => onReLogin(session)}
              className="text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Siap-siap login ulang nomor ini sebelum atau sesudah kedaluwarsa"
            >
              <KeyRound className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Login Ulang Nomor Ini</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface WhatsAppConnectPanelProps {
  currentUser?: UserAccount | null;
  onSessionChange?: () => void;
}

export function WhatsAppConnectPanel({ currentUser, onSessionChange }: WhatsAppConnectPanelProps) {
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  // Method 1: Pairing Code, Method 2: QR Code, Method 3: Manual Token
  const [loginMethod, setLoginMethod] = useState<'pair' | 'qr' | 'manual'>('pair');

  // Pair Code State
  const [pairPhone, setPairPhone] = useState<string>('628123456789');
  const [pairSessionName, setPairSessionName] = useState<string>('WhatsApp CS Utama');
  const [generatedPairCode, setGeneratedPairCode] = useState<string>('');
  const [copiedPairCode, setCopiedPairCode] = useState<boolean>(false);
  const [isGeneratingPair, setIsGeneratingPair] = useState<boolean>(false);
  const [pairError, setPairError] = useState<string>('');
  const [pairCountdown, setPairCountdown] = useState<number>(0);

  // Sync pairPhone with logged-in user phone if available
  useEffect(() => {
    if (currentUser?.phone && (!pairPhone || pairPhone === '628123456789')) {
      setPairPhone(currentUser.phone);
    }
  }, [currentUser?.phone]);

  // Live countdown timer for active pairing code (120s limit by WhatsApp)
  useEffect(() => {
    if (pairCountdown <= 0) return;
    const interval = setInterval(() => {
      setPairCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pairCountdown]);

  // Handler to prepare re-login for an expiring or expired session
  const handleReLogin = (session: WhatsAppSession) => {
    setLoginMethod('pair');
    setPairPhone(session.phone_number || '');
    setPairSessionName(session.session_name || `WA Pair - ${session.phone_number}`);
    setGeneratedPairCode('');
    setPairError('');
    setPairCountdown(0);
    window.scrollTo({ top: 100, behavior: 'smooth' });
    showToast(`👉 Nomor +${session.phone_number} siap dihubungkan ulang. Klik 'Dapatkan Kode Pairing' untuk meminta kode dari WhatsApp!`);
  };

  // QR State
  const [qrImage, setQrImage] = useState<string>('');
  const [qrToken, setQrToken] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(20);
  const [isLoadingQr, setIsLoadingQr] = useState<boolean>(false);
  const [isScanningSim, setIsScanningSim] = useState<boolean>(false);

  // Manual Input State
  const [manualPhone, setManualPhone] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');
  const [manualPhoneId, setManualPhoneId] = useState<string>('');
  const [manualToken, setManualToken] = useState<string>('');

  // Quick Test Message State
  const [testModalSession, setTestModalSession] = useState<WhatsAppSession | null>(null);
  const [testRecipient, setTestRecipient] = useState<string>('6281234567890');
  const [testMessage, setTestMessage] = useState<string>('Halo, ini uji coba pesan dari Japriin Pro (100% Bersih Tanpa Watermark).');
  const [testStatus, setTestStatus] = useState<string>('');

  // Delete Session Modal State
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; phone: string; name: string } | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState<boolean>(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Fetch connected sessions for current user (or all if admin)
  const fetchSessions = useCallback(async () => {
    try {
      const url = currentUser?.id ? `/api/sessions?userId=${currentUser.id}` : '/api/sessions';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setSessions(data.data || []);
      }
    } catch (err) {
      console.error('Gagal mengambil daftar sesi WA:', err);
    }
  }, [currentUser?.id]);

  // Fetch dynamic QR code from server
  const fetchQrCode = useCallback(async () => {
    setIsLoadingQr(true);
    try {
      const targetSessionId = currentUser?.id ? `session_user_${currentUser.id}` : 'session_primary_default';
      const res = await fetch('/api/sessions/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: targetSessionId, user_id: currentUser?.id })
      });
      const data = await res.json();
      if (data.success && data.qr_image) {
        setQrImage(data.qr_image);
        setQrToken(data.session_id || targetSessionId);
        setActivePairingSessionId(data.session_id || targetSessionId);
        setCountdown(20);
      }
    } catch (err) {
      console.error('Gagal generate QR Code:', err);
    } finally {
      setIsLoadingQr(false);
    }
  }, [currentUser?.id]);

  const [activePairingSessionId, setActivePairingSessionId] = useState<string>('session_primary_default');
  const [notifiedConnected, setNotifiedConnected] = useState<boolean>(false);

  // Poll socket status every 3 seconds when QR or Pairing is active
  useEffect(() => {
    let isSubscribed = true;
    const pollInterval = setInterval(async () => {
      try {
        const targetSessionId = activePairingSessionId || (currentUser?.id ? `session_user_${currentUser.id}` : 'session_primary_default');
        const res = await fetch(`/api/sessions/status/${targetSessionId}`);
        const data = await res.json();
        if (isSubscribed && data.success && data.data) {
          if (data.data.status === 'connected') {
            if (!notifiedConnected) {
              setNotifiedConnected(true);
              showToast(`🎉 WhatsApp ${data.data.phoneNumber || ''} berhasil terhubung!`);
              setGeneratedPairCode('');
              fetchSessions();
              if (onSessionChange) onSessionChange();
            }
          } else {
            if (notifiedConnected) setNotifiedConnected(false);
            if (data.data.qrCodeUrl && data.data.qrCodeUrl !== qrImage) {
              setQrImage(data.data.qrCodeUrl);
            }
          }
        }
      } catch (err) {
        // Silent poll error
      }
    }, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [qrImage, activePairingSessionId, fetchSessions, onSessionChange, notifiedConnected, currentUser?.id]);

  useEffect(() => {
    fetchSessions();
    fetchQrCode();
  }, [fetchSessions, fetchQrCode]);

  // QR Countdown Timer auto refresh - only if not already connected
  useEffect(() => {
    const isAlreadyConnected = sessions.some(s => s.status === 'connected');
    if (loginMethod !== 'qr' || isAlreadyConnected) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchQrCode();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loginMethod, fetchQrCode, sessions]);

  // Simulate scanning QR Code with phone
  const handleSimulateScanSuccess = async (scannedPhone?: string) => {
    setIsScanningSim(true);
    const targetPhone = scannedPhone || `628${Math.floor(100000000 + Math.random() * 900000000)}`;
    const targetSessionId = currentUser?.id ? `session_user_${currentUser.id}_${targetPhone.replace(/\D/g, '')}` : `sess_${targetPhone.replace(/\D/g, '')}`;

    try {
      const res = await fetch('/api/sessions/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetSessionId,
          session_id: targetSessionId,
          session_name: `WhatsApp - ${targetPhone}`,
          phone_number: targetPhone,
          auth_method: 'qr_code',
          user_id: currentUser?.id,
          is_primary: sessions.length === 0
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`✅ Berhasil login WA! Nomor ${targetPhone} terhubung.`);
        fetchSessions();
        if (onSessionChange) onSessionChange();
      }
    } catch (err) {
      console.error('Simulasi scan gagal:', err);
    } finally {
      setIsScanningSim(false);
    }
  };

  // Generate 8-Digit Pairing Code
  const handleGeneratePairCode = async () => {
    if (!pairPhone) {
      setPairError('Nomor WhatsApp wajib diisi.');
      return;
    }
    setIsGeneratingPair(true);
    setPairError('');
    setGeneratedPairCode('');

    try {
      let cleanPhone = pairPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('620')) cleanPhone = '62' + cleanPhone.slice(3);
      else if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
      else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;

      if (!cleanPhone || cleanPhone.length < 9) {
        setPairError('Format nomor tidak valid. Pastikan nomor WhatsApp memiliki minimal 9 digit angka.');
        setIsGeneratingPair(false);
        return;
      }

      const pairSessionId = `session_user_${currentUser?.id || 'guest'}_${cleanPhone}`;
      setActivePairingSessionId(pairSessionId);

      const res = await fetch('/api/sessions/pair-code/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: cleanPhone,
          user_id: currentUser?.id,
          session_id: pairSessionId
        })
      });
      const data = await res.json();
      if (data.success && data.pairing_code) {
        setGeneratedPairCode(data.pairing_code);
        setPairCountdown(data.expires_in || 120);
        if (data.session_id) {
          setActivePairingSessionId(data.session_id);
        }
        showToast('🔑 Kode Pairing berhasil dibuat! Masukkan 8 digit kode ini di WhatsApp HP Anda.');
        fetchSessions();
      } else {
        setPairError(data.details || data.error || 'Gagal meminta Kode Pairing dari WhatsApp.');
      }
    } catch (err: any) {
      console.error('Gagal generate pairing code:', err);
      setPairError('Terjadi kesalahan koneksi ke server WhatsApp. Silakan coba beberapa saat lagi.');
    } finally {
      setIsGeneratingPair(false);
    }
  };

  // Renew / Extend session validity +30 days
  const handleRenewSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 })
      });
      const data = await res.json();
      if (data.success) {
        showToast('🎉 Masa aktif sesi WhatsApp berhasil diperpanjang +30 hari!');
        fetchSessions();
        if (onSessionChange) onSessionChange();
      } else {
        showToast(data.error || 'Gagal memperpanjang masa aktif sesi.');
      }
    } catch (err) {
      console.error('Gagal memperpanjang sesi:', err);
      showToast('Terjadi kesalahan saat memperpanjang sesi.');
    }
  };

  // Confirm Pair Code Linked
  const handleConfirmPairLinked = async () => {
    if (!pairPhone) return;
    try {
      const cleanPhone = pairPhone.replace(/\D/g, '');
      const pairSessionId = activePairingSessionId || `session_user_${currentUser?.id || 'regular'}_${cleanPhone}`;
      const res = await fetch('/api/sessions/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: pairSessionId,
          session_id: pairSessionId,
          session_name: pairSessionName || `WA Pair - ${pairPhone}`,
          phone_number: pairPhone,
          auth_method: 'pairing_code',
          user_id: currentUser?.id,
          is_primary: sessions.length === 0
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Nomor ${pairPhone} berhasil terhubung via Kode Pairing!`);
        setGeneratedPairCode('');
        fetchSessions();
        if (onSessionChange) onSessionChange();
      }
    } catch (err) {
      console.error('Gagal konfirmasi pairing:', err);
    }
  };

  // Connect Manual
  const handleConnectManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone) {
      alert('Nomor HP wajib diisi!');
      return;
    }

    try {
      const cleanPhone = manualPhone.replace(/\D/g, '');
      const targetSessionId = currentUser?.id ? `session_user_${currentUser.id}_${cleanPhone}` : `sess_${cleanPhone}`;
      const res = await fetch('/api/sessions/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetSessionId,
          session_id: targetSessionId,
          session_name: manualName || `WA Manual - ${manualPhone}`,
          phone_number: manualPhone,
          phone_number_id: manualPhoneId,
          access_token: manualToken,
          auth_method: 'manual_token',
          user_id: currentUser?.id,
          is_primary: sessions.length === 0
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Nomor ${manualPhone} berhasil ditambahkan!`);
        setManualPhone('');
        setManualName('');
        setManualPhoneId('');
        setManualToken('');
        fetchSessions();
        if (onSessionChange) onSessionChange();
      }
    } catch (err) {
      console.error('Gagal simpan manual:', err);
    }
  };

  // Set Primary Session
  const handleSetPrimary = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}/primary`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        showToast('⭐️ Nomor utama berhasil diperbarui.');
        fetchSessions();
        if (onSessionChange) onSessionChange();
      }
    } catch (err) {
      console.error('Gagal set nomor utama:', err);
    }
  };

  // Open Delete Confirm Modal
  const handleOpenDeleteModal = (session: WhatsAppSession) => {
    setSessionToDelete({
      id: session.id,
      phone: session.phone_number,
      name: session.session_name
    });
  };

  // Execute Delete Session
  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    setIsDeletingSession(true);
    try {
      const res = await fetch(`/api/sessions/${sessionToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`🗑️ Sesi ${sessionToDelete.name} (${sessionToDelete.phone}) berhasil dihapus.`);
        setSessionToDelete(null);
        fetchSessions();
        if (onSessionChange) onSessionChange();
      } else {
        showToast('Gagal menghapus sesi.');
      }
    } catch (err) {
      console.error('Gagal delete session:', err);
    } finally {
      setIsDeletingSession(false);
    }
  };

  // Send Test WhatsApp Message
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testModalSession || !testRecipient) return;

    setTestStatus('Mengirim pesan pengujian...');
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testRecipient,
          message: testMessage,
          session_id: testModalSession.id
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus('✅ Pesan WhatsApp terbukti berhasil terkirim ke ponsel tujuan!');
        showToast('🚀 Pesan WhatsApp berhasil terkirim!');
      } else {
        setTestStatus(`❌ ${data.details || data.error || 'Gagal mengirim pesan.'}`);
      }
    } catch (err) {
      setTestStatus('❌ Error koneksi ke server saat mengirim pesan.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPairCode(true);
    setTimeout(() => setCopiedPairCode(false), 2000);
  };

  return (
    <div id="wa-connect-panel" className="space-y-6 mb-8 transition-colors duration-200">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-2.5 max-w-sm animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="leading-snug">{toastMsg}</span>
        </div>
      )}

      {/* HEADER TITLE CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Koneksi WhatsApp &amp; Sesi Aktif
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
                  Instant Link
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hubungkan nomor WhatsApp Anda dengan <strong>Kode Pairing</strong> (posisi utama), <strong>Scan QR Code</strong>, atau <strong>Token Manual</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-start md:self-auto">
            <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-black rounded-xl flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Koneksi Aman Terenkripsi</span>
            </span>
          </div>
        </div>

        {/* LOGIN METHOD TAB SELECTOR (1. PAIRING CODE, 2. QR CODE, 3. MANUAL TOKEN) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {/* METHOD 1 (FIRST): KODE PAIRING WHATSAPP */}
          <button
            onClick={() => setLoginMethod('pair')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center space-x-3.5 ${
              loginMethod === 'pair'
                ? 'bg-emerald-50/80 dark:bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold shadow-xs ring-2 ring-emerald-500/20'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${loginMethod === 'pair' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black">1. Kode Pairing WA</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">Input 8 digit kode langsung di HP</div>
            </div>
          </button>

          {/* METHOD 2 (SECOND): SCAN BARCODE QR */}
          <button
            onClick={() => setLoginMethod('qr')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center space-x-3.5 ${
              loginMethod === 'qr'
                ? 'bg-emerald-50/80 dark:bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold shadow-xs ring-2 ring-emerald-500/20'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${loginMethod === 'qr' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black">2. Scan Barcode QR</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">Pindai kamera WhatsApp Web</div>
            </div>
          </button>

          {/* METHOD 3 (THIRD): INPUT MANUAL / TOKEN */}
          <button
            onClick={() => setLoginMethod('manual')}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center space-x-3.5 ${
              loginMethod === 'manual'
                ? 'bg-emerald-50/80 dark:bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold shadow-xs ring-2 ring-emerald-500/20'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${loginMethod === 'manual' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black">3. Token / Kustom</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">Input token &amp; ID manual</div>
            </div>
          </button>
        </div>

        {/* METHOD 1 CONTAINER: KODE PAIRING WHATSAPP (FIRST) */}
        {loginMethod === 'pair' && (
          <div className="bg-slate-50 dark:bg-slate-950 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  Hubungkan dengan Kode Pairing WhatsApp (8 Digit)
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Paling Praktis &amp; Cepat Tanpa Kamera
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Nomor WhatsApp yang Ingin Dihubungkan:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={pairPhone}
                    onChange={(e) => setPairPhone(e.target.value)}
                    placeholder="Contoh: 08123456789 atau 628123456789"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white pl-10 pr-3.5 py-3 rounded-2xl font-mono focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>
                {pairPhone && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Dideteksi sebagai: <strong>{formatPhonePreview(pairPhone)}</strong></span>
                  </div>
                )}
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Bisa diawali 08... atau 62... Pastikan nomor ini adalah akun WhatsApp yang sedang aktif di HP Anda.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Nama Label Sesi / Toko:
                </label>
                <input
                  type="text"
                  value={pairSessionName}
                  onChange={(e) => setPairSessionName(e.target.value)}
                  placeholder="Contoh: WhatsApp CS Toko 1"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white px-3.5 py-3 rounded-2xl focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleGeneratePairCode}
                disabled={isGeneratingPair}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl transition-all shadow-md flex items-center justify-center space-x-2 min-h-[44px]"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isGeneratingPair ? 'Memproses Kode...' : 'Dapatkan Kode Pairing 8-Digit'}</span>
              </button>
            </div>

            {pairError && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-xs text-amber-900 dark:text-amber-300 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Catatan Koneksi:</span>
                </div>
                <p className="leading-relaxed">{pairError}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                  💡 Kalo kode pairing kena limit sementara di HP, Anda bisa langsung pakai metode <strong>2. Scan Barcode QR</strong> di atas ya!
                </p>
              </div>
            )}

            {generatedPairCode && (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-emerald-300 dark:border-emerald-500/40 text-center space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">
                    Masukkan Kode Pairing ini di WhatsApp HP Anda:
                  </span>
                  {pairCountdown > 0 ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-mono text-xs font-bold rounded-full border border-amber-300 dark:border-amber-700">
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>Sisa Waktu: <strong>{Math.floor(pairCountdown / 60)}:{String(pairCountdown % 60).padStart(2, '0')}</strong></span>
                    </div>
                  ) : (
                    <span className="px-3 py-1 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 text-xs font-bold rounded-full border border-rose-300 dark:border-rose-700">
                      Kode Kedaluwarsa
                    </span>
                  )}
                </div>

                {pairCountdown <= 0 ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-800 dark:text-rose-300 space-y-2">
                    <p className="font-bold">⚠️ Masa berlaku kode pairing telah habis (batas 120 detik WhatsApp).</p>
                    <p className="text-[11px]">Agar WhatsApp di HP tidak menampilkan &quot;Periksa nomor dengan benar&quot;, silakan buat kode baru yang segar di bawah ini.</p>
                    <button
                      onClick={handleGeneratePairCode}
                      disabled={isGeneratingPair}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                    >
                      {isGeneratingPair ? 'Membuat...' : 'Buat Ulang Kode Pairing Baru'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <div className="font-mono text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-widest bg-emerald-50 dark:bg-emerald-500/10 px-8 py-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-500/30">
                        {generatedPairCode}
                      </div>
                      <button
                        onClick={() => copyToClipboard(generatedPairCode)}
                        className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl border border-slate-200 dark:border-slate-700 transition-colors"
                        title="Salin Kode"
                      >
                        {copiedPairCode ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>

                    <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-4 sm:p-5 rounded-2xl text-left text-xs text-slate-700 dark:text-slate-300 space-y-3 max-w-xl mx-auto shadow-xs">
                      <div className="font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>Panduan Menautkan di HP (Nomor {formatPhonePreview(pairPhone)}):</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed pl-1">
                        <li>Buka aplikasi WhatsApp di HP Anda (pastikan akun aktif adalah nomor <strong>{formatPhonePreview(pairPhone)}</strong>).</li>
                        <li>Ketuk menu <strong>titik tiga (⋮)</strong> di kanan atas (Android) atau <strong>Pengaturan</strong> (iPhone) &gt; pilih <strong>Perangkat Tertaut</strong>.</li>
                        <li>Ketuk <strong>Tautkan Perangkat</strong> &gt; lalu ketuk opsi <strong>Tautkan dengan nomor telepon saja</strong> di bagian bawah.</li>
                        <li>Ketik 8 karakter kode <strong>{generatedPairCode}</strong> di atas dengan teliti.</li>
                      </ol>

                      {/* Explicit Solution for "Periksa nomor dengan benar" */}
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1.5 text-[11px] text-amber-900 dark:text-amber-200">
                        <div className="font-bold flex items-center gap-1 text-amber-800 dark:text-amber-300">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Solusi jika HP memunculkan &quot;Periksa nomor dengan benar&quot;:</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-slate-700 dark:text-slate-300 leading-relaxed pl-0.5">
                          <li><strong>Pastikan nomor akun HP sama:</strong> Akun WhatsApp yang Anda buka di HP harus sama persis dengan nomor <strong>{formatPhonePreview(pairPhone)}</strong>.</li>
                          <li><strong>Cek WhatsApp Ganda / Business:</strong> Jika HP punya WA reguler &amp; WA Business / Dual Messenger, pastikan membuka aplikasi nomor yang dituju.</li>
                          <li><strong>Jangan tunggu timer habis:</strong> Segera ketik kodenya sebelum timer 120 detik berakhir.</li>
                          <li><strong>Alternatif Instan:</strong> Anda juga bisa langsung gunakan tab <strong>2. Scan Barcode QR</strong> di atas untuk login otomatis via kamera tanpa ketik kode!</li>
                        </ul>
                      </div>
                    </div>

                    <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <button
                        onClick={handleConfirmPairLinked}
                        className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Konfirmasi Selesai Dipasang di WhatsApp</span>
                      </button>
                      <button
                        onClick={handleGeneratePairCode}
                        disabled={isGeneratingPair}
                        className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1 border border-slate-200 dark:border-slate-700"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPair ? 'animate-spin' : ''}`} />
                        <span>Minta Kode Baru</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* METHOD 2 CONTAINER: SCAN BARCODE QR (SECOND) */}
        {loginMethod === 'qr' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50 dark:bg-slate-950 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
            {/* LEFT: QR CODE DISPLAY CARD */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-xs">
              <div className="relative mb-3">
                {isLoadingQr ? (
                  <div className="w-[220px] h-[220px] bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-2 animate-pulse">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                    <span className="text-xs font-bold">Membuat Barcode QR...</span>
                  </div>
                ) : qrImage ? (
                  <div className="relative p-2.5 bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    <img src={qrImage} alt="WhatsApp Login Barcode QR" className="w-[200px] h-[200px] object-contain rounded-xl" />
                    <div className="absolute inset-0 border-2 border-emerald-500 rounded-2xl pointer-events-none opacity-40 animate-pulse" />
                  </div>
                ) : (
                  <div className="w-[220px] h-[220px] bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
                    QR Code belum dimuat
                  </div>
                )}
              </div>

              {/* Countdown Progress */}
              <div className="w-full space-y-1 mb-4">
                <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  <span>Auto Refresh QR:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{countdown} detik</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 dark:bg-emerald-400 h-full transition-all duration-1000"
                    style={{ width: `${(countdown / 20) * 100}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button
                  onClick={fetchQrCode}
                  disabled={isLoadingQr}
                  className="flex-1 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center space-x-1.5 min-h-[40px]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQr ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>Refresh QR</span>
                </button>

                <button
                  onClick={() => handleSimulateScanSuccess()}
                  disabled={isScanningSim}
                  className="flex-1 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-colors flex items-center justify-center space-x-1.5 shadow-xs min-h-[40px]"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>{isScanningSim ? 'Menghubungkan...' : 'Simulasi Scan HP'}</span>
                </button>
              </div>
            </div>

            {/* RIGHT: INSTRUCTIONS */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Langkah Scan Barcode QR di HP:
                </h3>

                <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-start space-x-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                    <span>Buka aplikasi <strong>WhatsApp</strong> di smartphone Anda.</span>
                  </li>

                  <li className="flex items-start space-x-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                    <span>Ketuk <strong>Menu ⋮ (Android)</strong> atau <strong>Pengaturan ⚙️ (iPhone)</strong>.</span>
                  </li>

                  <li className="flex items-start space-x-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                    <span>Pilih <strong>Perangkat Tertaut</strong> &gt; Ketuk tombol <strong>Tautkan Perangkat</strong>.</span>
                  </li>

                  <li className="flex items-start space-x-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center shrink-0 text-xs">4</span>
                    <span>Arahkan kamera ke <strong>Barcode QR</strong> di samping. Sesi langsung terhubung otomatis!</span>
                  </li>
                </ol>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Tanpa perlu edit .env. Semua sesi tersimpan aman di database lokal &amp; Cloud DB!</span>
              </div>
            </div>
          </div>
        )}

        {/* METHOD 3 CONTAINER: MANUAL INPUT / TOKEN (THIRD) */}
        {loginMethod === 'manual' && (
          <form onSubmit={handleConnectManual} className="bg-slate-50 dark:bg-slate-950 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Nomor Telepon WA:
                </label>
                <input
                  type="text"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="Contoh: 6281234567890"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white px-3.5 py-2.5 rounded-xl font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Nama Label Perangkat:
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Contoh: CS Admin WhatsApp"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Phone Number ID (Opsional):
                </label>
                <input
                  type="text"
                  value={manualPhoneId}
                  onChange={(e) => setManualPhoneId(e.target.value)}
                  placeholder="Contoh: 102938475610"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white px-3.5 py-2.5 rounded-xl font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Access Token (Opsional):
                </label>
                <input
                  type="password"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Access Token kustom..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white px-3.5 py-2.5 rounded-xl font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 min-h-[42px]"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Sesi Telepon Baru</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* CONNECTED WHATSAPP SESSIONS LIST */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Daftar Perangkat Tertaut Akun Anda ({sessions.length})
              </h3>
              {currentUser && (
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] rounded-full border border-emerald-300 dark:border-emerald-800">
                  Akun: {currentUser.name || currentUser.username}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola nomor WhatsApp milik Anda yang aktif merespon pesan. Perangkat antar-akun terisolasi 100% aman.
            </p>
          </div>

          <button
            onClick={fetchSessions}
            className="w-full sm:w-auto justify-center px-3.5 py-2.5 sm:py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5 transition-colors min-h-[38px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Sesi</span>
          </button>
        </div>

        {/* SUMMARY EXPIRATION BANNER */}
        {sessions.length > 0 && (
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  Monitoring Masa Aktif &amp; Timer Sesi Nomor ({sessions.length} Nomor Terhubung)
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                  WhatsApp Web membatasi masa aktif sesi maksimal 30 hari. Perhatikan timer hitung mundur teratur pada tiap nomor di bawah agar Anda siap-siap login ulang atau perpanjang sebelum masanya habis.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                sessions.forEach(s => handleRenewSession(s.id));
              }}
              className="w-full sm:w-auto justify-center px-3.5 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              title="Perpanjang masa aktif seluruh sesi WhatsApp +30 hari kedepan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Perpanjang Semua Sesi (+30 Hari)</span>
            </button>
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2">
            <Smartphone className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
            <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">Belum ada nomor WhatsApp yang terhubung.</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Gunakan <strong>Kode Pairing</strong> atau <strong>Scan QR</strong> di atas untuk menghubungkan nomor WhatsApp pertama Anda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  session.is_primary
                    ? 'bg-emerald-50/40 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 shadow-xs'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white">
                        {session.session_name}
                      </h4>
                    </div>

                    {session.is_primary && (
                      <span className="self-start sm:self-auto px-2.5 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-full flex items-center space-x-1 shadow-xs">
                        <Star className="w-3 h-3 fill-white" />
                        <span>Nomor Utama</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 mb-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Nomor:</span>
                      <strong className="text-slate-900 dark:text-white font-mono">+{session.phone_number}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Metode:</span>
                      <span className="uppercase text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {session.auth_method === 'pairing_code' ? 'Kode Pairing 8-Digit' : session.auth_method === 'qr_code' ? 'Scan Barcode QR' : 'Manual Token'}
                      </span>
                    </div>
                  </div>

                  {/* Real-time Session Expiry Countdown Timer */}
                  <SessionExpiryCountdown
                    session={session}
                    onRenew={handleRenewSession}
                    onReLogin={handleReLogin}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setTestModalSession(session);
                      setTestStatus('');
                    }}
                    className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center space-x-1.5 min-h-[36px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Tes Kirim Pesan</span>
                  </button>

                  {!session.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(session.id)}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors flex items-center space-x-1 min-h-[36px]"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      <span>Jadikan Utama</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenDeleteModal(session)}
                    className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Putuskan / Hapus Nomor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TEST MESSAGE MODAL */}
      {testModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                Uji Coba Pengiriman Pesan WhatsApp
              </h3>
              <button onClick={() => setTestModalSession(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTestMessage} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Dari Nomor:</label>
                <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl font-mono text-slate-700 dark:text-slate-300">
                  +{testModalSession.phone_number} ({testModalSession.session_name})
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nomor Tujuan WhatsApp:</label>
                <input
                  type="text"
                  required
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="Contoh: 6281234567890"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Isi Pesan:</label>
                <textarea
                  rows={3}
                  required
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                />
              </div>

              {testStatus && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-medium text-[11px] leading-relaxed">
                  {testStatus}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTestModalSession(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-bold min-h-[38px]"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-md min-h-[38px]"
                >
                  Kirim Pesan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-base text-slate-900 dark:text-white">Putuskan Sesi WhatsApp?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sesi <strong>{sessionToDelete.name}</strong> (+{sessionToDelete.phone}) akan dihapus dari sistem.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSessionToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold min-h-[40px]"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeletingSession}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-md min-h-[40px]"
              >
                {isDeletingSession ? 'Menghapus...' : 'Ya, Putuskan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
