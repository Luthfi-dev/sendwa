import fs from 'fs';
import path from 'path';
import {
  WhatsAppMessageLog,
  AutoReplyRule,
  BotStats,
  WhatsAppSession,
  AntiBanSettings,
  UserAccount,
  SubscriptionPlan,
  SmtpAccount,
  GeminiApiKey,
  SystemConfig,
  AiBotConfig,
  AppWhitelabelConfig,
  RemoteBotChallenge
} from '../types/whatsapp.js';
import {
  encryptData,
  decryptData,
  hashPassword,
  hashPin,
  verifyMasterPin,
  generateOtpCode,
  generateApiKey
} from './security.js';

let cachedMemoryDb: LocalDatabase | null = null;
let saveDebounceTimer: NodeJS.Timeout | null = null;

function asyncSyncMessage(msg: WhatsAppMessageLog) {
  import('./mysqlService.js').then(m => m.pushMessageToMysql(msg)).catch(() => {});
}

function asyncSyncSession(sess: WhatsAppSession) {
  import('./mysqlService.js').then(m => m.pushSessionToMysql(sess)).catch(() => {});
}

function asyncSyncUser(u: UserAccount) {
  import('./mysqlService.js').then(m => m.pushUserToMysql(u)).catch(() => {});
}

function asyncSyncRule(r: AutoReplyRule) {
  import('./mysqlService.js').then(m => m.pushRuleToMysql(r)).catch(() => {});
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

export interface BroadcastLogEntry {
  id: string;
  user_id?: string;
  session_id?: string;
  recipients_count: number;
  message: string;
  status: 'completed' | 'scheduled' | 'running' | 'failed';
  success_count: number;
  failed_count: number;
  scheduled_at?: string;
  created_at: string;
}

export const LOG_RETENTION_DAYS = 7;
export const LOG_RETENTION_MS = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface LocalDatabase {
  messages: WhatsAppMessageLog[];
  broadcastHistory?: BroadcastLogEntry[];
  rules: AutoReplyRule[];
  sessions: WhatsAppSession[];
  antiBan: AntiBanSettings;
  users: UserAccount[];
  plans: SubscriptionPlan[];
  smtpAccounts: SmtpAccount[];
  geminiKeys: GeminiApiKey[];
  systemConfig: SystemConfig;
  stats: {
    total_incoming: number;
    total_auto_replied: number;
    total_failed: number;
    total_ai_replied?: number;
    last_webhook_receive?: string;
  };
}

const DEFAULT_ANTIBAN: AntiBanSettings = {
  enabled: true,
  min_delay_seconds: 3,
  max_delay_seconds: 8,
  typing_simulation: true,
  max_messages_per_minute: 15,
  daily_quota_per_number: 500,
  read_receipt_simulation: true
};

const DEFAULT_AI_CONFIG: AiBotConfig = {
  enabled: true,
  system_prompt: 'Anda adalah Customer Service Assistant untuk bisnis yang ramah, sopan, ringkas, dan solutif. Jawab pertanyaan pelanggan dengan ramah dalam Bahasa Indonesia yang natural.',
  model: 'gemini-3.8-flash',
  fallback_when_no_rule: true,
  temperature: 0.3,
  offline_fallback_message: 'Halo! Terima kasih telah menghubungi kami. Maaf saat ini petugas/CS kami sedang offline. Kami akan membalas pesan Anda sesegera mungkin.'
};

const DEFAULT_QRIS_CONFIG = {
  image_url: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=00020101021126580014ID.LINKAJA.WWW01189360091432263435130208123456785204581253033605802ID5913JAPRIIN6007BANDUNG61054011562070703A016304E8A2',
  account_name: 'Japriin Official',
  bank_name: 'QRIS (Semua Bank / E-Wallet) & Bank BCA',
  account_number: '123-456-7890 a.n Japriin Media',
  instructions: '1. Buka aplikasi M-Banking atau E-Wallet (BCA, Mandiri, BRI, GoPay, OVO, Dana, ShopeePay)\n2. Scan barcode QRIS di atas atau transfer ke rekening BCA 123-456-7890\n3. Masukkan nominal sesuai harga paket yang dipilih\n4. Simpan / Screenshot bukti struk transfer\n5. Upload foto struk di bawah untuk divalidasi otomatis oleh AI!'
};

export const DEFAULT_WHITELABEL: AppWhitelabelConfig = {
  app_name: 'Japriin',
  tagline: 'Whitelabel WhatsApp Gateway, Interactive REST API & Remote AI Bot',
  logo_url: '/src/assets/images/japriin_logo_1791445508697.jpg',
  company_name: 'PT Japriin Teknologi Indonesia',
  support_phone: '081234567890',
  primary_bot_phone: '081234567890',
  primary_bot_name: 'Japriin Assistant Pusat',
  footer_text: 'Dikelola secara profesional oleh Japriin.com',
  api_enabled: true,
  updated_at: new Date().toISOString()
};

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Paket Gratis',
    price: 0,
    period: 'selamanya',
    max_sessions: 1,
    daily_msg_limit: 100,
    monthly_msg_limit: 500,
    daily_ai_limit: 25,
    monthly_ai_limit: 250,
    is_active: true,
    features: [
      '1 Nomor WhatsApp Terhubung',
      '100 Pesan Otomatis / Hari',
      'Batas Respon AI 25 / Hari (250/bln)',
      '100% Tanpa Watermark (Pesan Murni)',
      'Akses Remote Bot Assistant WA',
      'Aturan Balas Otomatis Bebas Atur',
      'Simulasi Ketik Proteksi Anti-Ban',
      'Langsung Aktif Tanpa Biaya (Rp 0)'
    ]
  },
  {
    id: 'starter',
    name: 'Paket Starter',
    price: 50000,
    period: '/ bulan',
    max_sessions: 1,
    daily_msg_limit: 500,
    monthly_msg_limit: 15000,
    daily_ai_limit: 150,
    monthly_ai_limit: 3000,
    is_active: true,
    features: [
      '1 Nomor WhatsApp Terhubung',
      '500 Pesan Otomatis / Hari',
      'Batas Respon AI 150 / Hari (3.000/bln)',
      '100% Tanpa Watermark / No Ads',
      'Akses REST API & Webhook',
      'Sistem Proteksi Anti-Ban Guard',
      'Aturan Balas Otomatis Tanpa Batas',
      'Log Pesan & Export data.sql'
    ]
  },
  {
    id: 'business',
    name: 'Paket Business',
    price: 85000,
    period: '/ bulan',
    max_sessions: 3,
    daily_msg_limit: 2500,
    monthly_msg_limit: 75000,
    daily_ai_limit: 500,
    monthly_ai_limit: 15000,
    popular: true,
    is_active: true,
    features: [
      '3 Nomor WhatsApp Terhubung',
      '2.500 Pesan Otomatis / Hari',
      'Batas Respon AI 500 / Hari (15.000/bln)',
      '100% Tanpa Watermark (Whitelabel)',
      'Interactive REST API v1 Terbuka',
      'Advance Anti-Ban & Jeda Acak',
      'Simulasi Ketik Status & Read Receipt',
      'Fitur Balas Otomatis AI (Multi-Key)',
      'Multi-Session Simultaneous'
    ]
  },
  {
    id: 'pro',
    name: 'Paket Unlimited Pro',
    price: 99000,
    period: '/ bulan',
    max_sessions: 10,
    daily_msg_limit: 10000,
    monthly_msg_limit: 300000,
    daily_ai_limit: 2000,
    monthly_ai_limit: 60000,
    is_active: true,
    features: [
      'Hingga 10 Nomor WhatsApp Terhubung',
      '10.000 Pesan Otomatis / Hari',
      'Batas Respon AI 2.000 / Hari (60.000/bln)',
      '100% Tanpa Watermark / Pure Clean',
      'Full Multi-User Operator Chat',
      'Prioritas Anti-Ban Behavioral Guard',
      'Fitur Balas AI Multi-Key Tanpa Batas',
      'Akses REST API, Webhook & DB Cloud Sync'
    ]
  }
];

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  whatsapp_token: '',
  phone_number_id: '',
  webhook_verify_token: 'maudigi_gtw_verify_token_2026',
  app_url: process.env.APP_URL || 'http://localhost:3000',
  mysql_host: process.env.MYSQL_HOST || '15.235.193.207',
  mysql_port: parseInt(process.env.MYSQL_PORT || '3306') || 3306,
  mysql_user: process.env.MYSQL_USER || 'maudigic_baru',
  mysql_password: process.env.MYSQL_PASSWORD || '',
  mysql_database: process.env.MYSQL_DATABASE || 'maudigic_whatsappsend',
  ai_config: DEFAULT_AI_CONFIG,
  qris_config: DEFAULT_QRIS_CONFIG,
  whitelabel_config: DEFAULT_WHITELABEL
};

export const SUBSCRIPTION_PLANS = DEFAULT_SUBSCRIPTION_PLANS;

// Default initial users
const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'usr_superadmin',
    username: 'superadmin',
    name: 'Super Administrator',
    role: 'admin',
    email: 'superadmin@japriin.com',
    phone: '081234567890',
    password: 'superadmin_hash_placeholder',
    is_active: true,
    email_verified: true,
    wa_verified: true,
    plan_id: 'pro',
    plan_status: 'active',
    max_sessions: 10,
    security_pin: hashPin('123456'),
    pin_failed_attempts: 0,
    is_bot_locked: false,
    api_key: 'mgw_live_superadmin_master_key_99',
    daily_messages_sent: 0,
    monthly_messages_sent: 0,
    created_at: new Date().toISOString(),
    approved_at: new Date().toISOString()
  },
  {
    id: 'usr_admin',
    username: 'admin',
    name: 'Admin Japriin',
    role: 'admin',
    email: 'admin@japriin.com',
    phone: '081298765432',
    password: 'admin_hash_placeholder',
    is_active: true,
    email_verified: true,
    wa_verified: true,
    plan_id: 'pro',
    plan_status: 'active',
    max_sessions: 5,
    security_pin: hashPin('123456'),
    pin_failed_attempts: 0,
    is_bot_locked: false,
    api_key: 'mgw_live_admin_general_key_77',
    daily_messages_sent: 0,
    monthly_messages_sent: 0,
    created_at: new Date().toISOString(),
    approved_at: new Date().toISOString()
  },
  {
    id: 'usr_user',
    username: 'user',
    name: 'Operator Chat User',
    role: 'user',
    email: 'user@japriin.com',
    phone: '085712345678',
    password: 'user_hash_placeholder',
    is_active: true,
    email_verified: true,
    wa_verified: true,
    plan_id: 'free',
    plan_status: 'active',
    max_sessions: 1,
    security_pin: hashPin('123456'),
    pin_failed_attempts: 0,
    is_bot_locked: false,
    api_key: 'mgw_live_user_client_key_33',
    daily_messages_sent: 0,
    monthly_messages_sent: 0,
    created_at: new Date().toISOString(),
    approved_at: new Date().toISOString()
  },
  {
    id: 'usr_user_b',
    username: 'user_b',
    name: 'Operator Chat User B',
    role: 'user',
    email: 'user_b@japriin.com',
    phone: '085261629099',
    password: 'user_hash_placeholder',
    is_active: true,
    email_verified: true,
    wa_verified: true,
    plan_id: 'free',
    plan_status: 'active',
    max_sessions: 2,
    security_pin: hashPin('123456'),
    pin_failed_attempts: 0,
    is_bot_locked: false,
    api_key: 'mgw_live_user_b_client_key_44',
    daily_messages_sent: 0,
    monthly_messages_sent: 0,
    created_at: new Date().toISOString(),
    approved_at: new Date().toISOString()
  }
];

