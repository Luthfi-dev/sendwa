import React, { useState } from 'react';
import {
  Key,
  ShieldCheck,
  Smartphone,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  Sparkles
} from 'lucide-react';
import { UserAccount } from '../types/whatsapp';

interface SecurityPinModalProps {
  isOpen: boolean;
  user: UserAccount | null;
  onClose: () => void;
  onSuccess: (updatedUser: UserAccount) => void;
}

export const SecurityPinModal: React.FC<SecurityPinModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen || !user) return null;

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
      setErrorMsg('PIN harus terdiri dari 4-8 digit angka.');
      return;
    }

    if (pin !== confirmPin) {
      setErrorMsg('Konfirmasi PIN tidak cocok!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          pin
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('✓ PIN Keamanan berhasil disimpan!');
        const updated = { ...user, is_bot_locked: false, pin_failed_attempts: 0 };
        onSuccess(updated);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMsg(data.error || 'Gagal menyimpan PIN.');
      }
    } catch (e) {
      setErrorMsg('Gagal menghubungi server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockBot = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/unlock-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('✓ Akses Remote Bot WhatsApp Berhasil Dibuka!');
        onSuccess(data.user);
      }
    } catch (e) {
      setErrorMsg('Gagal membuka blokir.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl relative text-slate-900 dark:text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-2xl border border-emerald-200 dark:border-emerald-800">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black">PIN Keamanan Remote WhatsApp Bot</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Digunakan untuk otorisasi saat eksekusi perintah via chat WhatsApp
            </p>
          </div>
        </div>

        {/* Lock status banner */}
        {user.is_bot_locked && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl space-y-2">
            <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-300 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Akses Bot WhatsApp Terblokir (3x Salah PIN)</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Anda salah memasukkan PIN 3 kali di chat bot. Klik tombol di bawah untuk membuka blokir akses.
            </p>
            <button
              onClick={handleUnlockBot}
              disabled={isSubmitting}
              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center space-x-1"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Buka Blokir Bot Sekarang</span>
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSavePin} className="space-y-4">
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
              Buat / Ubah PIN Baru (4-8 Digit Angka)
            </label>
            <input
              type="password"
              required
              maxLength={8}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Contoh: 123456"
              className="w-full text-center tracking-widest text-lg font-black bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
              Konfirmasi Ulang PIN
            </label>
            <input
              type="password"
              required
              maxLength={8}
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Ulangi PIN di atas"
              className="w-full text-center tracking-widest text-lg font-black bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-[11px] text-slate-500 leading-relaxed border border-slate-200 dark:border-slate-800">
            🔒 <strong>Keamanan Anti-Intip Layar</strong>: Saat bot WhatsApp meminta PIN, bot akan membuat 10 pilihan PIN acak untuk mengecoh orang lain di sekitar Anda.
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md flex items-center space-x-1.5"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>Simpan PIN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
