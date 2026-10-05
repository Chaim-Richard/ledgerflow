import { RECORD_DETAIL_FIELDS } from './recordDetails';
import type { DetailKind, DetailTarget } from './recordDetails';
export function recordDetailContext(element: Element | null, records: Partial<Record<DetailKind, { id: string; name?: string; sku?: string }[]>>): DetailTarget | undefined {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) return;
  const explicit = element.dataset.recordKind;
  const label = `${element.getAttribute('aria-label') || ''} ${Array.from(element.labels || []).map(label => label.textContent).join(' ')}`.toLowerCase();
  const kind = explicit && Object.hasOwn(RECORD_DETAIL_FIELDS, explicit) ? explicit as DetailKind : /\bvendor\b/.test(label) ? 'vendors' : /\bcustomer\b/.test(label) ? 'customers' : /\bproject\b/.test(label) ? 'projects' : /\b(item|sku)\b/.test(label) ? 'inventory' : undefined;
  if (!kind) return;
  if (element.dataset.recordId) return { kind, id: element.dataset.recordId };
  const value = element.value;
  if (!value) return;
  if (explicit && element instanceof HTMLSelectElement) return { kind, id: value };
  const matches = (records[kind] || []).filter(record => record.id === value || record.name === value || record.sku === value);
  return matches.length === 1 ? { kind, id: matches[0].id } : undefined;
}
