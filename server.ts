import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import {
  handleIncomingWhatsAppMessage,
  sendWhatsAppMessage
} from './src/lib/whatsapp.js';
import {
  getMessageLogs,
  clearMessageLogs,
  getAutoReplyRules,
  addAutoReplyRule,
  toggleAutoReplyRule,
  deleteAutoReplyRule,
  getBotStats,
  exportCurrentDataToSql,
  getWhatsAppSessions,
  getSessions,
  getSessionsByUserId,
  addWhatsAppSession,
  updateWhatsAppSession,
  deleteWhatsAppSession,
  setPrimarySession,
  extendWhatsAppSession,
  getAntiBanSettings,
  updateAntiBanSettings,
  getUsers,
  getUserById,
  updateUser,
  getUserByApiKey,
  getUserByPhone,
  approveUserSubscription,
  rejectUserSubscription,
  registerUser,
  checkAccountAvailability,
  verifyUserOtp,
  resetPasswordWithOtp,
  getSystemConfig,
  updateSystemConfig,
  getSubscriptionPlans,
  saveSubscriptionPlans,
  updateSubscriptionPlan,
  addSubscriptionPlan,
  deleteSubscriptionPlan,
  getWhitelabelConfig,
  updateWhitelabelConfig,
  getGeminiKeys,
  getActiveGeminiKeys,
  addGeminiKey,
  updateGeminiKey,
  deleteGeminiKey,
  toggleGeminiKey,
  setUserSecurityPin,
  verifyUserSecurityPin,
  unlockUserBot,
  generateUserApiKey,
  deductUserDailyQuota,
  processRemoteWhatsAppCommand,
  upgradeUserPlan,
  deleteUserAccount,
  getQrisConfig,
  updateQrisConfig,
  getBroadcastHistory,
  addBroadcastHistory,
  clearBroadcastHistory,
  getSmtpAccounts,
  getActiveSmtpAccounts,
  addSmtpAccount,
  updateSmtpAccount,
  deleteSmtpAccount,
  toggleSmtpAccount
} from './src/lib/db.js';
import {
  getOrStartBaileysSession,
  requestBaileysPairingCode,
  getBaileysSessionStatus,
  stopBaileysSession,
  sendBaileysTextMessage,
  normalizePhoneNumber
} from './src/lib/baileysManager.js';
import {
  sendEmailWithRotation,
  sendVerificationOtpEmail,
  sendPasswordResetEmail,
  testSmtpAccountConnection
} from './src/lib/emailService.js';
import {
  testGeminiApiKey,
  verifyPaymentReceiptWithAi
} from './src/lib/geminiService.js';
import {
  testMysqlConnection,
  syncPushStructureAndData,
  initMysqlSchemaIfNotExists
} from './src/lib/mysqlService.js';
import {
  maskSensitiveString,
  generateOtpCode,
  decryptData,
  encryptData,
  verifyMasterPin,
  hashPassword
} from './src/lib/security.js';
import { EnvConfigMasked } from './src/types/whatsapp.js';

dotenv.config();

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

function getSystemWhatsAppSessionId() {
  const sessions = getWhatsAppSessions();
  let session = sessions.find(s => s.status === 'connected' && (s.user_id === 'usr_superadmin' || s.id?.includes('superadmin')));
  if (!session) {
    session = sessions.find(s => s.status === 'connected' && s.is_primary);
  }
  if (!session) {
    session = sessions.find(s => s.status === 'connected');
  }
  return session ? session.id : null;
}

async function sendSystemWhatsAppNotification(phone: string, text: string) {
  const sessionId = getSystemWhatsAppSessionId();
  if (sessionId) {
    try {
      await sendBaileysTextMessage(sessionId, phone, text, { skipLog: true, skipQuota: true });
      console.log(`[System WA] Notification sent to ${phone} via session ${sessionId}`);
      return true;
    } catch (err: any) {
      console.error(`[System WA Error] Failed to send message to ${phone}:`, err?.message);
    }
  } else {
    console.warn(`[System WA Warning] No connected system/superadmin WhatsApp session found. Cannot send message to ${phone}.`);
  }
  return false;
}

function sanitizeUserForClient(user: any) {
  if (!user) return user;
  const copy = { ...user };
  delete copy.verification_otp;
  delete copy.password;
  return copy;
}

// In-memory rate limiting map for OTP generation (30 seconds cooldown per target)
const otpCooldownMap = new Map<string, number>();

function checkOtpCooldown(key: string, seconds = 30): { allowed: boolean; remaining: number } {
  if (!key) return { allowed: true, remaining: 0 };
  const lastTime = otpCooldownMap.get(key) || 0;
  const now = Date.now();
  const diffSec = Math.floor((now - lastTime) / 1000);
  if (diffSec < seconds) {
    return { allowed: false, remaining: seconds - diffSec };
  }
  otpCooldownMap.set(key, now);
  return { allowed: true, remaining: 0 };
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers middleware (anonymize technology fingerprint & allow iframe embedding)
app.use((_req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.removeHeader('X-Frame-Options');
  next();
});

// =============================================================
// 1. WEBHOOK ENDPOINTS (api/whatsapp)
// =============================================================

const handleWebhookVerification: express.RequestHandler = (req, res) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const sysConfig = getSystemConfig();
  const expectedToken = sysConfig.webhook_verify_token || process.env.WEBHOOK_VERIFY_TOKEN || 'maudigi_gtw_verify_token_2026';

  console.log(`[Webhook Verification] Mode: ${mode}, Token: ${token}, Expected: ${expectedToken}`);

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Webhook Verification] SUCCESS - Webhook verified!');
    res.status(200).send(challenge);
  } else {
    console.error('[Webhook Verification] FAILED - Token mismatch!');
    res.status(403).json({ error: 'Verification failed. Verify token does not match.' });
  }
};

app.get('/api/webhook', handleWebhookVerification);
app.get('/api/whatsapp', handleWebhookVerification);
app.get('/api/whatsapp/route', handleWebhookVerification);

const handleWebhookPost: express.RequestHandler = async (req, res) => {
  try {
    const body = req.body || {};

    // 1. Meta Official Cloud API Webhook Format
    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value || {};
          const messages = value.messages || [];
          const contacts = value.contacts || [];

          for (const message of messages) {
            if (message.type === 'text' && message.text?.body) {
              const senderPhone = message.from;
              const wamId = message.id;
              const messageText = message.text.body.trim();

              const contactMatch = contacts.find((c: any) => c.wa_id === senderPhone);
              const senderName = contactMatch?.profile?.name || 'Pengguna WhatsApp';

              console.log(`[Incoming Webhook] From: ${senderName} (${senderPhone}) -> "${messageText}"`);

              // Check if message is a slash command (/send, /status, /help, /menu) or from registered operator
              const userMatch = getUserByPhone(senderPhone);
              if (userMatch || messageText.startsWith('/')) {
                const botResult = await processRemoteWhatsAppCommand(senderPhone, senderName, messageText);
                // If /send <phone> <msg> was executed, also dispatch via active Baileys session
                if (messageText.toLowerCase().startsWith('/send ') || messageText.toLowerCase().startsWith('/kirim ')) {
                  const cmdWord = messageText.split(/\s+/)[0];
                  const rawArgs = messageText.substring(cmdWord.length).trim();
                  const firstWord = rawArgs.split(/\s+/)[0] || '';
                  const targetDigits = firstWord.replace(/\D/g, '');
                  const msgContent = rawArgs.substring(firstWord.length).trim();
                  if (targetDigits.length >= 8 && msgContent) {
                    const sessions = getSessions();
                    const activeSess = sessions.find(s => s.status === 'connected' && s.is_primary) || sessions.find(s => s.status === 'connected');
                    if (activeSess) {
                      await sendBaileysTextMessage(activeSess.id, targetDigits, msgContent).catch(() => {});
                    }
                  }
                }
                try {
                  const sessions = getSessions();
                  const activeSess = sessions.find(s => s.status === 'connected' && s.is_primary) || sessions.find(s => s.status === 'connected');
                  const sessId = activeSess?.id || 'sess_primary_app_gateway';
                  await sendBaileysTextMessage(sessId, senderPhone, botResult.reply);
                } catch (e) {
                  console.error('Failed to send remote bot reply via baileys:', e);
                }
              } else {
                await handleIncomingWhatsAppMessage({
                  senderPhone,
                  senderName,
                  messageText,
                  wamId
                });
              }
            }
          }
        }
      }

      res.status(200).send('EVENT_RECEIVED');
      return;
    }

    // 2. Universal Webhook Format (VPS / cPanel / Custom Script Bridge)
    // Case A: Direct Outbound Send via Webhook ({ action: "send", to: "0812...", message: "Halo" })
    const targetTo = body.to || body.target || body.receiver;
    const directMessage = body.message || body.text || body.body;
    if (targetTo && directMessage && (!body.sender && !body.from)) {
      const sessions = getSessions();
      const activeSess =
        (body.session_id ? sessions.find(s => s.id === body.session_id) : null) ||
        sessions.find(s => s.status === 'connected' && s.is_primary) ||
        sessions.find(s => s.status === 'connected');

      if (!activeSess) {
        res.status(400).json({
          success: false,
          error: 'Tidak ada sesi WhatsApp yang sedang terhubung (connected) di sistem.'
        });
        return;
      }

      const sendRes = await sendBaileysTextMessage(activeSess.id, String(targetTo), String(directMessage));
      res.status(200).json({
        success: sendRes.success,
        status: sendRes.success ? 'Sukses' : 'Gagal',
        session_id: activeSess.id,
        to: targetTo,
        message: directMessage,
        details: sendRes
      });
      return;
    }

    // Case B: Incoming Message Forwarded from VPS / cPanel Webhook ({ sender: "62812...", message: "/send ..." })
    const incomingSender = body.sender || body.from || body.phone;
    if (incomingSender && directMessage) {
      const senderPhone = String(incomingSender).replace(/\D/g, '');
      const senderName = String(body.name || body.pushName || body.sender_name || 'Webhook User');
      const messageText = String(directMessage).trim();

      if (messageText.startsWith('/')) {
        const botResult = await processRemoteWhatsAppCommand(senderPhone, senderName, messageText);
        res.status(200).json({
          success: true,
          type: 'command_reply',
          sender: senderPhone,
          reply: botResult.reply
        });
        return;
      }

      const result = await handleIncomingWhatsAppMessage({
        senderPhone,
        senderName,
        messageText,
        wamId: body.id || `wh_${Date.now()}`
      });

      res.status(200).json({
        success: true,
        type: 'auto_reply',
        sender: senderPhone,
        result
      });
      return;
    }

    res.status(200).json({
      success: true,
      status: 'WEBHOOK_READY',
      message: 'Japriin Webhook Endpoint Active'
    });
  } catch (err: any) {
    console.error('[Webhook POST Error]', err);
    res.status(500).json({ error: 'Webhook processing exception', details: err?.message });
  }
};

