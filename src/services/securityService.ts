import crypto from "crypto";

export class SecurityService {
  /**
   * Generates a forensic hash for an entity state
   * Used for "Vault" integrity and "Audit Trail" verification
   */
  static generateForensicHash(data: any): string {
    const serialized = JSON.stringify(data);
    const salt = process.env.SYSTEM_SALT;
    if (!salt) {
      throw new Error("SYSTEM_SALT environment variable is not set. Refusing to generate a forensic hash with a fallback.");
    }
    return crypto.createHmac('sha256', salt)
      .update(serialized)
      .digest('hex');
  }

  /**
   * Verifies a payload against its recorded hash
   */
  static verifyIntegrity(data: any, hash: string): boolean {
    const currentHash = this.generateForensicHash(data);
    const a = Buffer.from(currentHash, 'utf8');
    const b = Buffer.from(hash, 'utf8');
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Sanitizes sensitive information for logs
   */
  static scrubPII(text: string): string {
    if (!text) return "";
    // Enhanced regex for credit cards, accounts, SSNs, emails, phones, private identifiers, API keys
    return text
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, "[CREDIT_CARD_REDACTED]")
      .replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, "[SSN_REDACTED]")
      .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "[EMAIL_REDACTED]")
      .replace(/\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g, "[PHONE_REDACTED]")
      .replace(/\b(lf_live_[a-zA-Z0-9_-]+|lf_test_[a-zA-Z0-9_-]+|sk_live_[a-zA-Z0-9_-]+|sk_test_[a-zA-Z0-9_-]+)\b/g, "[SECRET_KEY_REDACTED]")
      .replace(/\b\d{8,12}\b/g, "[ACCOUNT_REDACTED]")
      .replace(/\b\d{9}\b/g, "[ROUTING_REDACTED]");
  }

  private static getEncryptionKey(): Buffer {
    const secret = process.env.SYSTEM_SALT || process.env.ENCRYPTION_SECRET || "default-ledgerflow-secure-key-32b";
    return crypto.createHash('sha256').update(secret).digest();
  }

  /**
   * Encrypts sensitive fields (such as banking access tokens) using AES-256-GCM
   */
  static encryptSensitiveField(plainText: string): string {
    if (!plainText) return plainText;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts AES-256-GCM encrypted fields
   */
  static decryptSensitiveField(cipherText: string): string {
    if (!cipherText || !cipherText.startsWith('enc:')) return cipherText;
    const parts = cipherText.split(':');
    if (parts.length !== 4) return cipherText;
    try {
      const iv = Buffer.from(parts[1], 'hex');
      const authTag = Buffer.from(parts[2], 'hex');
      const encrypted = parts[3];
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err: any) {
      console.error("[SecurityService] Decryption failed:", err);
      throw new Error(`Decryption failed: tampered ciphertext or invalid key. ${err?.message || ''}`);
    }
  }
}
