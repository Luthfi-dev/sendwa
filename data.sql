-- =============================================================
-- DATA.SQL - WhatsApp Business Cloud API Bot & Monitoring System
-- Database Schema for PostgreSQL / MySQL / Online DB Migration
-- =============================================================

-- 1. TABEL UTAMA: RIWAYAT PESAN (whatsapp_messages)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id VARCHAR(64) PRIMARY KEY,
    wam_id VARCHAR(128),                    -- ID unik dari Meta WhatsApp Cloud API
    sender_phone VARCHAR(32) NOT NULL,      -- Nomor WA Pengirim (e.g., 628123456789)
    sender_name VARCHAR(128) NOT NULL,     -- Nama Profil WhatsApp Pengirim
    message_body TEXT NOT NULL,             -- Isi Pesan Masuk
    direction VARCHAR(16) DEFAULT 'incoming', -- 'incoming' / 'outgoing'
    status VARCHAR(32) NOT NULL,            -- 'Sukses' / 'Gagal' / 'Diterima' / 'Terkirim'
    reply_body TEXT,                        -- Balasan Otomatis yang Dikirim
    error_detail TEXT,                      -- Log Error jika pengiriman gagal
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing untuk query cepat di Dashboard
CREATE INDEX IF NOT EXISTS idx_messages_sender ON whatsapp_messages(sender_phone);
CREATE INDEX IF NOT EXISTS idx_messages_created ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status ON whatsapp_messages(status);

-- 2. TABEL ATURAN AUTO-REPLY (auto_reply_rules)
CREATE TABLE IF NOT EXISTS auto_reply_rules (
    id VARCHAR(64) PRIMARY KEY,
    keyword VARCHAR(128) NOT NULL,          -- Kata kunci trigger (e.g. "halo", "hi", "1")
    match_type VARCHAR(32) NOT NULL DEFAULT 'contains', -- 'contains', 'exact', 'startsWith'
    response_text TEXT NOT NULL,            -- Teks Jawaban / Template Menu
    is_active BOOLEAN DEFAULT TRUE,         -- Status Aktif / Non-aktif
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABEL SESI & KONEKSI WHATSAPP (whatsapp_sessions - SCAN QR & PAIRING CODE)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id VARCHAR(64) PRIMARY KEY,
    session_name VARCHAR(128) NOT NULL,    -- Nama Label Sesi (e.g., 'WhatsApp Bot Utama')
    phone_number VARCHAR(32) NOT NULL,      -- Nomor Telepon WhatsApp Terkoneksi
    auth_method VARCHAR(32) NOT NULL,       -- 'qr_code' / 'pairing_code' / 'manual_token'
    status VARCHAR(32) NOT NULL DEFAULT 'connected', -- 'connected' / 'connecting' / 'disconnected'
    phone_number_id VARCHAR(64),            -- ID Nomor Telepon Meta (Opsional)
    access_token TEXT,                      -- Access Token Meta (Opsional)
    is_primary BOOLEAN DEFAULT TRUE,        -- Status Perangkat Utama
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_phone ON whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON whatsapp_sessions(status);

-- 4. TABEL PENGGUNA & SUBSCRIPTION (users)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'user', -- 'admin' / 'user'
    email VARCHAR(128) NOT NULL,
    phone VARCHAR(32),
    password VARCHAR(128) DEFAULT '123456',
    is_active BOOLEAN DEFAULT TRUE,
    plan_id VARCHAR(32) DEFAULT 'starter', -- 'starter', 'business', 'pro'
    plan_status VARCHAR(32) DEFAULT 'pending_approval', -- 'pending_approval', 'active', 'rejected'
    payment_note TEXT,
    max_sessions INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_plan_status ON users(plan_status);

-- 5. TABEL PENGATURAN ANTI-BAN (antiban_settings)
CREATE TABLE IF NOT EXISTS antiban_settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'default',
    enabled BOOLEAN DEFAULT TRUE,
    min_delay_seconds INT DEFAULT 3,
    max_delay_seconds INT DEFAULT 8,
    typing_simulation BOOLEAN DEFAULT TRUE,
    max_messages_per_minute INT DEFAULT 15,
    daily_quota_per_number INT DEFAULT 500,
    read_receipt_simulation BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABEL METRIK & LOGISTIK BOT (bot_metrics)
CREATE TABLE IF NOT EXISTS bot_metrics (
    metric_key VARCHAR(64) PRIMARY KEY,
    metric_value BIGINT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- INITIAL SEED DATA (Aturan Bawaan Default, User Seed, & Metrik Awal)
-- =============================================================

-- Seed User Administrator & Demo User
INSERT INTO users (id, username, name, role, email, phone, password, is_active, plan_id, plan_status, max_sessions)
VALUES
('user_admin_1', 'admin', 'Administrator Maudigi', 'admin', 'admin@maudigi.com', '6281234567890', 'admin123', TRUE, 'pro', 'active', 10),
('user_demo_1', 'demouser', 'Pengguna Demo Business', 'user', 'user@maudigi.com', '6289876543210', 'user123', TRUE, 'business', 'active', 3)
ON CONFLICT (id) DO NOTHING;

-- Seed Default Anti-Ban Configuration
INSERT INTO antiban_settings (id, enabled, min_delay_seconds, max_delay_seconds, typing_simulation)
VALUES ('default', TRUE, 3, 8, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed Sesi Koneksi WA Awal
INSERT INTO whatsapp_sessions (id, session_name, phone_number, auth_method, status, is_primary)
VALUES 
('session_primary_default', 'WhatsApp Bot Utama', '6281234567890', 'qr_code', 'connected', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed Aturan Auto-Reply Default
INSERT INTO auto_reply_rules (id, keyword, match_type, response_text, is_active)
VALUES 
('rule_halo', 'halo', 'contains', '👋 Halo {nama}! Selamat datang di Layanan Otomatis WhatsApp.\n\nBerikut menu layanan kami:\n1️⃣ *Info Layanan*\n2️⃣ *Jam Operasional*\n3️⃣ *Bantuan Customer Service*\n\nKetik *1*, *2*, atau *3* untuk informasi lebih lanjut!', TRUE),
('rule_hi', 'hi', 'exact', '👋 Hi {nama}! Selamat datang di Layanan Otomatis WhatsApp.\n\nBerikut menu layanan kami:\n1️⃣ *Info Layanan*\n2️⃣ *Jam Operasional*\n3️⃣ *Bantuan Customer Service*\n\nKetik *1*, *2*, atau *3* untuk informasi lebih lanjut!', TRUE),
('rule_menu_1', '1', 'exact', 'ℹ️ *INFO LAYANAN*\n\nKami menyediakan solusi otomasi pesan WhatsApp Business resmi yang aman, terintegrasi Webhook, dan dilengkapi dashboard real-time.', TRUE),
('rule_menu_2', '2', 'exact', '⏰ *JAM OPERASIONAL*\n\nLayanan Layanan Bot Otomatis kami beroperasi 24/7 tanpa henti.\nTim Support Customer Service kami siap melayani Senin - Jumat, pukul 08.00 - 17.00 WIB.', TRUE),
('rule_menu_3', '3', 'exact', '📞 *BANTUAN CUSTOMER SERVICE*\n\nSilakan sampaikan pertanyaan Anda secara detail. Tim kami akan menghubungi Anda segera.', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed Initial Metrics
INSERT INTO bot_metrics (metric_key, metric_value)
VALUES 
('total_incoming', 0),
('total_auto_replied', 0),
('total_failed', 0)
ON CONFLICT (metric_key) DO NOTHING;