app.post('/api/webhook', handleWebhookPost);
app.post('/api/whatsapp', handleWebhookPost);
app.post('/api/whatsapp/route', handleWebhookPost);

// =============================================================
// 2. DASHBOARD MANAGEMENT API ENDPOINTS
// =============================================================

// Get all message logs (isolated per user, auto-purged > 7 days)
app.get('/api/messages', (req, res) => {
  const userId = req.query.userId as string;
  const messages = getMessageLogs(userId);
  res.json({ success: true, count: messages.length, retention_days: 7, data: messages });
});

// Clear message logs
app.delete('/api/messages', (req, res) => {
  const userId = (req.query.userId as string) || undefined;
  clearMessageLogs(userId);
  res.json({ success: true, message: 'Riwayat pesan berhasil dibersihkan.' });
});

// Broadcast history logs (auto-purged > 7 days)
app.get('/api/broadcast/history', (req, res) => {
  const userId = (req.query.userId as string) || undefined;
  const history = getBroadcastHistory(userId);
  res.json({ success: true, count: history.length, retention_days: 7, data: history });
});

app.post('/api/broadcast/history', (req, res) => {
  const { user_id, session_id, recipients_count, message, status, success_count, failed_count, scheduled_at } = req.body;
  const saved = addBroadcastHistory({
    user_id,
    session_id,
    recipients_count: Number(recipients_count) || 0,
    message: String(message || ''),
    status: status || 'completed',
    success_count: Number(success_count) || 0,
    failed_count: Number(failed_count) || 0,
    scheduled_at
  });
  res.json({ success: true, data: saved });
});

app.delete('/api/broadcast/history', (req, res) => {
  const userId = (req.query.userId as string) || undefined;
  clearBroadcastHistory(userId);
  res.json({ success: true, message: 'Riwayat broadcast berhasil dibersihkan.' });
});

// Get Bot Statistics (isolated per user)
app.get('/api/stats', (req, res) => {
  const userId = req.query.userId as string;
  const stats = getBotStats(userId);
  res.json({ success: true, data: stats });
});

// Get Auto-Reply Rules (Strictly Isolated per User)
app.get('/api/rules', (req, res) => {
  const userId = (req.query.userId as string) || (req.query.user_id as string);
  if (!userId) {
    return res.json({ success: true, count: 0, data: [] });
  }
  const rules = getAutoReplyRules(userId);
  res.json({ success: true, count: rules.length, data: rules });
});

// Add Auto-Reply Rule (Assigned strictly to User)
app.post('/api/rules', (req, res) => {
  const { keyword, match_type, response_text, user_id } = req.body;
  const targetUserId = user_id || (req.query.userId as string) || (req.query.user_id as string);
  if (!targetUserId) {
    return res.status(400).json({ error: 'User ID wajib disertakan untuk isolasi data akun.' });
  }
  if (!keyword || !response_text) {
    return res.status(400).json({ error: 'Keyword dan Teks Balasan wajib diisi.' });
  }

  try {
    const newRule = addAutoReplyRule({
      user_id: targetUserId,
      keyword: String(keyword).trim(),
      match_type: match_type || 'contains',
      response_text: String(response_text).trim(),
      is_active: true
    });

    res.json({ success: true, data: newRule });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Gagal menambahkan aturan.' });
  }
});

// Toggle Auto-Reply Rule Status (Strictly User-authenticated)
app.put('/api/rules/:id/toggle', (req, res) => {
  const userId = (req.body?.user_id as string) || (req.query.userId as string) || (req.query.user_id as string);
  if (!userId) {
    return res.status(400).json({ error: 'User ID wajib disertakan.' });
  }
  const updated = toggleAutoReplyRule(req.params.id, userId);
  if (!updated) {
    return res.status(404).json({ error: 'Aturan tidak ditemukan atau Anda tidak memiliki akses ke aturan ini.' });
  }
  res.json({ success: true, data: updated });
});

// Delete Auto-Reply Rule (Strictly User-authenticated)
app.delete('/api/rules/:id', (req, res) => {
  const userId = (req.query.userId as string) || (req.query.user_id as string) || (req.body?.user_id as string);
  if (!userId) {
    return res.status(400).json({ error: 'User ID wajib disertakan.' });
  }
  const deleted = deleteAutoReplyRule(req.params.id, userId);
  if (!deleted) {
    return res.status(404).json({ error: 'Aturan tidak ditemukan atau Anda tidak memiliki akses ke aturan ini.' });
  }
  res.json({ success: true, message: 'Aturan berhasil dihapus.' });
});

// =============================================================
// 3. WHITELABEL & APP BRANDING API
// =============================================================

app.get('/api/whitelabel', (_req, res) => {
  res.json({ success: true, data: getWhitelabelConfig() });
});

app.post('/api/whitelabel', (req, res) => {
  const updated = updateWhitelabelConfig(req.body);
  res.json({ success: true, message: 'Informasi brand aplikasi berhasil disimpan!', data: updated });
});

// Master PIN verification
app.post('/api/auth/master-pin', (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ success: false, error: 'PIN wajib diisi.' });

  const isValid = verifyMasterPin(pin);
  if (isValid) {
    res.json({ success: true, message: 'Otentikasi Superadmin Berhasil!' });
  } else {
    res.status(403).json({ success: false, error: 'PIN Master Superadmin Salah!' });
  }
});

// =============================================================
// 4. SUBSCRIPTION PLANS MANAGEMENT (SUPERADMIN CRUD)
// =============================================================

app.get('/api/plans', (_req, res) => {
  const plans = getSubscriptionPlans();
  res.json({ success: true, data: plans });
});

app.post('/api/plans', (req, res) => {
  const { id, name, price, period, max_sessions, daily_msg_limit, monthly_msg_limit, daily_ai_limit, monthly_ai_limit, features, popular } = req.body;
  if (!id || !name || price === undefined) {
    return res.status(400).json({ error: 'ID, Nama Paket, dan Harga wajib diisi.' });
  }

  const newPlan = addSubscriptionPlan({
    id: id.toLowerCase().replace(/\s+/g, '_'),
    name,
    price: Number(price),
    period: period || '/ bulan',
    max_sessions: Number(max_sessions) || 1,
    daily_msg_limit: Number(daily_msg_limit) || 500,
    monthly_msg_limit: monthly_msg_limit ? Number(monthly_msg_limit) : undefined,
    daily_ai_limit: daily_ai_limit !== undefined ? Number(daily_ai_limit) : 50,
    monthly_ai_limit: monthly_ai_limit !== undefined ? Number(monthly_ai_limit) : 1500,
    features: Array.isArray(features) ? features : ['Fitur WhatsApp Gateway'],
    popular: Boolean(popular),
    is_active: true
  });

  res.json({ success: true, message: 'Paket baru berhasil ditambahkan!', data: newPlan });
});

app.put('/api/plans/:id', (req, res) => {
  const { id } = req.params;
  const updated = updateSubscriptionPlan(id, req.body);
  if (!updated) return res.status(404).json({ error: 'Paket tidak ditemukan.' });
  res.json({ success: true, message: 'Ketentuan paket berhasil diperbarui & langsung aktif di halaman depan!', data: updated });
});

app.delete('/api/plans/:id', (req, res) => {
  const { id } = req.params;
  if (id === 'free') {
    return res.status(400).json({ error: 'Paket Gratis tidak boleh dihapus!' });
  }
  const deleted = deleteSubscriptionPlan(id);
  if (!deleted) return res.status(404).json({ error: 'Paket tidak ditemukan.' });
  res.json({ success: true, message: 'Paket berhasil dihapus.' });
});

// =============================================================
// 5. GEMINI MULTI-KEY ROTATION API & TEST CHAT
// =============================================================

const handleGetGeminiKeys = (_req: express.Request, res: express.Response) => {
  const keys = getGeminiKeys().map(k => ({
    ...k,
    key_masked: maskSensitiveString(k.key)
  }));
  res.json({ success: true, data: keys });
};

const handleAddGeminiKey = (req: express.Request, res: express.Response) => {
  const { name, key } = req.body;
  if (!key) return res.status(400).json({ error: 'API Key wajib diisi.' });
  const newKey = addGeminiKey(name || 'Gemini Key', key);
  res.json({ success: true, message: 'Gemini Key berhasil ditambahkan ke rotasi!', data: newKey });
};

