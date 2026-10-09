import React, { useState } from 'react';
import { Send, Smartphone, Bot, CheckCircle2, RefreshCw, Terminal, Sparkles, User } from 'lucide-react';
import { WhatsAppMessageLog } from '../types/whatsapp';

interface WebhookSimulatorProps {
  onMessageSent: () => void;
}

interface ChatBubble {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  status?: string;
  error?: string;
}

export const WebhookSimulator: React.FC<WebhookSimulatorProps> = ({ onMessageSent }) => {
  const [senderPhone, setSenderPhone] = useState('6281234567890');
  const [senderName, setSenderName] = useState('Budi Pratama');
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chats, setChats] = useState<ChatBubble[]>([
    {
      id: 'init_1',
      sender: 'user',
      text: 'Halo admin, mau tanya info layanan',
      time: '10:00 AM'
    },
    {
      id: 'init_2',
      sender: 'bot',
      text: '👋 Halo *Budi Pratama*! Selamat datang di Layanan Otomatis WhatsApp.\n\nBerikut menu layanan kami:\n1️⃣ *Info Layanan*\n2️⃣ *Jam Operasional*\n3️⃣ *Bantuan Customer Service*\n\nKetik *1*, *2*, atau *3* untuk informasi lebih lanjut!',
      time: '10:00 AM',
      status: 'Sukses'
    }
  ]);
  const [rawPayloadJson, setRawPayloadJson] = useState<string>('// Kirim pesan untuk melihat payload JSON Meta Webhook');

  const handleQuickSend = (text: string) => {
    setInputMessage(text);
    triggerSend(text);
  };

  const triggerSend = async (messageTextToUse?: string) => {
    const textToSend = messageTextToUse || inputMessage;
    if (!textToSend.trim() || isSending) return;

    setIsSending(true);
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Add user bubble
    const userBubble: ChatBubble = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      time: nowTime
    };

    setChats(prev => [...prev, userBubble]);
    setInputMessage('');

    // Generate Meta Webhook JSON preview
    const metaPayloadMock = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: senderPhone,
                  phone_number_id: '102938475610'
                },
                contacts: [
                  {
                    profile: { name: senderName },
                    wa_id: senderPhone
                  }
                ],
                messages: [
                  {
                    from: senderPhone,
                    id: `wamid_${Date.now()}`,
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    text: { body: textToSend },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };
    setRawPayloadJson(JSON.stringify(metaPayloadMock, null, 2));

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_phone: senderPhone,
          sender_name: senderName,
          message_body: textToSend
        })
      });

      const data = await res.json() as { success: boolean; data?: WhatsAppMessageLog; error?: string };

      if (data.success && data.data) {
        const botBubble: ChatBubble = {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: data.data.reply_body || 'Pesan diterima.',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          status: data.data.status,
          error: data.data.error_detail
        };
        setChats(prev => [...prev, botBubble]);
        onMessageSent();
      } else {
        const errBubble: ChatBubble = {
          id: `err_${Date.now()}`,
          sender: 'bot',
          text: '⚠️ Terjadi kesalahan saat memproses balasan webhook.',
          time: nowTime,
          status: 'Gagal',
          error: data.error
        };
        setChats(prev => [...prev, errBubble]);
      }
    } catch (err: any) {
      setChats(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'bot',
          text: '⚠️ Gagal terhubung ke server backend local.',
          time: nowTime,
          status: 'Gagal'
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div id="simulator-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 transition-colors duration-200">
      {/* LEFT: PHONE MOCKUP UI */}
      <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Simulator WhatsApp Live Sandbox</h3>
          </div>
          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
            Real-Time Tester
          </span>
        </div>

        {/* Sender Info Controls */}
        <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <label className="text-slate-500 dark:text-slate-400 text-[10px] block font-bold mb-1">Nama Pengirim:</label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>
          <div>
            <label className="text-slate-500 dark:text-slate-400 text-[10px] block font-bold mb-1">Nomor WhatsApp:</label>
            <input
              type="text"
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        {/* Chat Phone Body */}
        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 h-[360px] overflow-y-auto flex flex-col space-y-3 border border-slate-200 dark:border-slate-800 shadow-inner scrollbar-thin">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`flex flex-col max-w-[85%] ${
                chat.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
              }`}
            >
              <div
                className={`p-3 rounded-2xl text-xs font-sans whitespace-pre-wrap break-words leading-relaxed shadow-xs ${
                  chat.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-800'
                }`}
              >
                {chat.sender === 'bot' && (
                  <div className="flex items-center space-x-1 mb-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Bot className="w-3 h-3" />
                    <span>Auto-Bot WA</span>
                  </div>
                )}
                {chat.text}
              </div>

              <div className="flex items-center space-x-1.5 mt-1 text-[10px] text-slate-400">
                <span>{chat.time}</span>
                {chat.status === 'Sukses' && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="self-start bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-center space-x-2 animate-pulse">
              <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <span>Memproses auto-reply Webhook...</span>
            </div>
          )}
        </div>

        {/* Quick Trigger Preset Buttons */}
        <div className="mt-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Klik cepat untuk uji coba kata kunci:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {['Halo', 'Hi', '1', '2', '3', 'Customer Service'].map((kw) => (
              <button
                key={kw}
                onClick={() => handleQuickSend(kw)}
                disabled={isSending}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              >
                "{kw}"
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Box */}
        <div className="mt-3 flex items-center space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && triggerSend()}
            placeholder="Ketik pesan simulasi di sini..."
            className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => triggerSend()}
            disabled={isSending || !inputMessage.trim()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 disabled:opacity-50 shrink-0 shadow-xs min-h-[40px]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim</span>
          </button>
        </div>
      </div>

      {/* RIGHT: RAW WEBHOOK PAYLOAD INSPECTOR */}
      <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
            <div className="flex items-center space-x-2">
              <Terminal className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Meta Webhook Event Inspector</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
              POST /api/whatsapp
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Di bawah ini adalah struktur JSON Payload resmi Meta Graph API v20.0 yang dikirim saat pengguna WhatsApp mengirim pesan ke bisnis Anda:
          </p>

          <div className="bg-slate-950 text-emerald-400 p-3.5 rounded-xl border border-slate-800 h-[400px] overflow-auto font-mono text-xs leading-relaxed shadow-inner">
            <pre className="break-words whitespace-pre-wrap">{rawPayloadJson}</pre>
          </div>
        </div>

        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
          💡 <strong>Tips Terintegrasi:</strong> Webhook ini sudah secara otomatis terhubung dengan logika auto-reply dan mencatat hasilnya di database (Offline JSON / Online SQL).
        </div>
      </div>
    </div>
  );
};
