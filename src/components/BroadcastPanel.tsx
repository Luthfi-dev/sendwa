import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send,
  Clock,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Calendar,
  Trash2,
  Upload,
  XCircle,
  Square
} from 'lucide-react';
import { UserAccount, WhatsAppSession, BotStats } from '../types/whatsapp';

interface BroadcastPanelProps {
  currentUser?: UserAccount | null;
  sessions?: WhatsAppSession[];
  stats?: BotStats | null;
}

interface BroadcastHistoryItem {
  id: string;
  user_id?: string;
  session_id?: string;
  recipients_count: number;
  message: string;
  status: 'completed' | 'scheduled' | 'running' | 'failed';
  success_count: number;
  failed_count: number;
  scheduled_at?: string;
  created_at: string;
}

interface ParsedRecipient {
  phone: string;
  rawPhone: string;
  name: string;
}

function normalizeWaPhone(raw: string): string {
  let clean = raw.replace(/\D/g, '');
  if (clean.startsWith('00')) clean = clean.slice(2);
  if (clean.startsWith('620')) clean = '62' + clean.slice(3);
  else if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  else if (clean.startsWith('8')) clean = '62' + clean;
  return clean;
}

/**
 * Parses many recipients from flexible formats:
 * - Newline, comma, semicolon, or space separated phone numbers
 * - "081234567890 | Budi Santoso" or "081234567890 - Budi Santoso" or "Budi Santoso, 081234567890"
 * - Formatted numbers like "+62 812-3456-7890"
 */
function parseBroadcastRecipients(input: string): ParsedRecipient[] {
  if (!input || !input.trim()) return [];
  const results: ParsedRecipient[] = [];
  const seenPhones = new Set<string>();

  const lines = input.split(/[\r\n;]+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Case 1: Line has pipe "|" or tab or " - " separating phone and name
    if (line.includes('|') || line.includes('\t') || /\s+-\s+/.test(line)) {
      const parts = line.split(/\||\t|\s+-\s+/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const firstDigits = parts[0].replace(/\D/g, '');
        const secondDigits = parts[1].replace(/\D/g, '');
        if (firstDigits.length >= 8 && firstDigits.length <= 16) {
          const norm = normalizeWaPhone(firstDigits);
          if (!seenPhones.has(norm)) {
            seenPhones.add(norm);
            results.push({ phone: norm, rawPhone: parts[0], name: parts.slice(1).join(' ') || `Pelanggan (${norm})` });
          }
          continue;
        } else if (secondDigits.length >= 8 && secondDigits.length <= 16) {
          const norm = normalizeWaPhone(secondDigits);
          if (!seenPhones.has(norm)) {
            seenPhones.add(norm);
            results.push({ phone: norm, rawPhone: parts[1], name: parts[0] || `Pelanggan (${norm})` });
          }
          continue;
        }
      }
    }

    // Case 2: CSV "Name, 08123456789" or "08123456789, Name" where one side has letters
    if (line.includes(',') && /[a-zA-Z]{2,}/.test(line)) {
      const csvParts = line.split(',').map(p => p.trim()).filter(Boolean);
      if (csvParts.length === 2) {
        const d0 = csvParts[0].replace(/\D/g, '');
        const d1 = csvParts[1].replace(/\D/g, '');
        if (d0.length >= 8 && d0.length <= 16 && !/[a-zA-Z]/.test(csvParts[0])) {
          const norm = normalizeWaPhone(d0);
          if (!seenPhones.has(norm)) {
            seenPhones.add(norm);
            results.push({ phone: norm, rawPhone: csvParts[0], name: csvParts[1] });
          }
          continue;
        } else if (d1.length >= 8 && d1.length <= 16 && !/[a-zA-Z]/.test(csvParts[1])) {
          const norm = normalizeWaPhone(d1);
          if (!seenPhones.has(norm)) {
            seenPhones.add(norm);
            results.push({ phone: norm, rawPhone: csvParts[1], name: csvParts[0] });
          }
          continue;
        }
      }
    }

    // Case 3: One or multiple phone numbers on the same line (comma or space separated)
    const phoneMatches = line.match(/(?:\+?62|0)[\d\-\s()]{7,16}|\b8[\d\-\s()]{7,14}\b|\b\d{8,15}\b/g);
    if (phoneMatches && phoneMatches.length > 0) {
      for (const rawMatch of phoneMatches) {
        const digits = rawMatch.replace(/\D/g, '');
        if (digits.length >= 8 && digits.length <= 16) {
          const norm = normalizeWaPhone(digits);
          if (!seenPhones.has(norm)) {
            seenPhones.add(norm);
            results.push({ phone: norm, rawPhone: rawMatch.trim(), name: `Pelanggan (${norm})` });
          }
        }
      }
    }
  }

  return results;
}

