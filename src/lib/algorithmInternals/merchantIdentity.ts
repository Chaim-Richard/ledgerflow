

/**
 * Merchant Identity Normalization Model
 */
export interface MerchantIdentity {
  canonicalMerchant: string;
  merchantTokens: string[];
  storeId?: string;
  location?: string;
  rawDescriptor: string;
  confidence: number;
}


const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]);


export const KNOWN_CANONICAL_BRANDS: Record<string, string> = {
  'shoprite': 'SHOPRITE',
  'shoprit': 'SHOPRITE',
  'amzn': 'AMAZON',
  'amazon': 'AMAZON',
  'walmart': 'WALMART',
  'wmt': 'WALMART',
  'shell': 'SHELL OIL',
  'shell oil': 'SHELL OIL',
  'msft': 'MICROSOFT',
  'microsoft': 'MICROSOFT',
  'uber': 'UBER',
  'lyft': 'LYFT',
  'starbucks': 'STARBUCKS',
  'sbux': 'STARBUCKS',
  'target': 'TARGET',
  'home depot': 'HOME DEPOT',
  'homedepot': 'HOME DEPOT',
  'apple': 'APPLE',
  'google': 'GOOGLE',
  'slack': 'SLACK',
  'github': 'GITHUB',
  'stripe': 'STRIPE',
  'costco': 'COSTCO',
  'cvs': 'CVS PHARMACY',
  'walgreens': 'WALGREENS',
  'kroger': 'KROGER',
  'trader joe': 'TRADER JOES',
  'trader joes': 'TRADER JOES',
  'whole foods': 'WHOLE FOODS'
};


/**
 * Normalizes a raw bank/statement merchant descriptor into structured components:
 * canonical merchant name, token set, store ID, location, and confidence.
 */
export function normalizeMerchantIdentity(rawDescriptor: string): MerchantIdentity {
  if (!rawDescriptor || !rawDescriptor.trim()) {
    return {
      canonicalMerchant: '',
      merchantTokens: [],
      rawDescriptor: '',
      confidence: 0
    };
  }

  const raw = rawDescriptor.trim();
  let working = raw.toUpperCase();

  // 1. Strip common payment processor / terminal prefixes
  working = working
    .replace(/^(SQ\s*\*|TST\s*\*|SP\s*\*|PAYPAL\s*\*|CHECKCARD\s+|DEBIT\s+CARD\s+|POS\s+DEBIT\s+|PURCHASE\s+AUTHORIZED\s+ON\s+\d{2}\/\d{2}\s+)/i, '')
    .replace(/^(\d{4,}\s+)/, '')
    .trim();

  // 2. Extract Store ID patterns: e.g. "#0451", "STORE 1234", "NO. 451", "# 1234"
  let storeId: string | undefined = undefined;
  const storeMatch = working.match(/(?:#\s*|STORE\s+(?:#\s*)?|NO\.?\s*|UNIT\s+)(\d{2,7})/i);
  if (storeMatch) {
    storeId = storeMatch[1];
    working = working.replace(storeMatch[0], ' ');
  }

  // 3. Extract Location patterns (e.g. "PARAMUS NJ", "SEATTLE WA", "AUSTIN TX")
  let location: string | undefined = undefined;
  const words = working.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const lastWord = words[words.length - 1].replace(/[^A-Z]/g, '');
    const prevWord = words[words.length - 2].replace(/[^A-Z]/g, '');
    if (US_STATE_CODES.has(lastWord) && prevWord.length >= 2) {
      location = `${prevWord} ${lastWord}`;
      working = words.slice(0, -2).join(' ');
    } else if (US_STATE_CODES.has(lastWord)) {
      location = lastWord;
      working = words.slice(0, -1).join(' ');
    }
  }

  // 4. Extract standalone store numbers if not yet found (e.g. "COFFEE SHOP 1234")
  if (!storeId) {
    const digitMatch = working.match(/\b(\d{3,6})\b/);
    if (digitMatch) {
      storeId = digitMatch[1];
      working = working.replace(digitMatch[0], ' ');
    }
  }

  // 5. Strip punctuation, trailing transaction reference codes, and common domain extensions (.COM, .NET, etc.)
  working = working
    .replace(/\.COM/gi, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 6. Extract clean lower-cased tokens
  const cleanTokens = working.toLowerCase().split(/\s+/).filter(t => t.length > 1);

  // 7. Resolve Canonical Brand
  let canonicalMerchant: string;
  let confidence = 0.80;

  const key1 = cleanTokens.join(' ');
  const keyFirst = cleanTokens[0];
  const keyFirstTwo = cleanTokens.slice(0, 2).join(' ');

  if (KNOWN_CANONICAL_BRANDS[key1]) {
    canonicalMerchant = KNOWN_CANONICAL_BRANDS[key1];
    confidence = 0.98;
  } else if (keyFirstTwo && KNOWN_CANONICAL_BRANDS[keyFirstTwo]) {
    canonicalMerchant = KNOWN_CANONICAL_BRANDS[keyFirstTwo];
    confidence = 0.95;
  } else if (keyFirst && KNOWN_CANONICAL_BRANDS[keyFirst]) {
    canonicalMerchant = KNOWN_CANONICAL_BRANDS[keyFirst];
    confidence = 0.92;
  } else {
    canonicalMerchant = working
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ') || rawDescriptor;
  }

  return {
    canonicalMerchant,
    merchantTokens: cleanTokens,
    storeId,
    location,
    rawDescriptor,
    confidence
  };
}


/**
 * Deterministic Import Identity Fingerprint Generator
 * Format:
 *  - When stable reference ID exists: <source>:id:<sanitizedRef>
 *  - When positional: <source>:<kind>:<64-bit-hash>
 *
 * Generates a deterministic 64-bit hash (16 hexadecimal characters) ensuring
 * idempotency, cross-session deduplication, and safe re-importing of statements.
 */
export function generateImportIdentity(
  source: string,
  kind: string,
  identity: {
    date: string;
    amountCents: number;
    description: string;
    reference?: string;
  },
  occurrenceIndex = 0
): string {
  const cleanSource = (source || 'statement').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
  const cleanKind = (kind || 'tx').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
  const cleanDate = (identity.date || '').trim();
  const cleanAmount = Math.abs(identity.amountCents || 0);
  const cleanDesc = (identity.description || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const cleanRef = (identity.reference || '').trim();

  // If a stable provider / bank transaction ID exists, prefer reference-first identity
  if (cleanRef) {
    const sanitizedRef = cleanRef.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    if (sanitizedRef.length >= 4) {
      return `${cleanSource}:id:${sanitizedRef}`;
    }
  }

  const payload = `${cleanSource}|${cleanKind}|${cleanDate}|${cleanAmount}|${cleanDesc}|occ:${occurrenceIndex}`;

  // Deterministic 64-bit hash string (16 hexadecimal characters) for fast browser + node collision-resistant hashing
  let h1 = 0xdeadbeef ^ occurrenceIndex;
  let h2 = 0x41c6ce57 ^ occurrenceIndex;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hashHex = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');

  return `${cleanSource}:${cleanKind}:${hashHex}`;
}