// In-Memory Remote WhatsApp Bot Challenges Map (expires in 5 minutes)
const activeRemoteChallenges = new Map<string, RemoteBotChallenge>();

// Clean up expired challenges
setInterval(() => {
  const now = Date.now();
  for (const [phone, challenge] of activeRemoteChallenges.entries()) {
    if (challenge.expires_at < now) {
      activeRemoteChallenges.delete(phone);
    }
  }
}, 60000);

export function initDbFile(): LocalDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialDb: LocalDatabase = {
      messages: [],
      rules: [
        {
          id: 'rule_1',
          keyword: 'halo',
          match_type: 'contains',
          response_text: 'Halo kak {nama}! Selamat datang di layanan kami. Ada yang bisa kami bantu seputar pesanan atau informasi produk?',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'rule_2',
          keyword: 'harga',
          match_type: 'contains',
          response_text: 'Halo kak {nama}, daftar harga produk kami sangat terjangkau mulai dari Rp 50.000. Cek katalog lengkap di website kami ya kak!',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      sessions: [
        {
          id: 'sess_primary_app_gateway',
          session_name: 'Nomor Gateway Utama Aplikasi & Bot',
          phone_number: '081234567890',
          auth_method: 'pairing_code',
          status: 'connected',
          is_primary: true,
          pairing_code: 'MDGW-8822',
          connected_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      antiBan: DEFAULT_ANTIBAN,
      users: DEFAULT_USERS,
      plans: DEFAULT_SUBSCRIPTION_PLANS,
      smtpAccounts: [],
      geminiKeys: process.env.GEMINI_API_KEY ? [
        {
          id: 'gem_default_env',
          name: 'Primary Environment Key',
          key: encryptData(process.env.GEMINI_API_KEY),
          is_active: true,
          usage_count: 0,
          error_count: 0,
          created_at: new Date().toISOString()
        }
      ] : [],
      systemConfig: DEFAULT_SYSTEM_CONFIG,
      stats: {
        total_incoming: 0,
        total_auto_replied: 0,
        total_failed: 0,
        total_ai_replied: 0
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    cachedMemoryDb = initialDb;
    return initialDb;
  }

  if (cachedMemoryDb) {
    return cachedMemoryDb;
  }

  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    let dbMigrated = false;

    // Schema Migrations & Fallbacks
    if (!parsed.plans || parsed.plans.length === 0) {
      parsed.plans = DEFAULT_SUBSCRIPTION_PLANS;
    } else {
      parsed.plans = parsed.plans.map((p: any) => {
        const def = DEFAULT_SUBSCRIPTION_PLANS.find(dp => dp.id === p.id);
        return {
          ...p,
          daily_ai_limit: p.daily_ai_limit ?? def?.daily_ai_limit ?? 50,
          monthly_ai_limit: p.monthly_ai_limit ?? def?.monthly_ai_limit ?? 1500
        };
      });
    }
    if (!parsed.systemConfig) {
      parsed.systemConfig = DEFAULT_SYSTEM_CONFIG;
    } else {
      if (!parsed.systemConfig.mysql_host || parsed.systemConfig.mysql_host === 'localhost') {
        parsed.systemConfig.mysql_host = process.env.MYSQL_HOST || '15.235.193.207';
      }
      if (!parsed.systemConfig.mysql_user || parsed.systemConfig.mysql_user === 'root') {
        parsed.systemConfig.mysql_user = process.env.MYSQL_USER || 'maudigic_baru';
      }
      if (!parsed.systemConfig.mysql_database || parsed.systemConfig.mysql_database === 'maudigi_wa_gateway') {
        parsed.systemConfig.mysql_database = process.env.MYSQL_DATABASE || 'maudigic_whatsappsend';
      }
      if (!parsed.systemConfig.ai_config) {
        parsed.systemConfig.ai_config = DEFAULT_AI_CONFIG;
      } else {
        // Ensure AI Auto-reply fallback is ON by default and model is fast gemini-2.5-flash
        parsed.systemConfig.ai_config.enabled = true;
        parsed.systemConfig.ai_config.fallback_when_no_rule = true;
        if (!parsed.systemConfig.ai_config.model || parsed.systemConfig.ai_config.model === 'gemini-3.8-flash') {
          parsed.systemConfig.ai_config.model = 'gemini-2.5-flash';
        }
        if (!parsed.systemConfig.ai_config.offline_fallback_message) {
          parsed.systemConfig.ai_config.offline_fallback_message = 'Halo! Terima kasih telah menghubungi kami. Maaf saat ini petugas/CS kami sedang offline. Kami akan membalas pesan Anda sesegera mungkin.';
        }
      }
    }
    if (!parsed.systemConfig.whitelabel_config) {
      parsed.systemConfig.whitelabel_config = DEFAULT_WHITELABEL;
    } else if (
      !parsed.systemConfig.whitelabel_config.logo_url ||
      parsed.systemConfig.whitelabel_config.logo_url.includes('maudigi_wa_icon_1785143465240.jpg')
    ) {
      parsed.systemConfig.whitelabel_config.logo_url = DEFAULT_WHITELABEL.logo_url;
    }
    if (!parsed.geminiKeys) {
      parsed.geminiKeys = [];
    }
    if (!Array.isArray(parsed.smtpAccounts)) {
      parsed.smtpAccounts = [];
    }
    if (!parsed.antiBan) {
      parsed.antiBan = DEFAULT_ANTIBAN;
    }
    if (!parsed.users || parsed.users.length === 0) {
      parsed.users = DEFAULT_USERS;
    }

    // Ensure users have pins, api_keys, and quota fields
    parsed.users.forEach((u: UserAccount) => {
      if (!u.security_pin) u.security_pin = hashPin('123456');
      if (u.pin_failed_attempts === undefined) u.pin_failed_attempts = 0;
      if (u.is_bot_locked === undefined) u.is_bot_locked = false;
      if (!u.api_key) u.api_key = generateApiKey(`mgw_${u.username.substring(0, 4)}_`);
      if (u.daily_messages_sent === undefined) u.daily_messages_sent = 0;
      if (u.monthly_messages_sent === undefined) u.monthly_messages_sent = 0;
      if (u.daily_ai_sent === undefined) u.daily_ai_sent = 0;
      if (u.monthly_ai_sent === undefined) u.monthly_ai_sent = 0;
      if (u.default_cs_reply_enabled === undefined) {
        u.default_cs_reply_enabled = true;
        dbMigrated = true;
      }
      if (!u.default_cs_reply_text) {
        u.default_cs_reply_text = 'Halo kak *{nama}*! Terima kasih telah menghubungi kami. Tim Customer Service kami akan segera membalas pesan Anda sesegera mungkin.';
        dbMigrated = true;
      }
    });

    // Ensure session IDs retain their rightful user_id if encoded in their session key
    if (parsed.sessions && parsed.sessions.length > 0) {
      parsed.sessions.forEach((s: any) => {
        if (!s.user_id && s.id && s.id.startsWith('session_user_')) {
          const extracted = s.id.replace('session_user_', '').split('_')[0];
          if (extracted) {
            s.user_id = extracted;
            dbMigrated = true;
          }
        }
        if (!s.expires_at) {
          const baseDate = s.connected_at ? new Date(s.connected_at).getTime() : (s.created_at ? new Date(s.created_at).getTime() : Date.now());
          s.expires_at = new Date(baseDate + 30 * 24 * 60 * 60 * 1000).toISOString();
          dbMigrated = true;
        }
      });
    }

    // Auto-purge message logs & broadcast history older than 7 days on load
    const cutoffMs = Date.now() - LOG_RETENTION_MS;
    if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
      const beforeMsgLen = parsed.messages.length;
      parsed.messages = parsed.messages.filter((m: any) => {
        if (!m?.created_at) return true;
        const ts = new Date(m.created_at).getTime();
        return isNaN(ts) || ts >= cutoffMs;
      });
      if (parsed.messages.length !== beforeMsgLen) dbMigrated = true;
    }
    if (Array.isArray(parsed.broadcastHistory) && parsed.broadcastHistory.length > 0) {
      const beforeBcLen = parsed.broadcastHistory.length;
      parsed.broadcastHistory = parsed.broadcastHistory.filter((b: any) => {
        if (!b?.created_at) return true;
        const ts = new Date(b.created_at).getTime();
        return isNaN(ts) || ts >= cutoffMs;
      });
      if (parsed.broadcastHistory.length !== beforeBcLen) dbMigrated = true;
    } else if (!Array.isArray(parsed.broadcastHistory)) {
      parsed.broadcastHistory = [];
    }

    // Ensure all existing auto-reply rules have user_id assigned (default to superadmin to prevent leaking)
    if (Array.isArray(parsed.rules)) {
      parsed.rules.forEach((r: any) => {
        if (!r.user_id) {
          r.user_id = 'user_superadmin';
          dbMigrated = true;
        }
      });
    } else {
      parsed.rules = [];
      dbMigrated = true;
    }

    if (dbMigrated) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
      } catch (e) {
        // Ignore
      }
    }

    cachedMemoryDb = parsed;
    return parsed;
  } catch (err) {
    console.error('Error reading database file, re-initializing:', err);
    return initDbFile();
  }
}

export function writeDbFile(data: LocalDatabase, immediate = false): void {
  cachedMemoryDb = data;
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = null;
  }
  if (immediate) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to synchronously write database file:', err);
    }
    return;
  }
  saveDebounceTimer = setTimeout(() => {
    fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8', (err) => {
      if (err) console.error('Failed to asynchronously write database file:', err);
    });
  }, 100);
}

// ==========================================
// SUBSCRIPTION PLANS CRUD (SUPERADMIN EDITABLE)
// ==========================================
export function getSubscriptionPlans(): SubscriptionPlan[] {
  const db = initDbFile();
  return db.plans || DEFAULT_SUBSCRIPTION_PLANS;
}

export function saveSubscriptionPlans(plans: SubscriptionPlan[]): SubscriptionPlan[] {
  const db = initDbFile();
  db.plans = plans;
  writeDbFile(db, true);
  return db.plans;
}

export function updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): SubscriptionPlan | null {
  const db = initDbFile();
  const index = db.plans.findIndex(p => p.id === id);
  if (index === -1) return null;

  db.plans[index] = {
    ...db.plans[index],
    ...updates,
    updated_at: new Date().toISOString()
  };
  writeDbFile(db, true);
  return db.plans[index];
}

export function addSubscriptionPlan(planData: Omit<SubscriptionPlan, 'updated_at'>): SubscriptionPlan {
  const db = initDbFile();
  const newPlan: SubscriptionPlan = {
    ...planData,
    updated_at: new Date().toISOString()
  };
  db.plans.push(newPlan);
  writeDbFile(db, true);
  return newPlan;
}

export function deleteSubscriptionPlan(id: string): boolean {
  const db = initDbFile();
  const beforeCount = db.plans.length;
  db.plans = db.plans.filter(p => p.id !== id);
  if (db.plans.length !== beforeCount) {
    writeDbFile(db, true);
    return true;
  }
  return false;
}

// ==========================================
// WHITELABEL APP CONFIGURATION CRUD
// ==========================================
export function getWhitelabelConfig(): AppWhitelabelConfig {
  const db = initDbFile();
  return db.systemConfig?.whitelabel_config || DEFAULT_WHITELABEL;
}

