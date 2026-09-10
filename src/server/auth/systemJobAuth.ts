import crypto from 'crypto';

export function isSystemJobAuthorized(
  decodedToken?: Record<string, unknown> | null,
  providedSecret?: string,
  cronSecret?: string
): boolean {
  if (cronSecret && providedSecret) {
    const a = Buffer.from(cronSecret);
    const b = Buffer.from(providedSecret);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  if (decodedToken && (decodedToken.admin === true || decodedToken.role === 'admin')) {
    return true;
  }
  return false;
}
