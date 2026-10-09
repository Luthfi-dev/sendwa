import makeWASocketImport, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { updateSession, addSession, deleteSession, getSessionById, getWhatsAppSessions, addMessageLog, addBroadcastHistory, getRules, getAutoReplyRules, getAntiBanSettings, getSystemConfig, getUserById, deductUserAiQuota, deductUserDailyQuota, getSubscriptionPlans, initDbFile, extractUserIdFromSessionId } from './db.js';
import { generateGeminiAutoReply } from './geminiService.js';
import { decryptData } from './security.js';

// Consistent Browser & Version across ALL Baileys sockets (prevents "Periksa nomor dengan benar" on pairing restart)
export const BAILEYS_BROWSER: [string, string, string] = ['Ubuntu', 'Chrome', '22.04.4'];
export const DEFAULT_BAILEYS_VERSION: [number, number, number] = [2, 3000, 1043857760];

// Normalize phone number to international WhatsApp format (e.g. 0812..., 812..., +62812... -> 62812...)
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('00')) {
    clean = clean.slice(2);
  }
  if (clean.startsWith('620')) {
    clean = '62' + clean.slice(3);
  } else if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (clean.startsWith('8')) {
    clean = '62' + clean;
  }
  return clean;
}

// Handle ESM/CJS default export compatibility for Baileys
const makeWASocket = (makeWASocketImport as any).default || makeWASocketImport;

interface SessionState {
  sessionId: string;
  userId?: string;
  socket: any;
  qrCodeUrl: string | null;
  pairingCode: string | null;
  status: 'connecting' | 'connected' | 'disconnected';
  phoneNumber: string | null;
  lastUpdated: number;
  is_primary?: boolean;
}

const activeSessions = new Map<string, SessionState>();
const AUTH_DIR = path.join(process.cwd(), 'baileys_auth_sessions');

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Clean session auth directory safely
export function cleanSessionFolder(folderName: string) {
  if (!folderName) return;
  const targetFolder = path.join(AUTH_DIR, folderName);
  try {
    if (fs.existsSync(targetFolder)) {
      fs.rmSync(targetFolder, { recursive: true, force: true });
      console.log(`[Baileys] Auth folder deleted: ${targetFolder}`);
    }
  } catch (err) {
    console.error(`[Baileys] Error cleaning session folder ${folderName}:`, err);
  }
}

// Helper to attach Auto-Reply, Anti-Ban, Centang Biru, and Quota Deductions to Baileys socket
const commandState = new Map<string, { step: string; data?: any }>();
const processedMessageIds = new Set<string>();

function rememberProcessedMsgId(id?: string | null) {
  if (!id) return;
  processedMessageIds.add(id);
  if (processedMessageIds.size > 500) {
    const first = processedMessageIds.values().next().value;
    if (first) processedMessageIds.delete(first);
  }
}

// Parse /send and /broadcast arguments in flexible single or multi-recipient formats:
// 1) /send 08123456789 Halo kak
// 2) /broadcast 08123456789, 08198765432, 08571234567 Halo kak promo spesial!
// 3) Multiline phone list followed by shared message
// 4) Multiline where each line has <nomor> <pesan>
export function parseSendOrBroadcastTasks(rawArgs: string): Array<{ targetPhone: string; messageToSend: string }> {
  const cleanedInput = rawArgs.replace(/^\/(?:send|broadcast|kirim|kirimpesan)\b\s*/i, '').trim();
  if (!cleanedInput) return [];

  // Check if input has multiple lines where EACH line is a distinct "<phone> <message>" task
  const nonEmptyLines = cleanedInput
    .split(/\r?\n/)
    .map(l => l.replace(/^\/(?:send|broadcast|kirim|kirimpesan)\b\s*/i, '').trim())
    .filter(Boolean);

  if (nonEmptyLines.length > 1) {
    const perLineTasks: Array<{ targetPhone: string; messageToSend: string }> = [];
    let allLinesHaveOwnMsg = true;

    for (const line of nonEmptyLines) {
      const m = line.match(/^(\+?[0-9][0-9\-()]{7,15})\s*[:|\-]?\s+(.+)$/);
      if (m) {
        const digits = m[1].replace(/\D/g, '');
        const msg = m[2].trim();
        // Make sure the message part is not just another bare phone number
        const msgDigitsOnly = msg.replace(/[\s,;+\-()]/g, '');
        const looksLikePhoneList = /^[0-9]+$/.test(msgDigitsOnly) && msgDigitsOnly.length >= 8;
        if (digits.length >= 8 && digits.length <= 16 && msg && !looksLikePhoneList) {
          perLineTasks.push({ targetPhone: digits, messageToSend: msg });
        } else {
          allLinesHaveOwnMsg = false;
          break;
        }
      } else {
        allLinesHaveOwnMsg = false;
        break;
      }
    }

    if (allLinesHaveOwnMsg && perLineTasks.length > 1) {
      return perLineTasks;
    }
  }

  // 1. Key-value format: to=0812xxx,0819xxx text=Halo or to=0812xxx msg=Halo
  const kvMatch = cleanedInput.match(/^to=([^\s&]+)[,\s&]+(?:text|msg|pesan)=([\s\S]+)$/i);
  if (kvMatch) {
    const phones = kvMatch[1]
      .split(/[,;]+/)
      .map(p => p.replace(/\D/g, ''))
      .filter(p => p.length >= 8 && p.length <= 16);
    const msg = kvMatch[2].trim();
    if (phones.length > 0 && msg) {
      return Array.from(new Set(phones)).map(targetPhone => ({ targetPhone, messageToSend: msg }));
    }
  }

  // 2. Pipe format: 0812xxx, 0819xxx | Halo kak
  if (cleanedInput.includes('|')) {
    const pipeIdx = cleanedInput.indexOf('|');
    const phoneSection = cleanedInput.substring(0, pipeIdx);
    const msgPart = cleanedInput.substring(pipeIdx + 1).trim();
    const phones = phoneSection
      .split(/[\s,;]+/)
      .map(p => p.replace(/\D/g, ''))
      .filter(p => p.length >= 8 && p.length <= 16);
    if (phones.length > 0 && msgPart) {
      return Array.from(new Set(phones)).map(targetPhone => ({ targetPhone, messageToSend: msgPart }));
    }
  }

  // 3. Scan 1 or many leading phone numbers (separated by comma, semicolon, space, or newline) followed by shared message
  const phones: string[] = [];
  let pos = 0;
  while (pos < cleanedInput.length) {
    const wsMatch = cleanedInput.slice(pos).match(/^[\s,;]+/);
    if (wsMatch) pos += wsMatch[0].length;
    const tokMatch = cleanedInput.slice(pos).match(/^([^\s]+)/);
    if (!tokMatch) break;
    const token = tokMatch[1];
    const subParts = token.split(/[,;]+/).filter(Boolean);
    const isAllPhones =
      subParts.length > 0 &&
      subParts.every(sp => {
        const digits = sp.replace(/\D/g, '');
        return /^[\d+\-()]+$/.test(sp) && digits.length >= 8 && digits.length <= 16;
      });
    if (isAllPhones) {
      subParts.forEach(sp => phones.push(sp.replace(/\D/g, '')));
      pos += token.length;
    } else {
      break;
    }
  }

  if (phones.length > 0) {
    const msgPart = cleanedInput.slice(pos).replace(/^[\s:,\-|]+/, '').trim();
    if (msgPart) {
      return Array.from(new Set(phones)).map(targetPhone => ({ targetPhone, messageToSend: msgPart }));
    }
  }

  // 4. Phone number with spaces/dashes e.g. +62 812-3456-7890 Halo kak
  const flexMatch = cleanedInput.match(/^(\+?[0-9][0-9\-\s]{7,17}?)\s+([\s\S]+)$/);
  if (flexMatch) {
    const digits = flexMatch[1].replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 16 && flexMatch[2].trim()) {
      return [{ targetPhone: digits, messageToSend: flexMatch[2].trim() }];
    }
  }

  return [];
}

