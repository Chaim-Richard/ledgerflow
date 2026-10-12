/**
 * E-14 — Pure US tax identifier presentation and typing-warning helpers.
 *
 * Caller chooses EIN or SSN; neither kind can be reliably inferred from nine
 * digits. Format checks do not establish issuance, identity, IRS matching,
 * employer registration, or suitability for filing. No I/O or persistence.
 *
 * Sources:
 * https://www.irs.gov/instructions/iw2w3 (EIN/SSN display formats)
 * https://www.ssa.gov/employer/randomizationfaqs.html (impossible SSN ranges)
 */
export type UsTaxIdKind = 'ein' | 'ssn';
export type UsTaxIdProblem = 'characters' | 'layout' | 'area' | 'group' | 'serial' | 'placeholder';

export type UsTaxIdCheck =
  | { state: 'empty'; kind: UsTaxIdKind; masked: null; problem: null }
  | { state: 'warning'; kind: UsTaxIdKind; masked: null; problem: UsTaxIdProblem }
  | { state: 'valid-format'; kind: UsTaxIdKind; masked: string; problem: null };

const WARNINGS: Readonly<Record<UsTaxIdProblem, string>> = {
  characters: 'Enter only ASCII digits and the standard separators for the selected tax ID type.',
  layout: 'Enter nine digits in the selected EIN or SSN layout.',
  area: 'This SSN begins with a number that the SSA does not assign.',
  group: 'The SSN middle two digits cannot be 00.',
  serial: 'The SSN last four digits cannot be 0000.',
  placeholder: 'An all-zero number is a placeholder, not a usable tax ID.',
};

/**
 * Accept plain nine ASCII digits or an exactly grouped layout.
 * Reject rather than silently stripping arbitrary punctuation or letters.
 * Formatting and masking only operate on structurally usable input.
 */
function parseDigits(value: unknown, kind: UsTaxIdKind):
  | { state: 'empty' }
  | { state: 'warning'; problem: UsTaxIdProblem }
  | { state: 'valid-format'; digits: string } {
  if (value === null || value === undefined || value === '') return { state: 'empty' };
  if (typeof value !== 'string') return { state: 'warning', problem: 'characters' };
  const trimmed = value.trim();
  if (!trimmed) return { state: 'empty' };
  if (!/^[0-9 -]+$/.test(trimmed)) return { state: 'warning', problem: 'characters' };

  const plain = /^[0-9]{9}$/.test(trimmed);
  const formatted = kind === 'ein'
    ? /^[0-9]{2}[- ][0-9]{7}$/.test(trimmed)
    : (/^[0-9]{3}-[0-9]{2}-[0-9]{4}$/.test(trimmed)
       || /^[0-9]{3} [0-9]{2} [0-9]{4}$/.test(trimmed));
  if (!plain && !formatted) return { state: 'warning', problem: 'layout' };

  const digits = trimmed.replace(/[- ]/g, '');
  if (/^0{9}$/.test(digits)) return { state: 'warning', problem: 'placeholder' };
  if (kind === 'ssn') {
    const area = Number(digits.slice(0, 3));
    if (area === 0 || area === 666 || area >= 900) return { state: 'warning', problem: 'area' };
    if (digits.slice(3, 5) === '00') return { state: 'warning', problem: 'group' };
    if (digits.slice(5) === '0000') return { state: 'warning', problem: 'serial' };
  }
  return { state: 'valid-format', digits };
}

/** Never returns any plaintext ID digits beyond the last four. */
export function checkUsTaxId(value: unknown, kind: UsTaxIdKind): UsTaxIdCheck {
  const parsed = parseDigits(value, kind);
  if (parsed.state === 'empty') return { state: 'empty', kind, masked: null, problem: null };
  if (parsed.state === 'warning') return { state: 'warning', kind, masked: null, problem: parsed.problem };
  return {
    state: 'valid-format', kind, problem: null,
    masked: kind === 'ein'
      ? '**-***' + parsed.digits.slice(-4)
      : '***-**-' + parsed.digits.slice(-4),
  };
}

/**
 * Explicitly for a trusted, controlled INPUT while the user is editing.
 * This returns the COMPLETE entered identifier, including all nine digits.
 * NEVER use it for logs, previews, API errors, analytics, activity feeds,
 * general exports, or the "masked display" of a saved record.
 */
export function formatUsTaxIdForInput(value: unknown, kind: UsTaxIdKind): string | null {
  const parsed = parseDigits(value, kind);
  if (parsed.state !== 'valid-format') return null;
  const d = parsed.digits;
  return kind === 'ein'
    ? d.slice(0, 2) + '-' + d.slice(2)
    : d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5);
}

/** A safe display result: null until the full identifier is format-valid. */
export function maskUsTaxId(value: unknown, kind: UsTaxIdKind): string | null {
  return checkUsTaxId(value, kind).masked;
}

/** Static, non-blocking user warning. Never echoes the submitted value. */
export function usTaxIdWarning(check: UsTaxIdCheck): string | null {
  return check.state === 'warning' ? WARNINGS[check.problem] : null;
}
