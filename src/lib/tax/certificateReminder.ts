import type { CertificateState } from '../customerTaxCertificates';

/**
 * C-83: the reminder letter for a customer's tax certificate — a draft, nothing sent.
 *
 * The report knows which certificates are expired or expire within 30 days. This builds the short
 * letter an accountant sends to ask for an updated one, in English or Hebrew, from the record as it
 * is saved. It makes no claim that the certificate is invalid or that the customer owes anything, and
 * it does not send, file or change any invoice: the reader copies it or opens it in their own mail app.
 */
export interface CertificateReminderRow {
  customer: string;
  /** the certificate number as recorded (may be empty) */
  number: string;
  /** the expiry as recorded (may be empty) */
  expires: string;
  state: CertificateState;
  /** the customer's saved email, when there is one */
  email?: string;
}

export type ReminderLanguage = 'en' | 'he';

export interface CertificateReminderDraft {
  customer: string;
  language: ReminderLanguage;
  subject: string;
  body: string;
  /** mailto: with the draft, when the customer has a saved email */
  mailto?: string;
}

/** A reminder is worth drafting only for a date that has passed, one coming up, or none at all. */
export function needsCertificateReminder(state: CertificateState): boolean {
  return state === 'Expired' || state === 'Expiring within 30 days' || state === 'No expiry recorded';
}

const recorded = (value: string, language: ReminderLanguage) => {
  const text = value.trim();
  if (text) return text;
  return language === 'he' ? 'לא נרשם' : 'not recorded';
};

export function certificateReminderDraft(
  row: CertificateReminderRow,
  language: ReminderLanguage,
  options: { entityName?: string; today: string },
): CertificateReminderDraft | null {
  if (!needsCertificateReminder(row.state)) return null;
  const entity = (options.entityName || '').trim();
  const signature = entity
    ? (language === 'he' ? `בברכה,\n${entity}` : `Kind regards,\n${entity}`)
    : (language === 'he' ? 'בברכה,' : 'Kind regards,');
  const subject = language === 'he'
    ? `בקשה לאישור פטור ממס מעודכן — ${row.customer}`
    : `Request for an updated tax exemption certificate — ${row.customer}`;
  const body = language === 'he'
    ? [
      `שלום ${row.customer},`,
      '',
      `ברשומותינו ${row.state === 'No expiry recorded' ? 'לא נרשם תוקף' : 'נרשם תוקף'} לאישור הפטור ממס שלכם: מספר ${recorded(row.number, language)}, תוקף ${recorded(row.expires, language)} (נבדק ב-${options.today}).`,
      'לשם המשך העבודה התקינה אנא שלחו לנו אישור פטור ממס בתוקף.',
      'מסמך זה הוא בקשה בלבד ואינו מהווה קביעה בדבר חבות המס שלכם.',
      '',
      signature,
    ].join('\n')
    : [
      `Hello ${row.customer},`,
      '',
      `Our records show the following tax exemption certificate: number ${recorded(row.number, language)}, expiry ${recorded(row.expires, language)} (checked on ${options.today}).`,
      'Please send us a current tax exemption certificate so we can keep the account in order.',
      'This letter is a request only; it is not a decision about your tax status.',
      '',
      signature,
    ].join('\n');
  const email = (row.email || '').trim();
  return {
    customer: row.customer,
    language,
    subject,
    body,
    ...(email ? { mailto: `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` } : {}),
  };
}

/** The rows that need a letter, in the report's own order. */
export function certificateReminderRows(
  rows: readonly (CertificateReminderRow & { id: string })[],
  language: ReminderLanguage,
  options: { entityName?: string; today: string },
): CertificateReminderDraft[] {
  const drafts: CertificateReminderDraft[] = [];
  for (const row of rows) {
    const draft = certificateReminderDraft(row, language, options);
    if (draft) drafts.push(draft);
  }
  return drafts;
}
