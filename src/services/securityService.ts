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
    // Enhanced regex for credit cards, accounts, SSNs, emails, phones, private identifiers
    return text
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, "[CREDIT_CARD_REDACTED]")
      .replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, "[SSN_REDACTED]")
      .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "[EMAIL_REDACTED]")
      .replace(/\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g, "[PHONE_REDACTED]")
      .replace(/\b\d{8,12}\b/g, "[ACCOUNT_REDACTED]")
      .replace(/\b\d{9}\b/g, "[ROUTING_REDACTED]");
  }
}
