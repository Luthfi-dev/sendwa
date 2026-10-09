import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, MessageSquare, Zap, CheckCircle2, Lock, Sparkles, Sliders, AlertTriangle } from 'lucide-react';
import { AntiBanSettings } from '../types/whatsapp';

export const AntiBanPanel: React.FC = () => {
  const [settings, setSettings] = useState<AntiBanSettings>({
    enabled: true,
    min_delay_seconds: 3,
    max_delay_seconds: 8,
    typing_simulation: true,
    max_messages_per_minute: 15,
    daily_quota_per_number: 500,
    read_receipt_simulation: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    fetch('/api/antiban')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          setSettings(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/antiban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setToastMsg('✅ Pengaturan Proteksi Anti-Ban & Jeda Acak berhasil disimpan!');
        setTimeout(() => setToastMsg(''), 3000);
      }
    } catch (err) {
      console.error('Failed to save anti-ban settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 transition-colors duration-200">
      {/* Banner Notice - No False Guarantees */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-emerald-300">Sistem Proteksi &amp; Mitigasi Risiko Anti-Ban WhatsApp</h3>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-500/40">
                Behavioral Guard
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Modul ini menerapkan teknologi simulasi perilaku alami manusia untuk mengurangi risiko deteksi spam oleh WhatsApp. Pesan otomatis diberikan jeda waktu acak (contoh: 3 - 8 detik), simulasi status <em>"sedang mengetik..."</em>, serta batas kuota pengiriman per menit.
            </p>
          </div>
        </div>
      </div>

      {/* Mandatory Legal & Operational Disclaimer Card */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-600/40 rounded-2xl p-4.5 text-amber-900 dark:text-amber-200 text-xs shadow-xs space-y-2">
        <div className="flex items-center space-x-2 font-bold text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>PENAFIAN PENTING &amp; KETENTUAN KEAMANAN AKUN (DISCLAIMER)</span>
        </div>
        <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-200/90">
          <strong>Perhatian:</strong> Meta Platforms / WhatsApp tidak pernah memberikan garansi anti-ban resmi kepada sistem otomasi pihak ketiga mana pun. Fitur Anti-Ban di Japriin adalah <strong>teknologi mitigasi risiko terbaik (best-effort risk mitigation)</strong>. Japriin tidak mengklaim atau menjamin 100% bebas dari pemblokiran bila nomor digunakan untuk pengiriman spam massal tanpa persetujuan penerima, atau melanggar Terms of Service resmi WhatsApp. Gunakan nomor bisnis secara wajar dan patuhi etika pesan pelanggan.
        </p>
      </div>

      {toastMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Form Settings */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <Sliders className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Konfigurasi Jeda Acak &amp; Simulasi Ketik</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Atur jeda acak waktu tunggu dan batas volume pengiriman pesan</p>
            </div>
          </div>
          {/* Main Master Toggle */}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            <span className="ml-3 text-xs font-bold text-slate-800 dark:text-slate-200">
              {settings.enabled ? 'Proteksi Aktif' : 'Proteksi Non-aktif'}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Min Delay */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Jeda Minimal (Detik)</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{settings.min_delay_seconds} detik</span>
            </label>
            <input
              type="range"
              min="1"
              max="15"
              value={settings.min_delay_seconds}
              onChange={e => setSettings(s => ({ ...s, min_delay_seconds: parseInt(e.target.value) || 1 }))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Paling cepat waktu tunggu sebelum membalas pesan.</p>
          </div>

          {/* Max Delay */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Jeda Maksimal (Detik)</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{settings.max_delay_seconds} detik</span>
            </label>
            <input
              type="range"
              min={settings.min_delay_seconds}
              max="30"
              value={settings.max_delay_seconds}
              onChange={e => setSettings(s => ({ ...s, max_delay_seconds: parseInt(e.target.value) || 5 }))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Waktu jeda acak batas atas agar balasan menyerupai manusia.</p>
          </div>

          {/* Max messages per minute */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Batas Maksimum Pesan per Menit</span>
            </label>
            <input
              type="number"
              min="5"
              max="60"
              value={settings.max_messages_per_minute}
              onChange={e => setSettings(s => ({ ...s, max_messages_per_minute: parseInt(e.target.value) || 15 }))}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Mencegah lonjakan trafik tinggi dalam kurun waktu singkat.</p>
          </div>

          {/* Daily Quota */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Batas Kuota Harian per Nomor</span>
            </label>
            <input
              type="number"
              min="50"
              max="5000"
              value={settings.daily_quota_per_number}
              onChange={e => setSettings(s => ({ ...s, daily_quota_per_number: parseInt(e.target.value) || 500 }))}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Batas pesan otomatis per nomor untuk melindungi reputasi nomor WA.</p>
          </div>
        </div>

        {/* Checkboxes for features */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center space-x-3 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.typing_simulation}
              onChange={e => setSettings(s => ({ ...s, typing_simulation: e.target.checked }))}
              className="rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-200 block">Simulasi Typing Status ("Sedang mengetik...")</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Menampilkan indikator ketik di HP penerima secara otomatis</span>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.read_receipt_simulation}
              onChange={e => setSettings(s => ({ ...s, read_receipt_simulation: e.target.checked }))}
              className="rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-200 block">Simulasi Read Receipt (Tanda Centang Biru)</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Memberikan jeda baca sebelum membalas pesan masuk</span>
            </div>
          </label>
        </div>

        {/* Save Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50 min-h-[40px]"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Proteksi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
