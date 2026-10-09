import nodemailer from 'nodemailer';
import { getActiveSmtpAccounts, getSmtpAccounts, updateSmtpAccount, getWhitelabelConfig } from './db.js';
import { decryptData } from './security.js';

export interface SendEmailResult {
  success: boolean;
  account_used?: string;
  message_id?: string;
  error?: string;
  attempted_accounts?: string[];
}

function buildTransporter(account: {
  host?: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass: string;
}) {
  const host = (account.host || 'smtp.gmail.com').trim();
  const port = Number(account.port) || 587;
  const secure = port === 465 ? true : (port === 587 ? false : Boolean(account.secure));
  const decrypted = decryptData(account.pass);
  const cleanPass = host.toLowerCase().includes('gmail')
    ? decrypted.replace(/\s+/g, '')
    : decrypted.trim();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: account.user.trim(),
      pass: cleanPass
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000
  });
}

/**
 * Verifies a specific SMTP account connection or sends a test email
 */
export async function testSmtpAccountConnection(options: {
  accountId?: string;
  recipientEmail?: string;
}): Promise<{ success: boolean; message: string; error?: string; account_used?: string }> {
  const wl = getWhitelabelConfig();
  const appName = wl.app_name || 'Japriin';

  if (options.accountId) {
    const all = getSmtpAccounts();
    const acc = all.find(a => a.id === options.accountId);
    if (!acc) {
      return { success: false, message: 'Akun SMTP tidak ditemukan.', error: 'Akun SMTP tidak ditemukan.' };
    }
    try {
      const transporter = buildTransporter(acc);
      await transporter.verify();

      if (options.recipientEmail) {
        await transporter.sendMail({
          from: `"${acc.sender_name || appName}" <${acc.user}>`,
          to: options.recipientEmail,
          subject: `[${appName}] Uji Koneksi SMTP Berhasil`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 14px;">
              <h2 style="color: #059669; margin-top: 0;">Koneksi SMTP ${appName} Aktif! ✅</h2>
              <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                Email uji coba ini berhasil dikirim melalui akun SMTP <strong>${acc.name} (${acc.user})</strong> pada host <code>${acc.host}:${acc.port}</code>.
              </p>
              <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">${wl.footer_text || ''}</p>
            </div>
          `
        });
      }

      updateSmtpAccount(acc.id, {
        success_count: (acc.success_count || 0) + 1,
        last_used_at: new Date().toISOString(),
        last_error: undefined
      });

      return {
        success: true,
        account_used: `${acc.name} (${acc.user})`,
        message: options.recipientEmail
          ? `Email uji coba berhasil dikirim ke ${options.recipientEmail} menggunakan ${acc.name} (${acc.user})!`
          : `Koneksi server SMTP ${acc.name} (${acc.user}) berhasil diverifikasi!`
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Gagal terhubung ke server SMTP';
      updateSmtpAccount(acc.id, {
        error_count: (acc.error_count || 0) + 1,
        last_error: errMsg
      });
      return {
        success: false,
        message: `Koneksi gagal pada ${acc.user}: ${errMsg}`,
        error: `Koneksi gagal pada ${acc.user}: ${errMsg}`
      };
    }
  }

  // Otherwise test via rotation to recipientEmail
  const targetEmail = options.recipientEmail || getActiveSmtpAccounts()[0]?.user;
  if (!targetEmail) {
    return {
      success: false,
      message: 'Belum ada akun SMTP aktif atau email tujuan belum diisi.',
      error: 'Belum ada akun SMTP aktif atau email tujuan belum diisi.'
    };
  }

  const res = await sendEmailWithRotation({
    to: targetEmail,
    subject: `[${appName}] Tes Rotasi Multi-SMTP Berhasil`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 14px;">
        <h2 style="color: #059669; margin-top: 0;">Tes Multi-SMTP ${appName} Berhasil! ✅</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Sistem rotasi email otomatis berhasil mengirimkan pesan uji coba ini ke <strong>${targetEmail}</strong>.
        </p>
        <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">${wl.footer_text || ''}</p>
      </div>
    `
  });

  if (res.success) {
    return {
      success: true,
      account_used: res.account_used,
      message: `Email uji coba berhasil dikirim ke ${targetEmail} via ${res.account_used}!`
    };
  }
  return {
    success: false,
    message: res.error || 'Gagal mengirim email uji coba.',
    error: res.error || 'Gagal mengirim email uji coba.'
  };
}

/**
 * Sends an email using Multi-SMTP rotation with automatic failover.
 * If account A fails, it automatically falls back to account B, C, etc.
 */
export async function sendEmailWithRotation(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  const accounts = getActiveSmtpAccounts();
  const attemptedAccounts: string[] = [];
  const wl = getWhitelabelConfig();
  const appName = wl.app_name || 'Japriin';

  if (accounts.length === 0) {
    return {
      success: false,
      error: 'Belum ada akun SMTP yang aktif. Tambahkan akun SMTP di menu Kredensial atau Superadmin Master untuk mengirim email otomatis.',
      attempted_accounts: []
    };
  }

  let lastError = '';

  for (const account of accounts) {
    attemptedAccounts.push(`${account.name} (${account.user})`);
    try {
      const transporter = buildTransporter(account);
      const senderHeader = `"${account.sender_name || appName}" <${account.user}>`;

      const info = await transporter.sendMail({
        from: senderHeader,
        to: options.to,
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
        html: options.html
      });

      // Update success metrics
      updateSmtpAccount(account.id, {
        success_count: (account.success_count || 0) + 1,
        last_used_at: new Date().toISOString(),
        last_error: undefined
      });

      console.log(`[SMTP Rotation] Email sent successfully via ${account.user} to ${options.to}`);

      return {
        success: true,
        account_used: `${account.name} (${account.user})`,
        message_id: info.messageId,
        attempted_accounts: attemptedAccounts
      };
    } catch (err: any) {
      lastError = err?.message || 'Gagal mengirim email';
      console.error(`[SMTP Rotation Failed on ${account.user}]`, err?.message);

      // Record error metrics
      updateSmtpAccount(account.id, {
        error_count: (account.error_count || 0) + 1,
        last_error: lastError
      });

      // Continue to next SMTP account in rotation
    }
  }

  return {
    success: false,
    error: `Semua akun SMTP (${accounts.length} akun) gagal: ${lastError}`,
    attempted_accounts: attemptedAccounts
  };
}

/**
 * Sends a formatted Verification OTP email for registration
 */
export async function sendVerificationOtpEmail(toEmail: string, username: string, otp: string) {
  const wl = getWhitelabelConfig();
  const appName = wl.app_name || 'Japriin';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 28px 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">${appName}</h1>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Verifikasi Email Pendaftaran Akun</p>
      </div>
      <div style="padding: 28px 24px; color: #334155;">
        <p style="font-size: 14px; margin-top: 0;">Halo <strong>${username}</strong>,</p>
        <p style="font-size: 13px; line-height: 1.6; color: #475569;">
          Terima kasih telah mendaftar di <strong>${appName}</strong>. Gunakan kode OTP berikut untuk memverifikasi alamat email akun Anda:
        </p>
        <div style="margin: 24px 0; text-align: center;">
          <span style="display: inline-block; font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #059669; background: #ecfdf5; border: 2px dashed #10b981; padding: 12px 28px; border-radius: 12px;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
          Kode ini berlaku selama <strong>15 menit</strong>. Jangan berikan kode ini kepada siapa pun demi keamanan akun Anda.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          Email otomatis ini dikirim oleh Sistem Multi-SMTP ${appName} (${wl.company_name || wl.footer_text || ''}).
        </p>
      </div>
    </div>
  `;

  return sendEmailWithRotation({
    to: toEmail,
    subject: `[${appName}] Kode Verifikasi Email Anda: ${otp}`,
    html
  });
}

/**
 * Sends a formatted Password Reset OTP email
 */
export async function sendPasswordResetEmail(toEmail: string, username: string, otp: string) {
  const wl = getWhitelabelConfig();
  const appName = wl.app_name || 'Japriin';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 28px 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">${appName}</h1>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Permintaan Reset Password Akun</p>
      </div>
      <div style="padding: 28px 24px; color: #334155;">
        <p style="font-size: 14px; margin-top: 0;">Halo <strong>${username}</strong>,</p>
        <p style="font-size: 13px; line-height: 1.6; color: #475569;">
          Kami menerima permintaan untuk mengatur ulang password akun ${appName} Anda. Masukkan kode verifikasi 6 digit berikut:
        </p>
        <div style="margin: 24px 0; text-align: center;">
          <span style="display: inline-block; font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #4f46e5; background: #eef2ff; border: 2px dashed #6366f1; padding: 12px 28px; border-radius: 12px;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
          Kode ini berlaku selama <strong>15 menit</strong>. Jika Anda tidak meminta reset password ini, abaikan email ini.
        </p>
      </div>
    </div>
  `;

  return sendEmailWithRotation({
    to: toEmail,
    subject: `[${appName}] Kode Reset Password: ${otp}`,
    html
  });
}
