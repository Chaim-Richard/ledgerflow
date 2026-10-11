import { getIdToken } from '../../firebase';

/**
 * Uses a recovery code at the code step of sign-in (L-85): the password-only session may call this
 * one route. When it works the authenticator is gone, so the page reloads and signs in normally.
 * Resolves with what went wrong, or '' when it worked.
 */
export async function redeemRecoveryCode(code: string): Promise<string> {
  try {
    const res = await fetch('/api/v1/account/recovery-codes/use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdToken()}` },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.message || 'That recovery code did not work';
    window.location.reload();
    return '';
  } catch (err) {
    return err instanceof Error ? err.message : 'That recovery code could not be checked';
  }
}
