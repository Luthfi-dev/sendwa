import mysql from 'mysql2/promise';
import { getSystemConfig, initDbFile } from './db.js';
import { MysqlConnectionStatus, WhatsAppMessageLog, WhatsAppSession, UserAccount, AutoReplyRule } from '../types/whatsapp.js';

let sharedPool: mysql.Pool | null = null;
let activePoolKey = '';

/**
 * Returns a high-performance MySQL connection pool for concurrent traffic (up to 10,000 users)
 */
export function getMysqlPool(configOverride?: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}): mysql.Pool {
  const sysConfig = getSystemConfig();
  const host = configOverride?.host || sysConfig.mysql_host || '15.235.193.207';
  const port = Number(configOverride?.port || sysConfig.mysql_port || 3306);
  const user = configOverride?.user || sysConfig.mysql_user || 'maudigic_baru';
  const password = configOverride?.password !== undefined ? configOverride.password : (sysConfig.mysql_password || '');
  const database = configOverride?.database || sysConfig.mysql_database || 'maudigic_whatsappsend';

  const poolKey = `${host}:${port}:${user}:${database}`;
  if (!sharedPool || activePoolKey !== poolKey) {
    if (sharedPool) {
      sharedPool.end().catch(() => {});
    }
    sharedPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 40,
      queueLimit: 0,
      connectTimeout: 5000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });
    activePoolKey = poolKey;
  }
  return sharedPool;
}

/**
 * Ensures MySQL online database and all tables exist
 */