export const BroadcastPanel: React.FC<BroadcastPanelProps> = ({ currentUser, sessions, stats }) => {
  // Resolve connected WhatsApp bot session phone for this account
  const connectedSession =
    sessions?.find(s => s.status === 'connected' && s.is_primary) ||
    sessions?.find(s => s.status === 'connected') ||
    sessions?.find(s => s.is_primary) ||
    sessions?.[0];
  const activeBotPhone = connectedSession?.phone_number || stats?.active_session_phone || 'Belum Terhubung';

  const [recipientsInput, setRecipientsInput] = useState<string>('081234567890\n081987654321\n085712345678');
  const [messageBody, setMessageBody] = useState<string>('Halo kak {{name}}, ini pesan pengingat resmi dari Japriin. Pesan ini dikirim otomatis 100% aman anti-ban.');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => connectedSession?.id || 'sess_primary_app_gateway');
  const [minDelay, setMinDelay] = useState<number>(2);
  const [maxDelay, setMaxDelay] = useState<number>(4);
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduledTime, setScheduledTime] = useState<string>('');

  const [isSending, setIsSending] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [activeStatusText, setActiveStatusText] = useState<string>('');
  const [noticeBanner, setNoticeBanner] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [broadcastResult, setBroadcastResult] = useState<{
    success: number;
    failed: number;
    logs: Array<{ phone: string; name: string; status: 'sent' | 'failed'; note: string; time: string }>;
  } | null>(null);

  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState<boolean>(false);

  const stopRequestedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsedContacts = useMemo(() => parseBroadcastRecipients(recipientsInput), [recipientsInput]);

  useEffect(() => {
    if (connectedSession?.id) {
      setSelectedSessionId(connectedSession.id);
    }
  }, [connectedSession?.id]);

  const fetchBroadcastHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const q = currentUser?.id ? `?userId=${encodeURIComponent(currentUser.id)}` : '';
      const res = await fetch(`/api/broadcast/history${q}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setHistory(data.data);
      }
    } catch {
      // Ignore fetch error
    } finally {
      setIsLoadingHistory(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchBroadcastHistory();
  }, [fetchBroadcastHistory]);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      if (content.trim()) {
        setRecipientsInput(prev => (prev.trim() ? `${prev.trim()}\n${content.trim()}` : content.trim()));
        setNoticeBanner({ type: 'success', text: `Berhasil mengimpor daftar kontak dari file ${file.name}!` });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleStopBroadcast = () => {
    stopRequestedRef.current = true;
    setActiveStatusText('Menghentikan antrean broadcast...');
  };

  const handleClearHistory = async () => {
    try {
      const q = currentUser?.id ? `?userId=${encodeURIComponent(currentUser.id)}` : '';
      await fetch(`/api/broadcast/history${q}`, { method: 'DELETE' });
      setHistory([]);
      setConfirmClearHistory(false);
      setNoticeBanner({ type: 'info', text: 'Riwayat log broadcast berhasil dibersihkan.' });
    } catch {
      setConfirmClearHistory(false);
    }
  };

  const getDaysUntilAutoDelete = (createdAt: string): number => {
    const createdMs = new Date(createdAt).getTime();
    if (isNaN(createdMs)) return 7;
    const expiresMs = createdMs + 7 * 24 * 60 * 60 * 1000;
    const diffDays = Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(7, diffDays));
  };

  const handleStartBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoticeBanner(null);

    if (parsedContacts.length === 0) {
      setNoticeBanner({
        type: 'error',
        text: 'Masukkan minimal 1 nomor penerima WhatsApp yang valid (minimal 8 digit)!'
      });
      return;
    }

    if (!messageBody.trim()) {
      setNoticeBanner({
        type: 'error',
        text: 'Isi pesan broadcast wajib diisi!'
      });
      return;
    }

    // Handle scheduled broadcast if future date is selected
    if (isScheduled && scheduledTime) {
      const scheduledMs = new Date(scheduledTime).getTime();
      const delayUntilStart = scheduledMs - Date.now();
      if (delayUntilStart > 5000) {
        try {
          const res = await fetch('/api/broadcast/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: currentUser?.id,
              session_id: selectedSessionId,
              recipients_count: parsedContacts.length,
              message: messageBody,
              status: 'scheduled',
              success_count: 0,
              failed_count: 0,
              scheduled_at: new Date(scheduledTime).toISOString()
            })
          });
          const saved = await res.json();
          if (saved.success && saved.data) {
            setHistory(prev => [saved.data, ...prev]);
          }
        } catch {}

        setNoticeBanner({
          type: 'success',
          text: `Broadcast ke ${parsedContacts.length} kontak berhasil dijadwalkan pada ${new Date(scheduledTime).toLocaleString('id-ID')}!`
        });
        return;
      }
    }

    stopRequestedRef.current = false;
    setIsSending(true);
    setProgressPercent(0);
    setActiveStatusText(`Menyiapkan pengiriman broadcast ke ${parsedContacts.length} kontak...`);
    setBroadcastResult({ success: 0, failed: 0, logs: [] });

    const logs: Array<{ phone: string; name: string; status: 'sent' | 'failed'; note: string; time: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    const safeMin = Math.max(1, Math.min(minDelay, maxDelay));
    const safeMax = Math.max(safeMin, maxDelay);

    for (let i = 0; i < parsedContacts.length; i++) {
      if (stopRequestedRef.current) {
        setActiveStatusText(`Broadcast dihentikan oleh pengguna pada kontak ke-${i} dari ${parsedContacts.length}.`);
        break;
      }

      const contact = parsedContacts[i];
      setActiveStatusText(`Mengirim ke +${contact.phone} (${i + 1} dari ${parsedContacts.length} kontak)...`);

      // Wait anti-ban delay ONLY between messages (not before the first message!)
      if (i > 0) {
        const delaySec = Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
        await new Promise(r => setTimeout(r, delaySec * 450));
      }

      if (stopRequestedRef.current) break;

      const personalizedMsg = messageBody
        .replace(/\{\{name\}\}|\{nama\}/gi, contact.name)
        .replace(/\{\{phone\}\}|\{nomor\}/gi, contact.phone);

      try {
        const res = await fetch('/api/v1/send-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser?.api_key || 'mgw_live_superadmin_master_key_99'}`
          },
          body: JSON.stringify({
            to: contact.phone,
            message: personalizedMsg,
            session_id: selectedSessionId,
            user_id: currentUser?.id,
            is_broadcast: true
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
          logs.unshift({
            phone: contact.phone,
            name: contact.name,
            status: 'sent',
            note: 'Terkirim via Japriin Gateway',
            time: new Date().toLocaleTimeString('id-ID')
          });
        } else {
          failedCount++;
          logs.unshift({
            phone: contact.phone,
            name: contact.name,
            status: 'failed',
            note: data.error || data.details || 'Gagal terkirim',
            time: new Date().toLocaleTimeString('id-ID')
          });
        }
      } catch (err: any) {
        failedCount++;
        logs.unshift({
          phone: contact.phone,
          name: contact.name,
          status: 'failed',
          note: err?.message || 'Koneksi terputus',
          time: new Date().toLocaleTimeString('id-ID')
        });
      }

      const completedPct = Math.round(((i + 1) / parsedContacts.length) * 100);
      setProgressPercent(completedPct);
      setBroadcastResult({
        success: successCount,
        failed: failedCount,
        logs: [...logs]
      });
    }

    setIsSending(false);
    setActiveStatusText(
      stopRequestedRef.current
        ? `Broadcast dihentikan (${successCount} sukses, ${failedCount} gagal).`
        : `Broadcast selesai diproses ke ${parsedContacts.length} kontak (${successCount} sukses, ${failedCount} gagal)!`
    );

    // Persist broadcast history to backend DB (auto-purged after 7 days)
    try {
      const saveRes = await fetch('/api/broadcast/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser?.id,
          session_id: selectedSessionId,
          recipients_count: parsedContacts.length,
          message: messageBody,
          status: failedCount === parsedContacts.length ? 'failed' : 'completed',
          success_count: successCount,
          failed_count: failedCount
        })
      });
      const saveData = await saveRes.json();
      if (saveData.success && saveData.data) {
        setHistory(prev => [saveData.data, ...prev]);
      } else {
        fetchBroadcastHistory();
      }
    } catch {
      fetchBroadcastHistory();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center space-x-1.5 bg-white/15 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Anti-Ban Behavioral Guard &amp; Auto-Clean Log 7 Hari</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black">Broadcast Pesan Massal &amp; Terjadwal</h2>
          <p className="text-xs text-emerald-100 max-w-xl">
            Kirim puluhan hingga ribuan pesan WhatsApp sekaligus dengan jeda waktu acak otomatis, variabel personalisasi, dan retensi log otomatis 7 hari.
          </p>
        </div>

        <div className="bg-black/25 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-xs space-y-1 shrink-0">
          <div className="text-[10px] text-emerald-300 font-bold uppercase">Kuota Hari Ini:</div>
          <div className="font-black text-white text-sm">
            {currentUser?.daily_messages_sent || 0} / {currentUser?.plan_id === 'free' ? '100' : '10.000'} Pesan
          </div>
        </div>
      </div>

      {noticeBanner && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
            noticeBanner.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : noticeBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {noticeBanner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{noticeBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNoticeBanner(null)}
            className="text-[11px] underline opacity-75 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Broadcast Form */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2.5">
              <span className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <Send className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Buat Pesan Broadcast Baru</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">Mendukung banyak nomor sekaligus (baris baru, koma, titik koma, atau file CSV/TXT)</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleStartBroadcast} className="space-y-4">
            {/* Session Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Pilih Nomor WhatsApp Pengirim (Gateway):
              </label>
              <select
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none font-medium"
              >
                {sessions && sessions.length > 0 ? (
                  sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.session_name} ({s.phone_number}) {s.status === 'connected' ? '🟢 Online' : '⚪ Standby'}
                    </option>
                  ))
                ) : (
                  <option value="sess_primary_app_gateway">
                    {activeBotPhone !== 'Belum Terhubung' ? `Bot WhatsApp (${activeBotPhone}) 🟢 Online` : 'WhatsApp Bot Utama'}
                  </option>
                )}
              </select>
            </div>

            {/* Recipients Input */}
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                  Daftar Nomor Penerima (Per baris / koma / <code className="text-emerald-600 font-mono">0812xxx | Nama</code>):
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Import TXT/CSV</span>
                  </button>
                  <span className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-[11px] font-black font-mono">
                    {parsedContacts.length} Kontak Valid
                  </span>
                </div>
              </div>
              <textarea
                rows={5}
                value={recipientsInput}
                onChange={e => setRecipientsInput(e.target.value)}
                placeholder={'081234567890 | Budi Santoso\n081987654321 | Siti Aminah\n085712345678, 081398765432'}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none font-mono leading-relaxed"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Otomatis mendeteksi &amp; menormalisasi nomor <span className="font-mono">08xx</span> / <span className="font-mono">+628xx</span> serta menghapus duplikat nomor ganda.
              </p>
            </div>

            {/* Message Body */}
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5 mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                  Isi Pesan Broadcast (Mendukung <code className="text-emerald-600 font-mono">&#123;&#123;name&#125;&#125;</code> &amp; <code className="text-emerald-600 font-mono">&#123;&#123;phone&#125;&#125;</code>):
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMessageBody(prev => prev + ' {{name}}')}
                    className="text-[11px] font-bold text-emerald-600 hover:underline"
                  >
                    + Variabel Nama
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageBody(prev => prev + ' {{phone}}')}
                    className="text-[11px] font-bold text-teal-600 hover:underline"
                  >
                    + Variabel Nomor
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                value={messageBody}
                onChange={e => setMessageBody(e.target.value)}
                placeholder="Ketik pesan broadcast Anda di sini..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none leading-relaxed"
              />
            </div>

            {/* Anti-Ban Delay Controls */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2 text-xs font-black text-slate-800 dark:text-slate-200">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span>Pengaturan Keamanan Anti-Ban &amp; Jeda Acak Antar Pesan</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Jeda Minimal (detik):</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={minDelay}
                    onChange={e => setMinDelay(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Jeda Maksimal (detik):</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={maxDelay}
                    onChange={e => setMaxDelay(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Pesan pertama dikirim langsung, diikuti jeda waktu acak antar nomor berikutnya agar aman dari deteksi spam WhatsApp.
              </p>
            </div>

            {/* Schedule Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="flex items-center space-x-2.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Jadwalkan Pengiriman</span>
                  <span className="text-[10px] text-slate-500">Kirim otomatis pada tanggal &amp; jam tertentu</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={e => setIsScheduled(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded accent-emerald-600 cursor-pointer"
              />
            </div>

            {isScheduled && (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Pilih Tanggal &amp; Waktu Kirim:</label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>
            )}

            {/* Submit & Stop Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="submit"
                disabled={isSending}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mengirim Broadcast ({progressPercent}%)...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {isScheduled
                        ? `Jadwalkan Broadcast (${parsedContacts.length} Kontak)`
                        : `Kirim Broadcast ke ${parsedContacts.length} Kontak ⚡`}
                    </span>
                  </>
                )}
              </button>

              {isSending && (
                <button
                  type="button"
                  onClick={handleStopBroadcast}
                  className="w-full sm:w-auto justify-center px-4 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-2xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>Hentikan</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right: Live Progress, Per-Contact Logs & 7-Day History */}
        <div className="lg:col-span-5 space-y-6">
          {/* WhatsApp Direct Command Bridge Guide */}
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 text-white shadow-xl space-y-4">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-indigo-500/20">
              <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
                <Smartphone className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <h4 className="text-sm font-black text-indigo-200">Kirim &amp; Broadcast via Chat WA!</h4>
                <p className="text-[10px] text-slate-300">WhatsApp Direct Command Bridge (1 Nomor &amp; Banyak Nomor)</p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="p-3 bg-indigo-950/50 rounded-2xl border border-indigo-500/20 space-y-1">
                <span className="text-[10px] text-indigo-300 font-bold uppercase block">Nomor WhatsApp Bot Aktif:</span>
                <strong className="text-xs font-mono text-emerald-400 font-black">{activeBotPhone}</strong>
              </div>

              <div className="p-3 bg-indigo-950/50 rounded-2xl border border-indigo-500/20 space-y-2">
                <span className="text-[10px] text-indigo-300 font-bold uppercase block">Format Kirim 1 Nomor &amp; Broadcast Banyak Nomor:</span>
                <code className="text-[11px] font-mono text-white bg-slate-950/80 px-2.5 py-1.5 rounded-lg block select-all">
                  /send 08123456789 Halo kak, pesanan siap!
                </code>
                <code className="text-[11px] font-mono text-emerald-300 bg-slate-950/80 px-2.5 py-1.5 rounded-lg block select-all">
                  /broadcast 08123456789, 08198765432 Halo kak promo diskon!
                </code>
                <span className="text-[10px] text-slate-300 block leading-relaxed">
                  *Atau ketik <strong className="text-white font-mono">/send</strong> maupun <strong className="text-white font-mono">/broadcast</strong> saja di chat Nomor Sistem / Nomor Sendiri untuk memunculkan template interaktif.
                </span>
              </div>
            </div>
          </div>

          {/* Live Progress Card */}
          {isSending && (
            <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-500/40 rounded-3xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Proses Broadcast Berjalan...</span>
                </span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">{activeStatusText}</p>
            </div>
          )}

          {/* Broadcast Result & Live Per-Contact Log Summary */}
          {broadcastResult && (
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-black text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>{isSending ? 'Status Pengiriman Real-Time' : 'Hasil Eksekusi Broadcast'}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  {broadcastResult.logs.length} / {parsedContacts.length} Diproses
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Berhasil Terkirim</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 text-lg">{broadcastResult.success} Kontak</strong>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Gagal / Invalid</span>
                  <strong className="text-rose-600 text-lg">{broadcastResult.failed} Kontak</strong>
                </div>
              </div>

              {broadcastResult.logs.length > 0 && (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                  {broadcastResult.logs.map((entry, idx) => (
                    <div
                      key={`${entry.phone}_${idx}`}
                      className="flex items-center justify-between text-[11px] bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {entry.status === 'sent' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        )}
                        <div className="truncate">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">+{entry.phone}</span>
                          <span className="text-slate-400 ml-1.5 text-[10px]">{entry.note}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">{entry.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History List (Auto-Deleted after 7 Days) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Riwayat &amp; Log Broadcast
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Auto-Hapus 7 Hari
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                  Log broadcast otomatis terhapus setelah 7 hari untuk menjaga performa.
                </p>
              </div>

              {history.length > 0 && (
                <div className="w-full sm:w-auto">
                  {confirmClearHistory ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleClearHistory}
                        className="flex-1 sm:flex-initial justify-center px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[11px] font-black"
                      >
                        Ya, Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearHistory(false)}
                        className="flex-1 sm:flex-initial justify-center px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-bold"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearHistory(true)}
                      className="w-full sm:w-auto justify-center px-3 py-2 sm:py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border border-rose-200 dark:border-rose-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Bersihkan Riwayat</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {isLoadingHistory ? (
                <div className="text-center py-6 text-xs text-slate-400">Memuat riwayat broadcast...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Belum ada riwayat broadcast</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Semua riwayat pengiriman broadcast akan tercatat di sini &amp; otomatis terhapus setelah 7 hari.
                  </p>
                </div>
              ) : (
                history.map(item => {
                  const daysLeft = getDaysUntilAutoDelete(item.created_at);
                  return (
                    <div key={item.id} className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
                        <span className="font-extrabold text-slate-900 dark:text-white">{item.recipients_count} Penerima</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Hapus otomatis: {daysLeft} hr lagi
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              item.status === 'failed'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                                : item.status === 'scheduled'
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                            }`}
                          >
                            {item.status === 'completed' ? 'Selesai' : item.status === 'scheduled' ? 'Terjadwal' : 'Gagal'}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 line-clamp-2 text-[11px] italic">"{item.message}"</p>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                        <span>
                          Sukses: <strong className="text-emerald-600 dark:text-emerald-400">{item.success_count}</strong> · Gagal: <strong className="text-rose-600">{item.failed_count}</strong>
                        </span>
                        <span>{new Date(item.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
