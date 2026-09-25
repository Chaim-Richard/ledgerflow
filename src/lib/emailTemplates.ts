/**
 * Email templates (K-08) for the emails LedgerFlow sends to customers. A workspace can change the
 * subject and text of each (Settings → Email templates); what it hasn't changed uses the default.
 * Templates are plain text with {{placeholders}}; the HTML version is built from the text with
 * everything escaped, so a template can't inject markup, and the text version is sent alongside
 * (BL-08). Used by the server to send and by the settings screen to preview.
 */

export const EMAIL_TEMPLATE_KEYS = ['invoice', 'reminder', 'receipt'] as const;
export type EmailTemplateKey = typeof EMAIL_TEMPLATE_KEYS[number];

export interface EmailTemplate {
  subject: string;
  body: string;
}

export type EmailTemplates = Partial<Record<EmailTemplateKey, Partial<EmailTemplate>>>;

export const PLACEHOLDERS = ['company', 'customer', 'number', 'amount', 'amount_due', 'due_date', 'days_overdue', 'link'] as const;
export type Placeholder = typeof PLACEHOLDERS[number];
export type TemplateValues = Partial<Record<Placeholder, string>>;

export const TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  invoice: 'Sending an invoice',
  reminder: 'Payment reminder',
  receipt: 'Payment received (thank you)',
};

export const DEFAULT_TEMPLATES: Record<EmailTemplateKey, EmailTemplate> = {
  invoice: {
    subject: 'Invoice {{number}} from {{company}}',
    body: 'Hello {{customer}},\n\nPlease find invoice {{number}} for {{amount}} attached, due on {{due_date}}.\n\nYou can view and pay it here: {{link}}\n\nThank you,\n{{company}}',
  },
  reminder: {
    subject: 'Reminder: invoice {{number}} is overdue',
    body: 'Hello {{customer}},\n\nThis is a friendly reminder that invoice {{number}} was due on {{due_date}} ({{days_overdue}} days ago). {{amount_due}} is still open.\n\nYou can view and pay it here: {{link}}\n\nIf you have already paid, please ignore this message.\n\nThank you,\n{{company}}',
  },
  receipt: {
    subject: 'Thank you for your payment',
    body: 'Hello {{customer}},\n\nWe received your payment of {{amount}} for invoice {{number}}. Thank you!\n\n{{company}}',
  },
};

export const MAX_SUBJECT = 200;
export const MAX_BODY = 5000;

export function resolveTemplate(key: EmailTemplateKey, custom?: EmailTemplates | null): EmailTemplate {
  const own = custom?.[key] || {};
  return {
    subject: (own.subject || '').trim() || DEFAULT_TEMPLATES[key].subject,
    body: (own.body || '').trim() || DEFAULT_TEMPLATES[key].body,
  };
}

/** Placeholders a template uses that don't exist (shown as a warning in settings). */
export function unknownPlaceholders(text: string): string[] {
  const found = [...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map(m => m[1].toLowerCase());
  return [...new Set(found.filter(p => !(PLACEHOLDERS as readonly string[]).includes(p)))];
}

const fill = (text: string, values: TemplateValues) =>
  text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, name: string) => {
    const value = values[name.toLowerCase() as Placeholder];
    return value === undefined ? whole : value;
  });

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Fills the template. The link becomes a button in the HTML; the text keeps it as a plain URL. */
export function renderEmail(template: EmailTemplate, values: TemplateValues): RenderedEmail {
  const subject = fill(template.subject, values).replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_SUBJECT);
  const text = fill(template.body, values).slice(0, MAX_BODY);
  const link = values.link || '';
  const paragraphs = text.split(/\n{2,}/).map(p => {
    const safe = escapeHtml(p).replace(/\n/g, '<br />');
    return link && p.trim() !== '' && p.includes(link)
      ? `<p>${safe.replace(escapeHtml(link), `<a href="${escapeHtml(encodeURI(link))}" style="color:#2563eb">${escapeHtml(link)}</a>`)}</p>`
      : `<p>${safe}</p>`;
  });
  const button = link
    ? `<p style="margin:28px 0"><a href="${escapeHtml(encodeURI(link))}" style="background:#2563eb;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">View invoice</a></p>`
    : '';
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:0 auto;padding:24px">${paragraphs.join('')}${button}</div>`;
  return { subject, text, html };
}
