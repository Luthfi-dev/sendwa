import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Bot,
  Zap,
  Sliders,
  Users,
  ShieldCheck,
  Database,
  QrCode,
  Smartphone,
  LogOut,
  Home,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Sun,
  Moon,
  Cloud,
  Menu,
  X,
  CreditCard,
  User,
  Shield,
  Key,
  Send,
  Code,
  ShieldAlert
} from 'lucide-react';

import {
  WhatsAppMessageLog,
  AutoReplyRule,
  BotStats,
  EnvConfigMasked,
  UserAccount,
  SubscriptionPlan,
  WhatsAppSession,
  AppWhitelabelConfig,
  QrisConfig
} from './types/whatsapp';

import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { MessageLogsTable } from './components/MessageLogsTable';
import { AutoReplyRules } from './components/AutoReplyRules';
import { AntiBanPanel } from './components/AntiBanPanel';
import { UserManagementPanel } from './components/UserManagementPanel';
import { ConfigPanel } from './components/ConfigPanel';
import { SqlSchemaViewer } from './components/SqlSchemaViewer';
import { WhatsAppConnectPanel } from './components/WhatsAppConnectPanel';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { PaymentUpgradeModal } from './components/PaymentUpgradeModal';
import { ApiDocsPanel } from './components/ApiDocsPanel';
import { SuperadminMasterPanel } from './components/SuperadminMasterPanel';
import { SecurityPinModal } from './components/SecurityPinModal';
import { BroadcastPanel } from './components/BroadcastPanel';
import { ProfilePanel } from './components/ProfilePanel';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem('japriin_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [currentRole, setCurrentRole] = useState<'admin' | 'user'>(() => {
    try {
      const saved = localStorage.getItem('japriin_auth_user');
      if (saved) {
        const u = JSON.parse(saved);
        return u.role || 'user';
      }
    } catch {}
    return 'admin';
  });
  const [viewMode, setViewMode] = useState<'landing' | 'app'>(() => {
    try {
      const saved = localStorage.getItem('japriin_auth_user');
      return saved ? 'app' : 'landing';
    } catch {
      return 'landing';
    }
  });

  // Re-sync persistent session with server on initial boot
  useEffect(() => {
    const saved = localStorage.getItem('japriin_auth_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.id) {
          fetch('/api/users')
            .then(r => r.json())
            .then(res => {
              if (res.success && Array.isArray(res.data)) {
                const fresh = res.data.find((u: UserAccount) => u.id === parsed.id);
                if (fresh) {
                  setCurrentUser(fresh);
                  setCurrentRole(fresh.role);
                  localStorage.setItem('japriin_auth_user', JSON.stringify(fresh));
                }
              }
            })
            .catch(() => {});
        }
      } catch {}
    }
  }, []);

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);
  const [mobileSubMenuOpen, setMobileSubMenuOpen] = useState<boolean>(false);

  // Pending WhatsApp Verification States for logged-in sessions
  const [waPendingOtp, setWaPendingOtp] = useState('');
  const [isVerifyingWaPending, setIsVerifyingWaPending] = useState(false);
  const [waPendingError, setWaPendingError] = useState('');
  const [waPendingSuccess, setWaPendingSuccess] = useState('');
  const [isResendingWaPending, setIsResendingWaPending] = useState(false);
  const [waPendingCooldown, setWaPendingCooldown] = useState<number>(30);

  // Timer hitungan mundur 30 detik untuk kirim ulang OTP WhatsApp pending
  useEffect(() => {
    if (waPendingCooldown <= 0) return;
    const timer = setInterval(() => {
      setWaPendingCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [waPendingCooldown]);

  // Security PIN Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Dark/Light Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('japriin_theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    const themeMeta = document.getElementById('theme-color-meta');
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('japriin_theme', 'dark');
      if (themeMeta) themeMeta.setAttribute('content', '#0f172a');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('japriin_theme', 'light');
      if (themeMeta) themeMeta.setAttribute('content', '#ffffff');
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // Auth Modal State
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('free');

  // Upgrade / QRIS Payment Modal State
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [targetPaidPlan, setTargetPaidPlan] = useState<SubscriptionPlan | null>(null);

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [whitelabel, setWhitelabel] = useState<AppWhitelabelConfig>({
    app_name: 'Japriin',
    tagline: 'Whitelabel WhatsApp Gateway, Interactive REST API & Remote AI Bot',
    logo_url: '/src/assets/images/japriin_logo_1791445508697.jpg',
    company_name: 'Maudigi Teknologi Indonesia',
    support_phone: '081234567890',
    primary_bot_phone: '085761010112',
    primary_bot_name: 'Japriin Assistant Pusat',
    footer_text: 'Dikelola secara profesional oleh maudigi.com',
    api_enabled: true
  });
  const [qrisConfig, setQrisConfig] = useState<QrisConfig | null>(null);
  const [logs, setLogs] = useState<WhatsAppMessageLog[]>([]);
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [stats, setStats] = useState<BotStats | null>(null);
  const [config, setConfig] = useState<EnvConfigMasked | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dynamically sync browser document title with whitelabel app_name & tagline
  useEffect(() => {
    if (whitelabel?.app_name) {
      document.title = `${whitelabel.app_name}${whitelabel.tagline ? ` — ${whitelabel.tagline}` : ''}`;
    }
  }, [whitelabel]);

  // Listen to immediate Superadmin updates
  useEffect(() => {
    const onWlUpdate = (e: Event) => {
      const custom = e as CustomEvent<AppWhitelabelConfig>;
      if (custom.detail) setWhitelabel(custom.detail);
    };
    const onPlansUpdate = (e: Event) => {
      const custom = e as CustomEvent<SubscriptionPlan[]>;
      if (custom.detail) setPlans(custom.detail);
    };
    const onQrisUpdate = (e: Event) => {
      const custom = e as CustomEvent<QrisConfig>;
      if (custom.detail) setQrisConfig(custom.detail);
    };
    window.addEventListener('whitelabel-updated', onWlUpdate);
    window.addEventListener('plans-updated', onPlansUpdate);
    window.addEventListener('qris-updated', onQrisUpdate);
    return () => {
      window.removeEventListener('whitelabel-updated', onWlUpdate);
      window.removeEventListener('plans-updated', onPlansUpdate);
      window.removeEventListener('qris-updated', onQrisUpdate);
    };
  }, []);

  // Helper for resilient JSON fetching without crashing Promise.all on temporary network glitches
  const safeFetchJson = async (url: string, fallback: any = { success: false, data: [] }) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return fallback;
      return await res.json();
    } catch {
      return fallback;
    }
  };

  // Fetch plans, whitelabel & qris on mount
  useEffect(() => {
    safeFetchJson('/api/plans', { success: true, data: [] })
      .then(res => {
        if (res.success && res.data) setPlans(res.data);
      });
    safeFetchJson('/api/whitelabel', { success: false, data: null })
      .then(res => {
        if (res.success && res.data) setWhitelabel(res.data);
      });
    safeFetchJson('/api/qris', { success: false, data: null })
      .then(res => {
        if (res.success && res.data) setQrisConfig(res.data);
      });
  }, []);

  const currentUserId = currentUser?.id;

  // Fetch all initial dashboard data
  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const uId = currentUserId || '';
      const [msgRes, statsRes, rulesRes, configRes, usersRes, sessionsRes, wlRes, plansRes, qrisRes] = await Promise.all([
        safeFetchJson(`/api/messages?userId=${uId}`, { success: true, data: [] }),
        safeFetchJson(`/api/stats?userId=${uId}`, { success: true, data: null }),
        safeFetchJson(`/api/rules?userId=${uId}`, { success: true, data: [] }),
        safeFetchJson('/api/config', { success: true, data: null }),
        safeFetchJson('/api/users', { success: true, data: [] }),
        safeFetchJson(`/api/sessions?userId=${uId}`, { success: true, data: [] }),
        safeFetchJson('/api/whitelabel', { success: false, data: null }),
        safeFetchJson('/api/plans', { success: false, data: null }),
        safeFetchJson('/api/qris', { success: false, data: null })
      ]);

      if (msgRes.success) setLogs(msgRes.data || []);
      if (statsRes.success) setStats(statsRes.data || null);
      if (rulesRes.success) setRules(rulesRes.data || []);
      if (configRes.success) setConfig(configRes.data || null);
      if (sessionsRes.success) setSessions(sessionsRes.data || []);
      if (wlRes.success && wlRes.data) setWhitelabel(wlRes.data);
      if (plansRes.success && Array.isArray(plansRes.data)) setPlans(plansRes.data);
      if (qrisRes.success && qrisRes.data) setQrisConfig(qrisRes.data);

      if (usersRes.success && usersRes.data && usersRes.data.length > 0) {
        if (currentUserId) {
          const fresh = usersRes.data.find((u: UserAccount) => u.id === currentUserId);
          if (fresh) {
            setCurrentUser(prev => {
              if (!prev || prev.plan_id !== fresh.plan_id || prev.is_active !== fresh.is_active || prev.max_sessions !== fresh.max_sessions || prev.phone !== fresh.phone) {
                localStorage.setItem('japriin_auth_user', JSON.stringify(fresh));
                return fresh;
              }
              return prev;
            });
            setCurrentRole(fresh.role);
          }
        }
      }
    } catch (err) {
      console.warn('Dashboard fetch warning (will retry automatically):', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => {
      const uId = currentUserId || '';
      safeFetchJson(`/api/messages?userId=${uId}`, { success: false })
        .then(res => { if (res.success) setLogs(res.data || []); });

      safeFetchJson(`/api/stats?userId=${uId}`, { success: false })
        .then(res => { if (res.success) setStats(res.data || null); });

      safeFetchJson('/api/whitelabel', { success: false })
        .then(res => { if (res.success && res.data) setWhitelabel(res.data); });

      safeFetchJson('/api/users', { success: false })
        .then(res => {
          if (res.success && Array.isArray(res.data) && currentUser) {
            const fresh = res.data.find((u: any) => u.id === currentUser.id);
            if (fresh && JSON.stringify(fresh) !== JSON.stringify(currentUser)) {
              setCurrentUser(fresh);
              setCurrentRole(fresh.role);
              localStorage.setItem('japriin_auth_user', JSON.stringify(fresh));
            }
          }
        });
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchData, currentUserId]);

  const handleOpenAuthModal = (mode: 'login' | 'register', defaultPlanId: string = 'free') => {
    setAuthMode(mode);
    setSelectedPlanId(defaultPlanId);
    setIsAuthOpen(true);
  };

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    setViewMode('app');
    setIsAuthOpen(false);
    localStorage.setItem('japriin_auth_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setViewMode('landing');
    localStorage.removeItem('japriin_auth_user');
  };

  // Clear Message Logs
  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/messages', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setLogs([]);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  // Add Auto Reply Rule
  const handleAddRule = async (newRuleData: Omit<AutoReplyRule, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const uId = currentUserId || '';
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRuleData, user_id: uId })
      });
      const data = await res.json();
      if (data.success) {
        setRules(prev => [...prev, data.data]);
      } else {
        alert(data.error || 'Gagal menambahkan aturan.');
      }
    } catch (err) {
      console.error('Failed to add rule:', err);
    }
  };

  // Toggle Rule Status
  const handleToggleRule = async (id: string) => {
    try {
      const uId = currentUserId || '';
      const res = await fetch(`/api/rules/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uId })
      });
      const data = await res.json();
      if (data.success) {
        setRules(prev => prev.map(r => r.id === id ? data.data : r));
      }
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  // Delete Rule
  const handleDeleteRule = async (id: string) => {
    try {
      const uId = currentUserId || '';
      const res = await fetch(`/api/rules/${id}?userId=${uId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setRules(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleSelectPaidPlan = (plan: SubscriptionPlan) => {
    setTargetPaidPlan(plan);
    setIsUpgradeOpen(true);
  };

  const handleVerifyPendingWa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !waPendingOtp.trim()) return;
    setIsVerifyingWaPending(true);
    setWaPendingError('');
    setWaPendingSuccess('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          otp: waPendingOtp.trim(),
          type: 'whatsapp'
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setWaPendingSuccess('✓ Verifikasi WhatsApp berhasil! Akun Anda aktif.');
        setCurrentUser(data.user);
        setCurrentRole(data.user.role);
        localStorage.setItem('japriin_auth_user', JSON.stringify(data.user));
        setWaPendingOtp('');
        fetchData();
      } else {
        setWaPendingError(data.error || 'Kode OTP tidak cocok atau sudah kadaluarsa.');
      }
    } catch {
      setWaPendingError('Gagal memverifikasi OTP. Periksa jaringan Anda.');
    } finally {
      setIsVerifyingWaPending(false);
    }
  };

  const handleResendPendingWa = async () => {
    if (!currentUser || waPendingCooldown > 0 || isResendingWaPending) return;
    setIsResendingWaPending(true);
    setWaPendingError('');
    setWaPendingSuccess('');
    setWaPendingCooldown(30);

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          method: 'whatsapp'
        })
      });
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setWaPendingSuccess(data.message || 'Kode OTP baru berhasil dikirim ke nomor WhatsApp Anda.');
        if (data.cooldown_seconds) setWaPendingCooldown(data.cooldown_seconds);
      } else if (data && data.cooldown_seconds) {
        setWaPendingCooldown(data.cooldown_seconds);
        setWaPendingError(data.error);
      } else {
        setWaPendingError(data?.error || 'Gagal mengirim ulang OTP.');
      }
    } catch {
      setWaPendingError('Gagal menghubungi server.');
    } finally {
      setIsResendingWaPending(false);
    }
  };

  const handleUpgradeSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    setViewMode('app');
    setIsUpgradeOpen(false);
    fetchData();
  };

  const webhookUrl = config?.webhook_endpoint_url || 'http://localhost:3000/api/whatsapp';

  // RENDER LANDING PAGE IF IN LANDING VIEW MODE
  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen max-w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
        <LandingPage
          plans={plans}
          onLoginSuccess={handleLoginSuccess}
          onOpenAuthModal={handleOpenAuthModal}
          onSelectPaidPlan={handleSelectPaidPlan}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
          whitelabel={whitelabel}
        />
        <AuthModal
          isOpen={isAuthOpen}
          mode={authMode}
          defaultPlanId={selectedPlanId}
          plans={plans}
          onClose={() => setIsAuthOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          onSwitchMode={(m) => setAuthMode(m)}
          whitelabel={whitelabel}
        />
        <PaymentUpgradeModal
          isOpen={isUpgradeOpen}
          plan={targetPaidPlan}
          currentUser={currentUser}
          onClose={() => setIsUpgradeOpen(false)}
          onSuccess={handleUpgradeSuccess}
        />
      </div>
    );
  }

  // RENDER APP DASHBOARD
  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans selection:bg-emerald-500 selection:text-white pb-24 md:pb-12 transition-colors duration-200">
      {/* Top Navigation Header */}
      <Header
        stats={stats}
        onRefresh={fetchData}
        isLoading={isLoading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onGoHome={() => setViewMode('landing')}
        onLogout={handleLogout}
        currentUserName={currentUser?.name}
        whitelabel={whitelabel}
      />

      {/* Modern Native Sub-Header Strip */}
      <div className="bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 py-3.5 px-4 sm:px-6 lg:px-8 backdrop-blur-md relative z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5 sm:mt-0">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  Halo, {currentUser?.name || 'Superadmin'}! 👋
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase ${
                  currentUser?.role === 'admin'
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300'
                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                }`}>
                  {currentUser?.role === 'admin' ? 'Administrator Pusat' : `Paket ${currentUser?.plan_id?.toUpperCase() || 'PRO'}`}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-relaxed">
                @{currentUser?.username || 'admin'} · {currentUser?.role === 'admin' ? 'Akses Pengelola Sistem & Gateway Utama' : '100% Pesan Whitelabel Tanpa Watermark'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80 relative">
            {currentUser?.role !== 'admin' ? (
              <button
                onClick={() => {
                  const proPlan = plans.find(p => p.id === 'pro') || plans[plans.length - 1] || null;
                  setTargetPaidPlan(proPlan);
                  setIsUpgradeOpen(true);
                }}
                className="flex-1 sm:flex-initial justify-center px-3.5 py-2 sm:py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Tingkatkan Paket ⚡</span>
              </button>
            ) : (
              <span className="text-[11px] font-bold text-slate-400 sm:hidden">Menu Aksi Cepat:</span>
            )}

            {/* Desktop Action Buttons */}
            <div className="hidden sm:flex items-center space-x-2">
              <button
                onClick={() => setIsPinModalOpen(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border border-slate-200 dark:border-slate-700"
                title="Atur PIN Keamanan Remote WhatsApp Bot"
              >
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>PIN Bot 🔑</span>
              </button>

              <button
                onClick={() => setViewMode('landing')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5"
              >
                <Home className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Halaman Depan</span>
              </button>

              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>

            {/* Mobile 3-Dot Action Menu Toggle */}
            <div className="relative sm:hidden">
              <button
                onClick={() => setMobileSubMenuOpen(!mobileSubMenuOpen)}
                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                aria-label="Menu Aksi Lainnya"
              >
                <span className="font-black tracking-wider text-base">⋮</span>
              </button>

              {mobileSubMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-[9999] space-y-1">
                  <button
                    onClick={() => {
                      setIsPinModalOpen(true);
                      setMobileSubMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2"
                  >
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span>PIN Keamanan Bot</span>
                  </button>

                  <button
                    onClick={() => {
                      setViewMode('landing');
                      setMobileSubMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2"
                  >
                    <Home className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Halaman Depan</span>
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>

                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileSubMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center space-x-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Akun</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6 pb-28 lg:pb-8">
        {/* CHECK IF USER IS PENDING WHATSAPP VERIFICATION (Non-Admin) */}
        {currentUser && currentUser.role !== 'admin' && (!currentUser.wa_verified || !currentUser.is_active) ? (
          <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-500/40 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-center shadow-xl space-y-5 my-6">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 mx-auto flex items-center justify-center">
              <Smartphone className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <span className="px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 rounded-full text-[11px] font-black uppercase">
                Status Akun: Pending
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Verifikasi Nomor WhatsApp untuk Mengaktifkan Akun
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                Halo <strong>{currentUser.name}</strong> (@{currentUser.username}), akun Anda masih berstatus <strong>Pending</strong>. Masukkan kode OTP rahasia 6 digit yang telah dikirimkan ke nomor WhatsApp <strong>{currentUser.phone || 'Anda'}</strong> untuk mulai menggunakan gateway.
              </p>
            </div>

            {waPendingError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-center space-x-2 text-left">
                <span>{waPendingError}</span>
              </div>
            )}

            {waPendingSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center space-x-2 text-left">
                <span>{waPendingSuccess}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPendingWa} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={waPendingOtp}
                  onChange={e => setWaPendingOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifyingWaPending || waPendingOtp.length < 4}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 min-h-[44px]"
              >
                {isVerifyingWaPending ? 'Memverifikasi...' : 'Verifikasi & Aktifkan Akun Sekarang'}
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleResendPendingWa}
                  disabled={isResendingWaPending || waPendingCooldown > 0}
                  className={`py-2.5 px-4 font-bold text-xs rounded-xl border transition-all ${
                    waPendingCooldown > 0
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700'
                      : 'bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                  }`}
                >
                  {waPendingCooldown > 0
                    ? `Kirim Ulang (${waPendingCooldown}s)`
                    : isResendingWaPending
                    ? 'Mengirim...'
                    : 'Kirim Ulang OTP ke WhatsApp'}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
                >
                  Keluar Akun
                </button>
              </div>
            </form>
          </div>
        ) : currentUser && currentUser.role !== 'admin' && currentUser.plan_status === 'pending_approval' ? (
          <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-2xl mx-auto text-center shadow-xl space-y-5 my-6">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-500/20 text-amber-500 border border-amber-300 dark:border-amber-500/30 mx-auto flex items-center justify-center animate-pulse">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Pendaftaran Anda Menunggu Konfirmasi</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                Halo <strong>{currentUser.name}</strong>, pendaftaran paket <strong>{currentUser.plan_id.toUpperCase()}</strong> Anda berhasil dicatat. Admin kami akan segera mengaktifkan akun Anda.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-left text-xs space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex justify-between font-bold text-amber-600 dark:text-amber-400 pb-2 border-b border-slate-200 dark:border-slate-800">
                <span>Rincian Pembayaran:</span>
                <span>{qrisConfig ? `${qrisConfig.bank_name} ${qrisConfig.account_number} a.n ${qrisConfig.account_name}` : `Transfer Resmi a.n ${whitelabel.company_name || whitelabel.app_name}`}</span>
              </div>
              <p>Catatan Transfer Anda: <code className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{currentUser.payment_note || 'Sudah Transfer'}</code></p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
              <a
                href={`https://wa.me/${(whitelabel.support_phone || whitelabel.primary_bot_phone || '6281234567890').replace(/\D/g, '').replace(/^0/, '62')}?text=Halo%20Admin,%20saya%20sudah%20mendaftar%20username:%20${currentUser.username},%20mohon%20diaktifkan.`}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <Smartphone className="w-4 h-4" />
                <span>Konfirmasi via WhatsApp CS</span>
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* USER PORTAL BANNER */}
            {currentRole === 'user' && (
              <div className="mb-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-3">
                  <span className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </span>
                  <div>
                    <span className="font-black text-slate-900 dark:text-white block text-sm">Portal Layanan Operator WhatsApp</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Hubungkan nomor WhatsApp, atur aturan balas otomatis, dan cek riwayat pesan bebas watermark.</span>
                  </div>
                </div>
                <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-full text-xs font-black self-start sm:self-auto">
                  Paket {currentUser?.plan_id?.toUpperCase() || 'STARTER'}
                </div>
              </div>
            )}

            {/* TAB 0: WHATSAPP CONNECT & BARCODE / PAIRING */}
            {activeTab === 'connect' && (
              <div>
                <WhatsAppConnectPanel currentUser={currentUser} onSessionChange={fetchData} />
              </div>
            )}

            {/* TAB 1: DASHBOARD & MESSAGE LOGS */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <StatsCards stats={stats} webhookUrl={webhookUrl} isAdmin={currentRole === 'admin'} currentUser={currentUser} />
                <MessageLogsTable
                  logs={logs}
                  onClearLogs={handleClearLogs}
                  onRefresh={fetchData}
                  isLoading={isLoading}
                />
              </div>
            )}

            {/* TAB 2: AUTO REPLY RULES */}
            {activeTab === 'rules' && (
              <div>
                <AutoReplyRules
                  rules={rules}
                  onAddRule={handleAddRule}
                  onToggleRule={handleToggleRule}
                  onDeleteRule={handleDeleteRule}
                  currentUser={currentUser}
                  onUpdateUser={(updated) => setCurrentUser(updated)}
                />
              </div>
            )}

            {/* TAB: BROADCAST & SCHEDULED MESSAGES */}
            {activeTab === 'broadcast' && (
              <div>
                <BroadcastPanel currentUser={currentUser} sessions={sessions} stats={stats} />
              </div>
            )}

            {/* TAB: PROFILE & ACCOUNT */}
            {activeTab === 'profile' && (
              <div>
                <ProfilePanel
                  currentUser={currentUser}
                  plans={plans}
                  onOpenPinModal={() => setIsPinModalOpen(true)}
                  onOpenUpgradeModal={(plan) => {
                    setTargetPaidPlan(plan);
                    setIsUpgradeOpen(true);
                  }}
                  onUpdateUser={(updated) => setCurrentUser(updated)}
                />
              </div>
            )}

            {/* TAB: INTERACTIVE DEVELOPER REST API v1 */}
            {activeTab === 'apidocs' && (
              <div>
                <ApiDocsPanel currentUser={currentUser} />
              </div>
            )}

            {/* TAB: SUPERADMIN MASTER PANEL (MASTER PIN PROTECTED) */}
            {activeTab === 'master' && currentRole === 'admin' && (
              <div>
                <SuperadminMasterPanel
                  onWhitelabelUpdated={(updatedWl) => {
                    setWhitelabel(updatedWl);
                    fetchData();
                  }}
                  onPlansUpdated={(updatedPlans) => {
                    setPlans(updatedPlans);
                    fetchData();
                  }}
                  onQrisUpdated={(updatedQris) => {
                    setQrisConfig(updatedQris);
                    fetchData();
                  }}
                />
              </div>
            )}

            {/* TAB 3: ANTI-BAN ENGINE (ADMIN ONLY) */}
            {activeTab === 'antiban' && currentRole === 'admin' && (
              <div>
                <AntiBanPanel />
              </div>
            )}

            {/* TAB 4: USER MANAGEMENT (ADMIN ONLY) */}
            {activeTab === 'users' && currentRole === 'admin' && (
              <div>
                <UserManagementPanel />
              </div>
            )}

            {/* TAB 5: CREDENTIALS & CONFIG (ADMIN ONLY) */}
            {activeTab === 'config' && currentRole === 'admin' && (
              <div>
                <ConfigPanel config={config} />
              </div>
            )}

            {/* TAB 6: DATABASE CLOUD & MIGRATION (ADMIN ONLY) */}
            {activeTab === 'sql' && currentRole === 'admin' && (
              <div>
                <SqlSchemaViewer />
              </div>
            )}
          </>
        )}
      </main>

      {/* MOBILE NATIVE BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200/90 dark:border-slate-800 backdrop-blur-xl z-40 lg:hidden px-2 py-1.5 shadow-xl">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center space-y-1 p-2 rounded-2xl text-[10px] font-extrabold transition-all min-h-[48px] justify-center ${
              activeTab === 'dashboard'
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Zap className="w-5 h-5" />
            <span>Pesan</span>
          </button>

          <button
            onClick={() => setActiveTab('connect')}
            className={`flex flex-col items-center space-y-1 p-2 rounded-2xl text-[10px] font-extrabold transition-all min-h-[48px] justify-center ${
              activeTab === 'connect'
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <QrCode className="w-5 h-5" />
            <span>Koneksi</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex flex-col items-center space-y-1 p-2 rounded-2xl text-[10px] font-extrabold transition-all min-h-[48px] justify-center ${
              activeTab === 'broadcast'
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Send className="w-5 h-5" />
            <span>Broadcast</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`flex flex-col items-center space-y-1 p-2 rounded-2xl text-[10px] font-extrabold transition-all min-h-[48px] justify-center ${
              activeTab === 'rules'
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Bot className="w-5 h-5" />
            <span>Balasan</span>
          </button>

          {/* More Menu Drawer Trigger */}
          <button
            onClick={() => setIsMobileMoreOpen(true)}
            className={`flex flex-col items-center space-y-1 p-2 rounded-2xl text-[10px] font-extrabold transition-all min-h-[48px] justify-center ${
              ['profile', 'apidocs', 'master', 'antiban', 'users', 'config', 'sql'].includes(activeTab)
                ? 'text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/15'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span>Lainnya</span>
          </button>
        </div>
      </nav>

      {/* MOBILE ACTION SHEET FOR "LAINNYA" */}
      {isMobileMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black text-sm shadow-md">
                  ⚡
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Menu Navigasi &amp; Fitur</h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{whitelabel.app_name || 'Japriin'} Mobile Native Hub</span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setActiveTab('profile');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center space-x-2.5 ${
                  activeTab === 'profile'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <User className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="truncate">Profil Akun</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('apidocs');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center space-x-2.5 ${
                  activeTab === 'apidocs'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Code className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="truncate">REST API v1</span>
              </button>

              {currentRole === 'admin' && (
                <>
                  <button
                    onClick={() => {
                      setActiveTab('master');
                      setIsMobileMoreOpen(false);
                    }}
                    className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center space-x-2.5 ${
                      activeTab === 'master'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500" />
                    <span className="truncate">Master Panel</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('antiban');
                      setIsMobileMoreOpen(false);
                    }}
                    className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center space-x-2.5 ${
                      activeTab === 'antiban'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Sliders className="w-4 h-4 shrink-0 text-emerald-500" />
                    <span className="truncate">Anti-Ban</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('users');
                      setIsMobileMoreOpen(false);
                    }}
                    className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center space-x-2.5 ${
                      activeTab === 'users'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Users className="w-4 h-4 shrink-0 text-teal-500" />
                    <span className="truncate">Pengguna</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('config');
                      setIsMobileMoreOpen(false);
                    }}
                    className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center space-x-2.5 ${
                      activeTab === 'config'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0 text-amber-500" />
                    <span className="truncate">Kredensial</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('sql');
                      setIsMobileMoreOpen(false);
                    }}
                    className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center space-x-2.5 ${
                      activeTab === 'sql'
                        ? 'bg-teal-600 text-white border-teal-500 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Cloud className="w-4 h-4 shrink-0 text-teal-400" />
                    <span className="truncate">Database Cloud</span>
                  </button>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setViewMode('landing');
                  setIsMobileMoreOpen(false);
                }}
                className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 py-1.5"
              >
                <Home className="w-4 h-4 text-emerald-600" />
                <span>Halaman Depan</span>
              </button>

              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileMoreOpen(false);
                }}
                className="text-xs font-bold text-rose-600 flex items-center space-x-1.5 py-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Whitelabel Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1">
            <span className="font-black text-slate-800 dark:text-slate-200">
              {whitelabel.app_name || 'Japriin'}
            </span>
            {whitelabel.company_name && (
              <>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {whitelabel.company_name}
                </span>
              </>
            )}
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
              {whitelabel.footer_text || 'Dikelola secara profesional'}
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            {currentRole === 'admin' ? (
              <span>Penyimpanan: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{stats?.db_status === 'online' ? 'Cloud DB Online' : 'Lokal Aktif'}</strong></span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Otomasi Normal</span>
              </span>
            )}
            <span>•</span>
            <span className="text-slate-500 dark:text-slate-400">100% Bebas Watermark</span>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={isAuthOpen}
        mode={authMode}
        defaultPlanId={selectedPlanId}
        plans={plans}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onSwitchMode={(m) => setAuthMode(m)}
        whitelabel={whitelabel}
      />

      <PaymentUpgradeModal
        isOpen={isUpgradeOpen}
        selectedPlan={targetPaidPlan}
        plan={targetPaidPlan}
        currentUser={currentUser}
        onClose={() => setIsUpgradeOpen(false)}
        onSuccess={handleUpgradeSuccess}
        onRequireLogin={() => {
          setIsUpgradeOpen(false);
          setAuthMode('login');
          setIsAuthOpen(true);
        }}
      />

      <SecurityPinModal
        isOpen={isPinModalOpen}
        user={currentUser}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={(updated) => {
          setCurrentUser(updated);
          fetchData();
        }}
      />
    </div>
  );
}

export default App;