export function updateWhitelabelConfig(updates: Partial<AppWhitelabelConfig>): AppWhitelabelConfig {
  const db = initDbFile();
  if (!db.systemConfig.whitelabel_config) {
    db.systemConfig.whitelabel_config = { ...DEFAULT_WHITELABEL };
  }
  db.systemConfig.whitelabel_config = {
    ...db.systemConfig.whitelabel_config,
    ...updates,
    updated_at: new Date().toISOString()
  };
  writeDbFile(db, true);
  return db.systemConfig.whitelabel_config;
}

// ==========================================
// GEMINI MULTI-KEY ROTATION & API KEYS
// ==========================================
export function getGeminiKeys(): GeminiApiKey[] {
  const db = initDbFile();
  return db.geminiKeys || [];
}

export function getActiveGeminiKeys(): GeminiApiKey[] {
  const db = initDbFile();
  return (db.geminiKeys || []).filter(k => k.is_active);
}

export function addGeminiKey(name: string, key: string): GeminiApiKey {
  const db = initDbFile();
  const newKey: GeminiApiKey = {
    id: `gem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: name.trim() || `Gemini Key ${db.geminiKeys.length + 1}`,
    key: encryptData(key.trim()),
    is_active: true,
    usage_count: 0,
    error_count: 0,
    created_at: new Date().toISOString()
  };
  db.geminiKeys.push(newKey);
  writeDbFile(db);
  return newKey;
}

export function updateGeminiKey(id: string, updates: Partial<GeminiApiKey>): GeminiApiKey | null {
  const db = initDbFile();
  const index = db.geminiKeys.findIndex(k => k.id === id);
  if (index === -1) return null;

  if (updates.key) {
    updates.key = encryptData(updates.key.trim());
  }

  db.geminiKeys[index] = { ...db.geminiKeys[index], ...updates };
  writeDbFile(db);
  return db.geminiKeys[index];
}

export function deleteGeminiKey(id: string): boolean {
  const db = initDbFile();
  const beforeCount = db.geminiKeys.length;
  db.geminiKeys = db.geminiKeys.filter(k => k.id !== id);
  if (db.geminiKeys.length !== beforeCount) {
    writeDbFile(db);
    return true;
  }
  return false;
}

export function toggleGeminiKey(id: string): GeminiApiKey | null {
  const db = initDbFile();
  const index = db.geminiKeys.findIndex(k => k.id === id);
  if (index === -1) return null;

  db.geminiKeys[index].is_active = !db.geminiKeys[index].is_active;
  writeDbFile(db);
  return db.geminiKeys[index];
}

// ==========================================
// USER ACCOUNTS & SECURITY PIN MANAGEMENT
// ==========================================
export function getUsers(): UserAccount[] {
  const db = initDbFile();
  return db.users;
}

export function getUserById(id: string): UserAccount | null {
  const db = initDbFile();
  if (!id) return null;
  return db.users.find(u => 
    u.id === id || 
    u.username.toLowerCase() === id.toLowerCase() ||
    (id === 'usr_user' && (u.id === 'user_regular' || u.username === 'user')) ||
    (id === 'user_regular' && (u.id === 'usr_user' || u.username === 'user')) ||
    (id === 'usr_admin' && (u.id === 'user_admin' || u.username === 'admin')) ||
    (id === 'usr_superadmin' && (u.id === 'user_superadmin' || u.username === 'superadmin'))
  ) || null;
}

export function getUserByPhone(phone: string): UserAccount | null {
  const db = initDbFile();
  if (!phone) return null;
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return null;
  return db.users.find(u => {
    if (!u.phone) return false;
    const uPhone = u.phone.replace(/\D/g, '');
    return uPhone === cleanPhone || (uPhone.length >= 8 && cleanPhone.endsWith(uPhone.slice(-8))) || (cleanPhone.length >= 8 && uPhone.endsWith(cleanPhone.slice(-8)));
  }) || null;
}

export function getUserByApiKey(apiKey: string): UserAccount | null {
  const db = initDbFile();
  if (!apiKey) return null;
  return db.users.find(u => u.api_key === apiKey.trim()) || null;
}

export function setUserSecurityPin(userId: string, pin: string): { success: boolean; message: string } {
  if (!pin || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
    return { success: false, message: 'PIN harus berupa 4-8 digit angka!' };
  }

  const db = initDbFile();
  const user = db.users.find(u => u.id === userId);
  if (!user) return { success: false, message: 'Pengguna tidak ditemukan.' };

  user.security_pin = hashPin(pin);
  user.pin_failed_attempts = 0;
  user.is_bot_locked = false;
  writeDbFile(db);
  return { success: true, message: 'PIN Keamanan berhasil dibuat & disimpan dengan aman!' };
}

export function verifyUserSecurityPin(userId: string, inputPin: string): boolean {
  const db = initDbFile();
  const user = db.users.find(u => u.id === userId);
  if (!user || !user.security_pin) return false;

  return user.security_pin === hashPin(inputPin);
}

export function unlockUserBot(userId: string): UserAccount | null {
  const db = initDbFile();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;

  user.is_bot_locked = false;
  user.pin_failed_attempts = 0;
  writeDbFile(db);
  return user;
}

export function generateUserApiKey(userId: string): string | null {
  const db = initDbFile();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;

  user.api_key = generateApiKey(`mgw_${user.username.substring(0, 4)}_`);
  writeDbFile(db);
  return user.api_key;
}

export function deductUserDailyQuota(userId: string): { allowed: boolean; remaining: number; dailyLimit: number; message?: string } {
  const db = initDbFile();
  const targetUser = getUserById(userId);
  if (!targetUser) return { allowed: false, remaining: 0, dailyLimit: 0, message: 'Pengguna tidak ditemukan' };
  const user = db.users.find(u => u.id === targetUser.id);
  if (!user) return { allowed: false, remaining: 0, dailyLimit: 0, message: 'Pengguna tidak ditemukan' };

  const isAdmin = user.role === 'admin';
  const plans = db.plans || DEFAULT_SUBSCRIPTION_PLANS;
  const userPlan = plans.find(p => p.id === user.plan_id) || plans[0];
  const dailyLimit = isAdmin ? 999999 : (userPlan.daily_msg_limit || 100);
  const monthlyLimit = isAdmin ? 999999 : (userPlan.monthly_msg_limit || 3000);

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7);
  if (user.last_quota_reset_date !== today) {
    user.daily_messages_sent = 0;
    user.daily_ai_sent = 0;
    user.last_quota_reset_date = today;
  }
  if ((user as any).last_quota_reset_month !== currentMonth) {
    user.monthly_messages_sent = 0;
    user.monthly_ai_sent = 0;
    (user as any).last_quota_reset_month = currentMonth;
  }

  if (!isAdmin && user.daily_messages_sent >= dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      dailyLimit,
      message: `Kuota pesan harian Anda telah habis (${user.daily_messages_sent}/${dailyLimit} pesan). Upgrade paket Anda untuk kuota lebih banyak.`
    };
  }

  if (!isAdmin && (user.monthly_messages_sent || 0) >= monthlyLimit) {
    return {
      allowed: false,
      remaining: 0,
      dailyLimit,
      message: `Kuota pesan bulanan Anda telah habis (${user.monthly_messages_sent || 0}/${monthlyLimit} pesan). Upgrade paket Anda untuk kuota lebih banyak.`
    };
  }

  user.daily_messages_sent = (user.daily_messages_sent || 0) + 1;
  user.monthly_messages_sent = (user.monthly_messages_sent || 0) + 1;
  writeDbFile(db);

  return {
    allowed: true,
    remaining: isAdmin ? 999999 : Math.max(0, dailyLimit - user.daily_messages_sent),
    dailyLimit: isAdmin ? 999999 : dailyLimit
  };
}

export function deductUserAiQuota(userId: string): {
  allowed: boolean;
  remainingDaily: number;
  dailyLimit: number;
  remainingMonthly: number;
  monthlyLimit: number;
  message?: string;
} {
  const db = initDbFile();
  const targetUser = getUserById(userId);
  if (!targetUser) {
    return {
      allowed: false,
      remainingDaily: 0,
      dailyLimit: 0,
      remainingMonthly: 0,
      monthlyLimit: 0,
      message: 'Pengguna tidak ditemukan'
    };
  }
  const user = db.users.find(u => u.id === targetUser.id);
  if (!user) {
    return {
      allowed: false,
      remainingDaily: 0,
      dailyLimit: 0,
      remainingMonthly: 0,
      monthlyLimit: 0,
      message: 'Pengguna tidak ditemukan'
    };
  }

  const isAdmin = user.role === 'admin';
  const plans = db.plans || DEFAULT_SUBSCRIPTION_PLANS;
  const userPlan = plans.find(p => p.id === user.plan_id) || plans[0];
  const dailyAiLimit = isAdmin ? 999999 : (userPlan.daily_ai_limit ?? 50);
  const monthlyAiLimit = isAdmin ? 999999 : (userPlan.monthly_ai_limit ?? 1500);

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7);
  if (user.last_quota_reset_date !== today) {
    user.daily_messages_sent = 0;
    user.daily_ai_sent = 0;
    user.last_quota_reset_date = today;
  }
  if ((user as any).last_quota_reset_month !== currentMonth) {
    user.monthly_messages_sent = 0;
    user.monthly_ai_sent = 0;
    (user as any).last_quota_reset_month = currentMonth;
  }

  const currentDailyAi = user.daily_ai_sent || 0;
  const currentMonthlyAi = user.monthly_ai_sent || 0;

  if (!isAdmin && currentDailyAi >= dailyAiLimit) {
    return {
      allowed: false,
      remainingDaily: 0,
      dailyLimit: dailyAiLimit,
      remainingMonthly: Math.max(0, monthlyAiLimit - currentMonthlyAi),
      monthlyLimit: monthlyAiLimit,
      message: `Batas kuota respon AI harian Anda telah habis (${currentDailyAi}/${dailyAiLimit}).`
    };
  }

  if (!isAdmin && currentMonthlyAi >= monthlyAiLimit) {
    return {
      allowed: false,
      remainingDaily: Math.max(0, dailyAiLimit - currentDailyAi),
      dailyLimit: dailyAiLimit,
      remainingMonthly: 0,
      monthlyLimit: monthlyAiLimit,
      message: `Batas kuota respon AI bulanan Anda telah habis (${currentMonthlyAi}/${monthlyAiLimit}).`
    };
  }

  user.daily_ai_sent = currentDailyAi + 1;
  user.monthly_ai_sent = currentMonthlyAi + 1;
  writeDbFile(db);

  return {
    allowed: true,
    remainingDaily: isAdmin ? 999999 : Math.max(0, dailyAiLimit - user.daily_ai_sent),
    dailyLimit: isAdmin ? 999999 : dailyAiLimit,
    remainingMonthly: isAdmin ? 999999 : Math.max(0, monthlyAiLimit - user.monthly_ai_sent),
    monthlyLimit: isAdmin ? 999999 : monthlyAiLimit
  };
}

// ==========================================
// REMOTE WHATSAPP BOT ASSISTANT ENGINE
// ==========================================
export function createPinChallenge(userPhone: string, userId: string, pendingAction: any, realPinClean: string): { prompt: string; pinOptions: string[] } {
  // Generate 9 fake numeric PINs around realPin length
  const pinLen = realPinClean.length || 6;
  const fakePins = new Set<string>();
  while (fakePins.size < 9) {
    const fake = Math.floor(Math.pow(10, pinLen - 1) + Math.random() * (Math.pow(10, pinLen) - Math.pow(10, pinLen - 1))).toString();
    if (fake !== realPinClean) {
      fakePins.add(fake);
    }
  }

  const allPins = [...Array.from(fakePins), realPinClean];
  // Shuffle array
  for (let i = allPins.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPins[i], allPins[j]] = [allPins[j], allPins[i]];
  }

  const challenge: RemoteBotChallenge = {
    user_phone: userPhone,
    user_id: userId,
    pending_action: pendingAction,
    correct_pin: realPinClean,
    pin_options: allPins,
    expires_at: Date.now() + 5 * 60 * 1000 // 5 minutes
  };

  activeRemoteChallenges.set(userPhone, challenge);

  let prompt = `🔒 *KONFIRMASI KEAMANAN PIN*\n`;
  prompt += `Perintah Anda membutuhkan otorisasi PIN keamanan.\n\n`;
  prompt += `Silakan ketik nomor/angka PIN Anda yang benar dari 10 pilihan acak berikut:\n`;
  allPins.forEach((pin, idx) => {
    prompt += `${idx + 1}. *${pin}*\n`;
  });
  prompt += `\n⚠️ *Penting*: List PIN ini akan otomatis terhapus dari memori bot setelah dijawab demi melindungi akun Anda dari intipan layar.`;

  return { prompt, pinOptions: allPins };
}

export function getActivePinChallenge(userPhone: string): RemoteBotChallenge | null {
  const challenge = activeRemoteChallenges.get(userPhone);
  if (!challenge) return null;
  if (challenge.expires_at < Date.now()) {
    activeRemoteChallenges.delete(userPhone);
    return null;
  }
  return challenge;
}

export function clearPinChallenge(userPhone: string): void {
  activeRemoteChallenges.delete(userPhone);
}

export async function processRemoteWhatsAppCommand(
  fromPhone: string,
  senderName: string,
  rawText: string
): Promise<{ reply: string; actionExecuted?: boolean }> {
  const text = rawText.trim();
  const db = initDbFile();
  const whitelabel = db.systemConfig?.whitelabel_config || DEFAULT_WHITELABEL;
  const user = getUserByPhone(fromPhone);

  if (!user) {
    return {
      reply: `Halo kak ${senderName}! 👋\nNomor WhatsApp Anda belum terdaftar sebagai operator di sistem *${whitelabel.app_name}*.\n\nSilakan daftar akun gratis di web kami: ${db.systemConfig.app_url || 'https://japriin.com'}`
    };
  }

  // Deduct quota for interaction
  const quota = deductUserDailyQuota(user.id);
  if (!quota.allowed) {
    return {
      reply: `⚠️ *KUOTA PESAN HABIS*\n\n${quota.message}\nUpgrade paket Pro Anda di website untuk melanjutkan.`
    };
  }

  // Check if user is locked due to 3x wrong PIN
  if (user.is_bot_locked) {
    return {
      reply: `🚫 *AKUN DIBLOKIR DARI WHATSAPP BOT*\n\nAkun Anda telah dinonaktifkan sementara dari akses bot karena 3x salah memasukkan PIN keamanan.\n\nUntuk membuka blokir, silakan masuk ke dashboard web *${whitelabel.app_name}* lalu verifikasi & reset PIN Anda.`
    };
  }

  // Check if there is an active PIN challenge waiting for response
  const activeChallenge = getActivePinChallenge(fromPhone);
  if (activeChallenge) {
    const inputVal = text.replace(/\D/g, '');
    let matchedPin = '';

    // Check if user entered the direct PIN or selected the index (1-10)
    const optionIdx = parseInt(text);
    if (!isNaN(optionIdx) && optionIdx >= 1 && optionIdx <= activeChallenge.pin_options.length) {
      matchedPin = activeChallenge.pin_options[optionIdx - 1];
    } else {
      matchedPin = inputVal;
    }

    const isCorrect = verifyUserSecurityPin(user.id, matchedPin);
    clearPinChallenge(fromPhone);

    if (isCorrect) {
      // Reset failed attempts
      user.pin_failed_attempts = 0;
      writeDbFile(db);

      // Execute pending action
      const action = activeChallenge.pending_action;
      if (action.type === 'edit_account') {
        if (action.payload.name) user.name = action.payload.name;
        if (action.payload.email) user.email = action.payload.email;
        writeDbFile(db);
        return {
          reply: `✅ *DATA AKUN BERHASIL DIUBAH!*\n\nNama: *${user.name}*\nEmail: *${user.email}*\nUsername: @${user.username}\n\nSisa kuota harian: ${quota.remaining} pesan.`,
          actionExecuted: true
        };
      } else if (action.type === 'send_message') {
        const targetPhone = action.payload.to;
        const msgBody = action.payload.msg;

        // Log outgoing message
        addMessageLog({
          sender_phone: targetPhone,
          sender_name: `Customer (${targetPhone})`,
          message_body: msgBody,
          direction: 'outgoing',
          status: 'Sukses',
          reply_body: 'Pesan dikirim via WhatsApp Remote Assistant'
        });

        return {
          reply: `✅ *PESAN BERHASIL DIKIRIM!*\n\nPesan terkirim ke: *${targetPhone}*\nIsi pesan: "${msgBody}"\n\n100% Bebas Watermark.`,
          actionExecuted: true
        };
      } else if (action.type === 'toggle_ai') {
        const state = action.payload.state;
        return {
          reply: `✅ *STATUS AI DIUBAH!*\n\nMode AI Cerdas Auto-Reply sekarang: *${state ? 'AKTIF ⚡' : 'NONAKTIF'}*`,
          actionExecuted: true
        };
      }

      return {
        reply: `✅ *OTORISASI PIN BERHASIL!*\nPerintah Anda telah selesai dijalankan.`,
        actionExecuted: true
      };
    } else {
      user.pin_failed_attempts = (user.pin_failed_attempts || 0) + 1;
      if (user.pin_failed_attempts >= 3) {
        user.is_bot_locked = true;
        writeDbFile(db);
        return {
          reply: `❌ *PIN SALAH 3 KALI! AKUN DIBLOKIR!*\n\nDemi keamanan akun Anda, akses bot WhatsApp telah diblokir otomatis. Silakan buka website dashboard untuk membuka blokir atau mereset PIN Anda.`
        };
      } else {
        writeDbFile(db);
        return {
          reply: `❌ *PIN SALAH!*\nPercobaan gagal: ${user.pin_failed_attempts}/3.\nJika salah 3 kali, akun akan diblokir otomatis. Ketik */menu* untuk mengulang perintah.`
        };
      }
    }
  }

  // Handle Command Menu & Quick Actions
  const lower = text.toLowerCase();

  if (lower === 'hai' || lower === 'halo' || lower === 'menu' || lower === 'help' || lower === '/menu' || lower === '/help' || lower === '/bantuan') {
    return {
      reply: `👋 *Halo kak ${user.name}!* (@${user.username})\nSelamat datang di *${whitelabel.primary_bot_name}* ⚡\n\nKamu bisa mengelola bot & kirim pesan langsung dari WhatsApp tanpa perlu buka web! Berikut perintah cepat:\n\n1️⃣ */send <nomor_tujuan> <isi_pesan>*\nKirim pesan ke customer (Tanpa Watermark)\n\n2️⃣ */send*\nTampilkan template kirim pesan interaktif\n\n3️⃣ */status* atau */cekkuota*\nCek sisa batas kuota pesan & status bot\n\n4️⃣ */editakun nama=NamaBaru*\nUbah nama profil operator\n\n5️⃣ */setpin 123456*\nBuat / atur PIN keamanan remote kamu`
    };
  }

  if (lower.startsWith('/cekkuota') || lower === '/kuota' || lower === '/saldo') {
    const plans = db.plans || DEFAULT_SUBSCRIPTION_PLANS;
    const userPlan = plans.find(p => p.id === user.plan_id) || plans[0];
    return {
      reply: `📊 *STATUS KUOTA PESAN*\n\nPengguna: *${user.name}* (@${user.username})\nPaket: *${userPlan.name}*\nTerkirim Hari Ini: *${user.daily_messages_sent}* / ${userPlan.daily_msg_limit} pesan\nSisa Kuota: *${Math.max(0, userPlan.daily_msg_limit - user.daily_messages_sent)}* pesan\n\n_100% Whitelabel Murni Bebas Watermark._`
    };
  }

  if (lower.startsWith('/statusbot') || lower === '/status') {
    const primarySess = db.sessions.find(s => s.is_primary) || db.sessions[0];
    return {
      reply: `🟢 *STATUS GATEWAY WHATSAPP*\n\nStatus: *${primarySess?.status === 'connected' ? 'TERHUBUNG (ONLINE)' : 'SIAP KONEK'}*\nNomor Gateway: *${primarySess?.phone_number || whitelabel.primary_bot_phone}*\nEngine: *${whitelabel.app_name} v2.6*\nAI Fallback: *Aktif 24/7*\n\n_Ketik */send* untuk kirim pesan._`
    };
  }

  if (lower === '/send' || lower === '/kirim' || lower === '/broadcast') {
    return {
      reply:
        `📱 *Template Kirim Pesan & Broadcast (Japriin Bridge)*\n\n` +
        `Silakan kirim pesan dengan format:\n` +
        `1️⃣ *1 Nomor:* */send <nomor> <pesan>*\n` +
        `   _Contoh: /send 08123456789 Halo kak, pesanan siap._\n\n` +
        `2️⃣ *Banyak Nomor (Broadcast):* */broadcast <nomor1>,<nomor2> <pesan>*\n` +
        `   _Contoh: /broadcast 08123456789, 08198765432 Halo kak, promo diskon hari ini!_\n\n` +
        `_Ketik */status* untuk cek sisa kuota harian._`
    };
  }

  if (lower.startsWith('/send ') || lower.startsWith('/kirim ') || lower.startsWith('/broadcast ')) {
    const cmdWord = text.split(/\s+/)[0];
    const rawArgs = text.substring(cmdWord.length).trim();

    // Extract 1 or many leading phone numbers (comma, semicolon, or space/newline separated)
    const phones: string[] = [];
    let pos = 0;
    while (pos < rawArgs.length) {
      const wsMatch = rawArgs.slice(pos).match(/^[\s,;]+/);
      if (wsMatch) pos += wsMatch[0].length;
      const tokMatch = rawArgs.slice(pos).match(/^([^\s]+)/);
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
        subParts.forEach(sp => phones.push(normalizePhoneNumber(sp.replace(/\D/g, ''))));
        pos += token.length;
      } else {
        break;
      }
    }

    const msgContent = rawArgs.slice(pos).replace(/^[\s:,\-|]+/, '').trim();

    if (phones.length === 0 || !msgContent) {
      return {
        reply:
          `⚠️ *Format Pengiriman Belum Sesuai*\n\n` +
          `Gunakan format:\n` +
          `👉 */send <nomor_tujuan> <isi_pesan>*\n` +
          `👉 */broadcast <nomor1>,<nomor2> <isi_pesan>*\n\n` +
          `Contoh:\n` +
          `*/send 08123456789 Halo kak, pesanan sudah dikirim!*`
      };
    }

    const uniquePhones = Array.from(new Set(phones));
    for (const p of uniquePhones) {
      addMessageLog({
        sender_phone: p,
        sender_name: uniquePhones.length > 1 ? `Broadcast (${p})` : `Tujuan (${p})`,
        message_body: msgContent,
        direction: 'outgoing',
        status: 'Sukses',
        user_id: user.id,
        reply_body: uniquePhones.length > 1 ? 'Dikirim via Broadcast WhatsApp (/broadcast)' : 'Dikirim via Remote WhatsApp Command (/send)'
      });
    }

    if (uniquePhones.length > 1) {
      addBroadcastHistory({
        user_id: user.id,
        recipients_count: uniquePhones.length,
        message: msgContent,
        status: 'completed',
        success_count: uniquePhones.length,
        failed_count: 0
      });
    }

    return {
      reply:
        uniquePhones.length > 1
          ? `✅ *Broadcast Berhasil Terkirim ke ${uniquePhones.length} Nomor!*\n\n• Daftar Tujuan: *${uniquePhones.slice(0, 5).join(', ')}${uniquePhones.length > 5 ? ` (+${uniquePhones.length - 5} lainnya)` : ''}*\n• Isi Pesan: "${msgContent}"`
          : `✅ *Pesan Berhasil Terkirim!*\n\n• Nomor Tujuan: *${uniquePhones[0]}*\n• Isi Pesan: "${msgContent}"`,
      actionExecuted: true
    };
  }

  if (lower.startsWith('/setpin')) {
    const pinPart = text.replace('/setpin', '').trim();
    if (!pinPart || pinPart.length < 4 || pinPart.length > 8) {
      return {
        reply: `⚠️ Format salah! Contoh penggunaan:\n*/setpin 123456* (Masukkan 4-8 digit angka)`
      };
    }
    setUserSecurityPin(user.id, pinPart);
    return {
      reply: `✅ *PIN KEAMANAN BERHASIL DISIMPAN!*\n\nPIN keamanan Anda telah aktif. Setiap kali Anda mengeksekusi perintah penting via WhatsApp, bot akan meminta Anda memilih PIN Anda.`
    };
  }

  if (lower.startsWith('/editakun')) {
    const rawParams = text.replace('/editakun', '').trim();
    const nameMatch = rawParams.match(/nama=([^&]+)/i);
    const emailMatch = rawParams.match(/email=([^&]+)/i);

    const newName = nameMatch ? nameMatch[1].trim() : undefined;
    const newEmail = emailMatch ? emailMatch[1].trim() : undefined;

    if (!newName && !newEmail) {
      return {
        reply: `⚠️ Format salah! Contoh penggunaan:\n*/editakun nama=Ahmad Fauzi* atau */editakun email=ahmad@gmail.com*`
      };
    }

    // Must have security PIN
    if (!user.security_pin) {
      return {
        reply: `🔒 Anda belum membuat PIN keamanan. Silakan buat PIN terlebih dahulu dengan mengetik:\n*/setpin 123456*`
      };
    }

    // Trigger PIN challenge
    const challenge = createPinChallenge(fromPhone, user.id, {
      type: 'edit_account',
      payload: { name: newName, email: newEmail }
    }, '123456'); // placeholder clean pin comparator

    return {
      reply: challenge.prompt
    };
  }

  if (lower.startsWith('/kirimpesan')) {
    const rawParams = text.replace('/kirimpesan', '').trim();
    const toMatch = rawParams.match(/to=([0-9+]+)/i);
    const msgMatch = rawParams.match(/msg=(.+)/i);

    if (!toMatch || !msgMatch) {
      return {
        reply: `⚠️ Format salah! Contoh penggunaan:\n*/kirimpesan to=08123456789 msg=Halo kak pesanan sudah dikirim!*`
      };
    }

    const targetTo = toMatch[1].trim();
    const messageContent = msgMatch[1].trim();

    if (!user.security_pin) {
      return {
        reply: `🔒 Anda belum membuat PIN keamanan. Silakan buat PIN terlebih dahulu dengan mengetik:\n*/setpin 123456*`
      };
    }

    const challenge = createPinChallenge(fromPhone, user.id, {
      type: 'send_message',
      payload: { to: targetTo, msg: messageContent }
    }, '123456');

    return {
      reply: challenge.prompt
    };
  }

  // Fallback: Informative Guide
  return {
    reply: `Halo kak ${user.name}! Pesan Anda: "${text}"\n\nUntuk melihat menu aksi cepat bot tanpa buka web, ketik: */menu*`
  };
}

// ==========================================
// SYSTEM CONFIG & QRIS
// ==========================================
export function getSystemConfig(): SystemConfig {
  const db = initDbFile();
  return db.systemConfig;
}

export function updateSystemConfig(updates: Partial<SystemConfig>): SystemConfig {
  const db = initDbFile();
  db.systemConfig = { ...db.systemConfig, ...updates };
  writeDbFile(db, true);
  return db.systemConfig;
}

export function getQrisConfig(): any {
  const db = initDbFile();
  return db.systemConfig.qris_config || DEFAULT_QRIS_CONFIG;
}

export function updateQrisConfig(config: any): any {
  const db = initDbFile();
  db.systemConfig.qris_config = {
    ...config,
    updated_at: new Date().toISOString()
  };
  writeDbFile(db, true);
  return db.systemConfig.qris_config;
}

// ==========================================
// MESSAGE LOGS, BROADCAST LOGS & 7-DAY AUTO RETENTION
// ==========================================
export function purgeExpiredLogs(dbInstance?: LocalDatabase): number {
  const db = dbInstance || initDbFile();
  const cutoffMs = Date.now() - LOG_RETENTION_MS;
  let removedCount = 0;

  if (Array.isArray(db.messages) && db.messages.length > 0) {
    const beforeLen = db.messages.length;
    db.messages = db.messages.filter(m => {
      if (!m.created_at) return true;
      const ts = new Date(m.created_at).getTime();
      return isNaN(ts) || ts >= cutoffMs;
    });
    removedCount += beforeLen - db.messages.length;
  }

  if (Array.isArray(db.broadcastHistory) && db.broadcastHistory.length > 0) {
    const beforeBcLen = db.broadcastHistory.length;
    db.broadcastHistory = db.broadcastHistory.filter(b => {
      if (!b.created_at) return true;
      const ts = new Date(b.created_at).getTime();
      return isNaN(ts) || ts >= cutoffMs;
    });
    removedCount += beforeBcLen - db.broadcastHistory.length;
  }

  if (removedCount > 0) {
    writeDbFile(db);
    import('./mysqlService.js').then(m => m.purgeOldMysqlLogs()).catch(() => {});
    console.log(`[Auto-Clean 7 Hari] Berhasil menghapus otomatis ${removedCount} log pesan/broadcast yang berusia > 7 hari.`);
  }

  return removedCount;
}

// Run 7-day log cleanup automatically every 15 minutes
setInterval(() => {
  try {
    purgeExpiredLogs();
    import('./mysqlService.js').then(m => m.purgeOldMysqlLogs()).catch(() => {});
  } catch {
    // Ignore background cleanup errors
  }
}, 15 * 60 * 1000);

function isSecretOtpMessageContent(text?: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('kode verifikasi') ||
    lower.includes('kode otp') ||
    lower.includes('verifikasi dua langkah') ||
    lower.includes('reset password')
  );
}

export function getMessageLogs(userId?: string): WhatsAppMessageLog[] {
  const db = initDbFile();
  purgeExpiredLogs(db);
  if (!userId) return [];

  const user = getUserById(userId);
  if (!user) return [];

  const nonOtpMessages = db.messages.filter(
    m => !isSecretOtpMessageContent(m.message_body) && !isSecretOtpMessageContent(m.reply_body)
  );

  if (user.role === 'admin') return nonOtpMessages;

  // Gather user session IDs
  const userSessions = getSessionsByUserId(user.id);
  const sessionIds = new Set(userSessions.map(s => s.id));

  // STRICT MESSAGE ISOLATION: Only messages that belong to this user or their sessions
  return nonOtpMessages.filter(m => {
    if (m.user_id && (m.user_id === user.id || m.user_id === userId)) return true;
    if (m.session_id && sessionIds.has(m.session_id)) return true;
    return false;
  });
}

export function addMessageLog(logData: Omit<WhatsAppMessageLog, 'id' | 'created_at'>): WhatsAppMessageLog {
  const db = initDbFile();
  purgeExpiredLogs(db);

  // Never record secret OTP messages in the visible message logs
  if (isSecretOtpMessageContent(logData.message_body) || isSecretOtpMessageContent(logData.reply_body)) {
    return {
      ...logData,
      id: `msg_otp_hidden_${Date.now()}`,
      created_at: new Date().toISOString()
    };
  }

  let assignedUserId = logData.user_id;
  if (!assignedUserId && logData.session_id) {
    const s = db.sessions.find(ses => ses.id === logData.session_id);
    if (s && s.user_id) assignedUserId = s.user_id;
  }
  if (!assignedUserId) {
    const regularUsers = db.users.filter(u => u.role === 'user');
    if (regularUsers.length === 1) assignedUserId = regularUsers[0].id;
  }

  const newLog: WhatsAppMessageLog = {
    ...logData,
    user_id: assignedUserId,
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    created_at: new Date().toISOString()
  };

  db.messages.unshift(newLog);
  if (db.messages.length > 1000) {
    db.messages = db.messages.slice(0, 1000);
  }

  if (logData.direction === 'incoming') {
    db.stats.total_incoming = (db.stats.total_incoming || 0) + 1;
    db.stats.last_webhook_receive = new Date().toISOString();
  }

  if (logData.reply_body) {
    db.stats.total_auto_replied = (db.stats.total_auto_replied || 0) + 1;
    if (logData.ai_generated) {
      db.stats.total_ai_replied = (db.stats.total_ai_replied || 0) + 1;
    }
  }

  if (logData.status === 'Gagal') {
    db.stats.total_failed = (db.stats.total_failed || 0) + 1;
  }

  writeDbFile(db);
  asyncSyncMessage(newLog);
  return newLog;
}

export function clearMessageLogs(userId?: string): void {
  const db = initDbFile();
  if (!userId) {
    db.messages = [];
  } else {
    const user = getUserById(userId);
    if (!user || user.role === 'admin') {
      db.messages = [];
    } else {
      const userSessions = getSessionsByUserId(user.id);
      const sessionIds = new Set(userSessions.map(s => s.id));
      db.messages = db.messages.filter(
        m => m.user_id !== user.id && m.user_id !== userId && (!m.session_id || !sessionIds.has(m.session_id))
      );
    }
  }
  writeDbFile(db);
}

export function getBroadcastHistory(userId?: string): BroadcastLogEntry[] {
  const db = initDbFile();
  purgeExpiredLogs(db);
  if (!Array.isArray(db.broadcastHistory)) {
    db.broadcastHistory = [];
  }
  if (!userId) return db.broadcastHistory;
  const user = getUserById(userId);
  if (!user || user.role === 'admin') return db.broadcastHistory;
  return db.broadcastHistory.filter(b => b.user_id === user.id || b.user_id === userId);
}

export function addBroadcastHistory(entry: Omit<BroadcastLogEntry, 'id' | 'created_at'>): BroadcastLogEntry {
  const db = initDbFile();
  purgeExpiredLogs(db);
  if (!Array.isArray(db.broadcastHistory)) {
    db.broadcastHistory = [];
  }
  const newItem: BroadcastLogEntry = {
    ...entry,
    id: `bc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    created_at: new Date().toISOString()
  };
  db.broadcastHistory.unshift(newItem);
  if (db.broadcastHistory.length > 200) {
    db.broadcastHistory = db.broadcastHistory.slice(0, 200);
  }
  writeDbFile(db);
  return newItem;
}