export async function initMysqlSchemaIfNotExists(): Promise<boolean> {
  try {
    const sysConfig = getSystemConfig();
    const host = sysConfig.mysql_host || '15.235.193.207';
    const port = Number(sysConfig.mysql_port || 3306);
    const user = sysConfig.mysql_user || 'maudigic_baru';
    const password = sysConfig.mysql_password || '';
    const database = sysConfig.mysql_database || 'maudigic_whatsappsend';

    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      connectTimeout: 6000
    });

    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${database}\``);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id VARCHAR(64) PRIMARY KEY,
        wam_id VARCHAR(128),
        user_id VARCHAR(64),
        session_id VARCHAR(64),
        sender_phone VARCHAR(32) NOT NULL,
        sender_name VARCHAR(128) NOT NULL,
        message_body TEXT NOT NULL,
        direction VARCHAR(16) DEFAULT 'incoming',
        status VARCHAR(32) NOT NULL,
        reply_body TEXT,
        error_detail TEXT,
        ai_generated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender_phone (sender_phone),
        INDEX idx_created_at (created_at),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS auto_reply_rules (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64),
        keyword VARCHAR(128) NOT NULL,
        match_type VARCHAR(32) NOT NULL DEFAULT 'contains',
        response_text TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_keyword (keyword)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64),
        session_name VARCHAR(128) NOT NULL,
        phone_number VARCHAR(32) NOT NULL,
        auth_method VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'connected',
        phone_number_id VARCHAR(64),
        access_token TEXT,
        is_primary BOOLEAN DEFAULT TRUE,
        expires_at TIMESTAMP NULL,
        connected_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_phone (phone_number),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(128) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'user',
        email VARCHAR(128) NOT NULL,
        phone VARCHAR(32),
        password VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        email_verified BOOLEAN DEFAULT FALSE,
        wa_verified BOOLEAN DEFAULT FALSE,
        plan_id VARCHAR(32) DEFAULT 'free',
        plan_status VARCHAR(32) DEFAULT 'active',
        payment_note TEXT,
        api_key VARCHAR(128),
        max_sessions INT DEFAULT 1,
        daily_messages_sent INT DEFAULT 0,
        monthly_messages_sent INT DEFAULT 0,
        security_pin VARCHAR(255),
        verification_otp VARCHAR(16),
        otp_expires_at VARCHAR(64),
        custom_gemini_key TEXT,
        custom_offline_message TEXT,
        default_cs_reply_enabled BOOLEAN DEFAULT TRUE,
        default_cs_reply_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      DELETE FROM whatsapp_messages WHERE created_at < NOW() - INTERVAL 7 DAY
    `).catch(() => {});

    await conn.end();
    console.log('[Online DB] Skema Database Cloud Online MySQL terverifikasi & aktif! (Auto-Clean Log > 7 Hari Aktif)');
    return true;
  } catch (err: any) {
    console.warn('[Online DB] Inisialisasi skema MySQL ditunda (server offline/timeout):', err?.message);
    return false;
  }
}

/**
 * Automatically purges message logs older than 7 days in MySQL online database
 */
export async function purgeOldMysqlLogs(): Promise<void> {
  try {
    const pool = getMysqlPool();
    await pool.query(`DELETE FROM whatsapp_messages WHERE created_at < NOW() - INTERVAL 7 DAY`);
  } catch {
    // Non-blocking
  }
}

/**
 * Real-time asynchronous push of message log to MySQL online database
 */
export async function pushMessageToMysql(m: WhatsAppMessageLog): Promise<void> {
  try {
    const pool = getMysqlPool();
    await pool.query(`
      INSERT INTO whatsapp_messages (id, wam_id, user_id, session_id, sender_phone, sender_name, message_body, direction, status, reply_body, error_detail, ai_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE status=VALUES(status), reply_body=VALUES(reply_body), error_detail=VALUES(error_detail)
    `, [
      m.id,
      m.wam_id || null,
      m.user_id || null,
      m.session_id || null,
      m.sender_phone,
      m.sender_name,
      m.message_body,
      m.direction,
      m.status,
      m.reply_body || null,
      m.error_detail || null,
      m.ai_generated || false
    ]);
  } catch {
    // Non-blocking for high concurrency
  }
}

/**
 * Real-time asynchronous push of session to MySQL online database
 */
export async function pushSessionToMysql(s: WhatsAppSession): Promise<void> {
  try {
    const pool = getMysqlPool();
    await pool.query(`
      INSERT INTO whatsapp_sessions (id, user_id, session_name, phone_number, auth_method, status, is_primary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE session_name=VALUES(session_name), status=VALUES(status), is_primary=VALUES(is_primary)
    `, [
      s.id,
      s.user_id || null,
      s.session_name,
      s.phone_number,
      s.auth_method,
      s.status,
      Boolean(s.is_primary)
    ]);
  } catch {
    // Non-blocking
  }
}

/**
 * Real-time asynchronous push of user account to MySQL online database
 */
export async function pushUserToMysql(u: UserAccount): Promise<void> {
  try {
    const pool = getMysqlPool();
    await pool.query(`
      INSERT INTO users (id, username, name, role, email, phone, password, is_active, email_verified, wa_verified, plan_id, plan_status, api_key, daily_messages_sent, monthly_messages_sent, security_pin, verification_otp, otp_expires_at, custom_gemini_key, custom_offline_message, default_cs_reply_enabled, default_cs_reply_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), password=VALUES(password), plan_id=VALUES(plan_id), plan_status=VALUES(plan_status), api_key=VALUES(api_key), daily_messages_sent=VALUES(daily_messages_sent), monthly_messages_sent=VALUES(monthly_messages_sent), security_pin=VALUES(security_pin), verification_otp=VALUES(verification_otp), otp_expires_at=VALUES(otp_expires_at), custom_gemini_key=VALUES(custom_gemini_key), custom_offline_message=VALUES(custom_offline_message), default_cs_reply_enabled=VALUES(default_cs_reply_enabled), default_cs_reply_text=VALUES(default_cs_reply_text)
    `, [
      u.id,
      u.username,
      u.name,
      u.role,
      u.email,
      u.phone || '',
      u.password || '',
      Boolean(u.is_active),
      Boolean(u.email_verified),
      Boolean(u.wa_verified),
      u.plan_id,
      u.plan_status,
      u.api_key || null,
      u.daily_messages_sent || 0,
      u.monthly_messages_sent || 0,
      u.security_pin || null,
      u.verification_otp || null,
      u.otp_expires_at || null,
      u.custom_gemini_key || null,
      u.custom_offline_message || null,
      u.default_cs_reply_enabled !== false ? 1 : 0,
      u.default_cs_reply_text || null
    ]);
  } catch (err) {
    console.error('[MySQL Push User Error]', err);
  }
}

/**
 * Real-time asynchronous push of auto reply rule to MySQL online database
 */
export async function pushRuleToMysql(r: AutoReplyRule): Promise<void> {
  try {
    const pool = getMysqlPool();
    await pool.query(`
      INSERT INTO auto_reply_rules (id, user_id, keyword, match_type, response_text, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE response_text=VALUES(response_text), is_active=VALUES(is_active)
    `, [
      r.id,
      r.user_id || null,
      r.keyword,
      r.match_type,
      r.response_text,
      Boolean(r.is_active)
    ]);
  } catch {
    // Non-blocking
  }
}

/**
 * Tests live connection to an external MySQL database
 */
export async function testMysqlConnection(configOverride?: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}): Promise<MysqlConnectionStatus> {
  const sysConfig = getSystemConfig();
  const host = configOverride?.host || sysConfig.mysql_host || 'localhost';
  const port = Number(configOverride?.port || sysConfig.mysql_port || 3306);
  const user = configOverride?.user || sysConfig.mysql_user || 'root';
  const password = configOverride?.password !== undefined ? configOverride.password : (sysConfig.mysql_password || '');
  const database = configOverride?.database || sysConfig.mysql_database || 'maudigi_wa_gateway';

  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      connectTimeout: 7000
    });

    const [rows] = await connection.query('SELECT VERSION() as version');
    const version = (rows as any)?.[0]?.version || 'Cloud DB 8.0';

    // Check if database exists
    let dbExists = false;
    try {
      const [dbRows] = await connection.query(`SHOW DATABASES LIKE ?`, [database]);
      dbExists = Array.isArray(dbRows) && dbRows.length > 0;
    } catch {
      // Fallback
    }

    await connection.end();

    return {
      connected: true,
      host,
      port,
      database: `${database} (${dbExists ? 'Tersedia' : 'Belum Dibuat'})`,
      version,
      message: `Koneksi Database Cloud Sukses! Server v${version} aktif dan merespons normal.`,
      checked_at: new Date().toISOString()
    };
  } catch (err: any) {
    return {
      connected: false,
      host,
      port,
      database,
      message: `Gagal terhubung ke Database Cloud: ${err?.message || 'Connection refused / timeout'}`,
      checked_at: new Date().toISOString()
    };
  }
}

/**
 * Synchronizes and pushes database structure and local data to online MySQL
 */
export async function syncPushStructureAndData(configOverride?: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}): Promise<{
  success: boolean;
  message: string;
  tables_created: string[];
  records_pushed: { [key: string]: number };
  logs: string[];
}> {
  const sysConfig = getSystemConfig();
  const host = configOverride?.host || sysConfig.mysql_host || 'localhost';
  const port = Number(configOverride?.port || sysConfig.mysql_port || 3306);
  const user = configOverride?.user || sysConfig.mysql_user || 'root';
  const password = configOverride?.password !== undefined ? configOverride.password : (sysConfig.mysql_password || '');
  const database = configOverride?.database || sysConfig.mysql_database || 'maudigi_wa_gateway';

  const logs: string[] = [];
  const tablesCreated: string[] = [];
  const recordsPushed: { [key: string]: number } = {};

  try {
    logs.push(`[1/5] Menghubungkan ke host MySQL: ${host}:${port}...`);
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      connectTimeout: 10000,
      multipleStatements: true
    });
    logs.push('✓ Terhubung ke server MySQL.');

    // Create database if not exists
    logs.push(`[2/5] Memeriksa & membuat database '${database}'...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${database}\``);
    logs.push(`✓ Database '${database}' siap digunakan.`);

    // Create Tables DDL
    logs.push('[3/5] Mendorong struktur tabel (DDL)...');

    // 1. messages
    await connection.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id VARCHAR(64) PRIMARY KEY,
        wam_id VARCHAR(128),
        sender_phone VARCHAR(32) NOT NULL,
        sender_name VARCHAR(128) NOT NULL,
        message_body TEXT NOT NULL,
        direction VARCHAR(16) DEFAULT 'incoming',
        status VARCHAR(32) NOT NULL,
        reply_body TEXT,
        error_detail TEXT,
        ai_generated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender_phone (sender_phone),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tablesCreated.push('whatsapp_messages');

    // 2. auto_reply_rules
    await connection.query(`
      CREATE TABLE IF NOT EXISTS auto_reply_rules (
        id VARCHAR(64) PRIMARY KEY,
        keyword VARCHAR(128) NOT NULL,
        match_type VARCHAR(32) NOT NULL DEFAULT 'contains',
        response_text TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_keyword (keyword)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tablesCreated.push('auto_reply_rules');

    // 3. whatsapp_sessions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id VARCHAR(64) PRIMARY KEY,
        session_name VARCHAR(128) NOT NULL,
        phone_number VARCHAR(32) NOT NULL,
        auth_method VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'connected',
        phone_number_id VARCHAR(64),
        access_token TEXT,
        is_primary BOOLEAN DEFAULT TRUE,
        connected_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_phone (phone_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tablesCreated.push('whatsapp_sessions');

    // 4. users
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(128) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'user',
        email VARCHAR(128) NOT NULL,
        phone VARCHAR(32),
        password VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        email_verified BOOLEAN DEFAULT FALSE,
        wa_verified BOOLEAN DEFAULT FALSE,
        plan_id VARCHAR(32) DEFAULT 'free',
        plan_status VARCHAR(32) DEFAULT 'active',
        payment_note TEXT,
        api_key VARCHAR(128),
        max_sessions INT DEFAULT 1,
        daily_messages_sent INT DEFAULT 0,
        monthly_messages_sent INT DEFAULT 0,
        security_pin VARCHAR(255),
        verification_otp VARCHAR(16),
        otp_expires_at VARCHAR(64),
        custom_gemini_key TEXT,
        custom_offline_message TEXT,
        default_cs_reply_enabled BOOLEAN DEFAULT TRUE,
        default_cs_reply_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tablesCreated.push('users');

    // 5. smtp_accounts
    await connection.query(`
      CREATE TABLE IF NOT EXISTS smtp_accounts (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        host VARCHAR(128) NOT NULL DEFAULT 'smtp.gmail.com',
        port INT NOT NULL DEFAULT 587,
        secure BOOLEAN DEFAULT FALSE,
        user VARCHAR(128) NOT NULL,
        pass TEXT NOT NULL,
        sender_name VARCHAR(128) DEFAULT 'Japriin',
        is_active BOOLEAN DEFAULT TRUE,
        success_count INT DEFAULT 0,
        error_count INT DEFAULT 0,
        last_used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tablesCreated.push('smtp_accounts');

    // 6. gemini_keys
    await connection.query(`
      CREATE TABLE IF NOT EXISTS gemini_keys (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        api_key TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        usage_count INT DEFAULT 0,
        error_count INT DEFAULT 0,
        last_used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tablesCreated.push('gemini_keys');

    logs.push(`✓ Berhasil memverifikasi ${tablesCreated.length} tabel di MySQL online.`);

    // [4/5] Seed and push current local data
    logs.push('[4/5] Mendorong data lokal ke MySQL online...');
    const db = initDbFile();

    // Push sessions
    let sessCount = 0;
    for (const s of db.sessions) {
      await connection.query(`
        INSERT INTO whatsapp_sessions (id, session_name, phone_number, auth_method, status, is_primary)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE session_name=VALUES(session_name), status=VALUES(status)
      `, [s.id, s.session_name, s.phone_number, s.auth_method, s.status, s.is_primary]);
      sessCount++;
    }
    recordsPushed['whatsapp_sessions'] = sessCount;

    // Push rules
    let ruleCount = 0;
    for (const r of db.rules) {
      await connection.query(`
        INSERT INTO auto_reply_rules (id, keyword, match_type, response_text, is_active)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE response_text=VALUES(response_text), is_active=VALUES(is_active)
      `, [r.id, r.keyword, r.match_type, r.response_text, r.is_active]);
      ruleCount++;
    }
    recordsPushed['auto_reply_rules'] = ruleCount;

    // Push users
    let userCount = 0;
    for (const u of db.users) {
      await connection.query(`
        INSERT INTO users (id, username, name, role, email, phone, password, is_active, email_verified, wa_verified, plan_id, plan_status, api_key, daily_messages_sent, monthly_messages_sent, security_pin, verification_otp, otp_expires_at, custom_gemini_key, custom_offline_message, default_cs_reply_enabled, default_cs_reply_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), password=VALUES(password), role=VALUES(role), plan_status=VALUES(plan_status), api_key=VALUES(api_key), security_pin=VALUES(security_pin)
      `, [
        u.id,
        u.username,
        u.name,
        u.role,
        u.email,
        u.phone || '',
        u.password || '',
        Boolean(u.is_active),
        Boolean(u.email_verified),
        Boolean(u.wa_verified),
        u.plan_id,
        u.plan_status,
        u.api_key || null,
        u.daily_messages_sent || 0,
        u.monthly_messages_sent || 0,
        u.security_pin || null,
        u.verification_otp || null,
        u.otp_expires_at || null,
        u.custom_gemini_key || null,
        u.custom_offline_message || null,
        u.default_cs_reply_enabled !== false ? 1 : 0,
        u.default_cs_reply_text || null
      ]);
      userCount++;
    }
    recordsPushed['users'] = userCount;

    // Push messages
    let msgCount = 0;
    for (const m of db.messages.slice(0, 200)) {
      await connection.query(`
        INSERT INTO whatsapp_messages (id, wam_id, sender_phone, sender_name, message_body, direction, status, reply_body, ai_generated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status=VALUES(status)
      `, [m.id, m.wam_id || null, m.sender_phone, m.sender_name, m.message_body, m.direction, m.status, m.reply_body || null, m.ai_generated || false]);
      msgCount++;
    }
    recordsPushed['whatsapp_messages'] = msgCount;

    await connection.end();

    logs.push('[5/5] Selesai! Struktur & data telah tersinkronisasi sempurna ke database MySQL.');

    return {
      success: true,
      message: 'Struktur tabel & data berhasil dipush ke database online MySQL!',
      tables_created: tablesCreated,
      records_pushed: recordsPushed,
      logs
    };
  } catch (err: any) {
    logs.push(`❌ Gagal: ${err?.message}`);
    return {
      success: false,
      message: `Proses push ke MySQL gagal: ${err?.message}`,
      tables_created: tablesCreated,
      records_pushed: recordsPushed,
      logs
    };
  }
}
