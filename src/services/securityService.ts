import crypto from "crypto";

export class SecurityService {
  /**
   * Generates a forensic hash for an entity state
   * Used for "Vault" integrity and "Audit Trail" verification
   */
  static generateForensicHash(data: any): string {
    const serialized = JSON.stringify(data);
    return crypto.createHmac('sha256', process.env.SYSTEM_SALT || 'ledgerflow-zenith-salt')
      .update(serialized)
      .digest('hex');
  }

  /**
   * Verifies a payload against its recorded hash
   */
  static verifyIntegrity(data: any, hash: string): boolean {
    const currentHash = this.generateForensicHash(data);
    return currentHash === hash;
  }

  /**
   * Sanitizes sensitive information for logs
   */
  static scrubPII(text: string): string {
    if (!text) return "";
    // Regex for credit cards, accounts, private identifiers
    return text
      .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{1,4}\b/g, "[CREDIT_CARD_MASQUED]")
      .replace(/\b\d{8,12}\b/g, "[ACCOUNT_REDACTED]")
      .replace(/\b\d{9}\b/g, "[ROUTING_REDACTED]");
  }
}
