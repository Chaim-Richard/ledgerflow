import { APP_TABS, REPORT_TABS_REGISTRY, SETTINGS_TABS_REGISTRY } from './registry';
import type { PinnedPage } from '../lib/pinnedPages';

/** Words people type when looking for a setting (BB-09 settings search). */
const SETTINGS_KEYWORDS: Record<string, string> = {
  rules: 'automation auto categorize bank rules',
  dimensions: 'class location department labels tags',
  appearance: 'theme dark light font size density display',
  team: 'users members invite roles permissions people',
  billing: 'plan subscription payment card upgrade',
  templates: 'custom templates',
  security: 'password two-step 2fa mfa login session delete workspace',
  rule: 'ai copilot assistant',
  developer: 'api keys webhooks integration',
  import: 'csv excel upload customers vendors items accounts spreadsheet',
  emails: 'email reminders templates thank you dunning overdue receipt',
  branding: 'logo color colour footer terms pdf look address',
  numbering: 'invoice number prefix sequence bill estimate',
  schedule: 'cron jobs daily run reminders statements recurring when next time',
  export: 'backup download restore data archive',
  shortcuts: 'keyboard keys speed dial hotkeys',
};

export interface PageEntry { page: PinnedPage; label: string; keywords: string }

type Labelled = { id: string; label: Record<string, string>; developerOnly?: boolean };
const name = (entry: Labelled, language: string) => entry.label[language] || entry.label.en;

/** Every page someone can go to: main screens, each report and each settings tab. */
export function pageIndex(language = 'en', opts: { developerMode?: boolean } = {}): PageEntry[] {
  const main = (APP_TABS as Labelled[]).filter(t => !t.developerOnly || opts.developerMode)
    .map(t => ({ page: { tab: t.id }, label: name(t, language), keywords: t.id }));
  const reports = (REPORT_TABS_REGISTRY as Labelled[]).map(r => ({ page: { tab: 'reports', sub: r.id }, label: `Report: ${name(r, language)}`, keywords: 'report' }));
  const settings = (SETTINGS_TABS_REGISTRY as Labelled[]).map(s => ({ page: { tab: 'settings', sub: s.id }, label: `Settings: ${name(s, language)}`, keywords: `settings ${SETTINGS_KEYWORDS[s.id] || ''}` }));
  return [...main, ...reports, ...settings];
}

/** Pages whose name or keywords contain every typed word. */
export function searchPages(index: PageEntry[], query: string): PageEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return index.filter(p => {
    const hay = `${p.label} ${p.keywords}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}
