import React, { useState, useEffect } from 'react';
import {
  Bot,
  RefreshCw,
  ShieldCheck,
  Database,
  Zap,
  QrCode,
  Smartphone,
  Download,
  User,
  Shield,
  Sliders,
  Users,
  Sun,
  Moon,
  Menu,
  X,
  Cloud,
  Home,
  LogOut,
  Sparkles,
  Code,
  ShieldAlert,
  Key,
  Send
} from 'lucide-react';
import { BotStats, AppWhitelabelConfig } from '../types/whatsapp';

interface HeaderProps {
  stats: BotStats | null;
  onRefresh: () => void;
  isLoading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentRole: 'admin' | 'user';
  setCurrentRole: (role: 'admin' | 'user') => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onGoHome?: () => void;
  onLogout?: () => void;
  currentUserName?: string;
  onOpenPinModal?: () => void;
  whitelabel?: AppWhitelabelConfig | null;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  onRefresh,
  isLoading,
  activeTab,
  setActiveTab,
  currentRole,
  setCurrentRole,
  isDarkMode,
  onToggleTheme,
  onGoHome,
  onLogout,
  currentUserName = 'Admin',
  onOpenPinModal,
  whitelabel
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const appName = whitelabel?.app_name || 'Japriin';
  const appTagline = whitelabel?.tagline || 'WhatsApp Gateway & AI';
  const logoUrl = whitelabel?.logo_url || '/src/assets/images/japriin_logo_1791445508697.jpg';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard & Log', icon: Zap, roles: ['admin', 'user'] },
    { id: 'connect', label: 'Koneksi WA', icon: QrCode, roles: ['admin', 'user'], badge: 'QR & Code' },
    { id: 'broadcast', label: 'Kirim Broadcast', icon: Send, roles: ['admin', 'user'], badge: 'Aman' },
    { id: 'rules', label: 'Aturan Balas & AI', icon: Bot, roles: ['admin', 'user'] },
    { id: 'profile', label: 'Profil Akun', icon: User, roles: ['admin', 'user'] },
    { id: 'apidocs', label: 'REST API v1', icon: Code, roles: ['admin', 'user'], badge: 'LIVE' },
    { id: 'master', label: 'Superadmin Master', icon: ShieldAlert, roles: ['admin'], badge: 'Master 🔒' },
    { id: 'antiban', label: 'Proteksi Anti-Ban', icon: Sliders, roles: ['admin'] },
    { id: 'users', label: 'Kelola Pengguna', icon: Users, roles: ['admin'] },
    { id: 'config', label: 'Kredensial & Rotasi', icon: ShieldCheck, roles: ['admin'] },
    { id: 'sql', label: 'Database Cloud', icon: Cloud, roles: ['admin'] },
  ].filter(item => item.roles.includes(currentRole));

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-40 text-slate-800 dark:text-slate-100 shadow-xs backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-2.5 shrink-0">
            <div
              onClick={onGoHome}
              className="flex items-center space-x-2.5 cursor-pointer group"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-md flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <img
                  src={logoUrl}
                  alt={appName}
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).src = '/src/assets/images/japriin_logo_1791445508697.jpg';
                  }}
                  className="w-full h-full object-cover rounded-[14px]"
                />
              </div>
              <div className="max-w-[180px] sm:max-w-[260px]">
                <div className="flex items-center space-x-1.5">
                  <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white truncate">
                    {appName}
                  </h1>
                </div>
                <span className="text-[10px] text-slate-400 font-medium block -mt-0.5 hidden xs:block truncate">
                  {appTagline}
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center min-w-[36px] min-h-[36px]"
              title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            {/* Refresh Data Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50 min-w-[36px] min-h-[36px]"
              title="Perbarui Data Realtime"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            {/* Role Badge */}
            <div className={`px-2.5 py-1.5 rounded-xl text-xs font-black border flex items-center space-x-1.5 ${
              currentRole === 'admin'
                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
            }`}>
              {currentRole === 'admin' ? <Shield className="w-3.5 h-3.5 text-purple-600" /> : <User className="w-3.5 h-3.5 text-emerald-600" />}
              <span className="text-[11px] uppercase tracking-wider">{currentRole === 'admin' ? 'Superadmin' : 'Operator'}</span>
            </div>

            {/* Mobile Menu Drawer Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-rose-500" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Desktop Header Tab Navigation */}
        <div className="hidden lg:flex space-x-1 border-t border-slate-200/80 dark:border-slate-800/80 overflow-x-auto py-2 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 whitespace-nowrap min-h-[36px] ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* MOBILE POPUP DRAWER MENU */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white/98 dark:bg-slate-900/98 border-b border-slate-200 dark:border-slate-800 px-4 py-4 space-y-3 shadow-xl backdrop-blur-xl animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Navigasi Menu Lengkap
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {currentUserName}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center space-x-2.5 min-h-[46px] ${
                    isActive
                      ? 'bg-emerald-600 border-emerald-500 text-white font-black shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
            {onGoHome && (
              <button
                onClick={() => {
                  onGoHome();
                  setMobileMenuOpen(false);
                }}
                className="text-slate-600 dark:text-slate-400 hover:text-emerald-600 font-bold flex items-center space-x-1.5 py-1.5"
              >
                <Home className="w-4 h-4" />
                <span>Halaman Depan</span>
              </button>
            )}

            {onLogout && (
              <button
                onClick={() => {
                  onLogout();
                  setMobileMenuOpen(false);
                }}
                className="text-rose-600 dark:text-rose-400 hover:text-rose-700 font-bold flex items-center space-x-1.5 py-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Akun</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
