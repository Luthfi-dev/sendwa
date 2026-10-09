import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Database,
  RefreshCw,
  Server,
  Sparkles,
  Wifi,
  WifiOff,
  ArrowUpRight,
  Activity,
  Sliders,
  Smartphone
} from 'lucide-react';
import { BotStats, UserAccount } from '../types/whatsapp';

interface StatsCardsProps {
  stats: BotStats | null;
  webhookUrl: string;
  isAdmin?: boolean;
  currentUser?: UserAccount | null;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, webhookUrl, isAdmin = false, currentUser }) => {
  const [copied, setCopied] = useState(false);

  // Cloud DB Connection State
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    message?: string;
    version?: string;
    host?: string;
    database?: string;
    errorReason?: string;
  } | null>(null);

  // Test live Cloud DB connection
  const checkCloudDbConnection = async () => {
    setIsTestingDb(true);
    try {
      const res = await fetch('/api/mysql/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success && data.data?.connected) {
        setDbStatus({
          connected: true,
          message: 'Koneksi ke Database Cloud Online stabil & siap tempur!',
          version: data.data.version || '8.0 Enterprise Cloud',
          host: data.data.host || 'Cloud Cluster',
          database: data.data.database || 'Cloud DB'
        });
      } else {
        setDbStatus({
          connected: false,
          message: 'Belum terhubung ke Database Cloud Online.',
          errorReason: data.error || data.data?.message || 'Server database cloud belum merespons atau kredensial host belum dikonfigurasi.',
          host: data.data?.host || 'localhost'
        });
      }
    } catch (err: any) {
      setDbStatus({
        connected: false,
        message: 'Koneksi ke Database Cloud terputus.',
        errorReason: 'Gagal menghubungi server database cloud. Tenang, seluruh data pesan tetap aman tersimpan di penyimpanan lokal bawaan sistem!'
      });
    } finally {
      setIsTestingDb(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      checkCloudDbConnection();
    }
  }, [isAdmin]);

  const totalIncoming = stats?.total_incoming || 0;
  const totalAutoReplied = stats?.total_auto_replied || 0;
  const totalAiReplied = stats?.total_ai_replied || 0;
  const totalFailed = stats?.total_failed || 0;

  const successRate = totalIncoming > 0
    ? Math.round((totalAutoReplied / totalIncoming) * 100)
    : 100;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 mb-6">
      {/* 1. TOP COMMAND BAR: GREETING & HEALTH PILLS */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/5 blur-xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 bg-white/15 px-3 py-1 rounded-full text-[11px] font-bold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
              <span>Gateway Engine v2.5 · 100% Whitelabel Murni</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {isAdmin ? 'Pusat Kontrol Superadmin ⚡' : 'Dashboard Operator WhatsApp 💬'}
            </h2>
            <p className="text-xs text-emerald-100 max-w-xl">
              {isAdmin
                ? 'Semua modul otomasi berjalan normal. Pantau arus pesan masuk, kesehatan database, dan respon AI secara real-time.'
                : 'Otomatisasi pesan aktif 24 jam nonstop tanpa watermark, menjaga reputasi bisnis Anda tetap kredibel.'}
            </p>
          </div>

          {/* Quick Health Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-black/25 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 flex items-center space-x-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] text-emerald-200 font-medium">WhatsApp:</span>
              <strong className="text-white text-xs">{stats?.active_session_name || 'Aktif'}</strong>
            </div>

            <div className="bg-black/25 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 flex items-center space-x-2 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-[11px] text-emerald-200 font-medium">AI CS Cerdas:</span>
              <strong className="text-white text-xs">Ready 24/7</strong>
            </div>

            {isAdmin && (
              <div className="bg-black/25 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 flex items-center space-x-2 text-xs">
                <Database className="w-3.5 h-3.5 text-cyan-300" />
                <span className="text-[11px] text-emerald-200 font-medium">Cloud DB:</span>
                <strong className={`text-xs ${dbStatus?.connected ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {dbStatus?.connected ? 'Online' : 'Lokal Aktif'}
                </strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. ADMIN SPECIAL: DATABASE CLOUD STATUS & DIAGNOSTICS CARD */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className={`p-3 rounded-2xl shrink-0 ${
                dbStatus?.connected
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
              }`}>
                {dbStatus?.connected ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Status Koneksi Database Cloud Online
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 ${
                    dbStatus?.connected
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dbStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                    <span>{dbStatus?.connected ? 'TERHUBUNG (ONLINE)' : 'MODE LOKAL (OFFLINE)'}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Penyimpanan utama lokal super cepat &amp; opsi sinkronisasi push ke Database Cloud pusat.
                </p>
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={checkCloudDbConnection}
                disabled={isTestingDb}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 border border-slate-200 dark:border-slate-700 disabled:opacity-50 min-h-[40px]"
              >
                <RefreshCw className={`w-4 h-4 ${isTestingDb ? 'animate-spin text-emerald-600' : ''}`} />
                <span>{isTestingDb ? 'Mengecek...' : 'Tes Hubungkan Lagi'}</span>
              </button>
            </div>
          </div>

          {/* Diagnostic Message & Explanation */}
          <div className="pt-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-8">
              {dbStatus?.connected ? (
                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Database Cloud Online Berfungsi Sempurna!</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    Koneksi remote aktif. Data riwayat chat, aturan auto-reply, dan akun pengguna dapat disinkronkan langsung kapan saja.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-800/40 text-xs space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-300 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Keterangan Status Koneksi:</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed font-mono bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40">
                    {dbStatus?.errorReason || 'Koneksi ke host Cloud DB belum terjangkau. Kredensial host atau port belum aktif.'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    💡 <em>Catatan:</em> Sistem tetap beroperasi normal 100% menggunakan database lokal berkecepatan tinggi. Anda bisa mengatur konfigurasi database online di tab <strong>Database Cloud</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Metrics of DB */}
            <div className="md:col-span-4 grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Penyimpanan</span>
                <span className="font-extrabold text-slate-900 dark:text-white text-xs mt-0.5 block">Lokal JSON</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Aktif &amp; Cepat</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Status Cloud</span>
                <span className="font-extrabold text-slate-900 dark:text-white text-xs mt-0.5 block">
                  {dbStatus?.connected ? 'Online' : 'Standby'}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Bisa Sync 1-Klik</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. CORE METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 0: Dynamic Message Quota (Limit) */}
        <div className="bg-gradient-to-br from-emerald-900/90 to-teal-950 border border-emerald-500/30 rounded-3xl p-5 shadow-lg text-white flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
              Kuota Pesan (Harian &amp; Bulanan)
            </span>
            <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-2xl border border-emerald-500/30">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {isAdmin
                  ? '∞'
                  : `${stats?.daily_messages_sent ?? (currentUser?.daily_messages_sent || 0)} / ${
                      stats?.daily_msg_limit ?? 100
                    }`}
              </span>
              {!isAdmin && (
                <span className="text-xs text-emerald-300 font-bold">
                  Harian
                </span>
              )}
            </div>
            <span className="text-[10px] text-emerald-200 font-medium block mt-0.5">
              {isAdmin
                ? 'Superadmin (Tanpa Batas)'
                : `Bulanan: ${stats?.monthly_messages_sent ?? (currentUser?.monthly_messages_sent || 0)} / ${stats?.monthly_msg_limit ?? 3000} pesan`}
            </span>
          </div>

          {!isAdmin && stats?.daily_msg_limit && (
            <div className="mt-3 space-y-1">
              <div className="w-full bg-emerald-950 rounded-full h-1.5 overflow-hidden border border-emerald-500/30">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((stats?.daily_messages_sent || 0) / (stats?.daily_msg_limit || 100)) * 100
                      )
                    )}%`
                  }}
                ></div>
              </div>
              <p className="text-[10px] text-emerald-300/80 text-right font-mono">
                Sisa Harian: {Math.max(0, (stats?.daily_msg_limit || 100) - (stats?.daily_messages_sent || 0))} Pesan
              </p>
            </div>
          )}
        </div>

        {/* Card 1: Total Pesan Masuk */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Pesan Masuk
            </span>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-200 dark:border-blue-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{totalIncoming}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Pesan WA</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Terisolasi milik Anda
          </p>
        </div>

        {/* Card 2: Pesan Dibalas Otomatis */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pesan Terbalas Otomatis
            </span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-200 dark:border-emerald-500/20">
              <Bot className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{totalAutoReplied}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold">Auto-Reply</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            100% Tanpa Watermark
          </p>
        </div>

        {/* Card 3: Respon AI Cerdas & Kuota AI */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Respon AI (Harian &amp; Bulanan)
            </span>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-200 dark:border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {isAdmin
                  ? `${totalAiReplied}`
                  : `${stats?.daily_ai_sent ?? 0} / ${stats?.daily_ai_limit ?? 50}`}
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold">
                {isAdmin ? 'Total AI' : 'Harian'}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
              {isAdmin
                ? 'Model Gemini 2.5 Flash Aktif'
                : `Bulanan: ${stats?.monthly_ai_sent ?? 0} / ${stats?.monthly_ai_limit ?? 1500} kuota`}
            </p>
          </div>
          {!isAdmin && (
            <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((stats?.daily_ai_sent ?? 0) / (stats?.daily_ai_limit ?? 50)) * 100
                    )
                  )}%`
                }}
              ></div>
            </div>
          )}
        </div>

        {/* Card 4: Success Rate & Webhook */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tingkat Keberhasilan
            </span>
            <div className={`p-2.5 rounded-2xl border ${
              totalFailed > 0
                ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
            }`}>
              {totalFailed > 0 ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{successRate}%</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Gagal: {totalFailed}</span>
          </div>

          {isAdmin ? (
            <button
              onClick={handleCopyWebhook}
              className="mt-3 w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center space-x-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">Tercopy!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Salin Webhook URL</span>
                </>
              )}
            </button>
          ) : (
            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Proteksi anti-ban aktif
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
