export function isSystemJobAuthorized(
  decodedToken?: Record<string, unknown> | null,
  providedSecret?: string,
  cronSecret?: string
): boolean {
  if (cronSecret && providedSecret && cronSecret === providedSecret) {
    return true;
  }
  if (decodedToken && (decodedToken.admin === true || decodedToken.role === 'admin')) {
    return true;
  }
  return false;
}
