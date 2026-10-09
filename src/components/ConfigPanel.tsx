import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Copy,
  Check,
  Key,
  Database,
  Globe,
  Mail,
  Bot,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Send,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Settings,
  Lock
} from 'lucide-react';
import { EnvConfigMasked, SmtpAccount, GeminiApiKey, SystemConfig } from '../types/whatsapp';

interface ConfigPanelProps {
  config: EnvConfigMasked | null;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config }) => {
  const [activeSubTab, setActiveSubTab] = useState<'gateway' | 'smtp' | 'gemini'>('gateway');

  // Gateway Settings State
  const [waToken, setWaToken] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [isSavingGateway, setIsSavingGateway] = useState(false);
  const [gatewayToast, setGatewayToast] = useState('');

  // Webhook Test State
  const [testTokenInput, setTestTokenInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ status: 'idle' | 'success' | 'failed'; message: string }>({ status: 'idle', message: '' });
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Multi-SMTP State
  const [smtpList, setSmtpList] = useState<any[]>([]);
  const [newSmtpUser, setNewSmtpUser] = useState('');
  const [newSmtpPass, setNewSmtpPass] = useState('');
  const [newSmtpName, setNewSmtpName] = useState('');
  const [newSmtpHost, setNewSmtpHost] = useState('smtp.gmail.com');
  const [newSmtpPort, setNewSmtpPort] = useState(587);
  const [newSmtpSecure, setNewSmtpSecure] = useState(false);
  const [isAddingSmtp, setIsAddingSmtp] = useState(false);
  const [testingSmtpId, setTestingSmtpId] = useState<string | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [emailToast, setEmailToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Gemini API Keys & AI Config State
  const [geminiList, setGeminiList] = useState<any[]>([]);
  const [newGeminiKey, setNewGeminiKey] = useState('');
  const [newGeminiName, setNewGeminiName] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');
  const [aiFallbackNoRule, setAiFallbackNoRule] = useState(true);
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [aiOfflineMessage, setAiOfflineMessage] = useState('Halo! Terima kasih telah menghubungi kami. Maaf saat ini petugas/CS kami sedang offline. Kami akan membalas pesan Anda sesegera mungkin.');
  const [isSavingAiConfig, setIsSavingAiConfig] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiToast, setGeminiToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch initial data
  const fetchGatewayConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success && data.fullConfig) {
        setPhoneId(data.fullConfig.phone_number_id || '');
        setVerifyToken(data.fullConfig.webhook_verify_token || 'maudigi_gtw_verify_token_2026');
        setAppUrl(data.fullConfig.app_url || window.location.origin);
        if (data.fullConfig.ai_config) {
          setAiEnabled(Boolean(data.fullConfig.ai_config.enabled));
          setAiSystemPrompt(data.fullConfig.ai_config.system_prompt || '');
          setAiFallbackNoRule(Boolean(data.fullConfig.ai_config.fallback_when_no_rule));
          setAiModel(data.fullConfig.ai_config.model || 'gemini-2.5-flash');
          setAiOfflineMessage(data.fullConfig.ai_config.offline_fallback_message || 'Halo! Terima kasih telah menghubungi kami. Maaf saat ini petugas/CS kami sedang offline. Kami akan membalas pesan Anda sesegera mungkin.');
        }
      }
    } catch (e) {}
  };

  const fetchSmtpAccounts = async () => {
    try {
      const res = await fetch('/api/smtp');
      const data = await res.json();
      if (data.success && data.data) {
        setSmtpList(data.data);
      }
    } catch (e) {}
  };

  const fetchGeminiKeys = async () => {
    try {
      const res = await fetch('/api/gemini-keys');
      const data = await res.json();
      if (data.success && data.data) {
        setGeminiList(data.data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchGatewayConfig();
    fetchSmtpAccounts();
    fetchGeminiKeys();
  }, []);

  // Save Gateway Credentials (No .env Needed)
  const handleSaveGateway = async () => {
    setIsSavingGateway(true);
    setGatewayToast('');
    try {
      const body: any = {
        phone_number_id: phoneId,
        webhook_verify_token: verifyToken,
        app_url: appUrl
      };
      if (waToken.trim() !== '') {
        body.whatsapp_token = waToken.trim();
      }

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setGatewayToast('✅ Kredensial WhatsApp & Webhook berhasil disimpan langsung ke database!');
        setWaToken('');
        fetchGatewayConfig();
        setTimeout(() => setGatewayToast(''), 3500);
      }
    } catch (e) {
      setGatewayToast('❌ Gagal menyimpan konfigurasi.');
    } finally {
      setIsSavingGateway(false);
    }
  };

  // Add SMTP Account
  const handleAddSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSmtpUser.trim() || !newSmtpPass.trim()) {
      setEmailToast({ type: 'error', text: 'Email pengirim dan App Password wajib diisi.' });
      return;
    }

    setIsAddingSmtp(true);
    setEmailToast(null);
    try {
      const portNum = Number(newSmtpPort) || 587;
      const res = await fetch('/api/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSmtpName.trim() || `SMTP (${newSmtpUser.trim().split('@')[0]})`,
          host: newSmtpHost.trim() || 'smtp.gmail.com',
          port: portNum,
          secure: portNum === 465 ? true : newSmtpSecure,
          user: newSmtpUser.trim(),
          pass: newSmtpPass.trim(),
          sender_name: config?.app_name || 'Japriin',
          is_active: true
        })
      });
      const data = await res.json();
      if (data.success) {
        setEmailToast({ type: 'success', text: '✓ Akun SMTP berhasil ditambahkan ke dalam rotasi!' });
        setNewSmtpUser('');
        setNewSmtpPass('');
        setNewSmtpName('');
        await fetchSmtpAccounts();
        setTimeout(() => setEmailToast(null), 4000);
      } else {
        setEmailToast({ type: 'error', text: data.error || 'Gagal menambahkan akun SMTP.' });
      }
    } catch (err: any) {
      setEmailToast({ type: 'error', text: err?.message || 'Gagal menghubungi server saat menambahkan SMTP.' });
    } finally {
      setIsAddingSmtp(false);
    }
  };

  // Toggle SMTP Active / Inactive
  const handleToggleSmtp = async (id: string) => {
    try {
      const res = await fetch(`/api/smtp/${id}/toggle`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        fetchSmtpAccounts();
      }
    } catch (e) {}
  };

  // Test Specific SMTP Account Connection
  const handleTestSingleSmtp = async (id: string) => {
    setTestingSmtpId(id);
    setEmailToast(null);
    try {
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: id, recipient_email: testEmailRecipient.trim() || undefined })
      });
      const data = await res.json();
      if (data.success) {
        setEmailToast({ type: 'success', text: `✓ ${data.message}` });
        fetchSmtpAccounts();
      } else {
        setEmailToast({ type: 'error', text: `❌ ${data.error || data.message}` });
        fetchSmtpAccounts();
      }
    } catch (err: any) {
      setEmailToast({ type: 'error', text: 'Gagal menguji koneksi akun SMTP.' });
    } finally {
      setTestingSmtpId(null);
    }
  };

  // Delete SMTP Account
  const handleDeleteSmtp = async (id: string) => {
    try {
      const res = await fetch(`/api/smtp/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setEmailToast({ type: 'success', text: '✓ Akun SMTP berhasil dihapus.' });
        fetchSmtpAccounts();
        setTimeout(() => setEmailToast(null), 3000);
      }
    } catch (e) {}
  };

  // Send Test Email via Multi-SMTP Rotation
  const handleTestEmail = async () => {
    if (!testEmailRecipient) return;
    setIsSendingTestEmail(true);
    setEmailToast(null);
    try {
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_email: testEmailRecipient })
      });
      const data = await res.json();
      if (data.success) {
        setEmailToast({ type: 'success', text: `✓ ${data.message}` });
        fetchSmtpAccounts();
      } else {
        setEmailToast({ type: 'error', text: `❌ ${data.error}` });
      }
    } catch (err: any) {
      setEmailToast({ type: 'error', text: 'Gagal mengirim email uji coba.' });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Add Gemini Key
  const handleAddGeminiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGeminiKey) return;

    try {
      const res = await fetch('/api/gemini-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGeminiName || `Gemini Key #${geminiList.length + 1}`,
          key: newGeminiKey.trim(),
          is_active: true
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeminiToast({ type: 'success', text: '✓ API Key Gemini berhasil ditambahkan untuk rotasi!' });
        setNewGeminiKey('');
        setNewGeminiName('');
        fetchGeminiKeys();
        fetchGatewayConfig();
        setTimeout(() => setGeminiToast(null), 3000);
      } else {
        setGeminiToast({ type: 'error', text: data.error || 'Gagal menambahkan Key.' });
      }
    } catch (e) {
      setGeminiToast({ type: 'error', text: 'Gagal menghubungi server.' });
    }
  };

  // Toggle Gemini Key
  const handleToggleGeminiKey = async (id: string) => {
    try {
      await fetch(`/api/gemini-keys/${id}/toggle`, { method: 'PUT' });
      fetchGeminiKeys();
    } catch (e) {}
  };

  // Delete Gemini Key
  const handleDeleteGeminiKey = async (id: string) => {
    try {
      await fetch(`/api/gemini-keys/${id}`, { method: 'DELETE' });
      fetchGeminiKeys();
    } catch (e) {}
  };

  // Test Gemini Key
  const handleTestGemini = async (key?: string) => {
    setIsTestingGemini(true);
    setGeminiToast(null);
    try {
      const res = await fetch('/api/gemini/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      if (data.success) {
        setGeminiToast({ type: 'success', text: `✓ ${data.message}` });
      } else {
        setGeminiToast({ type: 'error', text: `❌ ${data.message}` });
      }
    } catch (e) {
      setGeminiToast({ type: 'error', text: 'Gagal menguji Gemini API Key.' });
    } finally {
      setIsTestingGemini(false);
    }
  };

  // Save AI Prompt & Model Config
  const handleSaveAiConfig = async () => {
    setIsSavingAiConfig(true);
    setGeminiToast(null);
    try {
      const res = await fetch('/api/gemini/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: aiEnabled,
          system_prompt: aiSystemPrompt,
          fallback_when_no_rule: aiFallbackNoRule,
          model: aiModel,
          offline_fallback_message: aiOfflineMessage
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeminiToast({ type: 'success', text: '✓ Pengaturan AI & Pesan Offline berhasil disimpan ke Database!' });
        fetchGatewayConfig();
        setTimeout(() => setGeminiToast(null), 3500);
      } else {
        setGeminiToast({ type: 'error', text: data.error || 'Gagal menyimpan konfigurasi AI.' });
      }
    } catch (e) {
      setGeminiToast({ type: 'error', text: 'Gagal menghubungi server.' });
    } finally {
      setIsSavingAiConfig(false);
    }
  };

  // Test Webhook Verification
  const handleTestVerifyToken = async () => {
    const inputToUse = testTokenInput.trim() || verifyToken;
    const challengeStr = `test_challenge_${Math.floor(Math.random() * 100000)}`;
    const url = `/api/whatsapp?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(inputToUse)}&hub.challenge=${challengeStr}`;

    try {
      const res = await fetch(url);
      const text = await res.text();

      if (res.ok && text === challengeStr) {
        setVerifyResult({
          status: 'success',
          message: '✅ VERIFIKASI BERHASIL! Endpoint Webhook merespons challenge dengan HTTP 200 OK.'
        });
      } else {
        setVerifyResult({
          status: 'failed',
          message: '❌ VERIFIKASI GAGAL! Token verifikasi tidak cocok dengan token yang tersimpan.'
        });
      }
    } catch (err: any) {
      setVerifyResult({
        status: 'failed',
        message: '❌ GAGAL MENGHUBUNGI ENDPOINT! Pastikan server backend sedang berjalan.'
      });
    }
  };

  const handleCopy = (text: string, type: 'url' | 'token') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const webhookEndpoint = `${appUrl}/api/whatsapp`;

  return (
    <div className="space-y-6 mb-8 transition-colors duration-200">
      {/* Superadmin Subtab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setActiveSubTab('gateway')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center space-x-2 shrink-0 border ${
            activeSubTab === 'gateway'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Key className="w-4 h-4 shrink-0" />
          <span>Kredensial WA &amp; Webhook</span>
        </button>

        <button
          onClick={() => setActiveSubTab('smtp')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center space-x-2 shrink-0 border ${
            activeSubTab === 'smtp'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Mail className="w-4 h-4 shrink-0" />
          <span>Multi-SMTP Gmail ({smtpList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('gemini')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center space-x-2 shrink-0 border ${
            activeSubTab === 'gemini'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bot className="w-4 h-4 shrink-0" />
          <span>Rotasi Kunci AI ({geminiList.length})</span>
        </button>
      </div>

      {/* ---------------- SUBTAB 1: GATEWAY & WEBHOOK CREDENTIALS ---------------- */}
      {activeSubTab === 'gateway' && (
        <div className="space-y-6">
          {gatewayToast && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{gatewayToast}</span>
            </div>
          )}

          {/* Form Direct Edit WhatsApp Credentials (No .env) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Kredensial WhatsApp Gateway (Tersimpan di Database)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Anda tidak perlu mengedit file <code>.env</code>. Masukkan token dan ID langsung melalui formulir di bawah ini.
                </p>
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[10px] font-bold rounded-full">
                UI-Managed Mode
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  WhatsApp Access Token (Meta Graph API)
                </label>
                <input
                  type="password"
                  value={waToken}
                  onChange={e => setWaToken(e.target.value)}
                  placeholder={config?.whatsapp_token_set ? '•••••••••••••••• (Ketik baru untuk mengganti)' : 'Ketik WhatsApp Token di sini'}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                  Status: {config?.whatsapp_token_set ? <strong className="text-emerald-600 font-bold">Sudah Tersimpan</strong> : <span className="text-amber-500">Belum Disimpan</span>}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={phoneId}
                  onChange={e => setPhoneId(e.target.value)}
                  placeholder="Contoh: 102938475610"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                  ID Nomor Telepon bisnis dari Meta Dashboard
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Webhook Verify Token (Custom Token)
                </label>
                <input
                  type="text"
                  value={verifyToken}
                  onChange={e => setVerifyToken(e.target.value)}
                  placeholder="Token verifikasi rahasia"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                  Gunakan token ini saat setup Webhook di Meta Developer portal
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  App Base URL
                </label>
                <input
                  type="text"
                  value={appUrl}
                  onChange={e => setAppUrl(e.target.value)}
                  placeholder="http://localhost:3000 atau domain publik"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                  URL dasar domain gateway Anda
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSaveGateway}
                disabled={isSavingGateway}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {isSavingGateway ? 'Menyimpan...' : 'Simpan Kredensial Gateway'}
              </button>
            </div>
          </div>

          {/* Webhook Endpoint URLs & Simulator */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Endpoint URL Webhook Resmi Meta
            </h3>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <code className="text-xs font-mono text-emerald-600 dark:text-emerald-400 break-all select-all">
                {webhookEndpoint}
              </code>
              <button
                onClick={() => handleCopy(webhookEndpoint, 'url')}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center space-x-1 shrink-0"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Tersalin' : 'Salin URL'}</span>
              </button>
            </div>

            {/* Test Webhook Challenge verification */}
            <div className="pt-2 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Uji Respon Tantangan Webhook (Simulasi Meta Handshake)
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testTokenInput}
                  onChange={e => setTestTokenInput(e.target.value)}
                  placeholder={`Token verifikasi (default: ${verifyToken})`}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  onClick={handleTestVerifyToken}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all shrink-0"
                >
                  Tes Verifikasi
                </button>
              </div>

              {verifyResult.status !== 'idle' && (
                <div className={`p-3 rounded-xl text-xs font-bold border ${
                  verifyResult.status === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-400'
                }`}>
                  {verifyResult.message}
                </div>
              )}
            </div>

            {/* Ready-to-Copy Webhook Kit & VPS / cPanel Setup Guide */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Script Webhook Siap Pakai &amp; Panduan Setup (VPS &amp; Hosting cPanel)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(`${window.location.origin}/api/webhook`)
                  }
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-black"
                >
                  Salin /api/webhook
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* cPanel Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      1. Hosting cPanel (webhook.php)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(`<?php
header('Content-Type: application/json; charset=utf-8');
$GATEWAY_URL = '${window.location.origin}/api/webhook';
$VERIFY_TOKEN = '${verifyToken}';
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = $_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '';
    $token = $_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '';
    $challenge = $_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '';
    if ($mode === 'subscribe' && $token === $VERIFY_TOKEN) { echo $challenge; exit; }
    echo json_encode(['status' => 'READY']); exit;
}
$raw = file_get_contents('php://input');
$ch = curl_init($GATEWAY_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $raw);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$res = curl_exec($ch);
curl_close($ch);
echo $res ?: '{"success":true}';
?>`)
                      }
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold"
                    >
                      Salin Script PHP
                    </button>
                  </div>
                  <ol className="list-decimal list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-1 leading-relaxed">
                    <li>Buka <strong>cPanel &rarr; File Manager &rarr; public_html</strong>.</li>
                    <li>Buat file baru bernama <code className="font-mono font-bold">webhook.php</code>, klik Edit, lalu tempel (paste) Script PHP di atas.</li>
                    <li>Jika menggunakan menu <strong>Setup Node.js App</strong> di cPanel, arahkan <code className="font-mono">.htaccess</code> ke port <code className="font-mono">3000</code>.</li>
                    <li>Pastikan <strong>AutoSSL (HTTPS)</strong> aktif di cPanel Anda.</li>
                  </ol>
                </div>

                {/* VPS Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                      2. Server VPS (Ubuntu + Nginx + PM2)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(`pm2 start "npx tsx server.ts" --name "japriin-gateway" && pm2 save`)
                      }
                      className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold"
                    >
                      Salin Perintah PM2
                    </button>
                  </div>
                  <ol className="list-decimal list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-1 leading-relaxed">
                    <li>Arahkan <strong>A Record</strong> domain/subdomain ke IP VPS Anda.</li>
                    <li>Jalankan aplikasi via PM2: <code className="font-mono">pm2 start &quot;npx tsx server.ts&quot; --name &quot;japriin-gateway&quot;</code>.</li>
                    <li>Pasang Nginx Reverse Proxy ke <code className="font-mono">http://127.0.0.1:3000</code> dan aktifkan SSL dengan <code className="font-mono">certbot --nginx</code>.</li>
                    <li>Gunakan URL <code className="font-mono">https://domain-anda.com/api/webhook</code>.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SUBTAB 2: MULTI-SMTP GMAIL ROTATION ---------------- */}
      {activeSubTab === 'smtp' && (
        <div className="space-y-6">
          {emailToast && (
            <div className={`p-3 rounded-xl text-xs font-bold border flex items-center space-x-2 ${
              emailToast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-400'
            }`}>
              {emailToast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
              <span>{emailToast.text}</span>
            </div>
          )}

          {/* Add SMTP Account Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Tambah Akun SMTP Gmail untuk Rotasi
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Jika Akun Email A gagal mengirim kode verifikasi, sistem secara otomatis melakukan rotasi failover ke Akun Email B, C, dst.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddSmtp} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Label / Nama Akun</label>
                  <input
                    type="text"
                    value={newSmtpName}
                    onChange={e => setNewSmtpName(e.target.value)}
                    placeholder="Contoh: Gmail Utama Bisnis"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">SMTP Host</label>
                  <input
                    type="text"
                    required
                    value={newSmtpHost}
                    onChange={e => setNewSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Port SMTP</label>
                  <select
                    value={newSmtpPort}
                    onChange={e => {
                      const p = Number(e.target.value);
                      setNewSmtpPort(p);
                      setNewSmtpSecure(p === 465);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value={587}>587 (TLS / STARTTLS - Rekomendasi)</option>
                    <option value={465}>465 (SSL Secure)</option>
                    <option value={25}>25 (Non-SSL)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Email Pengirim (User)</label>
                  <input
                    type="email"
                    required
                    value={newSmtpUser}
                    onChange={e => setNewSmtpUser(e.target.value)}
                    placeholder="bisnisanda@gmail.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">App Password / Password SMTP</label>
                  <input
                    type="password"
                    required
                    value={newSmtpPass}
                    onChange={e => setNewSmtpPass(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  💡 Untuk Gmail, gunakan 16 digit <strong>Google App Password</strong> (spasi otomatis dibersihkan oleh sistem).
                </span>
                <button
                  type="submit"
                  disabled={isAddingSmtp}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1.5 min-h-[38px] disabled:opacity-50 shrink-0"
                >
                  {isAddingSmtp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isAddingSmtp ? 'Menambahkan...' : 'Tambahkan ke Rotasi'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Active SMTP Accounts */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Daftar Akun SMTP Dalam Rotasi Failover ({smtpList.length})
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Prioritas: Urutan atas ke bawah secara otomatis
              </span>
            </div>

            {smtpList.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                <Mail className="w-8 h-8 text-slate-400 mx-auto opacity-40" />
                <p>Belum ada akun SMTP Gmail yang ditambahkan.</p>
                <p className="text-[11px]">Tambahkan akun di atas agar pendaftaran dapat mengirimkan email kode OTP secara mandiri.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Nama &amp; Email</th>
                      <th className="p-3">Host &amp; Port</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Sukses / Gagal</th>
                      <th className="p-3">Terakhir Dipakai</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {smtpList.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 dark:text-white block">{item.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{item.user}</span>
                          {item.last_error && (
                            <span className="text-[10px] text-rose-500 block mt-0.5 max-w-xs truncate" title={item.last_error}>
                              ⚠️ {item.last_error}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {item.host}:{item.port}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => handleToggleSmtp(item.id)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              item.is_active !== false
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {item.is_active !== false ? 'Aktif' : 'Non-Aktif'}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold rounded text-[10px]">
                              ✓ {item.success_count || 0} Sukses
                            </span>
                            {item.error_count > 0 && (
                              <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold rounded text-[10px]">
                                ✗ {item.error_count} Gagal
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-[11px] text-slate-500">
                          {item.last_used_at ? new Date(item.last_used_at).toLocaleTimeString('id-ID') : 'Belum pernah'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleTestSingleSmtp(item.id)}
                              disabled={testingSmtpId === item.id}
                              className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 rounded-lg text-[11px] font-bold transition-colors flex items-center space-x-1"
                              title="Tes Koneksi Server SMTP Ini"
                            >
                              {testingSmtpId === item.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                              <span>Tes</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSmtp(item.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Hapus Akun"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Test Send Email Section */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-3">
              <input
                type="email"
                value={testEmailRecipient}
                onChange={e => setTestEmailRecipient(e.target.value)}
                placeholder="Masukkan email untuk tes kirim (contoh: tujuan@gmail.com)"
                className="w-full sm:flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                onClick={handleTestEmail}
                disabled={isSendingTestEmail || !testEmailRecipient}
                className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingTestEmail ? 'Mengirim Tes...' : 'Kirim Email Uji Coba'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SUBTAB 3: GEMINI API KEYS & AI AUTO REPLY ---------------- */}
      {activeSubTab === 'gemini' && (
        <div className="space-y-6">
          {geminiToast && (
            <div className={`p-3 rounded-xl text-xs font-bold border flex items-center space-x-2 ${
              geminiToast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-400'
            }`}>
              {geminiToast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
              <span>{geminiToast.text}</span>
            </div>
          )}

          {/* Add AI Key Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Tambah Kunci API Model AI Cerdas (Rotasi Otomatis)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sediakan beberapa Kunci API AI. Bila Kunci A terkena limit kuota, sistem otomatis beralih ke Kunci B agar balasan AI tidak terputus.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddGeminiKey} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Nama / Label Kunci</label>
                <input
                  type="text"
                  value={newGeminiName}
                  onChange={e => setNewGeminiName(e.target.value)}
                  placeholder="Contoh: Kunci AI Cadangan 1"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">API Key AI Cerdas</label>
                <input
                  type="password"
                  required
                  value={newGeminiKey}
                  onChange={e => setNewGeminiKey(e.target.value)}
                  placeholder="Ketik API key AI..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1 min-h-[40px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambahkan ke Rotasi</span>
                </button>
              </div>
            </form>
          </div>

          {/* List of AI Keys */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Daftar Kunci API AI Aktif ({geminiList.length})
              </h3>
              <button
                onClick={() => handleTestGemini()}
                disabled={isTestingGemini}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] rounded-xl transition-colors flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingGemini ? 'animate-spin' : ''}`} />
                <span>Uji Coba Respon Model</span>
              </button>
            </div>

            {geminiList.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <Bot className="w-8 h-8 text-slate-400 mx-auto opacity-40" />
                <p>Belum ada Kunci API AI yang ditambahkan.</p>
                <p className="text-[11px]">Tambahkan kunci di atas untuk mengaktifkan balasan cerdas dengan AI.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Nama Key</th>
                      <th className="p-3">Key (Disensor)</th>
                      <th className="p-3">Frekuensi Terpakai</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {geminiList.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{item.name}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">{item.key_masked}</td>
                        <td className="p-3 text-[11px] text-slate-500">
                          {item.usage_count || 0} kali digunakan
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleToggleGeminiKey(item.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.is_active
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.is_active ? 'Aktif' : 'Non-Aktif'}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteGeminiKey(item.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Hapus Key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* AI Auto-Reply Behavior Settings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Konfigurasi Model AI Cerdas &amp; Pesan Balasan Otomatis
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Gunakan model AI kecepatan tinggi (15 RPM) dan atur balasan otomatis saat pesan pelanggan tidak cocok dengan aturan keyword.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={e => setAiEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  {aiEnabled ? 'AI Aktif' : 'AI Non-Aktif'}
                </span>
              </label>
            </div>

            {/* Model Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Pilihan Versi Model AI (Mendukung 15 Request / Menit Kuota Free)
                </label>
                <select
                  value={aiModel}
                  onChange={e => setAiModel(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (Model Resmi Rekomendasi &amp; Kecepatan Tinggi) ⭐</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Paling Hemat Kuota &amp; Ringan)</option>
                  <option value="gemini-flash-latest">Gemini Flash Latest (Versi Terbaru Otomatis)</option>
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  ⚡ Model Gemini 3.8 Flash memberikan respons cerdas dan natural dalam Bahasa Indonesia untuk melayani pelanggan secara otomatis.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Mode Pemicu Balasan AI
                </label>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <label className="flex items-start space-x-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiFallbackNoRule}
                      onChange={e => setAiFallbackNoRule(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                    />
                    <span>Balas dengan AI jika pesan TIDAK cocok dengan Aturan Balasan manual</span>
                  </label>
                </div>
              </div>
            </div>

            {/* System Prompt Persona */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Instruksi Sistem AI (Persona &amp; Gaya Bahasa CS Bisnis)
              </label>
              <textarea
                rows={3}
                value={aiSystemPrompt}
                onChange={e => setAiSystemPrompt(e.target.value)}
                placeholder="Contoh: Anda adalah CS toko online yang ramah, sopan, ringkas, dan solutif. Sapa nama pelanggan dan jawab dalam Bahasa Indonesia natural..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
              />
            </div>

            {/* Offline / Unavailable Custom Message Fallback */}
            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl space-y-2">
              <label className="text-xs font-black text-amber-900 dark:text-amber-200 block">
                Pesan Kustom Jika AI Non-Aktif / Di Luar Jam Kerja / Kuota Habis
              </label>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400">
                Pesan ini otomatis dikirim jika fitur AI dimatikan, kuota limit tercapai, atau pesan pelanggan tidak memiliki jawaban custom di aturan kata kunci. Gunakan tag <code>{'{nama}'}</code> untuk menyapa pelanggan.
              </p>
              <textarea
                rows={2}
                value={aiOfflineMessage}
                onChange={e => setAiOfflineMessage(e.target.value)}
                placeholder="Contoh: Halo {nama}, terima kasih telah menghubungi kami. Maaf saat ini petugas kami sedang offline. Kami akan membalas pesan Anda sesegera mungkin."
                className="w-full bg-white dark:bg-slate-900 border border-amber-300/70 dark:border-amber-700/60 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSaveAiConfig}
                disabled={isSavingAiConfig}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {isSavingAiConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Simpan Konfigurasi Model AI &amp; Pesan Offline</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