function parseSendCommandArgs(rawArgs: string): { targetPhone: string; messageToSend: string } {
  const tasks = parseSendOrBroadcastTasks(rawArgs);
  if (tasks.length > 0) {
    return tasks[0];
  }
  return { targetPhone: '', messageToSend: '' };
}

// Anti-Echo Loop Breaker: tracks texts sent recently by the bot to prevent self-reflection infinite loops
const recentBotOutgoingTexts = new Map<string, number>();

function recordBotOutgoing(text: string) {
  if (!text) return;
  const key = text.trim();
  recentBotOutgoingTexts.set(key, Date.now());
  if (recentBotOutgoingTexts.size > 300) {
    const now = Date.now();
    for (const [k, time] of recentBotOutgoingTexts.entries()) {
      if (now - time > 45000) recentBotOutgoingTexts.delete(k);
    }
  }
}

function isRecentBotOutgoing(text: string): boolean {
  if (!text) return false;
  const key = text.trim();
  const time = recentBotOutgoingTexts.get(key);
  if (time && (Date.now() - time < 45000)) {
    return true;
  }
  return false;
}

function attachSocketMessageListener(sock: any, sessionId: string, sessionData: SessionState) {
  sock.ev.on('messages.upsert', async (m: any) => {
    try {
      if (m.type !== 'notify' && m.type !== 'append') return;
      for (const msg of m.messages) {
        if (!msg.message) continue;

        const msgId = msg.key?.id;
        if (msgId && processedMessageIds.has(msgId)) continue;

        // Ignore old history sync on 'append' events (only allow fresh messages <= 45s old)
        if (m.type === 'append') {
          const rawTs = typeof msg.messageTimestamp === 'number'
            ? msg.messageTimestamp
            : Number(msg.messageTimestamp?.low || msg.messageTimestamp || 0);
          if (rawTs > 0 && Math.floor(Date.now() / 1000) - rawTs > 45) {
            continue;
          }
        }

        const remoteJid = msg.key.remoteJid || msg.message?.deviceSentMessage?.destinationJid;
        if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue; // 1-on-1 chats only

        // Unwrap nested WhatsApp Multi-Device containers (deviceSentMessage for self-chat, ephemeralMessage, viewOnce)
        const innerMsg =
          msg.message?.deviceSentMessage?.message ||
          msg.message?.ephemeralMessage?.message ||
          msg.message?.viewOnceMessage?.message ||
          msg.message?.viewOnceMessageV2?.message ||
          msg.message?.documentWithCaptionMessage?.message ||
          msg.message;

        const messageText = (
          innerMsg?.conversation ||
          innerMsg?.extendedTextMessage?.text ||
          innerMsg?.imageMessage?.caption ||
          innerMsg?.videoMessage?.caption ||
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          ''
        ).trim();

        if (!messageText) continue;

        // Anti-Echo loop breaker: ignore messages that match recent bot outgoing messages
        if (isRecentBotOutgoing(messageText)) {
          console.log(`[Baileys Anti-Echo] Discarding reflected message from bot's own output to prevent loop: "${messageText.substring(0, 30)}..."`);
          continue;
        }

        const senderPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '').split(':')[0];
        const senderName = msg.pushName || 'Pengguna WhatsApp';
        const trimmedMsg = messageText.trim();
        const stateKey = `${sessionId}:${remoteJid}`;
        const hasActiveDialog = commandState.has(stateKey) || commandState.has(senderPhone) || commandState.has(remoteJid);
        const isSlashCommand = trimmedMsg.startsWith('/');

        // When msg.key.fromMe is true (sent from the connected phone itself / self-chat):
        // ONLY allow if it is an explicit '/' command (like /send, /status, /help, /batal) OR an active /send step-2 reply.
        // Ignore all normal outgoing messages so personal notes & chats to customers never trigger auto-reply or loop!
        if (msg.key.fromMe && !isSlashCommand && !hasActiveDialog) {
          continue;
        }

        rememberProcessedMsgId(msgId);
        console.log(`[Baileys Incoming] Session=${sessionId} From=${senderPhone} (${senderName}) fromMe=${Boolean(msg.key.fromMe)}: "${messageText}"`);

        // 1. TANDAI CENTANG BIRU (Read Receipt) SEBELUM MEMBALAS
        if (!msg.key.fromMe) {
          try {
            await sock.readMessages([msg.key]);
          } catch (readErr) {
            console.warn('[Baileys Read Receipt error]', readErr);
          }
        }

        const db = initDbFile();
        const cleanSender = senderPhone.replace(/\D/g, '');
        const cleanConnected = sessionData.phoneNumber ? sessionData.phoneNumber.replace(/\D/g, '') : '';
        const sockPhone = sock.user?.id ? sock.user.id.split('@')[0].split(':')[0].replace(/\D/g, '') : '';
        const sockLid = sock.user?.lid ? sock.user.lid.split('@')[0].split(':')[0].replace(/\D/g, '') : '';

        // Detect if sender is the bot's own connected number (self-chat / "Message Yourself")
        const isSelf = Boolean(
          msg.key.fromMe ||
          (cleanConnected && (cleanSender === cleanConnected || cleanSender.endsWith(cleanConnected) || cleanConnected.endsWith(cleanSender))) ||
          (sockPhone && (cleanSender === sockPhone || cleanSender.endsWith(sockPhone) || sockPhone.endsWith(cleanSender))) ||
          (sockLid && cleanSender === sockLid)
        );

        // Find user by registered phone, connected session phone, or session owner
        const matchedSessionBySender = db.sessions.find(s => {
          if (!s.phone_number) return false;
          const sp = s.phone_number.replace(/\D/g, '');
          return sp === cleanSender || (sp.length >= 8 && cleanSender.endsWith(sp.slice(-8))) || (cleanSender.length >= 8 && sp.endsWith(cleanSender.slice(-8)));
        });

        const user = db.users.find(u => {
          if (!u.phone) return false;
          const p = u.phone.replace(/\D/g, '');
          return p === cleanSender || (p.length >= 8 && cleanSender.endsWith(p.slice(-8))) || (cleanSender.length >= 8 && p.endsWith(cleanSender.slice(-8)));
        }) || (matchedSessionBySender?.user_id ? getUserById(matchedSessionBySender.user_id) : null)
           || (sessionData.userId ? getUserById(sessionData.userId) : null);

        const isOwner = Boolean(
          user && user.phone &&
          (user.phone.replace(/\D/g, '') === cleanSender || (cleanSender.length >= 8 && cleanSender.endsWith(user.phone.replace(/\D/g, '').slice(-8))))
        );
        const isAllowed = Boolean(
          user?.allowed_numbers &&
          user.allowed_numbers.some(n => n.replace(/\D/g, '') === cleanSender || cleanSender.endsWith(n.replace(/\D/g, '').slice(-8)))
        );

        // =========================================================================
        // REMOTE COMMAND BRIDGE & SELF-CHAT LOOP PREVENTION GUARD
        // Standardized to handle /send on BOTH System Number (including @lid) & Self-Chat
        // =========================================================================
        if (isSlashCommand || hasActiveDialog || isSelf || isOwner || isAllowed) {
          // Helper to clear dialog state across all possible keys for this sender
          const clearSenderDialogState = () => {
            commandState.delete(stateKey);
            commandState.delete(senderPhone);
            commandState.delete(remoteJid);
          };

          // Helper to select best active socket for sending outbound message
          const resolveOutboundSocket = () => {
            if (user) {
              const userSessions = Array.from(activeSessions.values()).filter(
                s => s.userId === user.id && s.status === 'connected' && s.socket
              );
              const primaryUserSession = userSessions.find(s => s.is_primary) || userSessions[0];
              if (primaryUserSession?.socket) return primaryUserSession.socket;
            }
            return sock;
          };

          // Helper to execute 1 or many send/broadcast tasks via WhatsApp command
          const executeSendOrBroadcastTasks = async (tasks: Array<{ targetPhone: string; messageToSend: string }>) => {
            const sockToUse = resolveOutboundSocket();

            if (tasks.length === 1) {
              const { targetPhone, messageToSend } = tasks[0];
              if (user) {
                const quota = deductUserDailyQuota(user.id);
                if (!quota.allowed) {
                  const quotaMsg = `❌ *Gagal Kirim:* ${quota.message || 'Batas kuota harian Anda telah habis.'}`;
                  recordBotOutgoing(quotaMsg);
                  await sock.sendMessage(remoteJid, { text: quotaMsg });
                  return;
                }
              }

              const cleanTarget = normalizePhoneNumber(targetPhone);
              const targetJid = `${cleanTarget}@s.whatsapp.net`;
              try {
                recordBotOutgoing(messageToSend);
                await sockToUse.sendMessage(targetJid, { text: messageToSend });

                addMessageLog({
                  wam_id: `cmd_out_${Date.now()}`,
                  session_id: sessionId,
                  user_id: user?.id || sessionData.userId,
                  sender_phone: cleanTarget,
                  sender_name: `Tujuan (${cleanTarget})`,
                  message_body: messageToSend,
                  direction: 'outgoing',
                  status: 'Sukses',
                  reply_body: 'Dikirim via Remote WhatsApp Command (/send)'
                });

                const successReply =
                  `✅ *Pesan Berhasil Terkirim!*\n\n` +
                  `• Nomor Tujuan: *${cleanTarget}*\n` +
                  `• Isi Pesan: "${messageToSend}"\n` +
                  `• Via Gateway: *${sessionData.phoneNumber || sockPhone || 'Japriin'}*`;
                recordBotOutgoing(successReply);
                await sock.sendMessage(remoteJid, { text: successReply });
              } catch (sendErr: any) {
                const errMsg = `❌ *Gagal mengirim pesan ke ${cleanTarget}:* ${sendErr?.message || 'Error koneksi gateway'}`;
                recordBotOutgoing(errMsg);
                await sock.sendMessage(remoteJid, { text: errMsg });
              }
              return;
            }

            // Multi-recipient broadcast execution (many messages)
            const startNotice =
              `⏳ *Memproses Broadcast ke ${tasks.length} Nomor...*\n` +
              `Mohon tunggu, pesan sedang dikirim bertahap dengan proteksi Anti-Ban Guard.`;
            recordBotOutgoing(startNotice);
            await sock.sendMessage(remoteJid, { text: startNotice });

            let successCount = 0;
            let failedCount = 0;
            const successPhones: string[] = [];

            for (let i = 0; i < tasks.length; i++) {
              const { targetPhone, messageToSend } = tasks[i];
              const cleanTarget = normalizePhoneNumber(targetPhone);
              if (!cleanTarget || cleanTarget.length < 8) {
                failedCount++;
                continue;
              }

              if (user) {
                const quota = deductUserDailyQuota(user.id);
                if (!quota.allowed) {
                  failedCount++;
                  continue;
                }
              }

              const targetJid = `${cleanTarget}@s.whatsapp.net`;
              try {
                recordBotOutgoing(messageToSend);
                await Promise.race([
                  sockToUse.sendMessage(targetJid, { text: messageToSend }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout pengiriman WA')), 15000))
                ]);

                successCount++;
                successPhones.push(cleanTarget);
                addMessageLog({
                  wam_id: `bc_cmd_${Date.now()}_${i}`,
                  session_id: sessionId,
                  user_id: user?.id || sessionData.userId,
                  sender_phone: cleanTarget,
                  sender_name: `Broadcast (${cleanTarget})`,
                  message_body: messageToSend,
                  direction: 'outgoing',
                  status: 'Sukses',
                  reply_body: 'Dikirim via Broadcast WhatsApp (/broadcast)'
                });
              } catch (err: any) {
                failedCount++;
                addMessageLog({
                  wam_id: `bc_fail_${Date.now()}_${i}`,
                  session_id: sessionId,
                  user_id: user?.id || sessionData.userId,
                  sender_phone: cleanTarget,
                  sender_name: `Broadcast (${cleanTarget})`,
                  message_body: messageToSend,
                  direction: 'outgoing',
                  status: 'Gagal',
                  error_detail: err?.message || 'Gagal kirim broadcast'
                });
              }

              if (i < tasks.length - 1) {
                await delay(1000 + Math.floor(Math.random() * 800));
              }
            }

            addBroadcastHistory({
              user_id: user?.id || sessionData.userId,
              session_id: sessionId,
              recipients_count: tasks.length,
              message: tasks[0]?.messageToSend || 'Broadcast Multi-Pesan',
              status: failedCount === tasks.length ? 'failed' : 'completed',
              success_count: successCount,
              failed_count: failedCount
            });

            const summaryReply =
              `✅ *Broadcast Selesai Diproses!*\n\n` +
              `• Total Tujuan: *${tasks.length} Nomor*\n` +
              `• Berhasil Terkirim: *${successCount} Nomor*\n` +
              `• Gagal: *${failedCount} Nomor*\n` +
              (successPhones.length > 0
                ? `• Penerima: *${successPhones.slice(0, 6).join(', ')}${successPhones.length > 6 ? ` (+${successPhones.length - 6} lainnya)` : ''}*\n`
                : '') +
              `• Via Gateway: *${sessionData.phoneNumber || sockPhone || 'Japriin'}*\n` +
              `• Log Retensi: *Otomatis dihapus setelah 7 hari*`;
            recordBotOutgoing(summaryReply);
            await sock.sendMessage(remoteJid, { text: summaryReply });
          };

          // If the message is a command starting with '/'
          if (isSlashCommand) {
            const parts = trimmedMsg.split(/\s+/);
            const cmd = parts[0].toLowerCase();

            // Command: /batal or /cancel
            if (cmd === '/batal' || cmd === '/cancel') {
              clearSenderDialogState();
              const cancelReply = `✓ *Perintah interaktif telah dibatalkan.*`;
              recordBotOutgoing(cancelReply);
              await sock.sendMessage(remoteJid, { text: cancelReply });
              continue;
            }

            // Command: /status or /saldo or /kuota or /cekkuota or /statusbot
            if (cmd === '/status' || cmd === '/saldo' || cmd === '/kuota' || cmd === '/cekkuota' || cmd === '/statusbot') {
              const u = user || (sessionData.userId ? getUserById(sessionData.userId) : null);
              const plan = db.plans.find(p => p.id === u?.plan_id) || db.plans[0];
              const usedToday = u?.daily_messages_sent || 0;
              const remainingToday = Math.max(0, (plan?.daily_msg_limit || 100) - usedToday);
              const statusReply =
                `📊 *Status Japriin Gateway*\n\n` +
                `• Akun: *${u?.name || 'Operator'}* (@${u?.username || 'user'})\n` +
                `• Paket: *${plan?.name || 'Pro'}*\n` +
                `• Nomor Gateway: *${sessionData.phoneNumber || sockPhone || 'Terhubung'}*\n` +
                `• Sisa Kuota Hari Ini: *${remainingToday} / ${plan?.daily_msg_limit || 100} pesan*\n` +
                `• Status Gateway: *TERHUBUNG (Anti-Ban Guard Aktif)*\n\n` +
                `_Ketik */send* untuk mengirim pesan ke nomor tujuan._`;
              recordBotOutgoing(statusReply);
              await sock.sendMessage(remoteJid, { text: statusReply });
              continue;
            }

            // Command: /help or /bantuan or /menu
            if (cmd === '/help' || cmd === '/bantuan' || cmd === '/menu') {
              const helpReply =
                `🤖 *Panduan Japriin Remote Command Bridge*\n\n` +
                `Anda dapat mengirim pesan dari Nomor Sistem maupun Nomor Sendiri dengan perintah berikut:\n\n` +
                `1️⃣ */send*\n` +
                `   Membuka template interaktif kirim pesan.\n\n` +
                `2️⃣ */send <nomor_tujuan> <isi_pesan>*\n` +
                `   Kirim pesan langsung dalam 1 langkah.\n` +
                `   _Contoh: /send 08123456789 Halo kak, pesanan sudah dikirim._\n\n` +
                `3️⃣ */status* atau */kuota*\n` +
                `   Cek sisa kuota harian & status koneksi bot.\n\n` +
                `4️⃣ */batal*\n` +
                `   Batalkan dialog kirim pesan yang sedang aktif.\n\n` +
                `💡 _Standar Anti-Loop: Chat biasa tanpa awalan / ke nomor sendiri otomatis diabaikan agar tidak memicu balasan berulang (looping)._`;
              recordBotOutgoing(helpReply);
              await sock.sendMessage(remoteJid, { text: helpReply });
              continue;
            }

            // Command: /send or /broadcast or /kirim or /kirimpesan
            if (cmd === '/send' || cmd === '/broadcast' || cmd === '/kirim' || cmd === '/kirimpesan') {
              const fullArgs = trimmedMsg.substring(cmd.length).trim();
              const tasks = parseSendOrBroadcastTasks(fullArgs);

              // Direct execution if 1 or more valid phone+message tasks are present
              if (tasks.length > 0) {
                clearSenderDialogState();
                await executeSendOrBroadcastTasks(tasks);
                continue;
              }

              // Prompt template if /send or /broadcast was typed alone (or without full args)
              commandState.set(stateKey, { step: 'awaiting_direct_target' });
              commandState.set(senderPhone, { step: 'awaiting_direct_target' });
              const promptMsg =
                `📱 *Template Kirim Pesan & Broadcast (Japriin Bridge)*\n\n` +
                `Silakan balas pesan ini dengan salah satu format berikut:\n\n` +
                `1️⃣ *Kirim ke 1 Nomor:*\n` +
                `*08123456789 Halo kak, pesanan Anda sudah siap dikirim.*\n\n` +
                `2️⃣ *Broadcast ke Banyak Nomor (1 Pesan Sama):*\n` +
                `*08123456789, 08198765432, 08571234567 Halo kak, promo spesial hari ini!*\n` +
                `_(Nomor juga bisa disusun per baris baru lalu diikuti isi pesan di bawahnya)_\n\n` +
                `3️⃣ *Broadcast Banyak Pesan Berbeda (Per Baris):*\n` +
                `*08123456789 Halo kak Budi, pesanan siap*\n` +
                `*08198765432 Halo kak Ani, pesanan dikirim*\n\n` +
                `_Ketik */batal* untuk membatalkan pengiriman._`;
              recordBotOutgoing(promptMsg);
              await sock.sendMessage(remoteJid, { text: promptMsg });
              continue;
            }

            // Unknown '/' command: give helpful menu instead of falling through to offline auto-reply
            const unknownCmdReply =
              `ℹ️ Perintah *${cmd}* tidak dikenali.\n\n` +
              `Gunakan perintah standar berikut:\n` +
              `• */send* — Template kirim pesan / broadcast\n` +
              `• */send <nomor> <pesan>* — Kirim pesan langsung\n` +
              `• */broadcast <nomor1>,<nomor2> <pesan>* — Broadcast banyak nomor\n` +
              `• */status* — Cek kuota & status gateway\n` +
              `• */help* — Panduan lengkap`;
            recordBotOutgoing(unknownCmdReply);
            await sock.sendMessage(remoteJid, { text: unknownCmdReply });
            continue;
          }

          // Check if waiting for target and message in active dialog (/send or /broadcast step 2)
          const activeState = commandState.get(stateKey) || commandState.get(senderPhone) || commandState.get(remoteJid);
          if (activeState && activeState.step === 'awaiting_direct_target') {
            const tasks = parseSendOrBroadcastTasks(trimmedMsg);

            if (tasks.length > 0) {
              clearSenderDialogState();
              await executeSendOrBroadcastTasks(tasks);
              continue;
            } else {
              const helpFormat =
                `⚠️ *Format Pengiriman Belum Sesuai*\n\n` +
                `Silakan kirim dengan format:\n` +
                `👉 *<nomor_tujuan> <isi_pesan>*\n` +
                `👉 *<nomor1>, <nomor2>, <nomor3> <isi_pesan>*\n\n` +
                `Contoh:\n` +
                `*08123456789 Halo Kak, pesanan sudah dikirim*\n\n` +
                `_Atau ketik */batal* untuk keluar dari mode kirim pesan._`;
              recordBotOutgoing(helpFormat);
              await sock.sendMessage(remoteJid, { text: helpFormat });
              continue;
            }
          }

          // =========================================================================
          // CRITICAL STANDAR INDUSTRI:
          // Pesan dari nomor sendiri/owner yang BUKAN berawalan '/' dan BUKAN dalam dialog:
          // ABAIKAN SECARA DIAM (SILENT / NO-OP) agar tidak memicu Auto-Reply / Gemini AI / Pesan Offline.
          // Ini 100% mencegah looping forever pada chat nomor sendiri!
          // =========================================================================
          console.log(`[Baileys Self-Chat Ignored] Pesan dari nomor sendiri/owner (${senderPhone}) bukan perintah '/'. Dilewati (tanpa auto-reply).`);
          continue;
        }


        // 2. Get session owner information for multi-user isolation & quota checking
        let dbSession = getSessionById(sessionId);
        if (!dbSession && sessionData.phoneNumber) {
          const cleanConnected = sessionData.phoneNumber.replace(/\D/g, '');
          dbSession = db.sessions.find(s => s.phone_number && s.phone_number.replace(/\D/g, '') === cleanConnected) || null;
        }

        let sessionUserId = dbSession?.user_id || sessionData.userId;
        if (!sessionUserId && sessionData.phoneNumber) {
          const cleanPhone = sessionData.phoneNumber.replace(/\D/g, '');
          const matchedUser = db.users.find(u => u.phone && u.phone.replace(/\D/g, '') === cleanPhone);
          if (matchedUser) sessionUserId = matchedUser.id;
        }
        if (!sessionUserId && sessionId.startsWith('session_user_')) {
          sessionUserId = sessionId.replace('session_user_', '').split('_')[0];
        }
        if (!sessionUserId) {
          const regularUsers = db.users.filter(u => u.role === 'user');
          if (regularUsers.length === 1) sessionUserId = regularUsers[0].id;
        }

        if (dbSession && sessionUserId && !dbSession.user_id) {
          dbSession.user_id = sessionUserId;
          updateSession(dbSession.id, { user_id: sessionUserId });
        }

        const sessionUser = sessionUserId ? getUserById(sessionUserId) : null;

        // Check active rules isolated per user and anti-ban configuration
        const rules = getAutoReplyRules(sessionUserId).filter(r => r.is_active);
        const antiBan = getAntiBanSettings();

        // Match keyword rule
        let matchedRule = null;
        for (const rule of rules) {
          const kw = rule.keyword.toLowerCase().trim();
          const text = messageText.toLowerCase().trim();
          if (rule.match_type === 'exact' && text === kw) {
            matchedRule = rule;
            break;
          } else if (rule.match_type === 'startsWith' && text.startsWith(kw)) {
            matchedRule = rule;
            break;
          } else if (rule.match_type === 'contains' && text.includes(kw)) {
            matchedRule = rule;
            break;
          }
        }

        let replyText = '';
        let isAi = false;

        if (matchedRule) {
          replyText = matchedRule.response_text
            .replace(/\{nama\}/gi, senderName)
            .replace(/\{pesan\}/gi, messageText);
        } else {
          // If no keyword rule matched, check if Gemini AI auto-reply is active
          const sysConfig = getSystemConfig();
          let canUseAi = false;
          let userPersonalKey: string | undefined = undefined;
          let userPersonalPrompt: string | undefined = undefined;

          if (sessionUser) {
            userPersonalPrompt = sessionUser.custom_system_prompt || undefined;

            if (sessionUser.role === 'admin') {
              // Admins can use AI if global setting is enabled
              canUseAi = sysConfig.ai_config.enabled && sysConfig.ai_config.fallback_when_no_rule;
              // Decrypt personal key if admin has one, otherwise system key rotation is used
              const hasPersonalKey = Boolean(sessionUser.custom_gemini_key && sessionUser.custom_gemini_key.length > 10);
              if (hasPersonalKey) {
                const plain = decryptData(sessionUser.custom_gemini_key!);
                if (plain && plain.length > 10) {
                  userPersonalKey = plain;
                }
              }
            } else {
              // For standard users: AI is ONLY active if THEY enabled it (ai_enabled === true) AND they have a personal key!
              // Standard users NEVER get system key allocations anymore.
              const isUserAiToggleOn = Boolean(sessionUser.ai_enabled);
              if (isUserAiToggleOn) {
                const hasPersonalKey = Boolean(sessionUser.custom_gemini_key && sessionUser.custom_gemini_key.length > 10);
                if (hasPersonalKey) {
                  const plain = decryptData(sessionUser.custom_gemini_key!);
                  if (plain && plain.length > 10) {
                    userPersonalKey = plain;
                    canUseAi = true;
                  }
                }
              }
              if (!canUseAi && isUserAiToggleOn) {
                console.log(`[Baileys AI Quota] User ${sessionUser.username} mengaktifkan AI tetapi tidak memasukkan API Key Gemini pribadi. Balasan dialihkan ke pesan offline.`);
              }
            }
          } else {
            // No session user context, fall back to global config
            canUseAi = sysConfig.ai_config.enabled && sysConfig.ai_config.fallback_when_no_rule;
          }

          if (canUseAi) {
            try {
              console.log(`[Baileys AI Fallback] Generating Gemini reply for "${messageText}"... (Personal Key: ${userPersonalKey ? 'Ya' : 'Sistem/Admin'})`);
              const aiRes = await generateGeminiAutoReply({
                senderName,
                incomingText: messageText,
                senderPhone,
                userCustomKey: userPersonalKey,
                userCustomPrompt: userPersonalPrompt
              });
              if (aiRes.success && aiRes.reply_text) {
                replyText = aiRes.reply_text;
                isAi = true;
              }
            } catch (aiErr) {
              console.error('[Baileys AI Reply Error]', aiErr);
            }
          }

          // If still no replyText (AI disabled, quota 3/3 exhausted, or AI error):
          // Send user's default CS reply fallback (active by default)
          if (!replyText) {
            const isCsEnabled = sessionUser ? (sessionUser.default_cs_reply_enabled !== false) : true;
            if (isCsEnabled) {
              const customOfflineMsg = sessionUser?.default_cs_reply_text || sessionUser?.custom_offline_message || sysConfig.ai_config.offline_fallback_message ||
                'Halo *{nama}*, terima kasih telah menghubungi kami. Tim Customer Service kami akan segera membalas pesan Anda sesegera mungkin.';
              replyText = customOfflineMsg
                .replace(/\{nama\}/gi, senderName)
                .replace(/\{pesan\}/gi, messageText);
            }
          }
        }

        if (replyText) {
          // Anti-Ban Simulation & Random Typing Delay
          if (antiBan.enabled) {
            const minS = Math.max(1, antiBan.min_delay_seconds || 2);
            const maxS = Math.max(minS, antiBan.max_delay_seconds || 5);
            const randomDelayMs = Math.floor(Math.random() * (maxS - minS + 1) + minS) * 1000;

            console.log(`[Baileys Anti-Ban] Typing simulation & random delay (${randomDelayMs / 1000}s) for ${senderPhone}...`);

            if (antiBan.typing_simulation) {
              await sock.sendPresenceUpdate('composing', remoteJid).catch(() => {});
            }

            await new Promise(res => setTimeout(res, randomDelayMs));

            if (antiBan.typing_simulation) {
              await sock.sendPresenceUpdate('paused', remoteJid).catch(() => {});
            }
          }

          // Send auto-reply message
          recordBotOutgoing(replyText);
          await sock.sendMessage(remoteJid, { text: replyText });
          console.log(`[Baileys Auto-Reply Sent ${isAi ? '(AI)' : ''}] To ${senderPhone}: "${replyText}"`);

          // DEDUCT USER QUOTAS (DAILY & MONTHLY) IMMEDIATELY
          if (sessionUser) {
            const msgDeduct = deductUserDailyQuota(sessionUser.id);
            if (isAi) {
              const aiDeduct = deductUserAiQuota(sessionUser.id);
              console.log(`[Baileys Quota Deducted] AI User ${sessionUser.username}: Daily AI=${aiDeduct.remainingDaily}/${aiDeduct.dailyLimit}, Monthly AI=${aiDeduct.remainingMonthly}/${aiDeduct.monthlyLimit}`);
            } else {
              console.log(`[Baileys Quota Deducted] Msg User ${sessionUser.username}: Daily Msg=${msgDeduct.remaining}/${msgDeduct.dailyLimit}`);
            }
          }
        }

        // Add to database message logs with isolated user_id & session_id
        addMessageLog({
          wam_id: msg.key.id || `baileys_in_${Date.now()}`,
          session_id: dbSession?.id || sessionId,
          user_id: sessionUserId,
          sender_phone: senderPhone,
          sender_name: senderName,
          message_body: messageText,
          direction: 'incoming',
          status: replyText ? 'Sukses' : 'Diterima',
          reply_body: replyText || undefined,
          ai_generated: isAi
        });
      }
    } catch (err) {
      console.error('[Baileys Message Listener Error]', err);
    }
  });
}

