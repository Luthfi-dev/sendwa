import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  QrCode,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Building,
  Smartphone,
  RefreshCw,
  Clock,
  Eye,
  FileText
} from 'lucide-react';
import { SubscriptionPlan, UserAccount, QrisConfig } from '../types/whatsapp';

interface PaymentUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan?: SubscriptionPlan | null;
  plan?: SubscriptionPlan | null;
  currentUser?: UserAccount | null;
  onSuccess: (updatedUser: UserAccount) => void;
  onRequireLogin?: () => void;
}

export const PaymentUpgradeModal: React.FC<PaymentUpgradeModalProps> = ({
  isOpen,
  onClose,
  selectedPlan,
  plan,
  currentUser,
  onSuccess,
  onRequireLogin
}) => {
  const activePlan: SubscriptionPlan = selectedPlan || plan || {
    id: 'pro',
    name: 'Paket Unlimited Pro',
    price: 99000,
    period: '/ bulan',
    max_sessions: 10,
    daily_msg_limit: 10000,
    monthly_msg_limit: 300000,
    features: ['Fitur Lengkap WhatsApp Gateway Pro'],
    is_active: true
  };
  const [qrisConfig, setQrisConfig] = useState<QrisConfig>({
    image_url: 'https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=00020101021126580014ID.LINKAJA.WWW01189360091432263435130208123456785204581253033605802ID5913JAPRIIN OFFICIAL6007BANDUNG61054011562070703A016304E8A2',
    account_name: 'PT Japriin Teknologi Indonesia',
    bank_name: 'QRIS (Semua Bank & E-Wallet) / BCA',
    account_number: '123-456-7890 a.n Japriin',
    instructions: 'Scan QRIS atau transfer BCA lalu upload bukti transfer.'
  });

  const [copiedAcc, setCopiedAcc] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [guestUsername, setGuestUsername] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');

  // AI Verification States
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStep, setVerifyStep] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/qris')
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data) {
            setQrisConfig(res.data);
          }
        })
        .catch(() => {});
      
      setReceiptFile(null);
      setReceiptBase64('');
      setPaymentNote('');
      setVerificationResult(null);
      setErrorMessage('');
      setIsVerifying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Harap unggah file foto struk/screenshot (JPG, PNG, atau WEBP).');
      return;
    }

    setReceiptFile(file);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCopyText = (text: string, type: 'acc' | 'amount') => {
    navigator.clipboard.writeText(text);
    if (type === 'acc') {
      setCopiedAcc(true);
      setTimeout(() => setCopiedAcc(false), 2000);
    } else {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    }
  };

  const handleStartAiVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptBase64 && !paymentNote.trim()) {
      setErrorMessage('Harap upload foto screenshot struk atau isi catatan transfer Anda.');
      return;
    }

    const targetUserId = currentUser?.id;
    if (!targetUserId) {
      if (onRequireLogin) {
        onRequireLogin();
        return;
      }
      setErrorMessage('Silakan login terlebih dahulu sebelum melakukan upgrade.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setVerificationResult(null);

    // Simulated scanner steps for rich interactive UX
    setVerifyStep('1/3 Membaca teks & citra struk transfer...');
    await new Promise(r => setTimeout(r, 600));

    setVerifyStep('2/3 Menganalisis keaslian transaksi & nominal dengan AI...');
    await new Promise(r => setTimeout(r, 800));

    setVerifyStep('3/3 Menyesuaikan status paket & membuka fitur Pro...');

    try {
      const res = await fetch('/api/upgrade-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: targetUserId,
          plan_id: activePlan.id,
          receipt_base64: receiptBase64,
          payment_note: paymentNote
        })
      });

      const data = await res.json();
      if (data.success) {
        setVerificationResult(data);
        if (data.user) {
          onSuccess(data.user);
        }
      } else {
        setErrorMessage(data.error || 'Gagal memproses pembayaran. Silakan periksa kembali struk Anda.');
      }
    } catch (err: any) {
      setErrorMessage('Terjadi kendala jaringan saat menghubungi server AI.');
    } finally {
      setIsVerifying(false);
      setVerifyStep('');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl relative text-slate-900 dark:text-slate-100 flex flex-col my-auto">
        
        {/* MODAL HEADER */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Pembayaran &amp; Aktivasi Paket
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Pilih QRIS atau Transfer Bank · Verifikasi AI Instan
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 space-y-5">
          
          {/* SUCCESS SCREEN */}
          {verificationResult && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/50 rounded-3xl p-6 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg sm:text-xl font-black text-emerald-900 dark:text-emerald-200">
                  Pembayaran Terverifikasi &amp; Paket Aktif!
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-md mx-auto leading-relaxed">
                  {verificationResult.ai_result?.reason || `Akun Anda telah otomatis ditingkatkan ke ${activePlan.name}.`}
                </p>
              </div>

              {verificationResult.ai_result && (
                <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 text-left text-xs space-y-1 font-mono text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Metode:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{verificationResult.ai_result.bankOrWallet}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Ref ID:</span>
                    <strong>{verificationResult.ai_result.transactionRef}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Nominal:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">Rp {verificationResult.ai_result.amountDetected?.toLocaleString('id-ID')}</strong>
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all"
              >
                Mulai Gunakan Fitur Sekarang
              </button>
            </div>
          )}

          {!verificationResult && (
            <>
              {/* PLAN SUMMARY BADGE */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Paket yang Dipilih:
                  </span>
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {activePlan.name}
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-medium">
                    {activePlan.daily_msg_limit.toLocaleString('id-ID')} pesan/hari · {activePlan.max_sessions} nomor WA
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    Rp {activePlan.price.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[11px] text-slate-400 block">{activePlan.period}</span>
                </div>
              </div>

              {/* QRIS & PAYMENT DETAILS */}
              <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                
                {/* QRIS Image & Info */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="bg-white p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                    <img
                      src={qrisConfig.image_url}
                      alt="QRIS Pembayaran"
                      className="w-40 h-40 object-contain rounded-xl"
                    />
                  </div>

                  <div className="space-y-2.5 flex-1 text-xs">
                    <div className="flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                      <Sparkles className="w-4 h-4" />
                      <span>Scan QRIS Semua Bank &amp; E-Wallet</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Penerima Resmi:</div>
                      <div className="font-extrabold text-slate-900 dark:text-white">{qrisConfig.account_name}</div>
                      <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {qrisConfig.account_number}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyText(qrisConfig.account_number.replace(/\D/g, '') || '1234567890', 'acc')}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 border border-slate-200 dark:border-slate-700"
                      >
                        {copiedAcc ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAcc ? 'Tersalin!' : 'Salin Rekening'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyText(activePlan.price.toString(), 'amount')}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 border border-slate-200 dark:border-slate-700"
                      >
                        {copiedAmount ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAmount ? 'Tersalin!' : `Salin Rp ${activePlan.price.toLocaleString('id-ID')}`}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* MANDATORY RECEIPT REMINDER (CRITICAL) */}
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-600/40 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>PERINGATAN PENTING: WAJIB SIMPAN BUKTI STRUK!</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Pastikan Anda <strong>Screenshot / Download bukti transfer Anda</strong> setelah berhasil bayar, lalu upload foto struk tersebut di bawah ini agar AI dapat memvalidasi dan langsung membuka fitur Pro Anda!
                  </p>
                </div>
              </div>

              {/* UPLOAD STRUK & AI VALIDATION FORM */}
              <form onSubmit={handleStartAiVerification} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
                    Upload Foto / Screenshot Bukti Transfer Struk:
                  </label>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                      receiptBase64
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50 dark:bg-slate-950'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {receiptBase64 ? (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <img
                          src={receiptBase64}
                          alt="Preview Struk"
                          className="w-16 h-20 object-cover rounded-xl border border-emerald-300 shadow-sm"
                        />
                        <div className="text-left space-y-1">
                          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Foto Struk Berhasil Dipilih</span>
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-xs font-mono">
                            {receiptFile?.name} ({(receiptFile?.size || 0) > 1024 ? `${Math.round((receiptFile?.size || 0) / 1024)} KB` : ''})
                          </span>
                          <span className="text-[10px] text-slate-400 hover:underline block cursor-pointer">
                            Klik untuk ganti foto struk
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Upload className="w-7 h-7 text-slate-400 mx-auto" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          Klik untuk memilih foto screenshot struk
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Format JPG, PNG, WEBP (Maks 10MB)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Catatan / Nomor Rekening Pengirim (Opsional):
                  </label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Contoh: Transfer BCA a.n Budi / GoPay 0812xxx"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* SUBMIT BUTTON WITH AI SCANNER */}
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2 min-h-[48px] disabled:opacity-60"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{verifyStep || 'Sedang memvalidasi dengan AI...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Validasi Struk &amp; Buka Fitur Pro (AI Instan)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