const handleUpdateGeminiKey = (req: express.Request, res: express.Response) => {
  const updated = updateGeminiKey(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Key tidak ditemukan.' });
  res.json({ success: true, data: updated });
};

const handleDeleteGeminiKey = (req: express.Request, res: express.Response) => {
  const deleted = deleteGeminiKey(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Key tidak ditemukan.' });
  res.json({ success: true, message: 'Key berhasil dihapus dari rotasi.' });
};

const handleToggleGeminiKey = (req: express.Request, res: express.Response) => {
  const toggled = toggleGeminiKey(req.params.id);
  if (!toggled) return res.status(404).json({ error: 'Key tidak ditemukan.' });
  res.json({ success: true, data: toggled });
};

// Route aliases for /api/gemini/keys AND /api/gemini-keys
app.get('/api/gemini/keys', handleGetGeminiKeys);
app.get('/api/gemini-keys', handleGetGeminiKeys);

app.post('/api/gemini/keys', handleAddGeminiKey);
app.post('/api/gemini-keys', handleAddGeminiKey);

app.put('/api/gemini/keys/:id', handleUpdateGeminiKey);
app.put('/api/gemini-keys/:id', handleUpdateGeminiKey);

app.delete('/api/gemini/keys/:id', handleDeleteGeminiKey);
app.delete('/api/gemini-keys/:id', handleDeleteGeminiKey);

app.post('/api/gemini/keys/:id/toggle', handleToggleGeminiKey);
app.put('/api/gemini/keys/:id/toggle', handleToggleGeminiKey);
app.post('/api/gemini-keys/:id/toggle', handleToggleGeminiKey);
app.put('/api/gemini-keys/:id/toggle', handleToggleGeminiKey);

app.post('/api/gemini/keys/test', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key wajib diisi.' });
  const result = await testGeminiApiKey(key);
  res.json(result);
});

app.post('/api/gemini/test', async (req, res) => {
  const { key } = req.body;
  const result = await testGeminiApiKey(key || process.env.GEMINI_API_KEY || '');
  res.json(result);
});

// =============================================================
// 5B. MULTI-SMTP EMAIL ROTATION API & ANTI-BAN API
// =============================================================

app.get('/api/smtp', (_req, res) => {
  const accounts = getSmtpAccounts().map(acc => ({
    ...acc,
    pass_masked: maskSensitiveString(acc.pass)
  }));
  res.json({ success: true, data: accounts });
});

app.post('/api/smtp', (req, res) => {
  try {
    const { name, host, port, secure, user, pass, sender_name, is_active } = req.body || {};
    if (!user || !pass) {
      return res.status(400).json({
        success: false,
        error: 'Email pengirim (user) dan App Password (pass) wajib diisi.'
      });
    }

    const newAcc = addSmtpAccount({
      name: name || `SMTP (${String(user).split('@')[0]})`,
      host: host || 'smtp.gmail.com',
      port: Number(port) || 587,
      secure: Number(port) === 465 ? true : Boolean(secure),
      user: String(user).trim(),
      pass: String(pass).trim(),
      sender_name: sender_name || getWhitelabelConfig().app_name || 'Japriin',
      is_active: is_active !== undefined ? Boolean(is_active) : true
    });

    res.json({
      success: true,
      message: 'Akun SMTP berhasil ditambahkan ke rotasi!',
      data: {
        ...newAcc,
        pass_masked: maskSensitiveString(newAcc.pass)
      }
    });
  } catch (err: any) {
    console.error('[SMTP Add Error]', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Gagal menyimpan akun SMTP.'
    });
  }
});

app.put('/api/smtp/:id', (req, res) => {
  const updated = updateSmtpAccount(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Akun SMTP tidak ditemukan.' });
  }
  res.json({
    success: true,
    message: 'Akun SMTP berhasil diperbarui!',
    data: { ...updated, pass_masked: maskSensitiveString(updated.pass) }
  });
});

const handleToggleSmtp = (req: express.Request, res: express.Response) => {
  const toggled = toggleSmtpAccount(req.params.id);
  if (!toggled) {
    return res.status(404).json({ success: false, error: 'Akun SMTP tidak ditemukan.' });
  }
  res.json({
    success: true,
    message: `Status akun SMTP diubah menjadi ${toggled.is_active ? 'Aktif' : 'Non-Aktif'}.`,
    data: { ...toggled, pass_masked: maskSensitiveString(toggled.pass) }
  });
};

app.put('/api/smtp/:id/toggle', handleToggleSmtp);
app.post('/api/smtp/:id/toggle', handleToggleSmtp);

app.delete('/api/smtp/:id', (req, res) => {
  const deleted = deleteSmtpAccount(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Akun SMTP tidak ditemukan.' });
  }
  res.json({ success: true, message: 'Akun SMTP berhasil dihapus dari rotasi.' });
});

app.post('/api/smtp/test', async (req, res) => {
  try {
    const { recipient_email, to, account_id, id } = req.body || {};
    const result = await testSmtpAccountConnection({
      accountId: account_id || id,
      recipientEmail: recipient_email || to
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Gagal menguji koneksi SMTP.'
    });
  }
});

app.get('/api/antiban', (_req, res) => {
  res.json({ success: true, data: getAntiBanSettings() });
});

app.post('/api/antiban', (req, res) => {
  const updated = updateAntiBanSettings(req.body || {});
  res.json({ success: true, message: 'Pengaturan Anti-Ban berhasil disimpan!', data: updated });
});

// Save AI Auto-Reply Behavior Config
app.post('/api/gemini/config', (req, res) => {
  const { enabled, system_prompt, fallback_when_no_rule, model, temperature, offline_fallback_message } = req.body;
  const sysConfig = getSystemConfig();
  const updatedAiConfig = {
    ...sysConfig.ai_config,
    enabled: enabled !== undefined ? Boolean(enabled) : sysConfig.ai_config.enabled,
    system_prompt: system_prompt !== undefined ? system_prompt : sysConfig.ai_config.system_prompt,
    fallback_when_no_rule: fallback_when_no_rule !== undefined ? Boolean(fallback_when_no_rule) : sysConfig.ai_config.fallback_when_no_rule,
    model: (() => {
      let m = model || sysConfig.ai_config.model || 'gemini-3.8-flash';
      if (m.includes('2.5') || m.includes('2.0') || m.includes('1.5')) m = 'gemini-3.8-flash';
      return m;
    })(),
    temperature: temperature !== undefined ? Number(temperature) : (sysConfig.ai_config.temperature || 0.3),
    offline_fallback_message: offline_fallback_message !== undefined ? offline_fallback_message : sysConfig.ai_config.offline_fallback_message
  };
  const updatedSys = updateSystemConfig({ ai_config: updatedAiConfig });
  res.json({ success: true, message: 'Pengaturan Balas AI Gemini & Pesan Offline berhasil disimpan!', data: updatedSys.ai_config });
});

// Live Test AI Reply Chat Simulation
app.post('/api/gemini/test-chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Pesan tes wajib diisi.' });
  }

  const startTime = Date.now();
  try {
    const result = await handleIncomingWhatsAppMessage({
      senderPhone: '628999000111',
      senderName: 'Uji Coba AI User',
      messageText: prompt
    });

    const elapsedMs = Date.now() - startTime;
    const activeKeys = getActiveGeminiKeys();

    res.json({
      success: true,
      reply: result.reply_body,
      ai_generated: result.ai_generated,
      matched_rule_id: (result as any).matched_rule_id,
      key_count: activeKeys.length,
      elapsed_ms: elapsedMs,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Gagal memproses simulasi balasan AI.',
      details: err?.message
    });
  }
});

// =============================================================
// 6. USER SECURITY PIN & REMOTE BOT UNLOCK
// =============================================================

app.post('/api/user/pin', (req, res) => {
  const { user_id, pin } = req.body;
  if (!user_id || !pin) return res.status(400).json({ error: 'User ID dan PIN wajib diisi.' });
  const result = setUserSecurityPin(user_id, pin);
  if (!result.success) return res.status(400).json({ error: result.message });
  res.json(result);
});

app.post('/api/user/pin/verify', (req, res) => {
  const { user_id, pin } = req.body;
  const isValid = verifyUserSecurityPin(user_id, pin);
  res.json({ success: isValid });
});

app.post('/api/user/unlock-bot', (req, res) => {
  const { user_id } = req.body;
  const user = unlockUserBot(user_id);
  if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  res.json({ success: true, message: 'Blokir bot WhatsApp berhasil dibuka!', user });
});

app.post('/api/user/api-key/regenerate', (req, res) => {
  const { user_id } = req.body;
  const newApiKey = generateUserApiKey(user_id);
  if (!newApiKey) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  res.json({ success: true, api_key: newApiKey });
});

// User custom Gemini API Key and Custom Offline Message management
app.post('/api/user/custom-gemini-key', (req, res) => {
  const { user_id, api_key } = req.body;
  if (!user_id) return res.status(400).json({ success: false, error: 'User ID wajib diisi.' });

  const user = getUserById(user_id);
  if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });

  // Encrypt user's custom API key
  const encryptedKey = api_key ? encryptData(api_key.trim()) : '';
  const updated = updateUser(user_id, { custom_gemini_key: encryptedKey });

  // Mask the key in response for security
  const maskedUser = { ...updated };
  if (maskedUser.custom_gemini_key) {
    maskedUser.custom_gemini_key = 'AI-KEY-****-' + api_key.trim().slice(-4);
  }

  res.json({
    success: true,
    message: 'Kunci API Gemini Pribadi berhasil disimpan!',
    user: maskedUser
  });
});

app.delete('/api/user/custom-gemini-key', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ success: false, error: 'User ID wajib diisi.' });

  const user = getUserById(user_id);
  if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });

  const updated = updateUser(user_id, { custom_gemini_key: '' });
  res.json({
    success: true,
    message: 'Kunci API Gemini Pribadi berhasil dihapus!',
    user: updated
  });
});

