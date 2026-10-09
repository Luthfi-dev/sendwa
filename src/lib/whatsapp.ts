import { getAutoReplyRules, getUserById, addMessageLog, getSystemConfig } from './db.js';
import { WhatsAppMessageLog } from '../types/whatsapp.js';
import { generateGeminiAutoReply } from './geminiService.js';
import { decryptData } from './security.js';

import { sendBaileysTextMessage } from './baileysManager.js';

interface SendWhatsAppMessageResult {
  success: boolean;
  wam_id?: string;
  error?: string;
}

/**
 * Sends a text message back to a WhatsApp user using Meta Graph API v20.0 or connected Baileys Session
 */
export async function sendWhatsAppMessage(
  recipientPhone: string,
  text: string
): Promise<SendWhatsAppMessageResult> {
  const sysConfig = getSystemConfig();
  const token = decryptData(sysConfig.whatsapp_token) || process.env.WHATSAPP_TOKEN || '';
  const phoneNumberId = sysConfig.phone_number_id || process.env.PHONE_NUMBER_ID || '';

  // 1. Try Meta Graph API if configured
  if (token && token.length >= 15 && phoneNumberId && phoneNumberId.length >= 5) {
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: text
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json() as any;

      if (response.ok) {
        const wamId = data?.messages?.[0]?.id || `wamid_${Date.now()}`;
        return {
          success: true,
          wam_id: wamId
        };
      }
    } catch (err) {
      // Fallthrough to Baileys Engine
    }
  }

  // 2. Fallback to connected Baileys WhatsApp Web Session
  try {
    const baileysRes = await sendBaileysTextMessage('sess_primary_app_gateway', recipientPhone, text);
    return {
      success: true,
      wam_id: (baileysRes as any)?.wam_id || (baileysRes as any)?.key?.id || `baileys_${Date.now()}`
    };
  } catch (baileysErr: any) {
    return {
      success: false,
      error: baileysErr?.message || 'Meta Cloud API dan Sesi WA Web Baileys belum terhubung.'
    };
  }
}

/**
 * Evaluates auto-reply rules and processes incoming message with Gemini AI fallback
 */
export async function handleIncomingWhatsAppMessage(params: {
  senderPhone: string;
  senderName: string;
  messageText: string;
  wamId?: string;
  userId?: string;
}): Promise<WhatsAppMessageLog> {
  const { senderPhone, senderName, messageText, wamId, userId } = params;
  const cleanName = senderName || 'Pelanggan';
  const cleanText = messageText.trim();
  const textLower = cleanText.toLowerCase();

  // 1. Find matching active rule isolated per user
  const activeRules = getAutoReplyRules(userId).filter(r => r.is_active);
  let matchedResponse: string | null = null;
  let isAiGenerated = false;

  for (const rule of activeRules) {
    const kwLower = rule.keyword.toLowerCase();
    let isMatch = false;

    if (rule.match_type === 'exact') {
      isMatch = textLower === kwLower;
    } else if (rule.match_type === 'contains') {
      isMatch = textLower.includes(kwLower);
    } else if (rule.match_type === 'startsWith') {
      isMatch = textLower.startsWith(kwLower);
    }

    if (isMatch) {
      matchedResponse = rule.response_text;
      break;
    }
  }

  // 2. If no rule matched, check if Gemini AI auto-reply is enabled for this user or admin
  const sysConfig = getSystemConfig();
  const user = userId ? getUserById(userId) : null;
  const isAiAllowed = user
    ? (user.role === 'admin' ? sysConfig.ai_config.enabled : Boolean(user.ai_enabled))
    : (sysConfig.ai_config.enabled && sysConfig.ai_config.fallback_when_no_rule);

  if (!matchedResponse && isAiAllowed) {
    try {
      console.log(`[AI Fallback] No rule matched for "${cleanText}", querying Gemini...`);
      const aiResult = await generateGeminiAutoReply({
        senderName: cleanName,
        incomingText: cleanText,
        senderPhone
      });

      if (aiResult.success && aiResult.reply_text) {
        matchedResponse = aiResult.reply_text;
        isAiGenerated = true;
      }
    } catch (e) {
      console.error('[AI Fallback Error]', e);
    }
  }

  // 3. Fallback template if neither rule nor AI matched (Default CS auto-reply: Active by default)
  const isCsEnabled = user ? (user.default_cs_reply_enabled !== false) : true;
  if (!matchedResponse && isCsEnabled) {
    matchedResponse = user?.default_cs_reply_text || user?.custom_offline_message || sysConfig.ai_config.offline_fallback_message ||
      `Halo kak *{nama}*! Terima kasih telah menghubungi kami. Tim Customer Service kami akan segera membalas pesan Anda sesegera mungkin.`;
  }

  // 4. Format template placeholders
  const finalReplyText = (matchedResponse || '')
    .replace(/{nama}/g, cleanName)
    .replace(/{pesan}/g, cleanText);

  // 5. Send message via Meta Graph API if token is configured
  const sendResult = finalReplyText ? await sendWhatsAppMessage(senderPhone, finalReplyText) : { success: true, wam_id: undefined, error: undefined };

  // Status calculation
  const isSuccess = sendResult.success;
  const logStatus = isSuccess ? 'Sukses' : 'Diterima';

  // 6. Save to DB isolated by user
  const savedLog = addMessageLog({
    wam_id: sendResult.wam_id || wamId || `wam_sim_${Date.now()}`,
    user_id: userId,
    sender_phone: senderPhone,
    sender_name: cleanName,
    message_body: cleanText,
    direction: 'incoming',
    status: logStatus,
    reply_body: finalReplyText || 'Tidak ada balasan otomatis terkonfigurasi.',
    error_detail: sendResult.error,
    ai_generated: isAiGenerated
  });

  return savedLog;
}
