import crypto from 'crypto';

// Secret encryption key derived from system environment or persistent seed
const ENCRYPTION_SECRET = process.env.APP_ENCRYPTION_KEY || 'maudigi-wa-gateway-security-key-2026-v2';
const KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Superadmin Master PIN (encrypted & salted hash comparator)
const MASTER_PIN_SALT = 'maudigi_master_superadmin_pin_salt_998822';
const MASTER_PIN_HASH = crypto.createHmac('sha256', MASTER_PIN_SALT).update('11110000').digest('hex');

/**
 * Encrypts a sensitive string (token, password, API key) using AES-256-CBC
 */
export function encryptData(text: string): string {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('Encryption error:', err);
    return text;
  }
}

/**
 * Decrypts an encrypted string
 */
export function decryptData(encryptedText: string): string {
  if (!encryptedText) return '';
  if (!encryptedText.includes(':')) return encryptedText; // not encrypted
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) return encryptedText;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText;
  }
}

/**
 * Hashes a user password with salt
 */
export function hashPassword(password: string): string {
  if (!password) return '';
  const salt = 'maudigi_salt_2026';
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

/**
 * Hashes a user security PIN
 */
export function hashPin(pin: string): string {
  if (!pin) return '';
  const salt = 'maudigi_pin_user_salt_2026';
  return crypto.createHmac('sha256', salt).update(pin.trim()).digest('hex');
}

/**
 * Verifies if entered PIN matches the superadmin Master PIN (11110000)
 */
export function verifyMasterPin(inputPin: string): boolean {
  if (!inputPin) return false;
  const hashedInput = crypto.createHmac('sha256', MASTER_PIN_SALT).update(inputPin.trim()).digest('hex');
  return hashedInput === MASTER_PIN_HASH;
}

/**
 * Masks a sensitive string for safe client display
 */
export function maskSensitiveString(str: string, showFirst = 4, showLast = 4): string {
  if (!str) return 'Belum diisi';
  const plain = decryptData(str);
  if (plain.length <= showFirst + showLast) {
    return '********';
  }
  return `${plain.substring(0, showFirst)}••••••••${plain.substring(plain.length - showLast)}`;
}

/**
 * Generates a secure random 6-digit numeric OTP code
 */
export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generates a random alphanumeric API Key for users / developers
 */
export function generateApiKey(prefix = 'mgw_live_'): string {
  return `${prefix}${crypto.randomBytes(16).toString('hex')}`;
}
