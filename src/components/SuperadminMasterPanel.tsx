import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Lock,
  Unlock,
  Key,
  Sliders,
  Settings,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  QrCode,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
  Building,
  Smartphone,
  Check,
  X,
  Layers,
  Flame,
  Globe,
  Mail,
  Send
} from 'lucide-react';
import { SubscriptionPlan, AppWhitelabelConfig, GeminiApiKey, QrisConfig, SmtpAccount } from '../types/whatsapp';
import { ConfirmModal } from './ConfirmModal';

interface SuperadminMasterPanelProps {
  onWhitelabelUpdated?: (whitelabel: AppWhitelabelConfig) => void;
  onPlansUpdated?: (plans: SubscriptionPlan[]) => void;
  onQrisUpdated?: (qris: QrisConfig) => void;
}

export const SuperadminMasterPanel: React.FC<SuperadminMasterPanelProps> = ({
  onWhitelabelUpdated,
  onPlansUpdated,
  onQrisUpdated
}) => {
  // Master PIN Unlock State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'plans' | 'whitelabel' | 'webhook' | 'smtp' | 'gemini' | 'qris'>('plans');
  const [toastMsg, setToastMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [webhookGuideTab, setWebhookGuideTab] = useState<'cpanel' | 'vps'>('cpanel');
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestOutput, setWebhookTestOutput] = useState<string | null>(null);

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    showToast('Berhasil disalin ke clipboard!');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleTestLocalWebhook = async () => {
    setIsTestingWebhook(true);
    setWebhookTestOutput(null);
    try {
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: whitelabel.primary_bot_phone || '6281234567890',
          name: 'Superadmin Tester',
          message: '/send'
        })
      });
      const data = await res.json();
      setWebhookTestOutput(JSON.stringify(data, null, 2));
      showToast('Webhook berhasil diuji & merespons template /send!');
    } catch (err: any) {
      setWebhookTestOutput(JSON.stringify({ success: false, error: err?.message || 'Gagal menghubungi webhook' }, null, 2));
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Plans State
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Whitelabel State
  const [whitelabel, setWhitelabel] = useState<AppWhitelabelConfig>({
    app_name: 'Japriin Pro',
    tagline: 'Whitelabel WhatsApp Gateway, REST API & Remote AI Bot',
    logo_url: '/src/assets/images/japriin_logo_1791445508697.jpg',
    company_name: 'PT Japriin Teknologi Indonesia',
    support_phone: '081234567890',
    primary_bot_phone: '081234567890',
    primary_bot_name: 'Japriin Assistant Pusat',
    footer_text: 'Dikelola secara profesional oleh Japriin.com',
    api_enabled: true
  });
  const [isSavingWhitelabel, setIsSavingWhitelabel] = useState(false);

  // Gemini Keys State
  const [geminiKeys, setGeminiKeys] = useState<GeminiApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [isTestingKey, setIsTestingKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Multi-SMTP State
  const [smtpList, setSmtpList] = useState<SmtpAccount[]>([]);
  const [newSmtpName, setNewSmtpName] = useState('');
  const [newSmtpHost, setNewSmtpHost] = useState('smtp.gmail.com');
  const [newSmtpPort, setNewSmtpPort] = useState(587);
  const [newSmtpUser, setNewSmtpUser] = useState('');
  const [newSmtpPass, setNewSmtpPass] = useState('');
  const [isAddingSmtp, setIsAddingSmtp] = useState(false);
  const [testingSmtpId, setTestingSmtpId] = useState<string | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [smtpErrorMsg, setSmtpErrorMsg] = useState('');

  // QRIS State
  const [qrisConfig, setQrisConfig] = useState<QrisConfig>({
    image_url: '',
    account_name: 'PT JAPRIIN MEDIA TEKNOLOGI',
    bank_name: 'QRIS ALL PAYMENT & BCA',
    account_number: '123-456-7890',
    instructions: 'Scan QRIS atau transfer BCA lalu upload bukti transfer.'
  });
  const [isSavingQris, setIsSavingQris] = useState(false);

  // Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const fetchData = async () => {
    try {
      const [pRes, wRes, gRes, qRes, sRes] = await Promise.all([
        fetch('/api/plans').then(r => r.json()),
        fetch('/api/whitelabel').then(r => r.json()),
        fetch('/api/gemini/keys').then(r => r.json()),
        fetch('/api/qris').then(r => r.json()),
        fetch('/api/smtp').then(r => r.json())
      ]);

      if (pRes.success) setPlans(pRes.data);
      if (wRes.success) setWhitelabel(wRes.data);
      if (gRes.success) setGeminiKeys(gRes.data);
      if (qRes.success) setQrisConfig(qRes.data);
      if (sRes.success && sRes.data) setSmtpList(sRes.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUnlockMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingPin(true);
    setPinError('');

    try {
      const res = await fetch('/api/auth/master-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      });
      const data = await res.json();
      if (data.success) {
        setIsUnlocked(true);
        setPinInput('');
      } else {
        setPinError(data.error || 'PIN Master Superadmin Salah!');
      }
    } catch (err) {
      setPinError('Gagal memverifikasi PIN.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Plan Save Handler
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setIsSavingPlan(true);

    try {
      const isNew = !plans.some(p => p.id === editingPlan.id);
      const url = isNew ? '/api/plans' : `/api/plans/${editingPlan.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPlan)
      });
      const data = await res.json();
      if (data.success) {
        showToast('✓ Paket langganan berhasil disimpan & langsung aktif!');
        setShowPlanModal(false);
        setEditingPlan(null);
        await fetchData();
        const freshPlans = await fetch('/api/plans').then(r => r.json()).catch(() => null);
        if (freshPlans?.success && freshPlans.data) {
          onPlansUpdated?.(freshPlans.data);
          window.dispatchEvent(new CustomEvent('plans-updated', { detail: freshPlans.data }));
        }
      }
    } catch (err) {
      showToast('Gagal menyimpan paket.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Logo Upload Handler
  const handleLogoImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setWhitelabel(prev => ({ ...prev, logo_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  // Whitelabel Save Handler
  const handleSaveWhitelabel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWhitelabel(true);
    try {
      const res = await fetch('/api/whitelabel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(whitelabel)
      });
      const data = await res.json();
      if (data.success) {
        const updatedWl = data.data || whitelabel;
        setWhitelabel(updatedWl);
        onWhitelabelUpdated?.(updatedWl);
        window.dispatchEvent(new CustomEvent('whitelabel-updated', { detail: updatedWl }));
        showToast('✓ Data Aplikasi, Nama, Footer & Nomor Gateway Utama Berhasil Disimpan & Diterapkan!');
        fetchData();
      }
    } catch (e) {
      showToast('Gagal menyimpan brand.');
    } finally {
      setIsSavingWhitelabel(false);
    }
  };

  // Gemini Key Add Handler
  const handleAddGeminiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyValue.trim()) return;

    try {
      const res = await fetch('/api/gemini/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, key: newKeyValue })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✓ Key Gemini berhasil ditambahkan ke rotasi!');
        setNewKeyName('');
        setNewKeyValue('');
        fetchData();
      }
    } catch (e) {
      showToast('Gagal menambahkan key.');
    }
  };

  // Gemini Key Test
  const handleTestKey = async (keyItem: GeminiApiKey) => {
    setIsTestingKey(keyItem.id);
    setTestResult(null);
    try {
      const res = await fetch('/api/gemini/keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyItem.key })
      });
      const data = await res.json();
      setTestResult({
        id: keyItem.id,
        success: data.success,
        message: data.message || (data.success ? 'Koneksi Berhasil!' : 'Gagal')
      });
    } catch (e: any) {
      setTestResult({ id: keyItem.id, success: false, message: e?.message || 'Error test key' });
    } finally {
      setIsTestingKey(null);
    }
  };

  // QRIS Image Upload Handler
  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setQrisConfig(prev => ({ ...prev, image_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveQris = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingQris(true);
    try {
      const res = await fetch('/api/qris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qrisConfig)
      });
      const data = await res.json();
      if (data.success) {
        const updatedQris = data.data || qrisConfig;
        setQrisConfig(updatedQris);
        onQrisUpdated?.(updatedQris);
        window.dispatchEvent(new CustomEvent('qris-updated', { detail: updatedQris }));
        showToast('✓ Konfigurasi QRIS & Rekening Pembayaran Berhasil Disimpan!');
      }
    } catch (e) {
      showToast('Gagal menyimpan QRIS.');
    } finally {
      setIsSavingQris(false);
    }
  };

  // If Master PIN is not yet unlocked
  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border border-indigo-200 dark:border-indigo-800 mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            Superadmin Master Lock 🔒
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Akses pengaturan paket langganan, rotasi API key, dan whitelabel brand dilindungi dengan enkripsi PIN Master tingkat tinggi.
          </p>
        </div>

        {pinError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{pinError}</span>
          </div>
        )}

        <form onSubmit={handleUnlockMaster} className="space-y-4">
          <div>
            <input
              type="password"
              required
              autoFocus
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              placeholder="Masukkan PIN Master Superadmin"
              className="w-full text-center tracking-widest text-base font-black bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isVerifyingPin}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black shadow-md transition-all flex items-center justify-center space-x-2 min-h-[44px]"
          >
            {isVerifyingPin ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            <span>Buka Akses Master</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/30 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-black text-indigo-200">
                Pusat Kontrol Superadmin Master
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                TERVERIFIKASI
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Atur seluruh ketentuan paket, rotasi Key Gemini, QRIS, dan identitas Whitelabel aplikasi.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsUnlocked(false)}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all self-start sm:self-auto flex items-center space-x-1.5"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Kunci Kembali</span>
        </button>
      </div>

      {toastMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${
            activeTab === 'plans'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Kelola Paket Langganan ({plans.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('whitelabel')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${
            activeTab === 'whitelabel'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Whitelabel &amp; No. Gateway Utama</span>
        </button>

        <button
          onClick={() => setActiveTab('webhook')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${
            activeTab === 'webhook'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Webhook Siap Pakai (VPS &amp; cPanel)</span>
        </button>

        <button
          onClick={() => setActiveTab('smtp')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${
            activeTab === 'smtp'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Multi-SMTP Email ({smtpList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('gemini')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${
            activeTab === 'gemini'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Rotasi Multi-Key Gemini ({geminiKeys.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('qris')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${
            activeTab === 'qris'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Upload QRIS &amp; Rekening</span>
        </button>
      </div>

      {/* TAB 1: PLANS MANAGEMENT */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Daftar &amp; Ketentuan Paket Harga
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ubah harga, limit harian, atau fitur paket. Halaman depan dan form upgrade akan otomatis sinkron!
              </p>
            </div>

            <button
              onClick={() => {
                setEditingPlan({
                  id: `plan_${Date.now()}`,
                  name: 'Paket Kustom',
                  price: 150000,
                  period: '/ bulan',
                  max_sessions: 5,
                  daily_msg_limit: 5000,
                  monthly_msg_limit: 150000,
                  features: ['5 Nomor WhatsApp Terhubung', '5.000 Pesan / Hari', 'Tanpa Watermark'],
                  popular: false
                });
                setShowPlanModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-xs flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Paket</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(plan => (
              <div
                key={plan.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between relative shadow-xs"
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-full uppercase">
                    Paling Laris 🔥
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h5 className="font-black text-slate-900 dark:text-white text-sm">{plan.name}</h5>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">ID: {plan.id}</span>
                  </div>

                  <div className="mt-3 flex items-baseline">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      Rp {plan.price.toLocaleString('id-ID')}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">{plan.period}</span>
                  </div>

                  <div className="mt-3 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-emerald-600 flex items-center justify-between">
                      <span>⚡ Limit WA:</span>
                      <span>{plan.daily_msg_limit.toLocaleString('id-ID')} / hari</span>
                    </div>
                    <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                      <span>🤖 Respon AI:</span>
                      <span>{(plan.daily_ai_limit ?? 50).toLocaleString('id-ID')} / hari</span>
                    </div>
                    <div className="text-slate-500 text-[11px] flex items-center justify-between">
                      <span>📅 Limit AI / Bln:</span>
                      <span>{(plan.monthly_ai_limit ?? 1500).toLocaleString('id-ID')} / bln</span>
                    </div>
                    <div className="text-slate-500 text-[11px] flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800 pt-1">
                      <span>📱 WhatsApp:</span>
                      <span>{plan.max_sessions} nomor</span>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {plan.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-center space-x-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setEditingPlan({ ...plan });
                      setShowPlanModal(true);
                    }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Paket</span>
                  </button>

                  {plan.id !== 'free' && (
                    <button
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Hapus Paket?',
                          message: `Apakah Anda yakin ingin menghapus paket "${plan.name}"?`,
                          onConfirm: async () => {
                            await fetch(`/api/plans/${plan.id}`, { method: 'DELETE' });
                            fetchData();
                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                          }
                        });
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: WHITELABEL & APP PRIMARY NUMBER */}
      {activeTab === 'whitelabel' && (
        <form onSubmit={handleSaveWhitelabel} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
          <div>
            <h4 className="text-base font-black text-slate-900 dark:text-white">
              Informasi Brand Whitelabel, Footer &amp; Nomor WhatsApp Gateway Utama
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Semua perubahan data aplikasi (Nama Aplikasi, Tagline, Perusahaan, Teks Footer, Logo, dan Nomor Gateway/CS) akan langsung diterapkan secara otomatis di halaman depan maupun di seluruh dalam aplikasi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Nama Aplikasi (Header, Judul &amp; Footer)
              </label>
              <input
                type="text"
                required
                value={whitelabel.app_name}
                onChange={e => setWhitelabel({ ...whitelabel, app_name: e.target.value })}
                placeholder="Contoh: Japriin"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Nomor WhatsApp Gateway Utama Aplikasi (Kirim OTP &amp; Remote Bot)
              </label>
              <input
                type="text"
                required
                value={whitelabel.primary_bot_phone}
                onChange={e => setWhitelabel({ ...whitelabel, primary_bot_phone: e.target.value })}
                placeholder="081234567890"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono font-bold text-emerald-600"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Nama Asisten Bot Pusat
              </label>
              <input
                type="text"
                required
                value={whitelabel.primary_bot_name}
                onChange={e => setWhitelabel({ ...whitelabel, primary_bot_name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Nama Perusahaan / Organisasi Resmi
              </label>
              <input
                type="text"
                value={whitelabel.company_name}
                onChange={e => setWhitelabel({ ...whitelabel, company_name: e.target.value })}
                placeholder="Contoh: PT Teknologi Indonesia"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Nomor WhatsApp Customer Service / Bantuan (Footer &amp; Konfirmasi)
              </label>
              <input
                type="text"
                value={whitelabel.support_phone || ''}
                onChange={e => setWhitelabel({ ...whitelabel, support_phone: e.target.value })}
                placeholder="081234567890"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Logo Aplikasi (URL Gambar atau Upload File)
              </label>
              <div className="flex items-center gap-2">
                <img
                  src={whitelabel.logo_url || '/src/assets/images/japriin_logo_1791445508697.jpg'}
                  alt="Logo Preview"
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).src = '/src/assets/images/japriin_logo_1791445508697.jpg';
                  }}
                  className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <input
                  type="text"
                  value={whitelabel.logo_url}
                  onChange={e => setWhitelabel({ ...whitelabel, logo_url: e.target.value })}
                  placeholder="/src/assets/images/japriin_logo_1791445508697.jpg"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                />
                <label className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer shrink-0 flex items-center space-x-1 border border-slate-200 dark:border-slate-700">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                  <input type="file" accept="image/*" onChange={handleLogoImageUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Tagline Aplikasi (Sub-judul Header &amp; Deskripsi Brand)
              </label>
              <input
                type="text"
                value={whitelabel.tagline}
                onChange={e => setWhitelabel({ ...whitelabel, tagline: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                Teks Footer Copyright (Ditampilkan di Bagian Bawah Dashboard &amp; Halaman Depan)
              </label>
              <input
                type="text"
                value={whitelabel.footer_text}
                onChange={e => setWhitelabel({ ...whitelabel, footer_text: e.target.value })}
                placeholder="Dikelola secara profesional oleh perusahaan Anda"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Live Preview of Header & Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Pratinjau Langsung (Live Preview Header &amp; Footer Aplikasi):
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <img
                  src={whitelabel.logo_url || '/src/assets/images/japriin_logo_1791445508697.jpg'}
                  alt={whitelabel.app_name}
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).src = '/src/assets/images/japriin_logo_1791445508697.jpg';
                  }}
                  className="w-8 h-8 rounded-lg object-cover"
                />
                <div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">{whitelabel.app_name || 'Nama Aplikasi'}</div>
                  <div className="text-[10px] text-slate-400">{whitelabel.tagline || 'Tagline Aplikasi'}</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                <strong className="text-slate-800 dark:text-slate-200">{whitelabel.app_name}</strong>
                {whitelabel.company_name ? ` (${whitelabel.company_name})` : ''} • {whitelabel.footer_text}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={isSavingWhitelabel}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md flex items-center space-x-2"
            >
              {isSavingWhitelabel && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Simpan &amp; Terapkan Konfigurasi Brand</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB: WEBHOOK SIAP PAKAI & PANDUAN VPS / CPANEL */}
      {activeTab === 'webhook' && (
        <div className="space-y-6">
          {/* Card 1: Endpoint Webhook Siap Salin & Tempel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
                  <Globe className="w-5 h-5 text-emerald-500" />
                  <span>Endpoint Webhook Siap Pakai (Tinggal Salin &amp; Tempel)</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Gunakan URL Webhook di bawah ini untuk menerima pesan masuk, perintah <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">/send</span>, atau integrasi jembatan VPS &amp; Hosting cPanel.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestLocalWebhook}
                disabled={isTestingWebhook}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-sm flex items-center space-x-2 shrink-0"
              >
                {isTestingWebhook ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Tes Simulasi Webhook (/send)</span>
              </button>
            </div>

            {webhookTestOutput && (
              <div className="p-4 bg-slate-950 text-emerald-400 rounded-2xl border border-emerald-500/30 text-xs font-mono space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans font-bold">
                  <span>Hasil Respons Uji Webhook (/api/webhook):</span>
                  <button
                    type="button"
                    onClick={() => setWebhookTestOutput(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    Tutup
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap text-[11px]">{webhookTestOutput}</pre>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary Webhook URL */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    1. URL Webhook Utama (Universal &amp; Meta)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
                    GET &amp; POST
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/api/webhook`}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`${window.location.origin}/api/webhook`, 'wh_primary')}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shrink-0"
                  >
                    {copiedKey === 'wh_primary' ? 'Tersalin!' : 'Salin URL'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Mendukung verifikasi webhook otomatis, perintah <code className="font-mono">/send</code>, dan penerusan pesan ke WhatsApp.
                </p>
              </div>

              {/* Alternative Meta Webhook URL */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    2. URL Webhook Alternatif (WhatsApp Cloud)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md">
                    GET &amp; POST
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/api/whatsapp`}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`${window.location.origin}/api/whatsapp`, 'wh_alt')}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shrink-0"
                  >
                    {copiedKey === 'wh_alt' ? 'Tersalin!' : 'Salin URL'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Endpoint cadangan yang kompatibel penuh dengan Meta Developer Portal &amp; cPanel Forwarder.
                </p>
              </div>

              {/* Verify Token */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    3. Webhook Verify Token
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md">
                    SECRET TOKEN
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value="maudigi_gtw_verify_token_2026"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard('maudigi_gtw_verify_token_2026', 'wh_token')}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shrink-0"
                  >
                    {copiedKey === 'wh_token' ? 'Tersalin!' : 'Salin Token'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Tempelkan token ini saat diminta <em>Verify Token</em> pada pengaturan Webhook.
                </p>
              </div>

              {/* Direct Send JSON Payload */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    4. Format Standar Perintah /send WhatsApp
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-md">
                    ANTI-LOOPING
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value="/send 08123456789 Halo kak, pesanan Anda sudah siap dikirim."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard('/send 08123456789 Halo kak, pesanan Anda sudah siap dikirim.', 'wh_send_cmd')}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shrink-0"
                  >
                    {copiedKey === 'wh_send_cmd' ? 'Tersalin!' : 'Salin Format'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Bisa dikirim ke <strong>Nomor Sistem ({whitelabel.primary_bot_phone})</strong> maupun ke <strong>Nomor Sendiri</strong> (ketik <code className="font-mono">/send</code> untuk melihat template).
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Script Webhook Siap Pakai & Tata Cara VPS / cPanel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  Script Webhook Siap Pakai &amp; Tata Cara Pemasangan (VPS &amp; Hosting cPanel)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pilih lingkungan server Anda di bawah ini. Semua kode sudah siap pakai — tinggal salin (copy) dan tempelkan (paste).
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setWebhookGuideTab('cpanel')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    webhookGuideTab === 'cpanel'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Hosting cPanel (PHP / Node.js)
                </button>
                <button
                  type="button"
                  onClick={() => setWebhookGuideTab('vps')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    webhookGuideTab === 'vps'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Server VPS (Ubuntu / Nginx / PM2)
                </button>
              </div>
            </div>

            {/* CPANEL GUIDE & READY SCRIPT */}
            {webhookGuideTab === 'cpanel' && (
              <div className="space-y-6">
                {/* Ready-to-paste webhook.php */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block">
                        File 1: Script <code className="text-emerald-600 dark:text-emerald-400 font-mono">webhook.php</code> Siap Pakai untuk cPanel (Tinggal Salin &amp; Tempel)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Buat file bernama <code className="font-mono font-bold">webhook.php</code> di dalam folder <code className="font-mono font-bold">public_html</code> cPanel Anda, lalu tempelkan kode di bawah ini:
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `<?php
/**
 * JAPRIIN WHATSAPP GATEWAY - WEBHOOK BRIDGE SIAP PAKAI (CPANEL PHP)
 * Simpan file ini di: public_html/webhook.php
 * URL Webhook Anda: https://domain-anda.com/webhook.php
 */

header('Content-Type: application/json; charset=utf-8');

// 1. Konfigurasi Gateway & Token
$GATEWAY_URL   = '${window.location.origin}/api/webhook';
$VERIFY_TOKEN  = 'maudigi_gtw_verify_token_2026';

// 2. Handle Verifikasi GET (Meta / Webhook Challenge)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode      = $_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '';
    $token     = $_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '';
    $challenge = $_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '';

    if ($mode === 'subscribe' && $token === $VERIFY_TOKEN) {
        http_response_code(200);
        echo $challenge;
        exit;
    }
    echo json_encode(['status' => 'ACTIVE', 'message' => 'Japriin cPanel Webhook Ready']);
    exit;
}

// 3. Baca Payload Pesan Masuk (POST)
$rawInput = file_get_contents('php://input');
$data     = json_decode($rawInput, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
    exit;
}

// 4. Teruskan (Forward) ke Engine Utama Japriin via cURL
$ch = curl_init($GATEWAY_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $rawInput);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Accept: application/json'
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 25);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode ?: 200);
echo $response ?: json_encode(['success' => true, 'status' => 'FORWARDED']);
?>`,
                          'script_cpanel_php'
                        )
                      }
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shrink-0"
                    >
                      {copiedKey === 'script_cpanel_php' ? '✓ Kode PHP Tersalin!' : 'Salin Script webhook.php'}
                    </button>
                  </div>

                  <pre className="p-4 bg-slate-950 text-emerald-300 rounded-2xl border border-slate-800 text-[11px] font-mono overflow-x-auto leading-relaxed">{`<?php
/**
 * JAPRIIN WHATSAPP GATEWAY - WEBHOOK BRIDGE SIAP PAKAI (CPANEL PHP)
 * Simpan file ini di: public_html/webhook.php
 * URL Webhook Anda: https://domain-anda.com/webhook.php
 */

header('Content-Type: application/json; charset=utf-8');

$GATEWAY_URL   = '${window.location.origin}/api/webhook';
$VERIFY_TOKEN  = 'maudigi_gtw_verify_token_2026';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode      = $_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '';
    $token     = $_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '';
    $challenge = $_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '';

    if ($mode === 'subscribe' && $token === $VERIFY_TOKEN) {
        http_response_code(200);
        echo $challenge;
        exit;
    }
    echo json_encode(['status' => 'ACTIVE', 'message' => 'Japriin cPanel Webhook Ready']);
    exit;
}

$rawInput = file_get_contents('php://input');
$ch = curl_init($GATEWAY_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $rawInput);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 25);
$response = curl_exec($ch);
curl_close($ch);
echo $response ?: json_encode(['success' => true]);
?>`}</pre>
                </div>

                {/* Ready-to-paste .htaccess for Node.js App on cPanel */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block">
                        File 2: Konfigurasi <code className="text-indigo-600 dark:text-indigo-400 font-mono">.htaccess</code> Reverse Proxy cPanel (Jika Menjalankan Node.js Langsung di cPanel)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Jika aplikasi Node.js dijalankan pada menu <strong>Setup Node.js App</strong> di cPanel (Port 3000), salin kode ini ke file <code className="font-mono font-bold">.htaccess</code> di <code className="font-mono font-bold">public_html</code>:
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `RewriteEngine On
RewriteRule ^$ http://127.0.0.1:3000/ [P,L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]`,
                          'script_cpanel_htaccess'
                        )
                      }
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shrink-0"
                    >
                      {copiedKey === 'script_cpanel_htaccess' ? '✓ .htaccess Tersalin!' : 'Salin .htaccess'}
                    </button>
                  </div>

                  <pre className="p-4 bg-slate-950 text-indigo-300 rounded-2xl border border-slate-800 text-[11px] font-mono overflow-x-auto leading-relaxed">{`RewriteEngine On
RewriteRule ^$ http://127.0.0.1:3000/ [P,L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]`}</pre>
                </div>

                {/* Step-by-Step cPanel Instructions */}
                <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl space-y-3">
                  <h5 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    📋 Tata Cara Lengkap Buat &amp; Pasang Webhook di Hosting cPanel:
                  </h5>
                  <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    <li>
                      <strong>Login ke cPanel Hosting</strong> Anda, lalu pastikan <strong>SSL/TLS Status (AutoSSL)</strong> sudah aktif (HTTPS hijau) pada domain atau subdomain Anda.
                    </li>
                    <li>
                      <strong>Cara Cepat (Menggunakan <code className="font-mono">webhook.php</code>):</strong>
                      <ul className="list-disc list-inside pl-5 mt-1 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <li>Buka menu <strong>File Manager</strong> &rarr; masuk ke direktori <code className="font-mono">public_html</code>.</li>
                        <li>Klik <strong>+ File</strong> di pojok kiri atas, beri nama <code className="font-mono font-bold">webhook.php</code>.</li>
                        <li>Klik kanan pada <code className="font-mono">webhook.php</code> &rarr; pilih <strong>Edit</strong>, lalu tempelkan (Paste) kode <strong>Script webhook.php Siap Pakai</strong> di atas dan klik <strong>Save Changes</strong>.</li>
                        <li>URL Webhook Anda siap digunakan di: <code className="font-mono text-emerald-600 dark:text-emerald-400">https://domain-anda.com/webhook.php</code>.</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Cara Full-Stack (Menggunakan Menu &ldquo;Setup Node.js App&rdquo; di cPanel):</strong>
                      <ul className="list-disc list-inside pl-5 mt-1 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <li>Buka menu <strong>Setup Node.js App</strong> di cPanel &rarr; klik <strong>Create Application</strong>.</li>
                        <li>Pilih versi Node.js <strong>20.x atau 22.x</strong>, mode <strong>Production</strong>, Application Root sesuai folder upload, dan Application Startup File isi dengan <code className="font-mono font-bold">server.ts</code> (atau hasil build).</li>
                        <li>Klik <strong>Run NPM Install</strong> lalu klik <strong>Start App</strong>.</li>
                        <li>Pasang file <code className="font-mono font-bold">.htaccess</code> di atas agar endpoint <code className="font-mono text-emerald-600 dark:text-emerald-400">https://domain-anda.com/api/webhook</code> langsung aktif.</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* VPS GUIDE & READY SCRIPT */}
            {webhookGuideTab === 'vps' && (
              <div className="space-y-6">
                {/* Ready-to-paste Nginx Config */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block">
                        File 1: Konfigurasi Nginx Reverse Proxy + WebSocket Siap Pakai (<code className="text-emerald-600 dark:text-emerald-400 font-mono">/etc/nginx/sites-available/japriin</code>)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Salin dan tempelkan konfigurasi ini ke Nginx di VPS Ubuntu/Debian Anda (ganti <code className="font-mono">domain-anda.com</code> dengan domain/sub-domain VPS Anda):
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `server {
    listen 80;
    server_name domain-anda.com www.domain-anda.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    location /api/webhook {
        proxy_pass http://127.0.0.1:3000/api/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`,
                          'script_vps_nginx'
                        )
                      }
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shrink-0"
                    >
                      {copiedKey === 'script_vps_nginx' ? '✓ Config Nginx Tersalin!' : 'Salin Config Nginx'}
                    </button>
                  </div>

                  <pre className="p-4 bg-slate-950 text-emerald-300 rounded-2xl border border-slate-800 text-[11px] font-mono overflow-x-auto leading-relaxed">{`server {
    listen 80;
    server_name domain-anda.com www.domain-anda.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    location /api/webhook {
        proxy_pass http://127.0.0.1:3000/api/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`}</pre>
                </div>

                {/* Ready-to-paste VPS Terminal Commands */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block">
                        File 2: Perintah Terminal Otomatis Setup VPS (Node.js 20 + PM2 + Nginx + SSL Certbot)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Salin dan jalankan perintah ini di terminal SSH VPS Ubuntu/Debian Anda:
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `# 1. Update & Install Nginx, Certbot SSL, dan Node.js 20 LTS
sudo apt update && sudo apt install -y curl git nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2 tsx

# 2. Masuk ke folder aplikasi & install dependencies
npm install
npm run build

# 3. Jalankan server gateway 24/7 dengan PM2 (Auto-Restart)
pm2 start "npx tsx server.ts" --name "japriin-gateway"
pm2 save
pm2 startup

# 4. Aktifkan Nginx & Pasang SSL HTTPS Gratis (Ganti domain-anda.com)
sudo ln -s /etc/nginx/sites-available/japriin /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d domain-anda.com`,
                          'script_vps_bash'
                        )
                      }
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shrink-0"
                    >
                      {copiedKey === 'script_vps_bash' ? '✓ Perintah SSH Tersalin!' : 'Salin Perintah VPS'}
                    </button>
                  </div>

                  <pre className="p-4 bg-slate-950 text-indigo-300 rounded-2xl border border-slate-800 text-[11px] font-mono overflow-x-auto leading-relaxed">{`# 1. Update & Install Nginx, Certbot SSL, dan Node.js 20 LTS
sudo apt update && sudo apt install -y curl git nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2 tsx

# 2. Masuk ke folder aplikasi & install dependencies
npm install
npm run build

# 3. Jalankan server gateway 24/7 dengan PM2 (Auto-Restart)
pm2 start "npx tsx server.ts" --name "japriin-gateway"
pm2 save
pm2 startup

# 4. Aktifkan Nginx & Pasang SSL HTTPS Gratis (Ganti domain-anda.com)
sudo ln -s /etc/nginx/sites-available/japriin /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d domain-anda.com`}</pre>
                </div>

                {/* Step-by-Step VPS Instructions */}
                <div className="p-5 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/50 rounded-2xl space-y-3">
                  <h5 className="text-xs font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                    🚀 Tata Cara Lengkap Buat &amp; Pasang Webhook di Server VPS:
                  </h5>
                  <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    <li>
                      <strong>Arahkan DNS Domain (A Record):</strong> Masuk ke pengelola domain (Cloudflare / Niagahoster / Rumahweb), buat <strong>A Record</strong> (misal <code className="font-mono">wa.domain-anda.com</code>) mengarah ke <strong>IP Public VPS</strong> Anda.
                    </li>
                    <li>
                      <strong>Jalankan Aplikasi dengan PM2:</strong> Pastikan aplikasi berjalan di port <code className="font-mono">3000</code> menggunakan PM2 (<code className="font-mono">pm2 start &quot;npx tsx server.ts&quot; --name &quot;japriin-gateway&quot;</code>) agar tetap menyala 24/7 meskipun VPS restart.
                    </li>
                    <li>
                      <strong>Pasang Reverse Proxy Nginx &amp; SSL HTTPS:</strong> Buat file <code className="font-mono">/etc/nginx/sites-available/japriin</code>, tempelkan <strong>Config Nginx</strong> di atas, lalu jalankan <code className="font-mono">sudo certbot --nginx -d wa.domain-anda.com</code>.
                    </li>
                    <li>
                      <strong>Gunakan URL Webhook Anda:</strong> Setelah SSL aktif, URL Webhook resmi Anda adalah <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">https://wa.domain-anda.com/api/webhook</code> dengan Verify Token <code className="font-mono font-bold">maudigi_gtw_verify_token_2026</code>.
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: MULTI-SMTP EMAIL ROTATION */}
      {activeTab === 'smtp' && (
        <div className="space-y-6">
          {smtpErrorMsg && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-bold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{smtpErrorMsg}</span>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
                <Mail className="w-4 h-4 text-emerald-500" />
                <span>Tambah Akun SMTP Email untuk Rotasi &amp; OTP</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Mendukung SMTP Gmail (16 digit App Password) maupun SMTP domain cPanel/VPS. Jika akun pertama gagal, sistem otomatis melakukan failover ke akun berikutnya.
              </p>
            </div>

            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!newSmtpUser.trim() || !newSmtpPass.trim()) return;
                setIsAddingSmtp(true);
                setSmtpErrorMsg('');
                try {
                  const portNum = Number(newSmtpPort) || 587;
                  const res = await fetch('/api/smtp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: newSmtpName.trim() || `SMTP (${newSmtpUser.trim().split('@')[0]})`,
                      host: newSmtpHost.trim() || 'smtp.gmail.com',
                      port: portNum,
                      secure: portNum === 465,
                      user: newSmtpUser.trim(),
                      pass: newSmtpPass.trim(),
                      sender_name: whitelabel.app_name || 'Japriin',
                      is_active: true
                    })
                  });
                  const data = await res.json();
                  if (data.success) {
                    showToast('✓ Akun SMTP berhasil ditambahkan ke rotasi!');
                    setNewSmtpName('');
                    setNewSmtpUser('');
                    setNewSmtpPass('');
                    fetchData();
                  } else {
                    setSmtpErrorMsg(data.error || 'Gagal menambahkan akun SMTP.');
                  }
                } catch (err: any) {
                  setSmtpErrorMsg(err?.message || 'Gagal menghubungi server saat menambahkan SMTP.');
                } finally {
                  setIsAddingSmtp(false);
                }
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Label / Nama Akun</label>
                  <input
                    type="text"
                    value={newSmtpName}
                    onChange={e => setNewSmtpName(e.target.value)}
                    placeholder="Contoh: Gmail Utama"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Host SMTP</label>
                  <input
                    type="text"
                    required
                    value={newSmtpHost}
                    onChange={e => setNewSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Port SMTP</label>
                  <select
                    value={newSmtpPort}
                    onChange={e => setNewSmtpPort(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold"
                  >
                    <option value={587}>587 (TLS / STARTTLS)</option>
                    <option value={465}>465 (SSL Secure)</option>
                    <option value={25}>25 (Non-SSL)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Email Pengirim (User)</label>
                  <input
                    type="email"
                    required
                    value={newSmtpUser}
                    onChange={e => setNewSmtpUser(e.target.value)}
                    placeholder="emailanda@gmail.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">App Password / Password</label>
                  <input
                    type="password"
                    required
                    value={newSmtpPass}
                    onChange={e => setNewSmtpPass(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isAddingSmtp}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-xs flex items-center space-x-1.5"
                >
                  {isAddingSmtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>{isAddingSmtp ? 'Menambahkan...' : 'Tambahkan ke Rotasi'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Daftar Akun SMTP Terdaftar ({smtpList.length})
            </h5>

            {smtpList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Belum ada akun SMTP. Tambahkan di atas untuk mengaktifkan pengiriman OTP Email.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {smtpList.map(acc => (
                  <div key={acc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-xs text-slate-900 dark:text-white">{acc.name}</span>
                        <span className="text-[11px] font-mono text-slate-500">({acc.user})</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                          {acc.host}:{acc.port}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 space-x-2">
                        <span className="text-emerald-600 font-bold">✓ {acc.success_count || 0} Sukses</span>
                        <span>•</span>
                        <span className={acc.error_count ? 'text-rose-500 font-bold' : ''}>✗ {acc.error_count || 0} Gagal</span>
                        {acc.last_error && <span className="text-rose-500">• {acc.last_error}</span>}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setTestingSmtpId(acc.id);
                          setSmtpErrorMsg('');
                          try {
                            const r = await fetch('/api/smtp/test', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ account_id: acc.id, recipient_email: testEmailRecipient.trim() || undefined })
                            }).then(res => res.json());
                            if (r.success) showToast(`✓ ${r.message}`);
                            else setSmtpErrorMsg(r.error || r.message || 'Tes koneksi SMTP gagal.');
                            fetchData();
                          } catch (e: any) {
                            setSmtpErrorMsg(e?.message || 'Gagal menguji koneksi SMTP.');
                          } finally {
                            setTestingSmtpId(null);
                          }
                        }}
                        disabled={testingSmtpId === acc.id}
                        className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center space-x-1"
                      >
                        {testingSmtpId === acc.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>Tes Koneksi</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/smtp/${acc.id}/toggle`, { method: 'PUT' });
                          fetchData();
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                          acc.is_active !== false
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {acc.is_active !== false ? 'Aktif' : 'Non-Aktif'}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/smtp/${acc.id}`, { method: 'DELETE' });
                          showToast('✓ Akun SMTP dihapus.');
                          fetchData();
                        }}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-3">
              <input
                type="email"
                value={testEmailRecipient}
                onChange={e => setTestEmailRecipient(e.target.value)}
                placeholder="Masukkan email tujuan untuk tes kirim (contoh: tujuan@gmail.com)"
                className="w-full sm:flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs"
              />
              <button
                type="button"
                disabled={isSendingTestEmail || !testEmailRecipient.trim()}
                onClick={async () => {
                  setIsSendingTestEmail(true);
                  setSmtpErrorMsg('');
                  try {
                    const r = await fetch('/api/smtp/test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ recipient_email: testEmailRecipient.trim() })
                    }).then(res => res.json());
                    if (r.success) showToast(`✓ ${r.message}`);
                    else setSmtpErrorMsg(r.error || r.message || 'Gagal mengirim email uji coba.');
                    fetchData();
                  } catch (e: any) {
                    setSmtpErrorMsg(e?.message || 'Gagal mengirim email uji coba.');
                  } finally {
                    setIsSendingTestEmail(false);
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingTestEmail ? 'Mengirim...' : 'Kirim Email Uji Coba'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GEMINI MULTI-KEY ROTATION */}
      {activeTab === 'gemini' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Tambah Key Gemini ke Sistem Rotasi</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sistem akan memutar (round-robin rotation) key secara otomatis saat membalas pesan atau mengecek bukti transfer. Jika salah satu key mencapai limit quota, sistem otomatis failover ke key berikutnya tanpa downtime.
            </p>

            <form onSubmit={handleAddGeminiKey} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Nama / Label Key
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="Contoh: Gemini Pro Key 2"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs"
                />
              </div>

              <div className="md:col-span-6">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  API Key Value (AIzaSy...)
                </label>
                <input
                  type="password"
                  required
                  value={newKeyValue}
                  onChange={e => setNewKeyValue(e.target.value)}
                  placeholder="Masukkan API Key Gemini..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambahkan</span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Keys */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Daftar Key Gemini Aktif ({geminiKeys.length})
              </h5>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {geminiKeys.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Belum ada key yang didaftarkan. Tambahkan key di atas.
                </div>
              ) : (
                geminiKeys.map(k => (
                  <div key={k.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-slate-900 dark:text-white text-xs">{k.name}</span>
                        <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                          k.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {k.is_active ? 'Aktif' : 'Non-aktif'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 space-x-2">
                        <span>Terpakai: {k.usage_count || 0}x</span>
                        <span>•</span>
                        <span>Error: {k.error_count || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTestKey(k)}
                        disabled={isTestingKey === k.id}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center space-x-1"
                      >
                        {isTestingKey === k.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                        <span>Tes Koneksi</span>
                      </button>

                      <button
                        onClick={async () => {
                          await fetch(`/api/gemini/keys/${k.id}/toggle`, { method: 'POST' });
                          fetchData();
                        }}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                      >
                        {k.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>

                      <button
                        onClick={async () => {
                          await fetch(`/api/gemini/keys/${k.id}`, { method: 'DELETE' });
                          fetchData();
                        }}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: UPLOAD QRIS & REKENING */}
      {activeTab === 'qris' && (
        <form onSubmit={handleSaveQris} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
          <div>
            <h4 className="text-base font-black text-slate-900 dark:text-white">
              Pengaturan QRIS &amp; Rekening Pembayaran Resmi
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Upload foto barcode QRIS langsung dari perangkat Anda atau masukkan URL gambar. Barcode ini akan muncul saat pembeli melakukan checkout paket.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                  Upload File Barcode QRIS
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrImageUpload}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                  Atau Masukkan URL Barcode QRIS
                </label>
                <input
                  type="url"
                  value={qrisConfig.image_url}
                  onChange={e => setQrisConfig({ ...qrisConfig, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                    Nama Bank / E-Wallet
                  </label>
                  <input
                    type="text"
                    required
                    value={qrisConfig.bank_name}
                    onChange={e => setQrisConfig({ ...qrisConfig, bank_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                    Nomor Rekening / HP
                  </label>
                  <input
                    type="text"
                    required
                    value={qrisConfig.account_number}
                    onChange={e => setQrisConfig({ ...qrisConfig, account_number: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                  Atas Nama Pemilik Rekening (NMID)
                </label>
                <input
                  type="text"
                  required
                  value={qrisConfig.account_name}
                  onChange={e => setQrisConfig({ ...qrisConfig, account_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold"
                />
              </div>
            </div>

            {/* QR Preview */}
            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                Pratinjau QRIS di Layar Pembeli:
              </span>
              <div className="w-48 h-48 mx-auto bg-white p-2 rounded-2xl shadow-md border border-slate-200 flex items-center justify-center">
                <img
                  src={qrisConfig.image_url || 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=JAPRIIN'}
                  alt="QRIS Preview"
                  className="w-full h-full object-contain"
                />
              </div>
              <h5 className="font-black text-xs text-slate-900 dark:text-white">{qrisConfig.account_name}</h5>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={isSavingQris}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md flex items-center space-x-2"
            >
              {isSavingQris && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Simpan QRIS &amp; Rekening</span>
            </button>
          </div>
        </form>
      )}

      {/* PLAN EDIT MODAL */}
      {showPlanModal && editingPlan && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => {
                setShowPlanModal(false);
                setEditingPlan(null);
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Edit Ketentuan Paket</span>
            </h3>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">ID Paket</label>
                  <input
                    type="text"
                    required
                    disabled={editingPlan.id === 'free'}
                    value={editingPlan.id}
                    onChange={e => setEditingPlan({ ...editingPlan, id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Nama Paket</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.name}
                    onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Harga (Rp)</label>
                  <input
                    type="number"
                    required
                    value={editingPlan.price}
                    onChange={e => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Periode</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.period}
                    onChange={e => setEditingPlan({ ...editingPlan, period: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Limit Pesan WA / Hari</label>
                  <input
                    type="number"
                    required
                    value={editingPlan.daily_msg_limit}
                    onChange={e => setEditingPlan({ ...editingPlan, daily_msg_limit: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Limit Pesan WA / Bulan</label>
                  <input
                    type="number"
                    value={editingPlan.monthly_msg_limit || 0}
                    onChange={e => setEditingPlan({ ...editingPlan, monthly_msg_limit: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Maksimal Sesi WA</label>
                  <input
                    type="number"
                    required
                    value={editingPlan.max_sessions}
                    onChange={e => setEditingPlan({ ...editingPlan, max_sessions: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs"
                  />
                </div>
              </div>

              {/* Batas Respon AI Gemini Per Hari & Per Bulan */}
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/60 rounded-2xl space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-black text-indigo-700 dark:text-indigo-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Batas Kuota Respon AI Gemini (Otomatis)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Batas Respon AI / Hari</label>
                    <input
                      type="number"
                      required
                      value={editingPlan.daily_ai_limit ?? 50}
                      onChange={e => setEditingPlan({ ...editingPlan, daily_ai_limit: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Batas Respon AI / Bulan</label>
                    <input
                      type="number"
                      required
                      value={editingPlan.monthly_ai_limit ?? 1500}
                      onChange={e => setEditingPlan({ ...editingPlan, monthly_ai_limit: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Fitur-fitur (Pisahkan dengan baris baru)
                </label>
                <textarea
                  rows={4}
                  value={editingPlan.features.join('\n')}
                  onChange={e => setEditingPlan({ ...editingPlan, features: e.target.value.split('\n').filter(Boolean) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="popular_plan"
                  checked={Boolean(editingPlan.popular)}
                  onChange={e => setEditingPlan({ ...editingPlan, popular: e.target.checked })}
                  className="rounded text-emerald-600"
                />
                <label htmlFor="popular_plan" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tandai sebagai Paket Paling Laris (Badge Populer)
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowPlanModal(false);
                    setEditingPlan(null);
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlan}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