// Start or get active Baileys socket for QR Code or persistent session
export async function getOrStartBaileysSession(sessionId: string = 'session_primary_default', phoneNumber?: string, userId?: string) {
  const existing = activeSessions.get(sessionId);
  if (existing && existing.status === 'connected' && existing.socket) {
    if (userId && !existing.userId) existing.userId = userId;
    return existing;
  }

  // If there's an existing connecting/broken socket, terminate it safely
  if (existing && existing.socket) {
    try {
      existing.socket.end(undefined);
    } catch (e) {
      // Ignore
    }
    activeSessions.delete(sessionId);
  }

  const sessionFolder = path.join(AUTH_DIR, sessionId);
  if (!fs.existsSync(sessionFolder)) {
    fs.mkdirSync(sessionFolder, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: DEFAULT_BAILEYS_VERSION }));

  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: BAILEYS_BROWSER,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000
  });

  const sessionData: SessionState = {
    sessionId,
    userId,
    socket: sock,
    qrCodeUrl: null,
    pairingCode: null,
    status: 'connecting',
    phoneNumber: phoneNumber || null,
    lastUpdated: Date.now()
  };

  activeSessions.set(sessionId, sessionData);

  // Safe sequential credential saving queue to avoid dropping updates or file corruption
  let credsSaveQueue: Promise<void> = Promise.resolve();
  sock.ev.on('creds.update', () => {
    credsSaveQueue = credsSaveQueue.then(async () => {
      try {
        await saveCreds();
      } catch (saveErr) {
        console.warn('[Baileys] Error saving creds:', saveErr);
      }
    });
  });

  // Long-lasting Keep-Alive presence pings (like WhatsApp Web for months of uptime)
  const keepAlivePing = setInterval(async () => {
    try {
      if (sessionData.status === 'connected' && sock) {
        await sock.sendPresenceUpdate('available').catch(() => {});
      } else if (sessionData.status === 'disconnected') {
        clearInterval(keepAlivePing);
      }
    } catch {
      // Ignore ping errors
    }
  }, 25000);

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrUrl = await QRCode.toDataURL(qr, { margin: 2, width: 300 });
        sessionData.qrCodeUrl = qrUrl;
        sessionData.lastUpdated = Date.now();
        activeSessions.set(sessionId, sessionData);
      } catch (e) {
        console.error('[Baileys] Error generating QR data URL:', e);
      }
    }

    if (connection === 'open') {
      console.log(`[Baileys] WhatsApp Connected successfully for session: ${sessionId}`);
      const connectedUser = sock.user?.id ? sock.user.id.split(':')[0] : phoneNumber || '6281234567890';
      sessionData.status = 'connected';
      sessionData.phoneNumber = connectedUser;
      sessionData.qrCodeUrl = null;
      sessionData.pairingCode = null;
      sessionData.lastUpdated = Date.now();

      const db = initDbFile();
      let targetUserId = sessionData.userId;
      if (!targetUserId) {
        const existingDb = getSessionById(sessionId);
        if (existingDb?.user_id) targetUserId = existingDb.user_id;
      }
      if (!targetUserId && connectedUser) {
        const matchedU = db.users.find(u => u.phone && u.phone.replace(/\D/g, '') === connectedUser.replace(/\D/g, ''));
        if (matchedU) targetUserId = matchedU.id;
      }
      if (!targetUserId && sessionId) {
        targetUserId = extractUserIdFromSessionId(sessionId, db.users);
      }
      sessionData.userId = targetUserId;
      sessionData.is_primary = Boolean(getSessionById(sessionId)?.is_primary);
      activeSessions.set(sessionId, sessionData);

      const existingDb = getSessionById(sessionId) || db.sessions.find(s => s.phone_number && s.phone_number.replace(/\D/g, '') === connectedUser.replace(/\D/g, ''));
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (existingDb) {
        updateSession(existingDb.id, {
          id: sessionId,
          status: 'connected',
          phone_number: connectedUser,
          user_id: targetUserId || existingDb.user_id,
          connected_at: new Date().toISOString(),
          expires_at: existingDb.expires_at || expiryDate
        });
      } else {
        addSession({
          id: sessionId,
          session_name: `WA - ${connectedUser}`,
          phone_number: connectedUser,
          auth_method: 'qr_code',
          status: 'connected',
          user_id: targetUserId,
          phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || '102938475610',
          access_token: process.env.WHATSAPP_ACCESS_TOKEN || 'TOKEN_WHATSAPP_SESSION_CONNECTED',
          is_primary: true,
          expires_at: expiryDate
        });
      }
    } else if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(`[Baileys] Connection closed for ${sessionId}. Status: ${statusCode}. LoggedOut: ${isLoggedOut}`);

      sessionData.status = 'disconnected';
      sessionData.qrCodeUrl = null;
      sessionData.pairingCode = null;
      activeSessions.set(sessionId, sessionData);
      clearInterval(keepAlivePing);

      if (isLoggedOut) {
        // Do NOT automatically wipe data unless user explicitly deletes from UI
        console.warn(`[Baileys] Sesi ${sessionId} terputus (status 401). Menandai sesi terputus...`);
        updateSession(sessionId, { status: 'disconnected' });
      } else {
        // Automatically reconnect for stream restarts (e.g. 515), network drops, or idle resets
        updateSession(sessionId, { status: 'connecting' });
        console.log(`[Baileys Auto-Reconnect] Menghubungkan ulang sesi ${sessionId} secara otomatis...`);
        setTimeout(() => {
          getOrStartBaileysSession(sessionId, phoneNumber || sessionData.phoneNumber || undefined, sessionData.userId);
        }, 3000);
      }
    }
  });

  // Attach messages upsert listener
  attachSocketMessageListener(sock, sessionId, sessionData);

  return sessionData;
}