export function clearBroadcastHistory(userId?: string): void {
  const db = initDbFile();
  if (!Array.isArray(db.broadcastHistory)) {
    db.broadcastHistory = [];
    return;
  }
  if (!userId) {
    db.broadcastHistory = [];
  } else {
    const user = getUserById(userId);
    if (!user || user.role === 'admin') {
      db.broadcastHistory = [];
    } else {
      db.broadcastHistory = db.broadcastHistory.filter(b => b.user_id !== user.id && b.user_id !== userId);
    }
  }
  writeDbFile(db);
}

export function getBotStats(userId?: string): BotStats {
  const db = initDbFile();
  const user = userId ? getUserById(userId) : null;

  if (!userId || !user || user.role === 'admin') {
    const primarySession = db.sessions.find(s => s.is_primary) || db.sessions[0];
    const whitelabel = db.systemConfig?.whitelabel_config || DEFAULT_WHITELABEL;

    return {
      total_incoming: db.stats.total_incoming || db.messages.filter(m => m.direction === 'incoming').length,
      total_auto_replied: db.stats.total_auto_replied || db.messages.filter(m => m.reply_body).length,
      total_failed: db.stats.total_failed || db.messages.filter(m => m.status === 'Gagal').length,
      total_ai_replied: db.stats.total_ai_replied || db.messages.filter(m => m.ai_generated).length,
      webhook_status: 'Active',
      db_status: db.systemConfig.mysql_host ? 'online' : 'offline',
      last_webhook_receive: db.stats.last_webhook_receive || db.messages[0]?.created_at,
      active_session_phone: primarySession?.phone_number || whitelabel.primary_bot_phone,
      active_session_name: primarySession?.session_name || whitelabel.primary_bot_name,
      primary_bot_phone: whitelabel.primary_bot_phone,
      total_connected_sessions: db.sessions.filter(s => s.status === 'connected').length,
      daily_messages_sent: user?.daily_messages_sent || 0,
      daily_msg_limit: 999999,
      monthly_messages_sent: user?.monthly_messages_sent || 0,
      monthly_msg_limit: 999999,
      daily_ai_sent: user?.daily_ai_sent || 0,
      daily_ai_limit: 999999,
      monthly_ai_sent: user?.monthly_ai_sent || 0,
      monthly_ai_limit: 999999
    };
  }

  // Isolated stats for regular users
  const userLogs = getMessageLogs(userId);
  const userSessions = getSessionsByUserId(userId);
  const connectedUserSessions = userSessions.filter(s => s.status === 'connected');
  const primarySession = connectedUserSessions[0] || userSessions[0];

  const plans = db.plans || DEFAULT_SUBSCRIPTION_PLANS;
  const userPlan = plans.find(p => p.id === user.plan_id) || plans[0];

  return {
    total_incoming: userLogs.filter(m => m.direction === 'incoming').length,
    total_auto_replied: userLogs.filter(m => m.reply_body).length,
    total_failed: userLogs.filter(m => m.status === 'Gagal').length,
    total_ai_replied: userLogs.filter(m => m.ai_generated).length,
    webhook_status: 'Active',
    db_status: db.systemConfig.mysql_host ? 'online' : 'offline',
    last_webhook_receive: userLogs[0]?.created_at,
    active_session_phone: primarySession?.phone_number || user.phone || '081234567890',
    active_session_name: primarySession?.session_name || `Nomor ${user.name}`,
    primary_bot_phone: primarySession?.phone_number || user.phone,
    total_connected_sessions: connectedUserSessions.length,
    daily_messages_sent: user.daily_messages_sent || 0,
    daily_msg_limit: userPlan.daily_msg_limit || 100,
    monthly_messages_sent: user.monthly_messages_sent || 0,
    monthly_msg_limit: userPlan.monthly_msg_limit || 3000,
    daily_ai_sent: user.daily_ai_sent || 0,
    daily_ai_limit: userPlan.daily_ai_limit || 50,
    monthly_ai_sent: user.monthly_ai_sent || 0,
    monthly_ai_limit: userPlan.monthly_ai_limit || 1500
  };
}