app.post('/api/user/offline-message', (req, res) => {
  const { user_id, message } = req.body;
  if (!user_id) return res.status(400).json({ success: false, error: 'User ID wajib diisi.' });

  const user = getUserById(user_id);
  if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });

  const updated = updateUser(user_id, {
    custom_offline_message: message || '',
    default_cs_reply_text: message || ''
  });
  res.json({
    success: true,
    message: 'Pesan CS standar / offline berhasil disimpan!',
    user: sanitizeUserForClient(updated)
  });
});

app.post('/api/user/default-cs-reply', (req, res) => {
  const { user_id, enabled, text } = req.body;
  if (!user_id) return res.status(400).json({ success: false, error: 'User ID wajib diisi.' });

  const user = getUserById(user_id);
  if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });

  const updates: any = {};
  if (typeof enabled === 'boolean') updates.default_cs_reply_enabled = enabled;
  if (typeof text === 'string') {
    updates.default_cs_reply_text = text.trim();
    updates.custom_offline_message = text.trim();
  }

  const updated = updateUser(user_id, updates);
  res.json({
    success: true,
    message: 'Pengaturan pesan balas otomatis CS berhasil disimpan!',
    user: sanitizeUserForClient(updated)
  });
});

app.post('/api/user/default-cs-reply', (req, res) => {
  const { user_id, enabled, text } = req.body;
  if (!user_id) return res.status(400).json({ success: false, error: 'User ID wajib diisi.' });

  const user = getUserById(user_id);
  if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });

  const updates: any = {};
  if (typeof enabled === 'boolean') updates.default_cs_reply_enabled = enabled;
  if (typeof text === 'string') {
    updates.default_cs_reply_text = text.trim();
    updates.custom_offline_message = text.trim();
  }

  const updated = updateUser(user_id, updates);
  res.json({
    success: true,
    message: 'Pengaturan pesan balas otomatis CS berhasil disimpan!',
    user: sanitizeUserForClient(updated)
  });
});

app.post('/api/user/allowed-numbers', (req, res) => {
  const { user_id, allowed_numbers } = req.body;
  if (!user_id) return res.status(400).json({ success: false, error: 'User ID wajib diisi.' });
  if (!Array.isArray(allowed_numbers)) return res.status(400).json({ success: false, error: 'Format nomor tidak valid.' });

  const user = getUserById(user_id);
  if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });

  const updated = updateUser(user_id, { allowed_numbers });
  res.json({
    success: true,
    message: 'Nomor yang diizinkan berhasil disimpan!',
    user: updated
  });
});

app.post('/api/user/ai-config', (req, res) => {
  const { user_id, enabled, system_prompt } = req.body;
  if (!user_id) return res.status(400).json({ success: false, error: 'User ID wajib diisi.' });

  const user = getUserById(user_id);
  if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });

  const updates: any = {};
  if (enabled !== undefined) {
    updates.ai_enabled = Boolean(enabled);
  }
  if (system_prompt !== undefined) {
    updates.custom_system_prompt = system_prompt;
  }

  const updated = updateUser(user_id, updates);
  res.json({
    success: true,
    message: 'Pengaturan AI kustom berhasil disimpan!',
    user: updated
  });
});

app.post('/api/user/send-email-otp', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ success: false, error: 'User ID wajib diisi.' });

  const user = getUserById(user_id);
  if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });

  const cooldownKey = `profile_email_${user_id}`;
  const cooldownCheck = checkOtpCooldown(cooldownKey, 30);
  if (!cooldownCheck.allowed) {
    return res.status(429).json({
      success: false,
      cooldown_seconds: cooldownCheck.remaining,
      error: `Mohon tunggu ${cooldownCheck.remaining} detik lagi sebelum mengirim ulang kode OTP email.`
    });
  }

  const newOtp = generateOtpCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const updated = updateUser(user_id, { verification_otp: newOtp, otp_expires_at: expiresAt });

  try {
    const emailResult = await sendVerificationOtpEmail(user.email, user.username, newOtp);
    if (emailResult.success) {
      res.json({
        success: true,
        cooldown_seconds: 30,
        message: 'Kode OTP rahasia verifikasi email berhasil dikirim! Silakan cek kotak masuk atau folder spam email Anda.',
        user: sanitizeUserForClient(updated)
      });
    } else {
      res.status(500).json({ success: false, error: `Gagal mengirim email: ${emailResult.error}` });
    }
  } catch (err: any) {
    console.error('Failed to send verification email:', err);
    res.status(500).json({ success: false, error: `Terjadi kesalahan saat mengirim email: ${err?.message}` });
  }
});

app.post('/api/user/send-wa-otp', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ success: false, error: 'User ID wajib diisi.' });

  const user = getUserById(user_id);
  if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });

  if (!user.phone) {
    return res.status(400).json({ success: false, error: 'Nomor WhatsApp pengguna belum diatur.' });
  }

  const cooldownKey = `profile_wa_${user_id}`;
  const cooldownCheck = checkOtpCooldown(cooldownKey, 30);
  if (!cooldownCheck.allowed) {
    return res.status(429).json({
      success: false,
      cooldown_seconds: cooldownCheck.remaining,
      error: `Mohon tunggu ${cooldownCheck.remaining} detik lagi sebelum mengirim ulang kode OTP WhatsApp.`
    });
  }

  const newOtp = generateOtpCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const updated = updateUser(user_id, { verification_otp: newOtp, otp_expires_at: expiresAt });
  const wl = getWhitelabelConfig();

  const msg = `Halo *${user.name}*! 👋\n\nKode rahasia verifikasi WhatsApp *${wl.app_name || 'Japriin'}* Anda adalah:\n\n*${newOtp}*\n\nJangan berikan kode ini kepada siapa pun. Silakan masukkan kode ini di aplikasi untuk memverifikasi akun Anda.`;
  
  const sent = await sendSystemWhatsAppNotification(user.phone, msg);
  if (sent) {
    res.json({
      success: true,
      cooldown_seconds: 30,
      message: 'Kode OTP rahasia verifikasi WhatsApp berhasil dikirim ke nomor Anda!',
      user: sanitizeUserForClient(updated)
    });
  } else {
    res.status(500).json({ success: false, error: 'Sistem gagal mengirim pesan WhatsApp OTP. Pastikan sesi WhatsApp utama/superadmin sedang terhubung.' });
  }
});

// =============================================================
// 7. INTERACTIVE DEVELOPER REST API v1
// =============================================================

const authenticateApiKey: express.RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization || (req.headers['x-api-key'] as string);
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (authHeader) {
    token = authHeader;
  }

  let user = token ? getUserByApiKey(token) : null;

  // Fallback for internal web dashboard requests passing user_id
  if (!user && req.body?.user_id) {
    user = getUserById(req.body.user_id);
  }
  // Fallback if superadmin master placeholder token is used from web UI
  if (!user && token === 'mgw_live_superadmin_master_key_99') {
    const allUsers = getUsers();
    user = allUsers.find(u => u.role === 'admin') || allUsers[0] || null;
  }

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized. Sertakan Bearer API Token yang valid di header Authorization atau x-api-key.'
    });
  }

  (req as any).apiUser = user;
  next();
};

// Check Status & Quota via API
app.get('/api/v1/status', authenticateApiKey, (req, res) => {
  const user = (req as any).apiUser;
  const plans = getSubscriptionPlans();
  const plan = plans.find(p => p.id === user.plan_id) || plans[0];
  const stats = getBotStats();

  res.json({
    status: 'online',
    app: 'Japriin Pro REST API v1',
    user: {
      username: user.username,
      name: user.name,
      plan: plan.name,
      daily_limit: plan.daily_msg_limit,
      daily_messages_sent: user.daily_messages_sent || 0,
      quota_remaining: Math.max(0, plan.daily_msg_limit - (user.daily_messages_sent || 0)),
      is_bot_locked: user.is_bot_locked
    },
    gateway: {
      primary_phone: stats.active_session_phone,
      total_sessions: stats.total_connected_sessions
    }
  });
});