// Request real WhatsApp pairing code via Baileys socket
export async function requestBaileysPairingCode(sessionId: string, phoneNumber: string, userId?: string): Promise<string> {
  const cleanPhone = normalizePhoneNumber(phoneNumber);
  if (!cleanPhone || cleanPhone.length < 9) throw new Error('Nomor telepon tidak valid. Gunakan format lengkap (contoh: 0812... atau 62812...).');

  // Safely stop existing sockets on this session ID without deleting DB records
  const existing = activeSessions.get(sessionId);
  if (existing && existing.socket) {
    try {
      existing.socket.end(undefined);
    } catch (e) {
      // Ignore
    }
    activeSessions.delete(sessionId);
  }

  const sessionFolder = path.join(AUTH_DIR, sessionId);
  if (fs.existsSync(sessionFolder)) {
    try {
      fs.rmSync(sessionFolder, { recursive: true, force: true });
    } catch (e) {
      console.warn('[Baileys] Warning cleaning session folder for new pairing:', e);
    }
  }
  if (!fs.existsSync(sessionFolder)) {
    fs.mkdirSync(sessionFolder, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: DEFAULT_BAILEYS_VERSION }));

  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: BAILEYS_BROWSER,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000
  });

  const sessionData: SessionState = {
    sessionId,
    userId,
    socket: sock,
    qrCodeUrl: null,
    pairingCode: null,
    status: 'connecting',
    phoneNumber: cleanPhone,
    lastUpdated: Date.now()
  };

  activeSessions.set(sessionId, sessionData);

  // Safe sequential credential saving queue for pairing session
  let pairCredsSaveQueue: Promise<void> = Promise.resolve();
  sock.ev.on('creds.update', () => {
    pairCredsSaveQueue = pairCredsSaveQueue.then(async () => {
      try {
        await saveCreds();
      } catch (saveErr) {
        console.warn('[Baileys Pairing] Error saving creds:', saveErr);
      }
    });
  });

  const pairKeepAlivePing = setInterval(async () => {
    try {
      if (sessionData.status === 'connected' && sock) {
        await sock.sendPresenceUpdate('available').catch(() => {});
      } else if (sessionData.status === 'disconnected') {
        clearInterval(pairKeepAlivePing);
      }
    } catch {}
  }, 25000);

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log(`[Baileys Pairing] Connected & Linked successfully! User: ${sock.user?.id}`);
      const connectedUser = sock.user?.id ? sock.user.id.split(':')[0] : cleanPhone;
      sessionData.status = 'connected';
      sessionData.phoneNumber = connectedUser;
      sessionData.pairingCode = null;
      sessionData.lastUpdated = Date.now();

      const db = initDbFile();
      let targetUserId = sessionData.userId || userId;
      if (!targetUserId) {
        const existingDb = getSessionById(sessionId);
        if (existingDb?.user_id) targetUserId = existingDb.user_id;
      }
      if (!targetUserId && connectedUser) {
        const matchedU = db.users.find(u => u.phone && u.phone.replace(/\D/g, '') === connectedUser.replace(/\D/g, ''));
        if (matchedU) targetUserId = matchedU.id;
      }
      if (!targetUserId && sessionId) {
        targetUserId = extractUserIdFromSessionId(sessionId, db.users);
      }
      sessionData.userId = targetUserId;
      activeSessions.set(sessionId, sessionData);

      const existing = getSessionById(sessionId) || db.sessions.find(s => s.phone_number && s.phone_number.replace(/\D/g, '') === connectedUser.replace(/\D/g, ''));
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (existing) {
        updateSession(existing.id, {
          id: sessionId,
          status: 'connected',
          phone_number: connectedUser,
          user_id: targetUserId || existing.user_id,
          connected_at: new Date().toISOString(),
          expires_at: existing.expires_at || expiryDate
        });
      } else {
        addSession({
          id: sessionId,
          session_name: `WA Pair - ${connectedUser}`,
          phone_number: connectedUser,
          auth_method: 'pairing_code',
          status: 'connected',
          user_id: targetUserId,
          phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || '102938475610',
          access_token: process.env.WHATSAPP_ACCESS_TOKEN || 'TOKEN_WHATSAPP_SESSION_CONNECTED',
          is_primary: true,
          expires_at: expiryDate
        });
      }
    } else if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      console.log(`[Baileys Pairing] Connection closed ${sessionId}, code: ${statusCode}`);
      clearInterval(pairKeepAlivePing);

      if (statusCode === DisconnectReason.loggedOut) {
        sessionData.status = 'disconnected';
        sessionData.pairingCode = null;
        activeSessions.set(sessionId, sessionData);
        updateSession(sessionId, { status: 'disconnected' });
        console.warn(`[Baileys Pairing] Session ${sessionId} marked as disconnected.`);
      } else {
        console.log(`[Baileys Pairing] Session closed during linking (${statusCode}). Waiting for credentials write and auto-reconnecting ${sessionId}...`);
        setTimeout(async () => {
          try {
            await pairCredsSaveQueue;
          } catch {}
          getOrStartBaileysSession(sessionId, cleanPhone, sessionData.userId || userId);
        }, 1500);
      }
    }
  });

  // Attach messages upsert listener to pairing socket as well
  attachSocketMessageListener(sock, sessionId, sessionData);

  // Wait for WebSocket connection to establish before requesting code
  let tries = 0;
  while (tries < 18 && !sock.ws?.isOpen) {
    await delay(300);
    tries++;
  }
  await delay(1000);

  if (!sock.authState.creds.registered) {
    try {
      const rawCode = await sock.requestPairingCode(cleanPhone);
      const formattedCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
      sessionData.pairingCode = formattedCode;
      activeSessions.set(sessionId, sessionData);

      // Create connecting session record in database
      const existingDbSess = getSessionById(sessionId);
      const defaultExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (!existingDbSess) {
        addSession({
          id: sessionId,
          session_name: `WA Pair - ${cleanPhone}`,
          phone_number: cleanPhone,
          auth_method: 'pairing_code',
          status: 'connecting',
          user_id: userId || sessionData.userId,
          phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || '102938475610',
          access_token: process.env.WHATSAPP_ACCESS_TOKEN || 'TOKEN_WHATSAPP_SESSION_CONNECTED',
          is_primary: true,
          expires_at: defaultExpires
        });
      } else if ((userId || sessionData.userId) && !existingDbSess.user_id) {
        updateSession(existingDbSess.id, { user_id: userId || sessionData.userId, id: sessionId, expires_at: defaultExpires });
      }

      return formattedCode;
    } catch (err: any) {
      console.error('[Baileys] Request pairing code error:', err);
      throw new Error(err?.message || 'Gagal meminta Kode Pairing dari WhatsApp.');
    }
  } else {
    throw new Error('Sesi ini sudah terdaftar dan terhubung.');
  }
}