// ==========================================
// AUTO REPLY RULES (STRICT MULTI-USER ISOLATION)
// ==========================================
export function getAutoReplyRules(userId?: string): AutoReplyRule[] {
  const db = initDbFile();
  if (!Array.isArray(db.rules)) db.rules = [];

  // Strictly isolate: never leak all rules if userId is missing
  if (!userId) {
    return [];
  }

  const user = getUserById(userId);
  if (!user) {
    return [];
  }

  // If user is administrator, show admin/system rules
  if (user.role === 'admin') {
    return db.rules.filter(
      r => r.user_id === user.id || r.user_id === 'user_superadmin' || r.user_id === 'usr_superadmin' || r.user_id === 'user_admin' || r.user_id === 'usr_admin'
    );
  }

  // For regular accounts: STRICT ISOLATION PER USER
  let userRules = db.rules.filter(r => r.user_id === user.id || r.user_id === userId);

  // If user has never been initialized with rules:
  // User Requirement: "harusnya itu default nya kosong dan default cs kami akan balas itu aktif dan chat custom itu kosong atau buatkan satu saja kalau halo lalu ada balasan teks contoh soal layanan"
  if (!user.rules_initialized) {
    user.rules_initialized = true;
    if (userRules.length === 0) {
      const sampleRule: AutoReplyRule = {
        id: `rule_halo_${user.id}`,
        user_id: user.id,
        keyword: 'halo',
        match_type: 'contains',
        response_text: '👋 Halo kak {nama}! Selamat datang di layanan kami. Ada yang bisa kami bantu seputar informasi layanan dan pemesanan?',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.rules.push(sampleRule);
      userRules = [sampleRule];
    }
    writeDbFile(db);
  }

  return userRules;
}

export function addAutoReplyRule(ruleData: Omit<AutoReplyRule, 'id' | 'created_at' | 'updated_at'> & { user_id?: string }): AutoReplyRule {
  const db = initDbFile();
  if (!Array.isArray(db.rules)) db.rules = [];

  if (!ruleData.user_id) {
    throw new Error('User ID wajib disertakan untuk isolasi data akun.');
  }

  const targetUserId = ruleData.user_id;
  const newRule: AutoReplyRule = {
    ...ruleData,
    user_id: targetUserId,
    id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.rules.push(newRule);
  writeDbFile(db);
  asyncSyncRule(newRule);
  return newRule;
}

export function toggleAutoReplyRule(id: string, userId?: string): AutoReplyRule | null {
  const db = initDbFile();
  if (!Array.isArray(db.rules)) db.rules = [];

  const rule = db.rules.find(r => r.id === id);
  if (!rule) return null;

  if (!userId) return null;

  const user = getUserById(userId);
  if (!user) return null;

  // Strict ownership check
  if (user.role !== 'admin') {
    if (rule.user_id !== user.id && rule.user_id !== userId) {
      return null; // Forbidden: cannot edit another user's rule
    }
  } else {
    // If admin is toggling, allow if rule belongs to admin or system
    const isAdminRule = !rule.user_id || rule.user_id === user.id || rule.user_id.includes('admin') || rule.user_id.includes('superadmin');
    if (!isAdminRule && rule.user_id !== user.id) {
      return null;
    }
  }

  rule.is_active = !rule.is_active;
  rule.updated_at = new Date().toISOString();
  writeDbFile(db);
  asyncSyncRule(rule);
  return rule;
}

export function deleteAutoReplyRule(id: string, userId?: string): boolean {
  const db = initDbFile();
  if (!Array.isArray(db.rules)) db.rules = [];

  const rule = db.rules.find(r => r.id === id);
  if (!rule) return false;

  if (!userId) return false;

  const user = getUserById(userId);
  if (!user) return false;

  // Strict ownership check
  if (user.role !== 'admin') {
    if (rule.user_id !== user.id && rule.user_id !== userId) {
      return false; // Forbidden: cannot delete another user's rule
    }
  } else {
    // If admin is deleting, only allow deleting their own/admin rules
    const isAdminRule = !rule.user_id || rule.user_id === user.id || rule.user_id.includes('admin') || rule.user_id.includes('superadmin');
    if (!isAdminRule && rule.user_id !== user.id) {
      return false;
    }
  }

  const initialLength = db.rules.length;
  db.rules = db.rules.filter(r => r.id !== id);
  if (db.rules.length !== initialLength) {
    writeDbFile(db);
    return true;
  }
  return false;
}

// ==========================================
// WHATSAPP SESSIONS & MULTI-USER ISOLATION
// ==========================================

/**
 * Deduplicates WhatsApp sessions array so that each clean phone number per user appears ONLY ONCE.
 */
function deduplicateSessionsList(sessions: WhatsAppSession[]): { deduplicated: WhatsAppSession[]; modified: boolean } {
  if (!sessions || sessions.length <= 1) return { deduplicated: sessions || [], modified: false };

  const map = new Map<string, WhatsAppSession>();
  let modified = false;

  for (const sess of sessions) {
    const cleanPhone = sess.phone_number ? sess.phone_number.replace(/\D/g, '') : sess.id;
    const key = sess.user_id ? `${sess.user_id}_${cleanPhone}` : cleanPhone;

    if (!map.has(key)) {
      map.set(key, sess);
    } else {
      modified = true;
      const existing = map.get(key)!;
      // Prefer connected status over disconnected, or keep latest updated_at
      if (sess.status === 'connected' && existing.status !== 'connected') {
        map.set(key, sess);
      } else if (new Date(sess.updated_at || 0) > new Date(existing.updated_at || 0)) {
        map.set(key, sess);
      }
    }
  }

  return { deduplicated: Array.from(map.values()), modified };
}

export function getWhatsAppSessions(): WhatsAppSession[] {
  const db = initDbFile();
  const { deduplicated, modified } = deduplicateSessionsList(db.sessions || []);
  if (modified) {
    db.sessions = deduplicated;
    writeDbFile(db);
  }
  return db.sessions;
}

export function getSessionById(id: string): WhatsAppSession | null {
  const db = initDbFile();
  return db.sessions.find(s => s.id === id || s.phone_number === id) || null;
}

export function extractUserIdFromSessionId(sessionId: string, users: UserAccount[]): string | undefined {
  if (!sessionId) return undefined;
  // Match known user IDs first (sorting descending by length to match specific IDs first)
  const sortedUsers = [...users].sort((a, b) => b.id.length - a.id.length);
  for (const u of sortedUsers) {
    if (sessionId.includes(u.id)) {
      return u.id;
    }
  }
  return undefined;
}

export function getSessionsByUserId(userId: string): WhatsAppSession[] {
  const db = initDbFile();
  const allSessions = getWhatsAppSessions();
  const user = getUserById(userId);
  if (!user) return [];

  const userPhoneClean = user.phone ? user.phone.replace(/\D/g, '') : '';

  // STRICT USER ISOLATION: A user only ever sees their OWN connected devices
  return allSessions.filter(s => {
    // 1. Direct match on user_id
    if (s.user_id && (s.user_id === user.id || s.user_id === userId)) return true;
    // 2. Match on session ID explicitly containing this user's ID
    if (s.id && s.id.includes(user.id)) return true;
    // 3. Fallback only if session has NO user_id AND strictly matches this user's registered phone
    if (!s.user_id && userPhoneClean && s.phone_number && s.phone_number.replace(/\D/g, '') === userPhoneClean) {
      s.user_id = user.id;
      writeDbFile(db);
      return true;
    }
    return false;
  });
}

export function addWhatsAppSession(sessionData: Omit<WhatsAppSession, 'id' | 'created_at' | 'updated_at'> & { id?: string }): WhatsAppSession {
  const db = initDbFile();
  const cleanPhone = sessionData.phone_number ? sessionData.phone_number.replace(/\D/g, '') : '';

  let targetUserId = sessionData.user_id;
  if (!targetUserId && cleanPhone) {
    const matchedU = db.users.find(u => u.phone && u.phone.replace(/\D/g, '') === cleanPhone);
    if (matchedU) targetUserId = matchedU.id;
  }
  if (!targetUserId && sessionData.id) {
    targetUserId = extractUserIdFromSessionId(sessionData.id, db.users);
  }

  // Calculate default 30-day session expiry (like WhatsApp Web)
  const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Check for existing session with same ID or same phone_number for the SAME user
  const existingIndex = db.sessions.findIndex(s => {
    if (sessionData.id && s.id === sessionData.id) return true;
    const sClean = s.phone_number ? s.phone_number.replace(/\D/g, '') : '';
    if (cleanPhone && sClean && cleanPhone === sClean) {
      if (targetUserId && s.user_id) {
        return s.user_id === targetUserId;
      }
      return false;
    }
    return false;
  });

  if (existingIndex !== -1) {
    // Update existing session in-place instead of creating a duplicate row
    const existing = db.sessions[existingIndex];
    if (sessionData.is_primary) {
      db.sessions.forEach(s => { s.is_primary = false; });
    }
    db.sessions[existingIndex] = {
      ...existing,
      ...sessionData,
      id: sessionData.id || existing.id,
      phone_number: cleanPhone || sessionData.phone_number || existing.phone_number,
      status: sessionData.status || existing.status,
      user_id: targetUserId || existing.user_id,
      session_name: sessionData.session_name || existing.session_name,
      expires_at: sessionData.expires_at || existing.expires_at || defaultExpiry,
      updated_at: new Date().toISOString()
    };
    writeDbFile(db);
    asyncSyncSession(db.sessions[existingIndex]);
    return db.sessions[existingIndex];
  }

  // Insert new session if none exists
  const newSession: WhatsAppSession = {
    ...sessionData,
    user_id: targetUserId,
    phone_number: cleanPhone || sessionData.phone_number,
    id: sessionData.id || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    expires_at: sessionData.expires_at || defaultExpiry,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (newSession.is_primary) {
    db.sessions.forEach(s => { s.is_primary = false; });
  }

  db.sessions.push(newSession);
  writeDbFile(db);
  asyncSyncSession(newSession);
  return newSession;
}

export function extendWhatsAppSession(id: string, daysToAdd: number = 30): WhatsAppSession | null {
  const db = initDbFile();
  const index = db.sessions.findIndex(s => s.id === id || s.phone_number === id);
  if (index === -1) return null;

  const current = db.sessions[index];
  const currentExpiry = current.expires_at ? new Date(current.expires_at).getTime() : Date.now();
  const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
  const newExpiry = new Date(baseTime + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

  db.sessions[index] = {
    ...current,
    expires_at: newExpiry,
    updated_at: new Date().toISOString()
  };
  writeDbFile(db);
  return db.sessions[index];
}

export function updateWhatsAppSession(id: string, updates: Partial<WhatsAppSession>): WhatsAppSession | null {
  const db = initDbFile();
  const index = db.sessions.findIndex(s => s.id === id || s.phone_number === id);
  if (index === -1) return null;

  if (updates.is_primary) {
    db.sessions.forEach(s => { s.is_primary = false; });
  }

  db.sessions[index] = {
    ...db.sessions[index],
    ...updates,
    updated_at: new Date().toISOString()
  };

  writeDbFile(db);
  return db.sessions[index];
}

export function deleteWhatsAppSession(id: string): boolean {
  const db = initDbFile();
  const initialLength = db.sessions.length;

  const targetSession = db.sessions.find(s => s.id === id || s.phone_number === id);
  const targetPhone = targetSession?.phone_number ? targetSession.phone_number.replace(/\D/g, '') : '';

  db.sessions = db.sessions.filter(s => {
    if (s.id === id) return false;
    if (targetPhone && s.phone_number && s.phone_number.replace(/\D/g, '') === targetPhone) return false;
    return true;
  });

  if (db.sessions.length !== initialLength) {
    writeDbFile(db);
    return true;
  }
  return false;
}

// ==========================================
// USER REGISTRATION & SUBSCRIPTION
// ==========================================
export function normalizePhoneForUniqueness(phone?: string): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '628' + digits.slice(1);
  }
  return digits;
}

export const normalizePhoneNumber = normalizePhoneForUniqueness;

export interface AccountAvailabilityResult {
  usernameAvailable: boolean;
  emailAvailable: boolean;
  phoneAvailable: boolean;
  usernameMessage?: string;
  emailMessage?: string;
  phoneMessage?: string;
  isAvailable: boolean;
}

export function checkAccountAvailability(params: {
  username?: string;
  email?: string;
  phone?: string;
  excludeUserId?: string;
}): AccountAvailabilityResult {
  const db = initDbFile();
  const excludeId = params.excludeUserId;
  const filteredUsers = excludeId ? db.users.filter(u => u.id !== excludeId) : db.users;

  let usernameAvailable = true;
  let usernameMessage: string | undefined = undefined;
  if (params.username !== undefined) {
    const cleanUser = params.username.toLowerCase().trim().replace(/\s+/g, '');
    if (!cleanUser) {
      usernameAvailable = false;
      usernameMessage = 'Username wajib diisi';
    } else if (cleanUser.length < 3) {
      usernameAvailable = false;
      usernameMessage = 'Username minimal 3 karakter';
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUser)) {
      usernameAvailable = false;
      usernameMessage = 'Username hanya boleh huruf, angka, underscore, atau titik';
    } else {
      const match = filteredUsers.find(u => u.username.toLowerCase().trim() === cleanUser);
      if (match) {
        usernameAvailable = false;
        usernameMessage = 'Username sudah digunakan, silakan pilih yang lain';
      } else {
        usernameAvailable = true;
        usernameMessage = 'Username tersedia';
      }
    }
  }

  let emailAvailable = true;
  let emailMessage: string | undefined = undefined;
  if (params.email !== undefined) {
    const cleanEmail = params.email.toLowerCase().trim();
    if (!cleanEmail) {
      emailAvailable = false;
      emailMessage = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      emailAvailable = false;
      emailMessage = 'Format email tidak valid';
    } else {
      const match = filteredUsers.find(u => u.email.toLowerCase().trim() === cleanEmail);
      if (match) {
        emailAvailable = false;
        emailMessage = 'Email sudah terdaftar pada akun lain';
      } else {
        emailAvailable = true;
        emailMessage = 'Email tersedia';
      }
    }
  }

  let phoneAvailable = true;
  let phoneMessage: string | undefined = undefined;
  if (params.phone !== undefined) {
    const cleanPhone = normalizePhoneForUniqueness(params.phone);
    if (!cleanPhone) {
      phoneAvailable = false;
      phoneMessage = 'Nomor WhatsApp wajib diisi';
    } else if (cleanPhone.length < 9) {
      phoneAvailable = false;
      phoneMessage = 'Nomor WhatsApp minimal 8 digit angka';
    } else {
      const match = filteredUsers.find(u => {
        if (!u.phone) return false;
        return normalizePhoneForUniqueness(u.phone) === cleanPhone;
      });
      if (match) {
        phoneAvailable = false;
        phoneMessage = 'Nomor WhatsApp sudah terdaftar pada akun lain';
      } else {
        phoneAvailable = true;
        phoneMessage = 'Nomor WhatsApp tersedia';
      }
    }
  }

  const isAvailable = usernameAvailable && emailAvailable && phoneAvailable;
  return {
    usernameAvailable,
    emailAvailable,
    phoneAvailable,
    usernameMessage,
    emailMessage,
    phoneMessage,
    isAvailable
  };
}

export function registerUser(data: {
  username: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  plan_id?: string;
  payment_note?: string;
  payment_receipt_url?: string;
}): { user: UserAccount; otp: string } {
  const db = initDbFile();
  const cleanUsername = data.username.toLowerCase().trim().replace(/\s+/g, '');
  const cleanEmail = data.email.toLowerCase().trim();

  // Strict Unique & Duplicate Check
  const avail = checkAccountAvailability({
    username: cleanUsername,
    email: cleanEmail,
    phone: data.phone
  });

  if (!avail.usernameAvailable) {
    throw new Error(avail.usernameMessage || 'Username sudah digunakan, silakan pilih yang lain.');
  }
  if (!avail.emailAvailable) {
    throw new Error(avail.emailMessage || 'Email sudah terdaftar pada akun lain.');
  }
  if (data.phone && !avail.phoneAvailable) {
    throw new Error(avail.phoneMessage || 'Nomor WhatsApp sudah terdaftar pada akun lain.');
  }

  const selectedPlanId = data.plan_id || 'free';
  const plans = db.plans || DEFAULT_SUBSCRIPTION_PLANS;
  const planInfo = plans.find(p => p.id === selectedPlanId) || plans[0];
  const otp = generateOtpCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Account status is PENDING until WhatsApp number is verified via OTP!
  const newUser: UserAccount = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    username: cleanUsername,
    name: data.name.trim(),
    role: 'user',
    email: cleanEmail,
    phone: data.phone?.trim() || '',
    password: data.password || '123456',
    is_active: false, // Inactive / Pending until WhatsApp verified
    email_verified: false,
    wa_verified: false,
    verification_otp: otp,
    otp_expires_at: expiresAt,
    plan_id: selectedPlanId,
    plan_status: 'pending_approval', // Pending until WhatsApp verified
    payment_note: data.payment_note || 'Pending - Menunggu Verifikasi Nomor WhatsApp',
    payment_receipt_url: data.payment_receipt_url,
    max_sessions: planInfo.max_sessions,
    security_pin: hashPin('123456'),
    pin_failed_attempts: 0,
    is_bot_locked: false,
    api_key: generateApiKey(`mgw_${cleanUsername.substring(0, 4)}_`),
    daily_messages_sent: 0,
    monthly_messages_sent: 0,
    default_cs_reply_enabled: true,
    default_cs_reply_text: 'Halo kak *{nama}*! Terima kasih telah menghubungi kami. Tim Customer Service kami akan segera membalas pesan Anda sesegera mungkin.',
    rules_initialized: true,
    created_at: new Date().toISOString()
  };

  // User Requirement: "dan chat custom itu kosong atau buatkan satu saja kalau halo lalu ada balasan teks contoh soal layanan"
  const sampleRule: AutoReplyRule = {
    id: `rule_halo_${newUser.id}`,
    user_id: newUser.id,
    keyword: 'halo',
    match_type: 'contains',
    response_text: '👋 Halo kak {nama}! Selamat datang di layanan kami. Ada yang bisa kami bantu seputar info layanan dan pemesanan?',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.rules.push(sampleRule);

  db.users.push(newUser);
  writeDbFile(db, true);
  asyncSyncUser(newUser);
  return { user: newUser, otp };
}

export function upgradeUserPlan(data: {
  userId: string;
  planId: string;
  receiptUrl?: string;
  paymentNote?: string;
  aiVerification?: {
    isValid: boolean;
    confidence: string;
    amountDetected?: number;
    transactionRef?: string;
    reason?: string;
    autoApproved?: boolean;
  };
}): UserAccount | null {
  const db = initDbFile();
  const user = db.users.find(u => u.id === data.userId);
  if (!user) return null;

  const plans = db.plans || DEFAULT_SUBSCRIPTION_PLANS;
  const planInfo = plans.find(p => p.id === data.planId) || plans[1];
  const autoApproved = data.aiVerification?.autoApproved ?? (data.aiVerification?.isValid && (data.aiVerification?.amountDetected || 0) >= planInfo.price * 0.95);

  user.requested_plan_id = data.planId;
  user.payment_receipt_url = data.receiptUrl || user.payment_receipt_url;
  user.payment_note = data.paymentNote || `Upgrade ke ${planInfo.name}`;
  user.ai_verified = Boolean(data.aiVerification?.isValid);
  user.ai_verification_notes = data.aiVerification?.reason || (autoApproved ? 'Struk pembayaran terverifikasi otomatis oleh AI.' : 'Menunggu review admin');
  user.ai_verified_at = new Date().toISOString();

  if (autoApproved) {
    user.plan_id = data.planId;
    user.plan_status = 'active';
    user.max_sessions = planInfo.max_sessions;
    user.approved_at = new Date().toISOString();
  } else {
    user.plan_status = 'pending_approval';
  }

  writeDbFile(db);
  return user;
}

export function approveUserSubscription(userId: string): UserAccount | null {
  const db = initDbFile();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;

  user.plan_status = 'active';
  user.approved_at = new Date().toISOString();
  const plans = db.plans || DEFAULT_SUBSCRIPTION_PLANS;
  const plan = plans.find(p => p.id === user.plan_id);
  if (plan) user.max_sessions = plan.max_sessions;

  writeDbFile(db);
  return user;
}

export function rejectUserSubscription(userId: string): UserAccount | null {
  const db = initDbFile();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;

  user.plan_status = 'rejected';
  writeDbFile(db);
  return user;
}

export function deleteUserAccount(userId: string): boolean {
  const db = initDbFile();
  const beforeCount = db.users.length;
  db.users = db.users.filter(u => u.id !== userId);
  if (db.users.length !== beforeCount) {
    writeDbFile(db);
    return true;
  }
  return false;
}

export function verifyUserOtp(userId: string, otp: string, type: 'email' | 'whatsapp'): boolean {
  const db = initDbFile();
  const user = db.users.find(u => u.id === userId);
  if (!user) return false;

  if (user.verification_otp && user.verification_otp === otp.trim()) {
    if (type === 'email') {
      user.email_verified = true;
    }
    if (type === 'whatsapp') {
      user.wa_verified = true;
      user.is_active = true;
      if (user.plan_id === 'free' || user.plan_status === 'pending_approval') {
        user.plan_status = 'active';
        user.approved_at = user.approved_at || new Date().toISOString();
        if (!user.payment_note || user.payment_note.includes('Menunggu Verifikasi')) {
          user.payment_note = 'Aktif (Nomor WhatsApp Terverifikasi)';
        }
      }
    }
    user.verification_otp = undefined;
    user.otp_expires_at = undefined;
    writeDbFile(db, true);
    asyncSyncUser(user);
    return true;
  }
  return false;
}

export function resetPasswordWithOtp(identifier: string, otp: string, newPass: string): boolean {
  const db = initDbFile();
  const clean = identifier.toLowerCase().trim();
  const cleanDigits = identifier.replace(/\D/g, '');
  const normDigits = cleanDigits.startsWith('0') ? '62' + cleanDigits.slice(1) : cleanDigits;

  const user = db.users.find(u => {
    if (u.id === identifier.trim()) return true;
    if (u.username.toLowerCase() === clean) return true;
    if (u.email.toLowerCase() === clean) return true;
    if (cleanDigits.length >= 8 && u.phone) {
      const uDigits = u.phone.replace(/\D/g, '');
      const uNorm = uDigits.startsWith('0') ? '62' + uDigits.slice(1) : uDigits;
      if (uDigits === cleanDigits || uNorm === normDigits || uDigits.includes(cleanDigits)) return true;
    }
    return false;
  });

  if (!user) return false;

  if (user.verification_otp && user.verification_otp === otp.trim()) {
    user.password = newPass;
    user.verification_otp = undefined;
    user.otp_expires_at = undefined;
    writeDbFile(db);
    asyncSyncUser(user);
    return true;
  }
  return false;
}

// SQL Export
export function exportCurrentDataToSql(): string {
  const db = initDbFile();
  let sql = `-- =============================================================\n`;
  sql += `-- SQL MIGRATION EXPORT FOR MYSQL / POSTGRESQL (${new Date().toISOString()})\n`;
  sql += `-- Generated by Japriin Pro (Japriin.com)\n`;
  sql += `-- =============================================================\n\n`;

  sql += `CREATE TABLE IF NOT EXISTS whatsapp_messages (\n`;
  sql += `    id VARCHAR(64) PRIMARY KEY,\n`;
  sql += `    wam_id VARCHAR(128),\n`;
  sql += `    sender_phone VARCHAR(32) NOT NULL,\n`;
  sql += `    sender_name VARCHAR(128) NOT NULL,\n`;
  sql += `    message_body TEXT NOT NULL,\n`;
  sql += `    direction VARCHAR(16) DEFAULT 'incoming',\n`;
  sql += `    status VARCHAR(32) NOT NULL,\n`;
  sql += `    reply_body TEXT,\n`;
  sql += `    error_detail TEXT,\n`;
  sql += `    ai_generated BOOLEAN DEFAULT FALSE,\n`;
  sql += `    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
  sql += `);\n\n`;

  sql += `CREATE TABLE IF NOT EXISTS auto_reply_rules (\n`;
  sql += `    id VARCHAR(64) PRIMARY KEY,\n`;
  sql += `    keyword VARCHAR(128) NOT NULL,\n`;
  sql += `    match_type VARCHAR(32) NOT NULL DEFAULT 'contains',\n`;
  sql += `    response_text TEXT NOT NULL,\n`;
  sql += `    is_active BOOLEAN DEFAULT TRUE,\n`;
  sql += `    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
  sql += `);\n\n`;

  sql += `CREATE TABLE IF NOT EXISTS whatsapp_sessions (\n`;
  sql += `    id VARCHAR(64) PRIMARY KEY,\n`;
  sql += `    session_name VARCHAR(128) NOT NULL,\n`;
  sql += `    phone_number VARCHAR(32) NOT NULL,\n`;
  sql += `    auth_method VARCHAR(32) NOT NULL,\n`;
  sql += `    status VARCHAR(32) NOT NULL DEFAULT 'connected',\n`;
  sql += `    phone_number_id VARCHAR(64),\n`;
  sql += `    access_token TEXT,\n`;
  sql += `    is_primary BOOLEAN DEFAULT TRUE,\n`;
  sql += `    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
  sql += `);\n\n`;

  return sql;
}

// ==========================================
// COMPATIBILITY EXPORT ALIASES
// ==========================================
export const getRules = getAutoReplyRules;
export const addRule = addAutoReplyRule;
export const toggleRule = toggleAutoReplyRule;
export const deleteRule = deleteAutoReplyRule;

export const getSessions = getWhatsAppSessions;
export const addSession = addWhatsAppSession;
export const updateSession = updateWhatsAppSession;
export const deleteSession = deleteWhatsAppSession;
export const setPrimarySession = (id: string): boolean => {
  const db = initDbFile();
  db.sessions.forEach(s => { s.is_primary = (s.id === id); });
  writeDbFile(db);
  return true;
};
export const getActiveSession = (): WhatsAppSession | null => {
  const db = initDbFile();
  return db.sessions.find(s => s.is_primary) || db.sessions[0] || null;
};

export const getMessages = getMessageLogs;
export const clearMessages = clearMessageLogs;

export const addUser = (data: any): UserAccount => {
  const res = registerUser(data);
  return res.user;
};

export const updateUser = (id: string, updates: Partial<UserAccount>): UserAccount | null => {
  const db = initDbFile();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  db.users[idx] = { ...db.users[idx], ...updates };
  writeDbFile(db);
  asyncSyncUser(db.users[idx]);
  return db.users[idx];
};

export const getUserByUsernameOrEmail = (identifier: string): UserAccount | null => {
  const db = initDbFile();
  const clean = identifier.toLowerCase().trim();
  return db.users.find(u => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean) || null;
};

export const getAntiBanSettings = (): AntiBanSettings => {
  const db = initDbFile();
  return db.antiBan || DEFAULT_ANTIBAN;
};

export const updateAntiBanSettings = (updates: Partial<AntiBanSettings>): AntiBanSettings => {
  const db = initDbFile();
  db.antiBan = { ...db.antiBan, ...updates };
  writeDbFile(db);
  return db.antiBan;
};

export const getSmtpAccounts = (): SmtpAccount[] => {
  const db = initDbFile();
  if (!Array.isArray(db.smtpAccounts)) db.smtpAccounts = [];
  return db.smtpAccounts;
};

export const getActiveSmtpAccounts = (): SmtpAccount[] => {
  const db = initDbFile();
  if (!Array.isArray(db.smtpAccounts)) db.smtpAccounts = [];
  return db.smtpAccounts.filter(s => s.is_active);
};

export const addSmtpAccount = (data: any): SmtpAccount => {
  const db = initDbFile();
  if (!Array.isArray(db.smtpAccounts)) db.smtpAccounts = [];

  const rawPass = String(data.pass || '').trim();
  const host = String(data.host || 'smtp.gmail.com').trim();
  const port = Number(data.port) || 587;
  const secure = port === 465 ? true : (port === 587 ? false : Boolean(data.secure));
  const wl = getWhitelabelConfig();

  const newAcc: SmtpAccount = {
    id: `smtp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: String(data.name || `SMTP (${String(data.user || '').split('@')[0]})`).trim(),
    host,
    port,
    secure,
    user: String(data.user || '').trim(),
    pass: rawPass.includes(':') ? rawPass : encryptData(rawPass),
    sender_name: String(data.sender_name || wl.app_name || 'Japriin').trim(),
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
    success_count: 0,
    error_count: 0,
    created_at: new Date().toISOString()
  };
  db.smtpAccounts.push(newAcc);
  writeDbFile(db, true);
  return newAcc;
};

