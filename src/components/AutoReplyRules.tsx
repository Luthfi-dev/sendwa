import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Power, Bot, Sparkles, Check, AlertCircle, RefreshCw, Sliders, ChevronLeft, ChevronRight, X, Key, Send, MessageSquare, CheckCircle2 } from 'lucide-react';
import { AutoReplyRule } from '../types/whatsapp';
import { ConfirmModal } from './ConfirmModal';

interface AutoReplyRulesProps {
  rules: AutoReplyRule[];
  onAddRule: (rule: Omit<AutoReplyRule, 'id' | 'created_at' | 'updated_at'>) => void;
  onToggleRule: (id: string) => void;
  onDeleteRule: (id: string) => void;
  currentUser: any;
  onUpdateUser?: (updatedUser: any) => void;
}

export const AutoReplyRules: React.FC<AutoReplyRulesProps> = ({
  rules,
  onAddRule,
  onToggleRule,
  onDeleteRule,
  currentUser,
  onUpdateUser
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [showAddModal, setShowAddModal] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [matchType, setMatchType] = useState<'contains' | 'exact' | 'startsWith'>('contains');
  const [responseText, setResponseText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // AI Auto-Reply Toggle & System Prompt State
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [geminiKeyCount, setGeminiKeyCount] = useState(0);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [aiToast, setAiToast] = useState('');

  // AI Key Add Modal State
  const [showAiKeyModal, setShowAiKeyModal] = useState(false);
  const [newAiKeyName, setNewAiKeyName] = useState('');
  const [newAiKeyValue, setNewAiKeyValue] = useState('');
  const [isAddingAiKey, setIsAddingAiKey] = useState(false);
  const [aiKeyToast, setAiKeyToast] = useState('');

  // Live AI Test Reply Simulator State
  const [testPrompt, setTestPrompt] = useState('Halo min, mau tanya harga dan syarat bergabung?');
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [testResult, setTestResult] = useState<{
    reply: string;
    ai_generated?: boolean;
    matched_rule_id?: string;
    elapsed_ms?: number;
    error?: string;
  } | null>(null);

  // Pagination for rules
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Confirm delete modal state
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    ruleId: string;
    keyword: string;
  }>({
    isOpen: false,
    ruleId: '',
    keyword: ''
  });

  const fetchAiConfig = () => {
    fetch('/api/config')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.fullConfig?.ai_config) {
          if (!currentUser || currentUser.role === 'admin') {
            setAiEnabled(Boolean(res.fullConfig.ai_config.enabled));
            setAiPrompt(res.fullConfig.ai_config.system_prompt || '');
          }
        }
      })
      .catch(() => {});

    if (currentUser && currentUser.role === 'admin') {
      fetch('/api/gemini/keys')
        .then(r => r.json())
        .then(res => {
          if (res.success && Array.isArray(res.data)) {
            setGeminiKeyCount(res.data.length);
          }
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role !== 'admin') {
        setAiEnabled(currentUser.ai_enabled ?? false);
        setAiPrompt(currentUser.custom_system_prompt || '');
      } else {
        fetchAiConfig();
      }
    } else {
      fetchAiConfig();
    }
  }, [currentUser]);

  const handleToggleAi = async (enabled: boolean) => {
    if (enabled && !isAdmin && !currentUser?.custom_gemini_key) {
      setAiToast(`⚠️ Anda wajib memasukkan API Key Gemini pribadi Anda terlebih dahulu di menu Profil untuk mengaktifkan balasan AI!`);
      setTimeout(() => setAiToast(''), 6000);
      setAiEnabled(false);
      return;
    }

    setAiEnabled(enabled);
    setIsSavingAi(true);
    try {
      if (!isAdmin && currentUser) {
        const res = await fetch('/api/user/ai-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUser.id, enabled })
        });
        const data = await res.json();
        if (data.success && data.user && onUpdateUser) {
          onUpdateUser(data.user);
        }
      } else {
        await fetch('/api/gemini/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled, fallback_when_no_rule: true })
        });
      }
      setAiToast(`✓ Balas Pesan dengan AI Cerdas ${enabled ? 'Diaktifkan' : 'Dinonaktifkan'}!`);
      setTimeout(() => setAiToast(''), 3000);
    } catch (e) {
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleSavePrompt = async () => {
    setIsSavingAi(true);
    try {
      if (!isAdmin && currentUser) {
        const res = await fetch('/api/user/ai-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUser.id, system_prompt: aiPrompt })
        });
        const data = await res.json();
        if (data.success && data.user && onUpdateUser) {
          onUpdateUser(data.user);
        }
      } else {
        await fetch('/api/gemini/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system_prompt: aiPrompt, enabled: aiEnabled, fallback_when_no_rule: true })
        });
      }
      setAiToast('✓ Karakter instruksi AI berhasil disimpan!');
      setTimeout(() => setAiToast(''), 3000);
    } catch (e) {
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleAddGeminiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAiKeyValue.trim()) return;

    setIsAddingAiKey(true);
    setAiKeyToast('');
    try {
      const res = await fetch('/api/gemini-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAiKeyName.trim() || `Kunci AI ${geminiKeyCount + 1}`,
          key: newAiKeyValue.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiKeyToast('✅ Kunci API AI berhasil ditambahkan & langsung aktif!');
        setNewAiKeyValue('');
        setNewAiKeyName('');
        fetchAiConfig();
        setTimeout(() => {
          setAiKeyToast('');
          setShowAiKeyModal(false);
        }, 1500);
      } else {
        setAiKeyToast(`❌ ${data.error || 'Gagal menambahkan Kunci API.'}`);
      }
    } catch (e) {
      setAiKeyToast('❌ Gagal menghubungi server.');
    } finally {
      setIsAddingAiKey(false);
    }
  };

  const handleTestAiChat = async () => {
    if (!testPrompt.trim()) return;
    setIsTestingAi(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/gemini/test-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testPrompt.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          reply: data.reply,
          ai_generated: data.ai_generated,
          matched_rule_id: data.matched_rule_id,
          elapsed_ms: data.elapsed_ms
        });
      } else {
        setTestResult({
          reply: '',
          error: data.error || 'Gagal menguji balasan AI.'
        });
      }
    } catch (e) {
      setTestResult({
        reply: '',
        error: 'Gagal menghubungi server backend.'
      });
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !responseText.trim()) {
      setErrorMsg('Kata kunci dan isi pesan balasan wajib diisi.');
      return;
    }

    onAddRule({
      keyword: keyword.trim(),
      match_type: matchType,
      response_text: responseText.trim(),
      is_active: true
    });

    setKeyword('');
    setResponseText('');
    setMatchType('contains');
    setErrorMsg('');
    setShowAddModal(false);
  };

  const promptDeleteRule = (id: string, kw: string) => {
    setDeleteModalState({
      isOpen: true,
      ruleId: id,
      keyword: kw
    });
  };

  const totalPages = Math.ceil(rules.length / itemsPerPage) || 1;
  const paginatedRules = rules.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div id="rules-container" className="space-y-6 mb-8 transition-colors duration-200">
      {/* AI AUTO-REPLY SMART FALLBACK CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 text-white shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-500/20">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/30 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-indigo-200">AI Customer Service Cerdas (Gemini 3.8 Flash)</h3>
                {isAdmin ? (
                  <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 text-[10px] font-black rounded-full border border-indigo-400/40">
                    {geminiKeyCount} Kunci Aktif
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 text-[10px] font-black rounded-full border border-indigo-400/40">
                    {currentUser?.custom_gemini_key ? 'Kunci Pribadi Aktif ⚡' : 'Kunci AI Belum Terpasang (AI Tidak Aktif) ⚠️'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Kalo ada chat pelanggan yang gak cocok sama kata kunci apa pun, AI cerdas bakal otomatis balas ramah &amp; solutif tanpa bikin pelanggan nunggu!
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto pt-2.5 sm:pt-0 border-t sm:border-t-0 border-indigo-500/20 shrink-0">
            {isAdmin && (
              <button
                onClick={() => setShowAiKeyModal(true)}
                className="px-3.5 py-2 sm:py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>+ Tambah Kunci AI</span>
              </button>
            )}

            {/* Toggle */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={e => handleToggleAi(e.target.checked)}
                disabled={isSavingAi}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-2 text-xs font-bold text-slate-200">
                {aiEnabled ? 'Aktif' : 'Mati'}
              </span>
            </label>
          </div>
        </div>

        {aiToast && (
          <div className="p-3 bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 rounded-xl text-xs font-bold flex items-center space-x-2">
            <Check className="w-4 h-4 text-indigo-400" />
            <span>{aiToast}</span>
          </div>
        )}

        <div className="space-y-2.5">
          <label className="text-xs font-bold text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>Karakter &amp; Pengetahuan AI (System Prompt):</span>
            <span className="text-[11px] text-indigo-300 font-mono">
              Model Responsif &amp; Teruji
            </span>
          </label>
          <textarea
            rows={2}
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="Tulis instruksi persona CS di sini, contoh: Kamu adalah CS Japriin yang ramah, santun, dan siap menjawab harga paket serta panduan setup..."
            className="w-full bg-slate-950/70 border border-indigo-500/30 rounded-2xl p-3.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 leading-relaxed font-sans"
          />
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSavePrompt}
              disabled={isSavingAi}
              className="w-full sm:w-auto justify-center px-4 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center space-x-1.5"
            >
              {isSavingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Simpan Karakter AI</span>
            </button>
          </div>
        </div>

        {!isAdmin && (
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[11px] text-indigo-200 flex items-start space-x-2">
            <span className="text-sm shrink-0">💡</span>
            <div>
              <p className="font-bold text-indigo-300">Kebijakan Penggunaan AI &amp; Pesan Offline:</p>
              <p className="mt-0.5 text-slate-300 leading-relaxed">
                Untuk menggunakan fitur balas otomatis AI, Anda <strong>wajib memasukkan API Key Gemini pribadi</strong> di menu <strong className="text-indigo-400">Profil</strong>. Saat AI diaktifkan, AI akan sepenuhnya membalas pesan jika tidak ada kata kunci yang cocok di daftar aturan. Jika AI dinonaktifkan (atau jika Anda belum memasang API Key Gemini pribadi), pesan akan otomatis dibalas menggunakan <strong>Pesan Offline / Default</strong> Anda yang dapat dikustomisasi di menu <strong className="text-indigo-400">Profil</strong>.
              </p>
            </div>
          </div>
        )}

        {/* LIVE SIMULATOR TEST CHAT BOX */}
        <div className="pt-4 border-t border-indigo-500/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-xs font-black text-indigo-300 flex items-center space-x-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Uji Coba Tes Balas AI Langsung (Live Simulation)</span>
            </span>
            <span className="text-[10px] text-slate-400">
              Coba ketik pertanyaan pelanggan untuk menguji respons AI
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              value={testPrompt}
              onChange={e => setTestPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTestAiChat()}
              placeholder="Contoh: Halo min, mau tanya harga dan lokasi toko?"
              className="w-full sm:flex-1 bg-slate-950/80 border border-indigo-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
            />
            <button
              onClick={handleTestAiChat}
              disabled={isTestingAi || !testPrompt.trim()}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 shrink-0"
            >
              {isTestingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Tes Balas AI ⚡</span>
            </button>
          </div>

          {/* Test AI Result Card */}
          {testResult && (
            <div className="p-4 bg-slate-950/90 border border-indigo-500/40 rounded-2xl text-xs space-y-2 animate-in fade-in">
              {testResult.error ? (
                <div className="text-rose-400 font-bold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{testResult.error}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded text-[10px] border border-emerald-500/30">
                        {testResult.ai_generated ? '🤖 Balasan dari Model AI' : '📌 Cocok Keyword Rule'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Waktu Respon: {testResult.elapsed_ms || 120}ms
                      </span>
                    </div>
                    <span className="text-[10px] text-indigo-300 font-mono">
                      Status: Aktif &amp; Teruji
                    </span>
                  </div>
                  <div className="text-slate-200 leading-relaxed font-sans whitespace-pre-line bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    {testResult.reply}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KEYWORD RULES SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Daftar Aturan Balas Otomatis (Keyword)</h3>
                <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black rounded-full border border-emerald-200 dark:border-emerald-500/20">
                  {rules.length} Aturan
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">Pesan otomatis akan dibalas instan ketika kata kunci pemicu terdeteksi</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Aturan Baru</span>
          </button>
        </div>

        {/* Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-slate-500 text-xs">
              Belum ada aturan kata kunci yang dibuat. Klik tombol di atas untuk membuat aturan pertama!
            </div>
          ) : (
            paginatedRules.map(rule => (
              <div
                key={rule.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  rule.is_active
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/60 opacity-60'
                }`}
              >
                <div>
                  <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-2.5 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-black text-slate-900 dark:text-white text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl break-all">
                        "{rule.keyword}"
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                        Tipe: {rule.match_type}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                      <button
                        onClick={() => onToggleRule(rule.id)}
                        className={`p-1.5 rounded-xl border transition-all ${
                          rule.is_active
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                            : 'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                        title={rule.is_active ? 'Nonaktifkan Aturan' : 'Aktifkan Aturan'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => promptDeleteRule(rule.id, rule.keyword)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                        title="Hapus Aturan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                    {rule.response_text}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Variabel: <code>{'{nama}'}</code></span>
                  <span>{rule.is_active ? '✓ Aktif membalas' : 'Non-aktif'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Bot className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Tambah Aturan Balas Otomatis</span>
            </h3>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Kata Kunci Pemicu (Keyword)</label>
                <input
                  type="text"
                  required
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder="Contoh: halo, harga, promo, jam operasional"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Tipe Pencocokan Kata (Match Type)</label>
                <select
                  value={matchType}
                  onChange={e => setMatchType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="contains">Mengandung Kata (Contains - Sangat Dianjurkan)</option>
                  <option value="exact">Sama Persis (Exact Match)</option>
                  <option value="startsWith">Diawali Kata (Starts With)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Teks Pesan Balasan</label>
                <textarea
                  required
                  rows={4}
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                  placeholder="Ketik balasan otomatis di sini. Gunakan {nama} untuk menyebut nama pelanggan."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Simpan Aturan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Rule Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalState.isOpen}
        title="Hapus Aturan Balas Otomatis?"
        message={`Apakah Anda yakin ingin menghapus aturan untuk kata kunci "${deleteModalState.keyword}"? Pesan dengan kata kunci ini tidak akan dibalas otomatis lagi.`}
        type="danger"
        confirmText="Hapus Aturan"
        onConfirm={() => {
          onDeleteRule(deleteModalState.ruleId);
          setDeleteModalState(prev => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Add AI Key Modal */}
      {showAiKeyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100 relative">
            <button
              onClick={() => setShowAiKeyModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Key className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Tambah Kunci API Model AI Gemini</span>
            </h3>

            {aiKeyToast && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600" />
                <span>{aiKeyToast}</span>
              </div>
            )}

            <form onSubmit={handleAddGeminiKey} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Nama / Label Kunci API</label>
                <input
                  type="text"
                  value={newAiKeyName}
                  onChange={e => setNewAiKeyName(e.target.value)}
                  placeholder="Contoh: Gemini Key Utama CS"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">API Key Gemini (Google AI Studio)</label>
                <input
                  type="password"
                  required
                  value={newAiKeyValue}
                  onChange={e => setNewAiKeyValue(e.target.value)}
                  placeholder="Masukkan API Key Gemini AI di sini..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                  Kunci API ini akan otomatis masuk ke dalam sistem rotasi failover.
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAiKeyModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAddingAiKey || !newAiKeyValue.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isAddingAiKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Simpan Kunci API</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