export function getBaileysSessionStatus(idOrPhone: string) {
  let session = activeSessions.get(idOrPhone);

  if (!session) {
    const cleanPhone = idOrPhone ? idOrPhone.replace(/\D/g, '') : '';
    for (const s of activeSessions.values()) {
      if (
        s.sessionId === idOrPhone ||
        (cleanPhone && s.phoneNumber && s.phoneNumber.includes(cleanPhone)) ||
        (cleanPhone && s.sessionId.includes(cleanPhone))
      ) {
        session = s;
        break;
      }
    }
  }

  if (session) {
    return {
      sessionId: session.sessionId,
      qrCodeUrl: session.qrCodeUrl,
      pairingCode: session.pairingCode,
      status: session.status,
      phoneNumber: session.phoneNumber,
      lastUpdated: session.lastUpdated
    };
  }

  // Fallback to database record if session connected
  try {
    const dbSess = getSessionById(idOrPhone);
    if (dbSess) {
      return {
        sessionId: dbSess.id,
        qrCodeUrl: null,
        pairingCode: null,
        status: dbSess.status || 'disconnected',
        phoneNumber: dbSess.phone_number,
        lastUpdated: Date.now()
      };
    }
  } catch {}

  return null;
}

export async function stopBaileysSession(idOrPhone: string) {
  if (!idOrPhone) return;

  console.log(`[Baileys] Stopping and deleting session: ${idOrPhone}`);
  const sess = getSessionById(idOrPhone);
  const targetPhone = sess?.phone_number || idOrPhone.replace(/\D/g, '');

  // 1. Delete from DB immediately so UI updates
  deleteSession(idOrPhone);
  if (sess?.id) deleteSession(sess.id);
  if (targetPhone && targetPhone.length >= 8) deleteSession(targetPhone);

  // 2. Terminate matching active sockets non-blockingly
  const keysToRemove: string[] = [];
  for (const [key, sessionData] of activeSessions.entries()) {
    if (
      key === idOrPhone ||
      (sess && key === sess.id) ||
      (targetPhone && targetPhone.length >= 8 && (sessionData.phoneNumber?.includes(targetPhone) || key.includes(targetPhone))) ||
      (idOrPhone === 'session_primary_default' && key === 'session_primary_default')
    ) {
      if (sessionData.socket) {
        try {
          await Promise.race([
            sessionData.socket.logout().catch(() => {}),
            new Promise(res => setTimeout(res, 800))
          ]);
        } catch (e) {
          // Ignore
        }
        try {
          sessionData.socket.end(undefined);
        } catch (e) {
          // Ignore
        }
      }
      keysToRemove.push(key);
    }
  }

  for (const k of keysToRemove) {
    activeSessions.delete(k);
    cleanSessionFolder(k);
  }

  // 3. Clean all session folders on disk
  cleanSessionFolder(idOrPhone);
  if (sess?.id) cleanSessionFolder(sess.id);
  if (targetPhone && targetPhone.length >= 8) {
    cleanSessionFolder(`session_${targetPhone}`);
    cleanSessionFolder(`session_pair_${targetPhone}`);
  }
}