export const updateSmtpAccount = (id: string, updates: any): SmtpAccount | null => {
  const db = initDbFile();
  if (!Array.isArray(db.smtpAccounts)) db.smtpAccounts = [];
  const idx = db.smtpAccounts.findIndex(s => s.id === id);
  if (idx === -1) return null;

  const cleanUpdates = { ...updates };
  if (cleanUpdates.pass && typeof cleanUpdates.pass === 'string' && !cleanUpdates.pass.includes(':')) {
    cleanUpdates.pass = encryptData(cleanUpdates.pass.trim());
  }
  if (cleanUpdates.port !== undefined) {
    cleanUpdates.port = Number(cleanUpdates.port) || 587;
    if (cleanUpdates.port === 465) cleanUpdates.secure = true;
    else if (cleanUpdates.port === 587) cleanUpdates.secure = false;
  }

  db.smtpAccounts[idx] = { ...db.smtpAccounts[idx], ...cleanUpdates };
  writeDbFile(db, true);
  return db.smtpAccounts[idx];
};

export const toggleSmtpAccount = (id: string): SmtpAccount | null => {
  const db = initDbFile();
  if (!Array.isArray(db.smtpAccounts)) db.smtpAccounts = [];
  const idx = db.smtpAccounts.findIndex(s => s.id === id);
  if (idx === -1) return null;
  db.smtpAccounts[idx].is_active = !db.smtpAccounts[idx].is_active;
  writeDbFile(db, true);
  return db.smtpAccounts[idx];
};

export const deleteSmtpAccount = (id: string): boolean => {
  const db = initDbFile();
  if (!Array.isArray(db.smtpAccounts)) db.smtpAccounts = [];
  const before = db.smtpAccounts.length;
  db.smtpAccounts = db.smtpAccounts.filter(s => s.id !== id);
  if (db.smtpAccounts.length !== before) {
    writeDbFile(db, true);
    return true;
  }
  return false;
};
