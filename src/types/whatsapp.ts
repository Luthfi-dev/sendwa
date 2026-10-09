export interface AntiBanSettings {
  enabled: boolean;
  min_delay_seconds: number;
  max_delay_seconds: number;
  typing_simulation: boolean;
  max_messages_per_minute: number;
  daily_quota_per_number: number;
  read_receipt_simulation: boolean;
}

export interface SubscriptionPlan {
  id: string; // 'free' | 'starter' | 'business' | 'pro' or custom
  name: string;
  price: number;
  period: string;
  max_sessions: number;
  daily_msg_limit: number;
  monthly_msg_limit?: number;
  daily_ai_limit?: number; // Batas berapa pesan yg bisa direspon AI per hari
  monthly_ai_limit?: number; // Batas berapa pesan yg bisa direspon AI per bulan
  features: string[];
  popular?: boolean;
  is_active?: boolean;
  updated_at?: string;
}

export interface QrisConfig {
  image_url: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  instructions: string;
  updated_at?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'user';
  email: string;
  phone?: string;
  password?: string;
  is_active: boolean;
  email_verified: boolean;
  wa_verified: boolean;
  verification_otp?: string;
  otp_expires_at?: string;
  plan_id: string;
  plan_status: 'pending_approval' | 'active' | 'rejected' | 'none';
  payment_note?: string;
  payment_receipt_url?: string;
  ai_verified?: boolean;
  ai_verification_notes?: string;
  ai_verified_at?: string;
  requested_plan_id?: string;
  max_sessions: number;
  security_pin?: string;
  pin_failed_attempts: number;
  is_bot_locked: boolean;
  allowed_numbers?: string[];
  ai_enabled?: boolean;
  api_key?: string;
  daily_messages_sent: number;
  monthly_messages_sent: number;
  daily_ai_sent?: number;
  monthly_ai_sent?: number;
  custom_gemini_key?: string; // Encrypted user's personal Gemini API key
  custom_offline_message?: string; // User's custom offline fallback message
  custom_system_prompt?: string; // User's custom Gemini system prompt
  default_cs_reply_enabled?: boolean; // Default CS auto reply toggle (default: true)
  default_cs_reply_text?: string; // Custom text for default CS auto reply
  rules_initialized?: boolean; // Whether initial sample rule has been initialized
  last_login_device?: string; // Device token of last login for 2FA detection
  last_quota_reset_date?: string;
  created_at: string;
  approved_at?: string;
}

export interface SmtpAccount {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  sender_name: string;
  is_active: boolean;
  success_count: number;
  error_count: number;
  last_used_at?: string;
  last_error?: string;
  created_at: string;
}

export interface GeminiApiKey {
  id: string;
  name: string;
  key: string;
  is_active: boolean;
  usage_count: number;
  error_count: number;
  last_used_at?: string;
  last_error?: string;
  created_at: string;
}

export interface AiBotConfig {
  enabled: boolean;
  system_prompt: string;
  model: string;
  fallback_when_no_rule: boolean;
  temperature?: number;
  offline_fallback_message?: string;
}

export interface AppWhitelabelConfig {
  app_name: string;
  tagline: string;
  logo_url?: string;
  company_name: string;
  support_phone: string;
  primary_bot_phone: string; // Nomor WhatsApp Gateway Utama Aplikasi
  primary_bot_name: string;
  footer_text: string;
  api_enabled: boolean;
  updated_at?: string;
}

export interface SystemConfig {
  whatsapp_token: string;
  phone_number_id: string;
  webhook_verify_token: string;
  app_url: string;
  mysql_host?: string;
  mysql_port?: number;
  mysql_user?: string;
  mysql_password?: string;
  mysql_database?: string;
  ai_config: AiBotConfig;
  qris_config?: QrisConfig;
  whitelabel_config?: AppWhitelabelConfig;
}

export interface WhatsAppSession {
  id: string;
  user_id?: string;
  session_name: string;
  phone_number: string;
  auth_method: 'qr_code' | 'pairing_code' | 'manual_token';
  status: 'connected' | 'connecting' | 'disconnected';
  phone_number_id?: string;
  access_token?: string;
  is_primary: boolean;
  qr_code_data?: string;
  pairing_code?: string;
  connected_at?: string;
  expires_at?: string; // Masa berlaku sesi (untuk timer hitung mundur kedaluwarsa)
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessageLog {
  id: string;
  wam_id?: string;
  user_id?: string;
  session_id?: string;
  sender_phone: string;
  sender_name: string;
  message_body: string;
  direction: 'incoming' | 'outgoing';
  status: 'Sukses' | 'Gagal' | 'Diterima' | 'Terkirim';
  reply_body?: string;
  error_detail?: string;
  created_at: string;
  ai_generated?: boolean;
}

export interface AutoReplyRule {
  id: string;
  user_id?: string;
  keyword: string;
  match_type: 'contains' | 'exact' | 'startsWith';
  response_text: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotStats {
  total_incoming: number;
  total_auto_replied: number;
  total_failed: number;
  total_ai_replied?: number;
  webhook_status: 'Active' | 'Inactive';
  db_status: 'offline' | 'online';
  last_webhook_receive?: string;
  active_session_phone?: string;
  active_session_name?: string;
  primary_bot_phone?: string;
  total_connected_sessions?: number;
  daily_messages_sent?: number;
  daily_msg_limit?: number;
  monthly_messages_sent?: number;
  monthly_msg_limit?: number;
  daily_ai_sent?: number;
  daily_ai_limit?: number;
  monthly_ai_sent?: number;
  monthly_ai_limit?: number;
}

export interface EnvConfigMasked {
  whatsapp_token_set: boolean;
  whatsapp_token_masked: string;
  phone_number_id_set: boolean;
  phone_number_id: string;
  webhook_verify_token: string;
  db_status: 'offline' | 'online';
  db_host: string;
  db_name: string;
  app_url: string;
  webhook_endpoint_url: string;
  active_phone_number?: string;
  primary_bot_phone?: string;
  smtp_accounts_count?: number;
  gemini_keys_count?: number;
  ai_reply_enabled?: boolean;
  app_name?: string;
  system_phone?: string;
}

export interface SimulatePayload {
  sender_phone: string;
  sender_name: string;
  message_body: string;
}

export interface MysqlConnectionStatus {
  connected: boolean;
  host?: string;
  port?: number;
  database?: string;
  version?: string;
  message?: string;
  checked_at?: string;
}

export interface RemoteBotChallenge {
  user_phone: string;
  user_id: string;
  pending_action: {
    type: 'edit_account' | 'send_message' | 'toggle_ai' | 'broadcast' | 'custom';
    payload: any;
  };
  correct_pin: string;
  pin_options: string[]; // 10 choices
  expires_at: number;
}