// Auto-restore all saved active WhatsApp sessions on server startup
export async function restoreSavedBaileysSessions() {
  try {
    const dbSessions = getWhatsAppSessions();
    const diskFolders = fs.existsSync(AUTH_DIR) ? fs.readdirSync(AUTH_DIR) : [];

    const sessionIdsToRestore = new Set<string>();

    dbSessions.forEach(s => {
      if (s.id) sessionIdsToRestore.add(s.id);
    });

    diskFolders.forEach(folder => {
      const folderPath = path.join(AUTH_DIR, folder);
      if (fs.lstatSync(folderPath).isDirectory() && fs.existsSync(path.join(folderPath, 'creds.json'))) {
        sessionIdsToRestore.add(folder);
      }
    });

    console.log(`[Baileys Persistent Storage] Found ${sessionIdsToRestore.size} saved WhatsApp session(s) to restore.`);

    for (const sid of sessionIdsToRestore) {
      if (!activeSessions.has(sid)) {
        try {
          console.log(`[Baileys Auto-Restore] Rehydrating session: ${sid}...`);
          getOrStartBaileysSession(sid);
          await delay(1000);
        } catch (err) {
          console.error(`[Baileys Auto-Restore Error] Failed to restore session ${sid}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[Baileys Restore Error]', err);
  }
}

// Automatically trigger session restore on module load
setTimeout(() => {
  restoreSavedBaileysSessions().catch(() => {});
}, 2000);

// Background Keep-Alive & Auto-Heal Watchdog (ensures WhatsApp Web sessions stay connected for months)
setInterval(async () => {
  try {
    const dbSessions = getWhatsAppSessions();
    for (const s of dbSessions) {
      if (s.status === 'connected' && s.id) {
        const mem = activeSessions.get(s.id);
        if (!mem || mem.status !== 'connected' || !mem.socket) {
          console.log(`[Baileys Watchdog] Auto-healing disconnected session ${s.id} (${s.phone_number})...`);
          getOrStartBaileysSession(s.id, s.phone_number, s.user_id).catch(() => {});
        }
      }
    }
  } catch (err) {
    // Silent watchdog error
  }
}, 30000);

// Send actual outgoing WhatsApp message via connected Baileys socket with resilient auto-restore
export async function sendBaileysTextMessage(
  idOrPhone: string,
  recipientPhone: string,
  text: string,
  options?: { userId?: string; isBroadcast?: boolean; skipLog?: boolean; skipQuota?: boolean }
) {
  const cleanRecipient = normalizePhoneNumber(recipientPhone);
  if (!cleanRecipient || cleanRecipient.length < 8) {
    throw new Error(`Nomor WhatsApp tujuan tidak valid (${recipientPhone}).`);
  }

  const jid = `${cleanRecipient}@s.whatsapp.net`;
  const db = initDbFile();

  // 1. Find active connected socket session by requested id or phone
  let targetSession: SessionState | undefined = idOrPhone ? activeSessions.get(idOrPhone) : undefined;

  // 2. If not found by exact key, match by session ID or phone number
  if (!targetSession || targetSession.status !== 'connected' || !targetSession.socket) {
    const cleanId = idOrPhone ? idOrPhone.replace(/\D/g, '') : '';
    for (const s of activeSessions.values()) {
      if (s.status === 'connected' && s.socket) {
        if (
          s.sessionId === idOrPhone ||
          (cleanId.length >= 8 && s.phoneNumber && s.phoneNumber.replace(/\D/g, '').endsWith(cleanId.slice(-8)))
        ) {
          targetSession = s;
          break;
        }
      }
    }
  }

  // 3. Match by userId (either passed in options or extracted from idOrPhone)
  if (!targetSession || targetSession.status !== 'connected' || !targetSession.socket) {
    const requestedUserId = options?.userId || (idOrPhone ? extractUserIdFromSessionId(idOrPhone, db.users) : undefined);
    if (requestedUserId) {
      const userConnected = Array.from(activeSessions.values()).filter(
        s => s.status === 'connected' && s.socket && (s.userId === requestedUserId || s.sessionId.includes(requestedUserId))
      );
      targetSession = userConnected.find(s => s.is_primary) || userConnected[0];
    }
  }

  // 4. Fallback to ANY connected session in memory (prefer primary session first)
  if (!targetSession || targetSession.status !== 'connected' || !targetSession.socket) {
    const allConnected = Array.from(activeSessions.values()).filter(s => s.status === 'connected' && s.socket);
    targetSession = allConnected.find(s => s.is_primary) || allConnected[0];
  }

  // 5. If still not found in memory, check disk for requested auth folder or any saved connected session
  if (!targetSession || targetSession.status !== 'connected' || !targetSession.socket) {
    const candidateFolders: string[] = [];
    if (idOrPhone) candidateFolders.push(idOrPhone);
    for (const s of db.sessions) {
      if (s.id && !candidateFolders.includes(s.id)) candidateFolders.push(s.id);
    }

    for (const folderId of candidateFolders) {
      const requestedFolder = path.join(AUTH_DIR, folderId);
      if (fs.existsSync(path.join(requestedFolder, 'creds.json'))) {
        console.log(`[Baileys Auto-Connect] Attempting to rehydrate session "${folderId}" for message dispatch...`);
        targetSession = await getOrStartBaileysSession(folderId);
        let waitCount = 0;
        while (waitCount < 7 && targetSession && targetSession.status !== 'connected') {
          await delay(500);
          waitCount++;
        }
        if (targetSession && targetSession.status === 'connected' && targetSession.socket) {
          break;
        }
      }
    }
  }

  if (!targetSession || !targetSession.socket || targetSession.status !== 'connected') {
    // Wait briefly if a session is currently reconnecting (e.g. during stream restart in bulk broadcast)
    const connectingSession = Array.from(activeSessions.values()).find(s => s.status === 'connecting');
    if (connectingSession) {
      let waitRetry = 0;
      while (waitRetry < 10 && connectingSession.status === 'connecting') {
        await delay(500);
        waitRetry++;
      }
      if (connectingSession.status === 'connected' && connectingSession.socket) {
        targetSession = connectingSession;
      }
    }
  }

  if (!targetSession || !targetSession.socket || targetSession.status !== 'connected') {
    throw new Error('Gagal terhubung ke WhatsApp Sesi. Pastikan nomor WhatsApp Anda sudah terhubung (Scan QR / Kode Pairing) di menu Koneksi WA.');
  }

  const sessionUserId =
    options?.userId ||
    targetSession.userId ||
    extractUserIdFromSessionId(targetSession.sessionId, db.users);

  console.log(`[Baileys Outgoing] Sending message to ${jid} via session ${targetSession.sessionId}...`);
  recordBotOutgoing(text);

  let result: any = null;
  try {
    await targetSession.socket.sendPresenceUpdate('composing', jid).catch(() => {});
    await delay(200);
    result = await Promise.race([
      targetSession.socket.sendMessage(jid, { text }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Batas waktu pengiriman ke nomor tujuan habis (Timeout 18d)')), 18000))
    ]);
  } catch (firstErr: any) {
    console.warn(`[Baileys Outgoing Retry] First attempt to ${jid} failed (${firstErr?.message}), retrying in 1.2s...`);
    await delay(1200);
    // Re-resolve active socket in case it reconnected
    const refreshed =
      activeSessions.get(targetSession.sessionId) ||
      Array.from(activeSessions.values()).find(s => s.status === 'connected' && s.socket);
    if (!refreshed || !refreshed.socket || refreshed.status !== 'connected') {
      if (!options?.skipLog) {
        addMessageLog({
          wam_id: `baileys_fail_${Date.now()}`,
          session_id: targetSession.sessionId,
          user_id: sessionUserId,
          sender_phone: cleanRecipient,
          sender_name: options?.isBroadcast ? `Broadcast (${cleanRecipient})` : `Tujuan (${cleanRecipient})`,
          message_body: text,
          direction: 'outgoing',
          status: 'Gagal',
          error_detail: firstErr?.message || 'Koneksi terputus saat broadcast'
        });
      }
      throw firstErr;
    }
    targetSession = refreshed;
    try {
      result = await Promise.race([
        targetSession.socket.sendMessage(jid, { text }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Batas waktu pengiriman ulang habis (Timeout 18d)')), 18000))
      ]);
    } catch (retryErr: any) {
      if (!options?.skipLog) {
        addMessageLog({
          wam_id: `baileys_fail_${Date.now()}`,
          session_id: targetSession.sessionId,
          user_id: sessionUserId,
          sender_phone: cleanRecipient,
          sender_name: options?.isBroadcast ? `Broadcast (${cleanRecipient})` : `Tujuan (${cleanRecipient})`,
          message_body: text,
          direction: 'outgoing',
          status: 'Gagal',
          error_detail: retryErr?.message || 'Gagal mengirim pesan setelah percobaan ulang'
        });
      }
      throw retryErr;
    }
  }

  if (!options?.skipLog) {
    addMessageLog({
      wam_id: result?.key?.id || `baileys_${Date.now()}`,
      session_id: targetSession.sessionId,
      user_id: sessionUserId,
      sender_phone: cleanRecipient,
      sender_name: options?.isBroadcast ? `Broadcast (${cleanRecipient})` : `Tujuan (${cleanRecipient})`,
      message_body: text,
      direction: 'outgoing',
      status: 'Sukses',
      reply_body: options?.isBroadcast ? 'Dikirim via Broadcast Massal' : text
    });
  }

  if (!options?.skipQuota && sessionUserId) {
    deductUserDailyQuota(sessionUserId);
  }

  return {
    success: true,
    wam_id: result?.key?.id,
    to: cleanRecipient,
    session_id: targetSession.sessionId,
    raw: result
  };
}
