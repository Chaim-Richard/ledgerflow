/**
 * Errors that say what to do (BO-07): the common causes of a failed save or load, in plain words,
 * each with the remedy. The technical message stays in the console for support.
 */
export interface DescribedError { title: string; remedy: string }

const VERB: Record<string, string> = { create: 'saving', update: 'saving the changes', delete: 'deleting', list: 'loading', get: 'loading', write: 'saving' };

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return String(error ?? '');
}

export function describeError(error: unknown, operation?: string): DescribedError {
  const m = errorMessage(error).toLowerCase();
  if (/field ".*" is not allowed|is not allowed on/.test(m)) {
    return { title: 'This change couldn\'t be saved', remedy: 'The app sent a detail the database doesn\'t accept. Please report it (Help → Support) with what you were doing.' };
  }
  if (/lock(ed)? (date|period)|period is (locked|closed)|closed period|this period is locked|on or before the lock/.test(m)) {
    return { title: 'That date is in a closed period', remedy: 'Use a date after the lock date, or ask an owner to reopen the period (Month-End Close).' };
  }
  if (/sign in required|unauthenticated|jwt|session (has )?expired|not signed in|\b401\b/.test(m)) {
    return { title: 'Your session ended', remedy: 'Sign in again. What you were doing on this screen was not saved.' };
  }
  if (/permission denied|row-level security|forbidden|requires (owner|an? )|not a member|insufficient|\b403\b|42501/.test(m)) {
    return { title: 'You don\'t have permission to do this', remedy: 'Ask an owner of this workspace to change your role (Settings → Team).' };
  }
  if (/failed to fetch|networkerror|network request|offline|timed? ?out|econn|load failed/.test(m)) {
    return { title: 'Can\'t reach the server', remedy: 'Check your internet connection, then try again.' };
  }
  if (/duplicate key|already exists|23505|unique constraint/.test(m)) {
    return { title: 'This already exists', remedy: 'Use a different number or name, or open the existing one.' };
  }
  if (/not found|p0002|\b404\b|no longer exists/.test(m)) {
    return { title: 'It no longer exists', remedy: 'Someone may have deleted it. Refresh the list and try again.' };
  }
  if (/unbalanced|does not balance|debits.*credits/.test(m)) {
    return { title: 'The entry doesn\'t balance', remedy: 'Make the debits equal the credits, then save again.' };
  }
  if (/invalid|validation|must be|required|check constraint|zod/.test(m)) {
    return { title: 'Some details aren\'t valid', remedy: `${errorMessage(error).slice(0, 140)}. Correct it and try again.` };
  }
  const doing = operation ? VERB[operation.toLowerCase()] || operation.toLowerCase() : 'doing that';
  return { title: `Something went wrong while ${doing}`, remedy: 'Try again. If it keeps happening, report it (Help → Support).' };
}