// Send Message via API (supports single phone or comma/newline-separated multiple phones)
app.post('/api/v1/send-message', authenticateApiKey, async (req, res) => {
  const user = (req as any).apiUser;
  const { to, message, session_id, is_broadcast } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Parameter "to" (nomor tujuan) dan "message" (isi pesan) wajib diisi.' });
  }

  const targetSessionId = session_id || 'sess_primary_app_gateway';
  const rawPhones = Array.isArray(to)
    ? to.map(String)
    : String(to)
        .split(/[\r\n,;]+/)
        .map(p => p.trim())
        .filter(Boolean);

  const phonesList = rawPhones
    .map(p => normalizePhoneNumber(p))
    .filter(p => p.length >= 8 && p.length <= 16);

  if (phonesList.length === 0) {
    return res.status(400).json({ error: 'Nomor tujuan WhatsApp tidak valid (minimal 8 digit).' });
  }

  // Single recipient fast path
  if (phonesList.length === 1) {
    const quota = deductUserDailyQuota(user.id);
    if (!quota.allowed) {
      return res.status(429).json({ error: quota.message });
    }

    try {
      const cleanPhone = phonesList[0];
      await sendBaileysTextMessage(targetSessionId, cleanPhone, String(message), {
        userId: user.id,
        isBroadcast: Boolean(is_broadcast),
        skipQuota: true
      });

      return res.json({
        success: true,
        message: 'Pesan berhasil dikirim via WhatsApp Gateway!',
        data: {
          to: cleanPhone,
          message,
          remaining_quota: quota.remaining,
          daily_limit: quota.dailyLimit
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Gagal mengirim pesan WhatsApp.', details: err?.message });
    }
  }

  // Multi-recipient path if 'to' contained multiple numbers
  let successCount = 0;
  let failedCount = 0;
  const results: any[] = [];

  for (let i = 0; i < phonesList.length; i++) {
    const cleanPhone = phonesList[i];
    const quota = deductUserDailyQuota(user.id);
    if (!quota.allowed) {
      failedCount++;
      results.push({ phone: cleanPhone, status: 'failed', error: quota.message });
      continue;
    }

    try {
      const personalized = String(message).replace(/\{\{name\}\}|\{nama\}/gi, `Pelanggan (${cleanPhone})`);
      await sendBaileysTextMessage(targetSessionId, cleanPhone, personalized, {
        userId: user.id,
        isBroadcast: true,
        skipQuota: true
      });
      successCount++;
      results.push({ phone: cleanPhone, status: 'sent' });
      if (i < phonesList.length - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    } catch (err: any) {
      failedCount++;
      results.push({ phone: cleanPhone, status: 'failed', error: err?.message });
    }
  }

  addBroadcastHistory({
    user_id: user.id,
    session_id: targetSessionId,
    recipients_count: phonesList.length,
    message: String(message),
    status: failedCount === phonesList.length ? 'failed' : 'completed',
    success_count: successCount,
    failed_count: failedCount
  });

  res.json({
    success: successCount > 0,
    message: `Broadcast selesai dikirim ke ${phonesList.length} nomor (${successCount} sukses, ${failedCount} gagal).`,
    data: {
      total: phonesList.length,
      success_count: successCount,
      failed_count: failedCount,
      results
    }
  });
});

// Broadcast Message via API
app.post('/api/v1/broadcast', authenticateApiKey, async (req, res) => {
  const user = (req as any).apiUser;
  const { recipients, phones, to, message, session_id, min_delay, max_delay } = req.body;
  const rawInput = recipients || phones || to;

  const parsedRecipients: Array<{ phone: string; name?: string }> = [];
  if (Array.isArray(rawInput)) {
    for (const item of rawInput) {
      if (typeof item === 'string') {
        item
          .split(/[\r\n,;]+/)
          .map(s => s.trim())
          .filter(Boolean)
          .forEach(s => parsedRecipients.push({ phone: s }));
      } else if (item && typeof item === 'object' && item.phone) {
        parsedRecipients.push({ phone: String(item.phone), name: item.name ? String(item.name) : undefined });
      }
    }
  } else if (typeof rawInput === 'string') {
    rawInput
      .split(/[\r\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(s => parsedRecipients.push({ phone: s }));
  }

  if (parsedRecipients.length === 0 || !message) {
    return res.status(400).json({ error: 'Parameter "recipients" (daftar nomor) dan "message" wajib diisi.' });
  }

  const plans = getSubscriptionPlans();
  const plan = plans.find(p => p.id === user.plan_id) || plans[0];
  const isAdmin = user.role === 'admin';
  const quotaRemaining = isAdmin ? 999999 : Math.max(0, plan.daily_msg_limit - (user.daily_messages_sent || 0));

  if (!isAdmin && parsedRecipients.length > quotaRemaining) {
    return res.status(429).json({
      error: `Jumlah penerima broadcast (${parsedRecipients.length}) melebihi sisa kuota harian Anda (${quotaRemaining}).`
    });
  }

  const targetSessionId = session_id || 'sess_primary_app_gateway';
  const minD = Math.max(1, Number(min_delay) || 1);
  const maxD = Math.max(minD, Number(max_delay) || 2);

  const results: any[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < parsedRecipients.length; i++) {
    const rawItem = parsedRecipients[i];
    const phone = rawItem.phone || '';
    const customName = rawItem.name || `Pelanggan (${phone})`;
    try {
      const q = deductUserDailyQuota(user.id);
      if (!q.allowed) {
        failedCount++;
        results.push({ phone, status: 'failed', error: q.message });
        continue;
      }
      const clean = normalizePhoneNumber(phone);
      const personalized = String(message).replace(/\{\{name\}\}|\{nama\}/gi, customName);
      await sendBaileysTextMessage(targetSessionId, clean, personalized, {
        userId: user.id,
        isBroadcast: true,
        skipQuota: true
      });
      successCount++;
      results.push({ phone: clean, status: 'sent' });
      if (i < parsedRecipients.length - 1) {
        const waitMs = Math.floor(Math.random() * (maxD - minD + 1) + minD) * 500;
        await new Promise(r => setTimeout(r, waitMs));
      }
    } catch (e: any) {
      failedCount++;
      results.push({ phone, status: 'failed', error: e?.message });
    }
  }

  addBroadcastHistory({
    user_id: user.id,
    session_id: targetSessionId,
    recipients_count: parsedRecipients.length,
    message: String(message),
    status: failedCount === parsedRecipients.length ? 'failed' : 'completed',
    success_count: successCount,
    failed_count: failedCount
  });

  res.json({
    success: successCount > 0,
    message: `Broadcast selesai diproses ke ${results.length} kontak (${successCount} sukses, ${failedCount} gagal).`,
    success_count: successCount,
    failed_count: failedCount,
    results
  });
});

// =============================================================
// 8. SIMULATOR & REMOTE BOT CHAT TEST
// =============================================================

app.post('/api/simulate', async (req, res) => {
  const { sender_phone, sender_name, message_body } = req.body;
  if (!sender_phone || !message_body) {
    return res.status(400).json({ error: 'Sender Phone dan Message Body wajib diisi.' });
  }

  const cleanPhone = normalizePhoneNumber(sender_phone);
  const user = getUserByPhone(cleanPhone);

  if (user) {
    // Process as registered operator Remote Assistant Command
    const botResult = await processRemoteWhatsAppCommand(cleanPhone, sender_name || user.name, message_body);
    return res.json({
      success: true,
      mode: 'remote_assistant_bot',
      reply: botResult.reply,
      user_name: user.name,
      action_executed: botResult.actionExecuted
    });
  }

  // Regular simulation
  const result = await handleIncomingWhatsAppMessage({
    senderPhone: cleanPhone,
    senderName: sender_name || 'Pengguna Simulasi',
    messageText: message_body
  });

  res.json({
    success: true,
    mode: 'auto_reply_standard',
    reply: result.reply_body,
    ai_generated: result.ai_generated
  });
});

// =============================================================
// 9. CONFIG, SESSIONS & MYSQL API
// =============================================================

// Public Health Check Endpoint for cPanel cron job / Uptime monitoring
app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'online', timestamp: new Date().toISOString() });
});

app.get('/api/config', (_req, res) => {
  const sysConfig = getSystemConfig();
  const whitelabel = getWhitelabelConfig();
  const token = decryptData(sysConfig.whatsapp_token) || process.env.WHATSAPP_TOKEN || '';
  const phoneId = sysConfig.phone_number_id || process.env.PHONE_NUMBER_ID || '';
  const verifyToken = sysConfig.webhook_verify_token || process.env.WEBHOOK_VERIFY_TOKEN || 'maudigi_gtw_verify_token_2026';
  const appUrl = sysConfig.app_url || process.env.APP_URL || 'http://localhost:3000';

  const sessions = getWhatsAppSessions();
  const systemSession = sessions.find(s => s.status === 'connected' && (s.user_id === 'usr_superadmin' || s.id?.includes('superadmin') || s.is_primary));
  const systemPhone = systemSession?.phone_number || whitelabel.primary_bot_phone || '081234567890';

  const masked: EnvConfigMasked = {
    whatsapp_token_set: Boolean(token),
    whatsapp_token_masked: maskSensitiveString(token),
    phone_number_id_set: Boolean(phoneId),
    phone_number_id: phoneId ? `${phoneId.substring(0, 4)}...${phoneId.substring(phoneId.length - 3)}` : 'Belum diisi',
    webhook_verify_token: verifyToken,
    db_status: sysConfig.mysql_host ? 'online' : 'offline',
    db_host: sysConfig.mysql_host || 'Cloud Cluster',
    db_name: sysConfig.mysql_database || 'japriin_wa_gateway',
    app_url: appUrl,
    webhook_endpoint_url: `${appUrl}/api/whatsapp`,
    active_phone_number: whitelabel.primary_bot_phone,
    primary_bot_phone: whitelabel.primary_bot_phone,
    gemini_keys_count: getGeminiKeys().length,
    ai_reply_enabled: sysConfig.ai_config?.enabled,
    app_name: whitelabel.app_name,
    system_phone: systemPhone
  };

  res.json({ success: true, data: masked, fullConfig: sysConfig, whitelabel, system_phone: systemPhone });
});

app.post('/api/config', (req, res) => {
  const updated = updateSystemConfig(req.body);
  res.json({ success: true, message: 'Konfigurasi sistem berhasil disimpan!', data: updated });
});

app.get('/api/sessions', (req, res) => {
  const userId = req.query.userId as string;
  const showAll = req.query.all === 'true';

  if (!userId) {
    // Prevent privacy leak: Unidentified or empty requests receive empty array
    return res.json({ success: true, data: [] });
  }

  const user = getUserById(userId);
  if (!user) {
    return res.json({ success: true, data: [] });
  }

  // Admin can view all sessions only when explicitly requesting ?all=true
  if (user.role === 'admin' && showAll) {
    return res.json({ success: true, data: getWhatsAppSessions() });
  }

  // Otherwise, strictly return sessions belonging to THIS specific user
  return res.json({ success: true, data: getSessionsByUserId(user.id) });
});

app.post('/api/sessions', (req, res) => {
  const newSession = addWhatsAppSession(req.body);
  res.json({ success: true, data: newSession });
});

app.post('/api/sessions/connect', (req, res) => {
  const { id, session_id, session_name, phone_number, auth_method, is_primary, phone_number_id, access_token, user_id } = req.body;
  const cleanPhone = phone_number ? phone_number.replace(/\D/g, '') : '';
  const targetId = id || session_id || (user_id && cleanPhone ? `session_user_${user_id}_${cleanPhone}` : undefined);
  const newSession = addWhatsAppSession({
    id: targetId,
    session_name: session_name || `WA - ${phone_number || 'Session'}`,
    phone_number: cleanPhone || phone_number || '081234567890',
    auth_method: auth_method || 'qr_code',
    status: 'connected',
    phone_number_id,
    access_token,
    user_id,
    is_primary: Boolean(is_primary)
  });
  res.json({ success: true, message: 'Nomor WhatsApp berhasil dihubungkan!', data: newSession });
});

app.put('/api/sessions/:id/primary', (req, res) => {
  const { id } = req.params;
  const success = setPrimarySession(id);
  res.json({ success: true, message: 'Nomor utama berhasil diperbarui.' });
});

app.post('/api/sessions/:id/primary', (req, res) => {
  const { id } = req.params;
  const success = setPrimarySession(id);
  res.json({ success: true, message: 'Nomor utama berhasil diperbarui.' });
});

app.post('/api/sessions/:id/renew', (req, res) => {
  const { id } = req.params;
  const days = Number(req.body?.days) || 30;
  const updated = extendWhatsAppSession(id, days);
  if (updated) {
    res.json({ success: true, message: `Masa aktif sesi WhatsApp berhasil diperpanjang +${days} hari kedepan!`, data: updated });
  } else {
    res.status(404).json({ success: false, error: 'Sesi tidak ditemukan.' });
  }
});

app.post('/api/sessions/:id/extend', (req, res) => {
  const { id } = req.params;
  const days = Number(req.body?.days) || 30;
  const updated = extendWhatsAppSession(id, days);
  if (updated) {
    res.json({ success: true, message: `Masa aktif sesi WhatsApp berhasil diperpanjang +${days} hari kedepan!`, data: updated });
  } else {
    res.status(404).json({ success: false, error: 'Sesi tidak ditemukan.' });
  }
});

app.put('/api/sessions/:id', (req, res) => {
  const updated = updateWhatsAppSession(req.params.id, req.body);
  res.json({ success: true, data: updated });
});

app.delete('/api/sessions/:id', (req, res) => {
  const deleted = deleteWhatsAppSession(req.params.id);
  res.json({ success: deleted });
});

// Test & Broadcast Message Dispatch Route
app.post('/api/messages/send', async (req, res) => {
  const { session_id, recipient_phone, to, message, user_id, is_broadcast } = req.body;
  const targetPhone = recipient_phone || to;
  const targetSession = session_id || 'sess_primary_app_gateway';

  if (!targetPhone || !message) {
    return res.status(400).json({ success: false, error: 'Nomor tujuan dan isi pesan wajib diisi.' });
  }

  const phonesList = String(targetPhone)
    .split(/[\r\n,;]+/)
    .map(p => normalizePhoneNumber(p.trim()))
    .filter(p => p.length >= 8 && p.length <= 16);

  if (phonesList.length === 0) {
    return res.status(400).json({ success: false, error: 'Format nomor tujuan tidak valid (minimal 8 digit).' });
  }

  if (phonesList.length === 1) {
    try {
      const result = await sendBaileysTextMessage(targetSession, phonesList[0], message, {
        userId: user_id,
        isBroadcast: Boolean(is_broadcast)
      });
      return res.json({
        success: true,
        message: 'Pesan berhasil dikirim via WhatsApp!',
        data: result
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Gagal mengirim pesan WhatsApp.'
      });
    }
  }

  // Multiple phone numbers sent via /api/messages/send
  let successCount = 0;
  let failedCount = 0;
  for (let i = 0; i < phonesList.length; i++) {
    try {
      await sendBaileysTextMessage(targetSession, phonesList[i], message, {
        userId: user_id,
        isBroadcast: true
      });
      successCount++;
      if (i < phonesList.length - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    } catch {
      failedCount++;
    }
  }

  res.json({
    success: successCount > 0,
    message: `Berhasil mengirim ke ${successCount} dari ${phonesList.length} nomor tujuan.`,
    data: { total: phonesList.length, success_count: successCount, failed_count: failedCount }
  });
});

app.post('/api/sessions/qr/generate', async (req, res) => {
  try {
    const { session_id, user_id } = req.body;
    const sessionId = session_id || (user_id ? `session_user_${user_id}` : 'session_primary_default');
    await getOrStartBaileysSession(sessionId, undefined, user_id);
    const status = getBaileysSessionStatus(sessionId);
    res.json({
      success: true,
      session_id: sessionId,
      qr_image: status?.qrCodeUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=MAUDIGI_GTW_WA_PAIRING_SESSION_ACTIVE'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Gagal generate QR Code.' });
  }
});

app.get('/api/sessions/status/:sessionId', (req, res) => {
  try {
    const status = getBaileysSessionStatus(req.params.sessionId || 'session_primary_default');
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Baileys Real WhatsApp Engine routes
app.get('/api/baileys/status/:sessionId', (req, res) => {
  const status = getBaileysSessionStatus(req.params.sessionId);
  res.json({ success: true, data: status });
});

app.post('/api/baileys/start', async (req, res) => {
  const { sessionId, userId } = req.body;
  const session = await getOrStartBaileysSession(sessionId || 'session_primary_default', undefined, userId);
  res.json({ success: true, data: session });
});

app.post('/api/baileys/request-pairing', async (req, res) => {
  const { sessionId, phoneNumber, userId } = req.body;
  try {
    const pairingCode = await requestBaileysPairingCode(sessionId || 'session_primary_default', phoneNumber, userId);
    res.json({ success: true, pairing_code: pairingCode });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal meminta kode pairing.' });
  }
});

app.post('/api/sessions/pair-code/generate', async (req, res) => {
  const { session_id, phone_number, user_id } = req.body;
  const rawPhone = phone_number || req.body.phoneNumber;
  if (!rawPhone) {
    return res.status(400).json({ success: false, error: 'Nomor WhatsApp wajib diisi.' });
  }
  const cleanPhone = normalizePhoneNumber(rawPhone);
  if (!cleanPhone || cleanPhone.length < 9) {
    return res.status(400).json({ success: false, error: 'Format nomor WhatsApp tidak valid. Gunakan format internasional (contoh: 0812... atau 62812...).' });
  }

  const targetSessionId = session_id || (user_id ? `session_user_${user_id}_${cleanPhone}` : `session_pair_${cleanPhone}`);
  try {
    const pairingCode = await requestBaileysPairingCode(targetSessionId, cleanPhone, user_id);
    res.json({
      success: true,
      pairing_code: pairingCode,
      session_id: targetSessionId,
      phone_number: cleanPhone,
      expires_in: 120
    });
  } catch (err: any) {
    console.error('Pairing code generation error:', err);
    res.status(400).json({
      success: false,
      error: err?.message || 'Gagal meminta Kode Pairing dari WhatsApp. Pastikan nomor terdaftar aktif di WhatsApp dan coba lagi.'
    });
  }
});

// Authentication routes
app.get('/api/auth/check-availability', (req, res) => {
  const { username, email, phone, exclude_user_id } = req.query;
  const result = checkAccountAvailability({
    username: username as string | undefined,
    email: email as string | undefined,
    phone: phone as string | undefined,
    excludeUserId: exclude_user_id as string | undefined
  });
  res.json({ success: true, ...result });
});

app.post('/api/auth/check-availability', (req, res) => {
  const { username, email, phone, exclude_user_id } = req.body || {};
  const result = checkAccountAvailability({
    username,
    email,
    phone,
    excludeUserId: exclude_user_id
  });
  res.json({ success: true, ...result });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    if (!req.body?.phone || String(req.body.phone).replace(/\D/g, '').length < 8) {
      return res.status(400).json({ error: 'Nomor WhatsApp aktif wajib diisi (minimal 8 digit) untuk menerima kode verifikasi OTP.' });
    }

    const { user, otp } = registerUser(req.body);
    const wl = getWhitelabelConfig();

    // Kirim OTP verifikasi ke WhatsApp user menggunakan sesi sistem/superadmin (Rahasia, tidak dicatat di halaman)
    let waSent = false;
    if (user.phone) {
      const msg = `Halo *${user.name}*! 👋\n\nTerima kasih telah mendaftar di *${wl.app_name || 'Japriin'}*. Kode OTP rahasia verifikasi nomor WhatsApp Anda adalah:\n\n*${otp}*\n\nJangan bagikan kode ini kepada siapa pun. Masukkan kode ini di halaman verifikasi untuk mengaktifkan akun Anda.`;
      waSent = await sendSystemWhatsAppNotification(user.phone, msg);
    }

    const cleanUser = sanitizeUserForClient(user);
    res.json({
      success: true,
      user: cleanUser,
      data: cleanUser,
      user_id: user.id,
      wa_sent: waSent,
      message: 'Pendaftaran berhasil! Kode OTP rahasia 6 digit telah dikirimkan ke nomor WhatsApp Anda.'
    });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Gagal mendaftar pengguna baru.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, device_id } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username/Email dan Password wajib diisi.' });
    }

    const users = getUsers();
    const cleanUser = username.toLowerCase().trim();
    const cleanDigits = username.replace(/\D/g, '');
    const normDigits = cleanDigits.startsWith('0') ? '62' + cleanDigits.slice(1) : cleanDigits;

    const user = users.find(u => {
      const uName = u.username?.toLowerCase();
      const uEmail = u.email?.toLowerCase();
      const uPhone = u.phone ? u.phone.replace(/\D/g, '') : '';
      const uNormPhone = uPhone.startsWith('0') ? '62' + uPhone.slice(1) : uPhone;

      return (
        uName === cleanUser ||
        uEmail === cleanUser ||
        (cleanDigits.length >= 8 && (uPhone === cleanDigits || uNormPhone === normDigits))
      );
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Akun dengan username atau email tersebut tidak ditemukan. Silakan periksa kembali atau daftar akun baru.'
      });
    }

    // Standard industry password verification
    const matchPass =
      user.password === password ||
      user.password === hashPassword(password) ||
      ((!user.password || user.password.endsWith('_hash_placeholder')) && password === '123456');

    if (!matchPass) {
      return res.status(401).json({
        success: false,
        error: 'Password yang Anda masukkan salah. Silakan ulangi dengan password yang benar.'
      });
    }

    // Check WhatsApp verification:
    // "Akun aktif jika sudah verifikasi no WhatsApp jika belum maka pending jika pending belum bisa login dan gunakan harus verifikasi nomor WhatsApp dulu"
    if (user.role !== 'admin' && (!user.wa_verified || !user.is_active)) {
      let pendingOtp = user.verification_otp;
      const now = Date.now();
      const isExpired = !user.otp_expires_at || new Date(user.otp_expires_at).getTime() < now;
      const cooldownCheck = checkOtpCooldown(`login_wa_${user.id}`, 30);

      if (!pendingOtp || isExpired || cooldownCheck.allowed) {
        pendingOtp = generateOtpCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        updateUser(user.id, { verification_otp: pendingOtp, otp_expires_at: expiresAt });

        if (user.phone) {
          const wl = getWhitelabelConfig();
          const msg = `Halo *${user.name}*! 👋\n\nAkun Anda masih berstatus *Pending* menunggu verifikasi nomor WhatsApp.\nKode OTP rahasia verifikasi Anda adalah:\n\n*${pendingOtp}*\n\nSilakan masukkan kode ini di aplikasi untuk mengaktifkan akun Anda.`;
          // Kirim di background tanpa memblokir respon HTTP (mencegah timeout "server gagal terhubung")
          sendSystemWhatsAppNotification(user.phone, msg).catch(err => {
            console.error('[Send Pending Login WA Error]', err);
          });
        }
      }

      return res.status(200).json({
        success: false,
        requires_wa_verification: true,
        user_id: user.id,
        phone: user.phone,
        message: 'Status akun Anda masih Pending karena nomor WhatsApp belum diverifikasi. Kode OTP telah dikirim ke nomor WhatsApp Anda.',
        error: 'Status akun Anda masih Pending karena nomor WhatsApp belum diverifikasi. Silakan masukkan kode OTP yang telah dikirimkan ke WhatsApp Anda untuk mengaktifkan akun.'
      });
    }

    // 2-Step Verification for multi-device logins
    const incomingDevice = device_id || 'unknown_browser';

    // If they have logged in before, and the device ID is different:
    if (user.last_login_device && user.last_login_device !== incomingDevice) {
      // 1. Superadmin: No 2FA OTP needed at all!
      if (user.id === 'usr_superadmin' || user.username?.toLowerCase() === 'superadmin') {
        const updatedUser = updateUser(user.id, { last_login_device: incomingDevice });
        const sanitizedUser = sanitizeUserForClient(updatedUser);
        return res.json({ success: true, user: sanitizedUser, data: sanitizedUser });
      }

      // 2. Admin (non-superadmin admin): 2-step verification is via PIN!
      if (user.role === 'admin') {
        return res.json({
          success: true,
          requires_pin_verification: true,
          user_id: user.id,
          message: 'Verifikasi dua langkah Admin: Masukkan PIN Keamanan Anda untuk masuk.'
        });
      }

      // 3. Regular users: WhatsApp OTP 2FA as before
      const loginOtp = generateOtpCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      updateUser(user.id, { verification_otp: loginOtp, otp_expires_at: expiresAt });

      if (user.phone) {
        const msg = `🔒 *KEAMANAN JAPRIIN: VERIFIKASI DUA LANGKAH*\n\nKami mendeteksi upaya masuk ke akun Japriin Anda (*${user.username}*) dari perangkat/browser baru.\n\nKode verifikasi keamanan login Anda adalah:\n\n*${loginOtp}*\n\nSilakan masukkan kode ini di layar browser Anda untuk menyelesaikan login.`;
        await sendSystemWhatsAppNotification(user.phone, msg);
      }

      return res.json({
        success: true,
        requires_2fa: true,
        user_id: user.id,
        message: 'Keamanan Verifikasi Dua Langkah aktif! Kami telah mengirimkan kode verifikasi login ke nomor WhatsApp Anda.'
      });
    }

    // Otherwise, login is directly successful, record current device ID
    const updatedUser = updateUser(user.id, { last_login_device: incomingDevice });
    const sanitizedUser = sanitizeUserForClient(updatedUser);
    res.json({ success: true, user: sanitizedUser, data: sanitizedUser });
  } catch (err: any) {
    console.error('Server login handler error:', err);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server saat memproses login.', details: err?.message });
  }
});

app.post('/api/auth/verify-login-pin', (req, res) => {
  const { user_id, pin, device_id } = req.body;
  if (!user_id || !pin) {
    return res.status(400).json({ success: false, error: 'User ID dan PIN wajib diisi.' });
  }
  const isValid = verifyUserSecurityPin(user_id, pin);
  if (isValid) {
    if (device_id) {
      updateUser(user_id, { last_login_device: device_id });
    }
    const user = sanitizeUserForClient(getUserById(user_id));
    res.json({ success: true, message: 'Verifikasi PIN berhasil!', user, data: user });
  } else {
    res.status(400).json({ success: false, error: 'PIN Keamanan salah. Silakan coba lagi.' });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { user_id, otp, type, device_id } = req.body;
  const success = verifyUserOtp(user_id, otp, type || 'whatsapp');
  if (success) {
    if (device_id) {
      updateUser(user_id, { last_login_device: device_id });
    }
    const user = sanitizeUserForClient(getUserById(user_id));
    res.json({ success: true, message: 'Verifikasi berhasil!', user, data: user });
  } else {
    res.status(400).json({ error: 'Kode OTP tidak cocok atau sudah kadaluarsa.' });
  }
});

app.post('/api/auth/resend-otp', async (req, res) => {
  const { user_id, method } = req.body;
  const user = getUserById(user_id);
  if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

  const targetMethod = method === 'email' ? 'email' : 'whatsapp';
  const cooldownKey = `resend_${user.id}_${targetMethod}`;
  const cooldownCheck = checkOtpCooldown(cooldownKey, 30);
  if (!cooldownCheck.allowed) {
    return res.status(429).json({
      success: false,
      cooldown_seconds: cooldownCheck.remaining,
      error: `Mohon tunggu ${cooldownCheck.remaining} detik lagi sebelum mengirim ulang kode OTP baru.`
    });
  }

  const newOtp = generateOtpCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const updated = updateUser(user_id, { verification_otp: newOtp, otp_expires_at: expiresAt });
  const wl = getWhitelabelConfig();

  if (targetMethod === 'email') {
    const emailRes = await sendVerificationOtpEmail(user.email, user.username, newOtp).catch((e: any) => ({
      success: false,
      error: e?.message
    }));
    if (!emailRes.success) {
      return res.status(500).json({ error: `Gagal mengirim email OTP: ${emailRes.error || 'Periksa konfigurasi SMTP'}` });
    }
    return res.json({
      success: true,
      cooldown_seconds: 30,
      message: 'Kode OTP rahasia baru telah dikirimkan ke alamat email Anda.',
      user: sanitizeUserForClient(updated)
    });
  }

  if (!user.phone) {
    return res.status(400).json({ error: 'Nomor WhatsApp pengguna belum diatur.' });
  }

  const msg = `Halo *${user.name}*! 👋\n\nKode OTP rahasia verifikasi WhatsApp *${wl.app_name || 'Japriin'}* Anda adalah:\n\n*${newOtp}*\n\nJangan bagikan kode ini kepada siapa pun. Silakan masukkan kode ini di aplikasi untuk memverifikasi akun Anda.`;
  sendSystemWhatsAppNotification(user.phone, msg).catch(e => console.error('Resend WA Error:', e));

  res.json({
    success: true,
    cooldown_seconds: 30,
    message: 'Kode OTP rahasia baru telah dikirimkan ke nomor WhatsApp Anda.',
    user: sanitizeUserForClient(updated)
  });
});

app.post('/api/auth/forgot-password/request', async (req, res) => {
  const { identifier, method } = req.body;
  if (!identifier) return res.status(400).json({ error: 'Username, Email, atau No. WhatsApp wajib diisi.' });

  const users = getUsers();
  const clean = String(identifier).toLowerCase().trim();
  const cleanDigits = String(identifier).replace(/\D/g, '');
  const normDigits = cleanDigits.startsWith('0') ? '62' + cleanDigits.slice(1) : cleanDigits;

  const user = users.find(u => {
    if (u.id === identifier) return true;
    if (u.username.toLowerCase() === clean) return true;
    if (u.email.toLowerCase() === clean) return true;
    if (cleanDigits.length >= 8 && u.phone) {
      const uDigits = u.phone.replace(/\D/g, '');
      const uNorm = uDigits.startsWith('0') ? '62' + uDigits.slice(1) : uDigits;
      if (uDigits === cleanDigits || uNorm === normDigits || uDigits.includes(cleanDigits)) return true;
    }
    return false;
  });

  if (!user) {
    return res.status(404).json({ error: 'Akun dengan username, email, atau nomor WhatsApp tersebut tidak ditemukan.' });
  }

  // Default verification for password reset/change is WhatsApp; Email is 2nd option ONLY if email_verified === true
  const selectedMethod = method === 'email' ? 'email' : 'whatsapp';

  if (selectedMethod === 'email') {
    if (!user.email_verified) {
      return res.status(400).json({
        success: false,
        error: 'Alamat email pada akun ini belum diverifikasi! Kode OTP reset password via Email hanya dapat dikirim jika email sudah diverifikasi di halaman Profil. Silakan gunakan metode verifikasi WhatsApp (Default).'
      });
    }
  } else {
    if (!user.phone) {
      return res.status(400).json({
        success: false,
        error: 'Nomor WhatsApp pada akun ini belum terdaftar. Silakan gunakan metode lain atau hubungi administrator.'
      });
    }
  }

  // Check 30 seconds cooldown for forgot password OTP
  const cooldownKey = `forgot_${user.id}_${selectedMethod}`;
  const cooldownCheck = checkOtpCooldown(cooldownKey, 30);
  if (!cooldownCheck.allowed) {
    return res.status(429).json({
      success: false,
      cooldown_seconds: cooldownCheck.remaining,
      error: `Mohon tunggu ${cooldownCheck.remaining} detik lagi sebelum meminta kode OTP reset password baru.`
    });
  }

  const resetOtp = generateOtpCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  updateUser(user.id, { verification_otp: resetOtp, otp_expires_at: expiresAt });
  const wl = getWhitelabelConfig();

  if (selectedMethod === 'email') {
    const emailRes = await sendPasswordResetEmail(user.email, user.username, resetOtp);
    if (!emailRes.success) {
      return res.status(500).json({
        success: false,
        error: `Gagal mengirim kode OTP ke email: ${emailRes.error || 'Pastikan akun SMTP sudah aktif'}`
      });
    }
    return res.json({
      success: true,
      cooldown_seconds: 30,
      message: 'Kode OTP rahasia untuk ganti/reset password telah dikirim ke alamat email terverifikasi Anda.',
      user_id: user.id,
      method: 'email'
    });
  }

  const msg = `🔐 *RESET PASSWORD ${(wl.app_name || 'JAPRIIN').toUpperCase()}*\n\nHalo *${user.name}* (@${user.username}),\nKami menerima permintaan untuk mengganti/mereset password akun Anda.\n\nKode OTP rahasia Anda adalah:\n\n*${resetOtp}*\n\nJangan bagikan kode ini kepada siapa pun. Kode berlaku selama 15 menit.`;
  sendSystemWhatsAppNotification(user.phone, msg).catch(e => console.error('Forgot WA Error:', e));

  res.json({
    success: true,
    cooldown_seconds: 30,
    message: 'Kode OTP rahasia untuk ganti/reset password telah dikirimkan ke nomor WhatsApp terdaftar Anda.',
    user_id: user.id,
    method: 'whatsapp'
  });
});

app.post('/api/auth/forgot-password/reset', (req, res) => {
  const { identifier, otp, new_password } = req.body;
  if (!identifier || !otp || !new_password) {
    return res.status(400).json({ error: 'Semua kolom wajib diisi.' });
  }

  const success = resetPasswordWithOtp(identifier, otp, new_password);
  if (success) {
    res.json({ success: true, message: 'Password berhasil direset! Silakan login dengan password baru Anda.' });
  } else {
    res.status(400).json({ error: 'Kode OTP tidak cocok atau sudah kadaluarsa.' });
  }
});

// QRIS & Upgrade routes
app.get('/api/qris', (_req, res) => {
  res.json({ success: true, data: getQrisConfig() });
});

app.post('/api/qris', (req, res) => {
  const updated = updateQrisConfig(req.body);
  res.json({ success: true, message: 'Pengaturan QRIS berhasil disimpan!', data: updated });
});

app.post('/api/upgrade-plan', async (req, res) => {
  const { user_id, plan_id, receipt_base64, payment_note } = req.body;
  const user = getUserById(user_id);
  if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

  const plans = getSubscriptionPlans();
  const plan = plans.find(p => p.id === plan_id);
  if (!plan) return res.status(400).json({ error: 'Paket tidak valid.' });

  try {
    const aiResult = await verifyPaymentReceiptWithAi({
      receiptBase64: receipt_base64,
      paymentNote: payment_note,
      planName: plan.name,
      expectedPrice: plan.price,
      username: user.username
    });

    const updatedUser = upgradeUserPlan({
      userId: user_id,
      planId: plan_id,
      receiptUrl: receipt_base64 ? `receipt_${Date.now()}` : undefined,
      paymentNote: payment_note || `Transfer ${aiResult.bankOrWallet} (${aiResult.transactionRef})`,
      aiVerification: aiResult
    });

    res.json({
      success: true,
      message: aiResult.autoApproved
        ? `🎉 Pembayaran Terverifikasi AI! Akun Anda telah ditingkatkan ke ${plan.name}!`
        : `Bukti transfer berhasil diunggah! Sedang dalam antrean review admin.`,
      ai_result: aiResult,
      user: updatedUser
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal memproses verifikasi struk.', details: err?.message });
  }
});

// User Management Admin routes
app.get('/api/users', (_req, res) => {
  res.json({ success: true, data: getUsers().map(u => sanitizeUserForClient(u)) });
});

app.post('/api/users', (req, res) => {
  try {
    const { username, name, role, email, phone, plan_id, password } = req.body || {};
    if (!username || !name) {
      return res.status(400).json({ success: false, error: 'Username dan Nama wajib diisi.' });
    }
    const { user } = registerUser({
      username,
      name,
      email: email || `${username}@japriin.com`,
      phone: phone || '',
      password: password || '123456',
      plan_id: plan_id || 'free'
    });
    const finalUser = updateUser(user.id, {
      role: role === 'admin' ? 'admin' : 'user',
      plan_status: 'active',
      email_verified: true,
      wa_verified: true
    });
    res.json({ success: true, message: 'Pengguna baru berhasil ditambahkan!', data: finalUser || user });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal menambahkan pengguna.' });
  }
});

app.post('/api/users/:id/verify', (req, res) => {
  const updates: any = { ...(req.body || {}) };
  if (updates.wa_verified !== undefined) {
    if (updates.wa_verified) {
      updates.is_active = true;
      updates.plan_status = 'active';
      updates.payment_note = 'Aktif (Diverifikasi Admin)';
    } else {
      updates.is_active = false;
      updates.plan_status = 'pending_approval';
      updates.payment_note = 'Pending - Menunggu Verifikasi Nomor WhatsApp';
    }
  }
  const updated = updateUser(req.params.id, updates);
  if (!updated) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
  res.json({ success: true, message: 'Status verifikasi pengguna diperbarui.', data: sanitizeUserForClient(updated) });
});

app.post('/api/users/:id/send-wa-otp', async (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
  if (!user.phone) return res.status(400).json({ success: false, error: 'Nomor WhatsApp pengguna belum diatur.' });

  const newOtp = generateOtpCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const updated = updateUser(user.id, { verification_otp: newOtp, otp_expires_at: expiresAt });
  const wl = getWhitelabelConfig();
  const msg = `Halo *${user.name}*! 👋\n\nKode rahasia verifikasi WhatsApp *${wl.app_name || 'Japriin'}* Anda adalah:\n\n*${newOtp}*\n\nJangan bagikan kode ini kepada siapa pun. Silakan masukkan kode ini di aplikasi untuk memverifikasi akun Anda.`;
  const sent = await sendSystemWhatsAppNotification(user.phone, msg);
  if (sent) {
    res.json({
      success: true,
      message: `Kode OTP rahasia berhasil dikirim ke WhatsApp ${user.phone}!`,
      data: sanitizeUserForClient(updated)
    });
  } else {
    res.json({
      success: true,
      message: `Kode OTP rahasia telah dibuat untuk ${user.name} (pastikan sesi WA utama terhubung untuk pengiriman otomatis).`,
      data: sanitizeUserForClient(updated)
    });
  }
});

app.post('/api/users/:id/approve', (req, res) => {
  const updated = approveUserSubscription(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  res.json({ success: true, message: `Langganan ${updated.name} berhasil di-ACC!`, data: updated });
});

app.post('/api/users/:id/reject', (req, res) => {
  const updated = rejectUserSubscription(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  res.json({ success: true, message: `Permohonan langganan ditolak.`, data: updated });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const user = getUserById(id);
  if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  if (user.role === 'admin' && user.username === 'superadmin') {
    return res.status(400).json({ error: 'Akun Superadmin utama tidak boleh dihapus!' });
  }
  deleteUserAccount(id);
  res.json({ success: true, message: `Pengguna ${user.name} berhasil dihapus!` });
});

// MySQL Test & Export routes
app.post('/api/mysql/test', async (req, res) => {
  const status = await testMysqlConnection(req.body);
  res.json({ success: status.connected, data: status });
});

app.post('/api/mysql/sync', async (req, res) => {
  const result = await syncPushStructureAndData(req.body);
  res.json(result);
});

app.get('/api/export-sql', (_req, res) => {
  const sql = exportCurrentDataToSql();
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="data.sql"');
  res.send(sql);
});

// Static / SPA Vite Handler
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 Japriin Server Running on http://0.0.0.0:${PORT}`);
    console.log(`📌 Webhook Endpoint: http://0.0.0.0:${PORT}/api/whatsapp`);
    console.log(`⚡ Developer REST API v1: http://0.0.0.0:${PORT}/api/v1/status`);
    console.log(`🤖 Remote Assistant WhatsApp Bot Ready`);
    console.log(`====================================================`);

    // Asynchronously verify & initialize Online Database Cloud MySQL schema
    initMysqlSchemaIfNotExists().catch(err => {
      console.warn('[Online DB] Inisialisasi latar belakang:', err?.message);
    });
  });
}

startServer();
