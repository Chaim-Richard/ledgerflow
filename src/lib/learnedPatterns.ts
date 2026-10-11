/**
 * The id a learned pattern is saved under (N-14). It used to be the description with every
 * character other than a–z and 0–9 turned into "_", so two Hebrew descriptions of the same length
 * ("שלום", "תודה") became the same id and the second overwrote the first. Readers find patterns by
 * their description, never by id, so only the id changes:
 * - plain Latin text (a–z, 0–9, spaces) of up to 100 characters keeps exactly the id it had, so
 *   existing patterns keep counting up;
 * - anything else gets a readable start and a hash of the whole text, so different texts never share
 *   an id, and the id stays short enough for the database.
 */
const MAX_PLAIN = 100;

/** FNV-1a, 64 bits as 16 hex characters: the same text always gives the same hash. */
function fnv1a64(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

export function learnedPatternId(description: string): string {
  const readable = description.replace(/[^a-z0-9]/g, '_');
  if (/^[a-z0-9 ]*$/.test(description) && description.length <= MAX_PLAIN) return readable;
  return `${readable.slice(0, 60)}_h${fnv1a64(description)}`;
}
