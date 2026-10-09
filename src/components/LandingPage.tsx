import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  Smartphone,
  MessageSquare,
  Bot,
  Users,
  Clock,
  Lock,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Star,
  Globe,
  HelpCircle,
  Sun,
  Moon,
  Check,
  X,
  FileText,
  Sliders,
  Send,
  Eye,
  Gift,
  Flame,
  KeyRound,
  ExternalLink,
  Shield,
  Cloud,
  Layers,
  Terminal,
  Cpu
} from 'lucide-react';
import { SubscriptionPlan, UserAccount, AppWhitelabelConfig } from '../types/whatsapp';

interface LandingPageProps {
  plans: SubscriptionPlan[];
  onLoginSuccess: (user: UserAccount) => void;
  onOpenAuthModal: (mode: 'login' | 'register', defaultPlanId?: string) => void;
  onSelectPaidPlan?: (plan: SubscriptionPlan) => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  whitelabel?: AppWhitelabelConfig | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  plans,
  onLoginSuccess,
  onOpenAuthModal,
  onSelectPaidPlan,
  isDarkMode = false,
  onToggleTheme,
  whitelabel
}) => {
  const appName = whitelabel?.app_name || 'Japriin';
  const appTagline = whitelabel?.tagline || 'Whitelabel WhatsApp Gateway, Interactive REST API & Remote AI Bot';
  const companyName = whitelabel?.company_name || 'PT Japriin Teknologi Indonesia';
  const footerText = whitelabel?.footer_text || 'Dikelola secara profesional oleh Japriin.com';
  const supportPhone = whitelabel?.support_phone || whitelabel?.primary_bot_phone || '081234567890';
  const logoUrl = whitelabel?.logo_url || '/src/assets/images/japriin_logo_1791445508697.jpg';

  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [simulatorQuestion, setSimulatorQuestion] = useState('Halo kak, produk ini masih ready stock dan bisa kirim hari ini?');
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [isSimulatingTyping, setIsSimulatingTyping] = useState(false);
  const [simulatedReply, setSimulatedReply] = useState<string>('👋 Halo Kak! Masih ready stock dan siap dikirim hari ini sebelum jam 16.00 WIB. Mau diproses sekarang?');
  const [watermarkCompareMode, setWatermarkCompareMode] = useState<'clean' | 'other_bot'>('clean');

  // Pre-configured questions for the live simulator
  const samplePrompts = [
    {
      q: 'Halo kak, produk ini ready stock & bisa kirim hari ini?',
      a: '👋 Halo Kak! Barang ready stock dan siap dikirim hari ini sebelum jam 16:00 WIB. Mau dikirim via kurir Instant atau Reguler?'
    },
    {
      q: 'Berapa biaya langganan paketnya?',
      a: 'Ada Paket Gratis Rp 0 selamanya (100 pesan/hari & 500 pesan/bulan), Starter Rp 50rb/bln, dan Business Rp 85rb/bln. Semua paket 100% tanpa watermark!'
    },
    {
      q: 'Jam berapa operasional customer service toko?',
      a: 'Bot otomatis kami aktif 24 jam nonstop setiap hari! Kalo tim CS manusia standby Senin - Sabtu jam 08:00 - 20:00 WIB ya kak.'
    },
    {
      q: 'Apakah ada watermark iklan bot pada pesan yang dikirim?',
      a: 'Sama sekali GAK ADA! Pesan yang terkirim ke WhatsApp pelanggan 100% murni atas nama brand Anda tanpa embel-embel watermark apa pun.'
    }
  ];

  const handleSelectPrompt = (prompt: { q: string; a: string }) => {
    setSimulatorQuestion(prompt.q);
    setIsSimulatingTyping(true);
    setSimulatedReply('');

    setTimeout(() => {
      setIsSimulatingTyping(false);
      setSimulatedReply(prompt.a);
    }, 1100);
  };

  const handleSendCustomPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestionInput.trim()) return;

    const q = customQuestionInput.trim();
    setSimulatorQuestion(q);
    setCustomQuestionInput('');
    setIsSimulatingTyping(true);
    setSimulatedReply('');

    setTimeout(() => {
      setIsSimulatingTyping(false);
      setSimulatedReply(`👋 Halo Kak! Terkait pertanyaan "${q}", sistem kami siap bantu proses dengan cepat dan praktis.`);
    }, 1300);
  };

  const toggleFaq = (idx: number) => {
    setActiveFaq(prev => prev === idx ? null : idx);
  };

  const faqs = [
    {
      q: 'Apakah beneran pesan yang dikirim gak ada watermark sama sekali?',
      a: 'Beneran 100% Murni Tanpa Watermark! Beda sama bot gratisan lain yang maksa nyelipin footer iklan kayak "Sent via FreeBot" atau link promosi mencurigakan, di Japriin pesan terkirim bersih apa adanya, bahkan buat akun Paket Gratis.'
    },
    {
      q: 'Gimana aturan kuota Paket Gratis 100 pesan per hari?',
      a: 'Tinggal daftar akun baru dan pilih Paket Gratis (Rp 0). Begitu verifikasi email atau nomor WhatsApp selesai, akun Anda langsung aktif otomatis seketika tanpa perlu bayar sepeser pun. Dapet kuota 100 pesan per hari dengan batas bulanan 500 pesan.'
    },
    {
      q: 'Gimana cara konekin nomor WhatsApp ke sistem?',
      a: 'Gampang dan sat-set banget! Masuk ke Dashboard, buka menu Koneksi WA, lalu scan Barcode QR pake kamera WhatsApp di HP Anda (persis kayak buka WhatsApp Web), atau bisa juga pake fitur Kode Pairing 8 digit.'
    },
    {
      q: 'Gimana cara kerja fitur Balas Pesan Cerdas pake AI?',
      a: 'Kalo ada chat pelanggan yang pertanyaannya gak cocok sama keyword otomatis mana pun, mesin AI Cerdas bakal otomatis nyusun jawaban yang sopan, ramah, dan solutif sesuai instruksi karakter bisnis Anda.'
    },
    {
      q: 'Apakah akun WhatsApp saya aman dari risiko banned?',
      a: 'Japriin dibekali Sistem Proteksi Perilaku Alami: jeda acak manusiawi (3-8 detik sebelum balas), simulasi status "sedang mengetik...", dan pembatas frekuensi pesan per menit biar akun WA Anda gak kebaca sebagai bot spam agresif.'
    },
    {
      q: 'Apakah saya bisa langsung mendaftar secara gratis?',
      a: 'Bisa banget! Silakan klik tombol "Daftar Akun Baru" di atas untuk mendaftarkan akun Anda secara gratis, memverifikasi nomor WhatsApp Anda, dan langsung mencoba seluruh fitur gateway & AI kami secara gratis.'
    }
  ];

  return (
    <div className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 min-h-screen selection:bg-emerald-500 selection:text-white transition-colors duration-200 font-sans pb-12">
      {/* Top Header Navbar */}
      <nav className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-15 sm:h-16 flex items-center justify-between">
          {/* Logo & Brand (Clean single line, no wrapping) */}
          <div
            className="flex items-center space-x-2 cursor-pointer group shrink-0"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <img
                src={logoUrl}
                alt={appName}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src = '/src/assets/images/japriin_logo_1791445508697.jpg';
                }}
                className="w-full h-full object-cover rounded-[10px]"
              />
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-sm sm:text-base font-black tracking-tight whitespace-nowrap text-slate-900 dark:text-white">
                {appName}
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-7 text-xs font-bold text-slate-600 dark:text-slate-300">
            <a href="#keunggulan" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Keunggulan
            </a>
            <a href="#tanpa-watermark" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
              <span>Tanpa Watermark</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </a>
            <a href="#paket-gratis" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Paket Gratis (Rp 0)
            </a>
            <a href="#simulator" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Simulasi Chat
            </a>
            <a href="#harga" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Harga
            </a>
            <a href="#faq" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              FAQ
            </a>
          </div>

          {/* Action Buttons (Compact & Responsive) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center min-w-[34px] min-h-[34px]"
                title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
              >
                {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
              </button>
            )}

            <button
              onClick={() => onOpenAuthModal('login')}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-black text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors rounded-xl"
            >
              Masuk
            </button>

            <button
              onClick={() => onOpenAuthModal('register', 'free')}
              className="px-3 sm:px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md hover:shadow-emerald-500/25 transition-all flex items-center space-x-1 min-h-[34px]"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Coba Gratis</span>
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28 bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border-b border-slate-200/80 dark:border-slate-800">
        {/* Ambient Glow Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[600px] h-[300px] bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none -z-0"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-5 sm:space-y-6">
            {/* Pill Kicker */}
            <div className="inline-flex items-center space-x-2 text-[11px] sm:text-xs font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 px-4 py-1.5 rounded-full shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>100% Whitelabel Murni · Tanpa Watermark Iklan Bot</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-2xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.18] sm:leading-[1.12]">
              Otomasi Chat WhatsApp Bisnis.{' '}
              <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400">
                100% Bersih Bebas Watermark.
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-xs sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-2xl sm:max-w-3xl mx-auto px-2">
              Bikin bisnis makin cuan dengan respon kilat 24/7! Dilengkapi kecerdasan <strong>AI Customer Service</strong>, proteksi jeda alami anti-ban, dan <strong>Paket Gratis 100 pesan per hari</strong>. Pesan terkirim murni &amp; profesional tanpa disisipi iklan bot ke pelanggan Anda.
            </p>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 px-2">
              <button
                onClick={() => onOpenAuthModal('register', 'free')}
                className="w-full sm:w-auto px-7 py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2 min-h-[48px] transform hover:-translate-y-0.5"
              >
                <Gift className="w-4 h-4" />
                <span>Daftar Paket Gratis (100 Pesan / Hari)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onOpenAuthModal('login')}
                className="w-full sm:w-auto px-6 py-3.5 sm:py-4 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs sm:text-sm rounded-2xl border border-slate-300 dark:border-slate-700 transition-all text-center min-h-[48px] flex items-center justify-center space-x-2 shadow-xs"
              >
                <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Masuk ke Dashboard ⚡</span>
              </button>
            </div>

            {/* Value Proof Badges */}
            <div className="pt-4 sm:pt-6 flex flex-wrap justify-center items-center gap-2 sm:gap-4 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
              <span className="flex items-center space-x-1.5 bg-white dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                <span className="font-extrabold text-slate-900 dark:text-white">100% Tanpa Watermark</span>
              </span>
              <span className="flex items-center space-x-1.5 bg-white dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                <span>Paket Gratis 100/Hari (500/Bulan)</span>
              </span>
              <span className="flex items-center space-x-1.5 bg-white dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                <span>Proteksi Jeda Alami Anti-Ban</span>
              </span>
              <span className="flex items-center space-x-1.5 bg-white dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                <span>AI CS Pintar Auto Fallback</span>
              </span>
            </div>
          </div>

          {/* INTERACTIVE LIVE PREVIEW BOX (MOCK WHATSAPP CHAT) */}
          <div id="simulator" className="mt-10 sm:mt-14 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
              {/* Window Header */}
              <div className="bg-slate-100/90 dark:bg-slate-800/80 px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2.5">
                  <div className="flex space-x-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  </div>
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300 ml-1.5 font-bold">
                    Simulator Live Chat WhatsApp
                  </span>
                </div>

                {/* Compare Mode Toggle */}
                <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-950 p-1 rounded-xl text-xs self-stretch sm:self-auto justify-center">
                  <button
                    onClick={() => setWatermarkCompareMode('clean')}
                    className={`flex-1 sm:flex-none px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      watermarkCompareMode === 'clean'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ✓ {appName} (Bersih)
                  </button>
                  <button
                    onClick={() => setWatermarkCompareMode('other_bot')}
                    className={`flex-1 sm:flex-none px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      watermarkCompareMode === 'other_bot'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ✕ Bot Lain (Watermark)
                  </button>
                </div>
              </div>

              {/* Chat Simulation Area */}
              <div className="p-4 sm:p-6 bg-slate-50/70 dark:bg-slate-950/70 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column: Sample Quick Questions */}
                <div className="lg:col-span-5 space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    1. Klik Pertanyaan Uji Coba:
                  </span>
                  <div className="space-y-1.5">
                    {samplePrompts.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectPrompt(p)}
                        className={`w-full text-left p-2.5 sm:p-3 rounded-2xl border text-xs transition-all ${
                          simulatorQuestion === p.q
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-snug text-[11px] sm:text-xs">{p.q}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Custom Input */}
                  <form onSubmit={handleSendCustomPrompt} className="pt-1">
                    <div className="relative">
                      <input
                        type="text"
                        value={customQuestionInput}
                        onChange={e => setCustomQuestionInput(e.target.value)}
                        placeholder="Ketik chat pelanggan custom..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        className="absolute right-1.5 top-1.5 p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all"
                        title="Kirim pesan simulasi"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right Column: WhatsApp Chat Preview */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between min-h-[320px]">
                  {/* WhatsApp Chat Header */}
                  <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                        CS
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">Customer Support Bisnis</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500 text-white" />
                        </div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Online (Terhubung)</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Hari ini</span>
                  </div>

                  {/* Chat Bubbles */}
                  <div className="py-4 space-y-3 flex-1">
                    {/* Incoming customer message */}
                    <div className="flex flex-col items-start space-y-1">
                      <span className="text-[10px] text-slate-400 font-medium">Pelanggan</span>
                      <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3.5 py-2.5 rounded-2xl rounded-tl-xs text-xs max-w-[90%] shadow-2xs leading-relaxed">
                        {simulatorQuestion}
                      </div>
                    </div>

                    {/* Human typing simulation state */}
                    {isSimulatingTyping && (
                      <div className="flex items-center space-x-2 text-[11px] text-emerald-600 dark:text-emerald-400 italic py-1">
                        <div className="flex space-x-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                        <span>{appName} sedang mengetik... (jeda proteksi anti-ban)</span>
                      </div>
                    )}

                    {/* Outgoing Auto Reply Bubble */}
                    {!isSimulatingTyping && simulatedReply && (
                      <div className="flex flex-col items-end space-y-1">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          Otomatis {appName}
                        </span>

                        {watermarkCompareMode === 'clean' ? (
                          /* Mode 1: 100% Clean Without Watermark */
                          <div className="bg-emerald-600 text-white px-3.5 sm:px-4 py-3 rounded-2xl rounded-tr-xs text-xs max-w-[90%] shadow-sm leading-relaxed space-y-1">
                            <p>{simulatedReply}</p>
                            <div className="flex items-center justify-end space-x-1 text-[10px] text-emerald-100 pt-0.5">
                              <span>10:42</span>
                              <Check className="w-3.5 h-3.5 stroke-[3] text-cyan-200" />
                            </div>
                          </div>
                        ) : (
                          /* Mode 2: Other Bot with Watermark */
                          <div className="bg-slate-700 text-slate-100 px-3.5 sm:px-4 py-3 rounded-2xl rounded-tr-xs text-xs max-w-[90%] shadow-sm leading-relaxed space-y-2 border border-rose-400/40">
                            <p>{simulatedReply}</p>
                            <div className="border-t border-rose-400/40 pt-2 text-[11px] font-mono text-rose-300 space-y-0.5">
                              <p className="font-bold">-- Sent by FreeBot Trial v1.2 --</p>
                              <p className="text-[10px] text-slate-300">Upgrade to PRO to remove this watermark! Visit: bit.ly/upgrade</p>
                            </div>
                            <div className="flex items-center justify-end space-x-1 text-[10px] text-slate-400 pt-0.5">
                              <span>10:42</span>
                              <Check className="w-3.5 h-3.5 stroke-[3] text-slate-300" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Comparison Status Banner */}
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                    watermarkCompareMode === 'clean'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {watermarkCompareMode === 'clean' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Pesan 100% Bersih &amp; Murni. Reputasi brand bisnis Anda terjaga sempurna!</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>Watermark bot lain merusak citra profesional dan dicurigai penipuan.</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: KEUNGGULAN UTAMA */}
      <section id="keunggulan" className="py-16 sm:py-20 bg-white dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-2.5 mb-12 sm:mb-16">
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Keunggulan Utama
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
              Kenapa Harus Pilih {appName}?
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Dibangun dengan teknologi soket modern dan kecerdasan AI untuk kecepatan, keamanan, dan privasi penuh tanpa ribet.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Keunggulan 1: No Watermark */}
            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all space-y-3 shadow-xs">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">100% Bebas Watermark</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Pesan yang masuk ke ponsel pelanggan murni milik bisnis Anda, tanpa embel-embel footer bot, link asing, atau watermark promosi apa pun.
              </p>
            </div>

            {/* Keunggulan 2: Paket Gratis 100/hari */}
            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all space-y-3 shadow-xs">
              <div className="w-11 h-11 rounded-2xl bg-teal-100 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                <Gift className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Paket Gratis Rp 0 Selamanya</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Kirim hingga 100 pesan otomatis per hari dengan kuota bulanan 500 pesan. Tanpa kartu kredit, langsung aktif seketika setelah verifikasi.
              </p>
            </div>

            {/* Keunggulan 3: Proteksi Anti-Ban Alami */}
            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all space-y-3 shadow-xs">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Proteksi Jeda Alami Anti-Ban</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Ada jeda waktu acak (3-8 detik), simulasi status "sedang mengetik...", dan pembatas frekuensi biar nomor WA Anda tetap aman dan terlindungi.
              </p>
            </div>

            {/* Keunggulan 4: AI CS Pintar */}
            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all space-y-3 shadow-xs">
              <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Balasan Cerdas AI 24 Jam</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Pertanyaan di luar kata kunci otomatis dijawab oleh model AI pintar yang ramah dan solutif sesuai instruksi karakter CS toko Anda.
              </p>
            </div>

            {/* Keunggulan 5: Multi-SMTP Rotasi */}
            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all space-y-3 shadow-xs">
              <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Multi-User &amp; Multi-Nomor</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Kelola banyak nomor WhatsApp sekaligus untuk berbagai cabang bisnis atau tim CS dalam satu dashboard terpusat yang aman.
              </p>
            </div>

            {/* Keunggulan 6: Database Cloud Online */}
            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all space-y-3 shadow-xs">
              <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Cloud className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Database Cloud Online Sync</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Data tersimpan lokal super cepat dan bisa dites koneksinya serta didorong sinkronisasinya ke Database Cloud online Anda kapan saja dengan 1 klik.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: DEDICATED SPOTLIGHT - TANPA WATERMARK */}
      <section id="tanpa-watermark" className="py-16 sm:py-20 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 rounded-3xl p-6 sm:p-12 text-white shadow-xl relative overflow-hidden">
            <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-white/5 blur-2xl pointer-events-none"></div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center space-x-2 bg-white/10 px-3.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Keunggulan Utama Paling Dicari</span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-black leading-tight">
                  Pesan Terkirim Murni Tanpa Watermark di Semua Paket.
                </h2>

                <p className="text-xs sm:text-sm text-emerald-50 leading-relaxed max-w-xl">
                  Banyak bot gratisan di luaran sana menyisipkan footer memalukan seperti <em>"Sent via Free-Bot - Upgrade to remove"</em>. Di Japriin, semua pesan yang terkirim ke pelanggan murni 100% milik bisnis Anda, bahkan di Paket Gratis sekalipun!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="flex items-start space-x-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Brand Tetap Kredibel</h4>
                      <p className="text-[11px] text-emerald-100">Pelanggan yakin bahwa mereka dilayani langsung oleh tim resmi.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Bebas Link Asing</h4>
                      <p className="text-[11px] text-emerald-100">Gak ada tautan pihak ketiga yang bikin pelanggan curiga.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Berlaku di Paket Gratis</h4>
                      <p className="text-[11px] text-emerald-100">Paket Rp 0 tetap bebas watermark selamanya.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Whitelabel Total</h4>
                      <p className="text-[11px] text-emerald-100">Bisnis Anda tampil seperti punya sistem enterprise bernilai tinggi.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Comparison Box */}
              <div className="lg:col-span-5 bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 space-y-3.5">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-200 block">
                  Perbandingan Tampilan di HP Pelanggan:
                </span>

                <div className="p-3 bg-black/30 rounded-xl space-y-1.5 border border-rose-500/30">
                  <span className="text-[11px] font-bold text-rose-300 flex items-center space-x-1">
                    <X className="w-3.5 h-3.5" />
                    <span>Layanan Bot Lain:</span>
                  </span>
                  <p className="text-[11px] text-slate-200 font-mono leading-relaxed">
                    Halo kak, pesanan Anda sedang kami siapkan ya...<br />
                    <span className="text-rose-300 font-bold block mt-1">
                      [Sent via FreeBot - Upgrade to remove watermark]
                    </span>
                  </p>
                </div>

                <div className="p-3 bg-emerald-950/60 rounded-xl space-y-1.5 border border-emerald-400/40">
                  <span className="text-[11px] font-bold text-emerald-300 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{appName} (Murni &amp; Bersih):</span>
                  </span>
                  <p className="text-[11px] text-emerald-50 font-mono leading-relaxed">
                    Halo kak, pesanan Anda sedang kami siapkan ya...<br />
                    <span className="text-emerald-300 font-bold block mt-0.5">
                      ✓ 100% Bersih &amp; Rapi tanpa iklan bot sama sekali.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: PAKET GRATIS HIGHLIGHT */}
      <section id="paket-gratis" className="py-16 sm:py-20 bg-white dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 dark:from-emerald-950/30 dark:via-slate-900 dark:to-teal-950/30 rounded-3xl p-6 sm:p-10 border-2 border-emerald-500/40 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
              <div className="space-y-3.5">
                <div className="inline-flex items-center space-x-2 bg-emerald-600 text-white text-[10px] sm:text-[11px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  <Gift className="w-3.5 h-3.5" />
                  <span>Paket Gratis Tanpa Biaya</span>
                </div>

                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-tight">
                  Kirim Hingga 100 Pesan per Hari.{' '}
                  <span className="text-emerald-600 dark:text-emerald-400">Rp 0 Selamanya.</span>
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  Gak perlu modal buat mulai! Gunakan Paket Gratis dengan kuota <strong>100 pesan otomatis per hari</strong> dan <strong>limit bulanan 500 pesan</strong>, lengkap dengan proteksi anti-ban dan 100% tanpa watermark.
                </p>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                    <span>100 Pesan / Hari</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                    <span>Limit Bulanan 500 Pesan</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                    <span>100% Tanpa Watermark</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                    <span>Langsung Aktif Tanpa Bayar</span>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto shrink-0 text-center bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md min-w-[240px]">
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Biaya Berlangganan</span>
                <span className="text-4xl font-black text-slate-900 dark:text-white block my-1">Rp 0</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block mb-4">Gratis Selamanya</span>

                <button
                  onClick={() => onOpenAuthModal('register', 'free')}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 min-h-[42px]"
                >
                  <Gift className="w-4 h-4" />
                  <span>Daftar Gratis Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: PRICING SECTION (ALL 4 TIERS) */}
      <section id="harga" className="py-16 sm:py-20 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-2.5 mb-12 sm:mb-16">
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Paket &amp; Harga Transparan
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
              Pilih Paket Sesuai Kebutuhan Anda
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Mulai gratis tanpa modal, atau upgrade kuota biar makin fleksibel dan tanpa batasan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            {plans.map((plan) => {
              const isFree = plan.id === 'free';
              const isPopular = plan.popular;

              return (
                <div
                  key={plan.id}
                  className={`rounded-3xl p-6 flex flex-col justify-between transition-all relative ${
                    isPopular
                      ? 'bg-white dark:bg-slate-900 border-2 border-emerald-500 shadow-xl ring-2 ring-emerald-500/20 z-10'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-sm flex items-center space-x-1">
                      <Flame className="w-3 h-3 text-amber-300 fill-amber-300" />
                      <span>Paling Laris 🔥</span>
                    </div>
                  )}

                  {isFree && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-sm">
                      Gratis Selamanya
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {isFree ? 'Uji coba langsung tanpa bayar' : 'Solusi otomasi chat bisnis'}
                    </p>

                    <div className="mt-5 flex items-baseline">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">
                        {isFree ? 'Rp 0' : `Rp ${plan.price.toLocaleString('id-ID')}`}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">{plan.period}</span>
                    </div>

                    <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                      <div className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                        {plan.daily_msg_limit.toLocaleString('id-ID')} pesan / hari
                      </div>
                      {plan.monthly_msg_limit && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Limit bulanan: {plan.monthly_msg_limit.toLocaleString('id-ID')} pesan
                        </div>
                      )}
                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start space-x-2 text-xs text-slate-700 dark:text-slate-300">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 stroke-[3]" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 pt-4">
                    <button
                      onClick={() => {
                        if (isFree) {
                          onOpenAuthModal('register', 'free');
                        } else if (onSelectPaidPlan) {
                          onSelectPaidPlan(plan);
                        } else {
                          onOpenAuthModal('register', plan.id);
                        }
                      }}
                      className={`w-full py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center space-x-1.5 min-h-[42px] ${
                        isPopular
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                          : isFree
                          ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>{isFree ? 'Daftar Gratis Sekarang (Rp 0)' : `Pilih & Bayar QRIS (${plan.name})`}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 5: DEVELOPER REST API & REMOTE WHATSAPP BOT HIGHLIGHTS */}
      <section className="py-16 sm:py-20 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2.5 max-w-3xl mx-auto">
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Fitur Canggih &amp; Integrasi Tanpa Batas
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Koneksikan ke Sistem Apapun atau Kontrol Langsung via WhatsApp
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Dua modul revolusioner yang bikin pengelolaan pesan WhatsApp Anda jauh lebih hemat waktu, fleksibel, dan profesional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Card 1: Interactive REST API */}
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 border border-indigo-500/30 flex flex-col justify-between relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Terminal className="w-48 h-48 text-indigo-400" />
              </div>

              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center">
                  <Cpu className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg sm:text-xl font-black text-white">
                      Interactive Developer REST API v1
                    </h3>
                    <span className="px-2 py-0.2 bg-indigo-500/30 text-indigo-200 text-[10px] font-black rounded-full border border-indigo-400/40">
                      HTTP POST / GET
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Koneksikan aplikasi toko online, POS kasir, ERP, CRM, atau sistem custom Anda langsung ke WhatsApp Gateway. Dilengkapi dokumentasi interaktif live tester dan siap salin kode Node.js, Python, PHP, dan cURL.
                  </p>
                </div>

                <div className="p-3 bg-black/50 rounded-2xl border border-white/10 font-mono text-[11px] text-emerald-300 space-y-1">
                  <div>POST /api/v1/send-message</div>
                  <div className="text-slate-400 text-[10px]">Authorization: Bearer mgw_live_token...</div>
                </div>
              </div>

              <div className="relative z-10 pt-6">
                <button
                  onClick={() => onOpenAuthModal('login')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all flex items-center space-x-2 shadow-md"
                >
                  <span>Buka Dokumentasi API Lengkap</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Card 2: Remote WhatsApp Assistant */}
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 border border-emerald-500/30 flex flex-col justify-between relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Smartphone className="w-48 h-48 text-emerald-400" />
              </div>

              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg sm:text-xl font-black text-white">
                      Remote WhatsApp Bot Assistant
                    </h3>
                    <span className="px-2 py-0.2 bg-emerald-500/30 text-emerald-200 text-[10px] font-black rounded-full border border-emerald-400/40">
                      Tanpa Buka Web
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Malas buka web? Cukup chat ke nomor WhatsApp resmi sistem. Ketik <code>/menu</code> untuk kirim pesan ke customer atau ubah data. Setiap eksekusi diverifikasi dengan <strong>10 pilihan PIN acak anti-intip</strong> untuk keamanan maksimal!
                  </p>
                </div>

                <div className="p-3 bg-black/50 rounded-2xl border border-white/10 text-[11px] text-slate-300 space-y-1">
                  <div className="text-emerald-300 font-bold">💬 Chat: /kirimpesan to=0812... msg=Halo</div>
                  <div className="text-amber-300 text-[10px]">🔒 Bot: Masukkan PIN Anda dari 10 pilihan acak</div>
                </div>
              </div>

              <div className="relative z-10 pt-6">
                <button
                  onClick={() => onOpenAuthModal('register', 'free')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center space-x-2 shadow-md"
                >
                  <span>Coba Gratis Sekarang</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: FAQ ACCORDION */}
      <section id="faq" className="py-16 sm:py-20 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2.5 mb-10 sm:mb-12">
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Tanya Jawab (FAQ)
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Pertanyaan yang Sering Ditanyakan
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Jawaban ringkas buat semua hal seputar Japriin, paket gratis, dan sistem keamanan.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4.5 text-left text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between gap-3 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className={`text-slate-400 text-sm transform transition-transform ${activeFaq === idx ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>
                {activeFaq === idx && (
                  <div className="px-4.5 pb-4.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RICH MODERN 4-COLUMN FOOTER */}
      <footer className="bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs border-t border-slate-200/80 dark:border-slate-800 pt-16 pb-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
            {/* Brand Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-md flex items-center justify-center shrink-0">
                  <img
                    src={logoUrl}
                    alt={appName}
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).src = '/src/assets/images/japriin_logo_1791445508697.jpg';
                    }}
                    className="w-full h-full object-cover rounded-[14px]"
                  />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-lg font-black text-slate-900 dark:text-white">{appName}</span>
                    <span className="px-1.5 py-0.2 text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-md">PRO</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium block -mt-0.5">{appTagline}</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
                Solusi otomasi chat bisnis profesional nomor satu di Indonesia. <strong>100% bebas watermark</strong>, dilengkapi AI CS cerdas, proteksi jeda alami anti-ban, dan integrasi QRIS instan.
              </p>

              {/* Status Pill */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                  Sistem &amp; Server: 99.9% Uptime Online
                </span>
                <span className="inline-flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-full text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                  Whitelabel 100% Murni
                </span>
              </div>
            </div>

            {/* Column 1: Produk & Fitur */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Produk &amp; Fitur
              </h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#tanpa-watermark" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">100% Bebas Watermark</a></li>
                <li><a href="#paket-gratis" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Paket Gratis Rp 0</a></li>
                <li><a href="#simulator" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Simulator Live Chat</a></li>
                <li><a href="#keunggulan" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Proteksi Anti-Ban Alami</a></li>
                <li><a href="#keunggulan" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">AI Cerdas Customer Service</a></li>
              </ul>
            </div>

            {/* Column 2: Paket & Layanan */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Paket Langganan
              </h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#harga" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Paket Gratis (100 msg/hari)</a></li>
                <li><a href="#harga" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Paket Starter (500 msg/hari)</a></li>
                <li><a href="#harga" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Paket Business (2.500 msg/hari)</a></li>
                <li><a href="#harga" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Paket Unlimited Pro</a></li>
                <li><a href="#faq" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Tanya Jawab (FAQ)</a></li>
              </ul>
            </div>

            {/* Column 3: Akses & Pengembang */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Akses &amp; Dukungan
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button onClick={() => onOpenAuthModal('login')} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left">
                    Login Superadmin
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenAuthModal('register', 'free')} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left">
                    Daftar Akun Baru
                  </button>
                </li>
                <li>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                    {companyName}
                  </span>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${supportPhone.replace(/\D/g, '').replace(/^0/, '62')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    Hubungi CS: {supportPhone}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright Row */}
          <div className="pt-8 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400 text-center sm:text-left">
            <p>
              &copy; {new Date().getFullYear()} <strong className="text-slate-700 dark:text-slate-200">{appName}</strong>
              {companyName ? ` (${companyName})` : ''}. <span className="text-emerald-600 dark:text-emerald-400 font-bold">{footerText}</span>
            </p>
            <p className="text-slate-400 text-[10px]">
              Bukan bagian resmi dari Meta Platforms Inc. WhatsApp adalah merek dagang Meta Platforms.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
