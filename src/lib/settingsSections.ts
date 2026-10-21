/**
 * D-90: the Settings screen groups its tabs into five sections and offers one search box.
 * The registry stays the single list of settings screens: this file only says which section
 * each id belongs to, so a new tab without a section fails `settings-navigation.test.ts`.
 */
export interface SettingsSection {
  id: string;
  label: { en: string; he: string };
  /** One plain sentence: what the person finds here. */
  description: string;
  tabs: readonly string[];
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: 'business',
    label: { en: 'Your business', he: 'העסק שלך' },
    description: 'How your business, documents and books are set up.',
    tabs: ['appearance', 'branding', 'templates', 'numbering', 'currencies', 'defaults', 'modules', 'groups'],
  },
  {
    id: 'accounting',
    label: { en: 'Accounting', he: 'הנהלת חשבונות' },
    description: 'Rules, labels, tax profiles and the lists the ledger uses.',
    tabs: ['rules', 'dimensions', 'tax-profiles', 'tags', 'split-rules', 'price-lists', 'price-list-import', 'custom-fields', 'sales-reps', 'stages'],
  },
  {
    id: 'people',
    label: { en: 'People & messages', he: 'אנשים והודעות' },
    description: 'Who can use these books and what LedgerFlow sends them.',
    tabs: ['team', 'security', 'emails'],
  },
  {
    id: 'data',
    label: { en: 'Data & automation', he: 'נתונים ואוטומציה' },
    description: 'Imports, backups, schedules, alerts and the assistant.',
    tabs: ['import', 'export', 'schedule', 'incoming-events', 'scheduled-reports', 'alerts', 'rule'],
  },
  {
    id: 'app',
    label: { en: 'App & plan', he: 'אפליקציה ותוכנית' },
    description: 'Your plan, keyboard shortcuts and developer access.',
    tabs: ['billing', 'shortcuts', 'developer'],
  },
];

/** Every tab id the sections cover, in the order a person reads them. */
export const SETTINGS_SECTION_TAB_IDS: readonly string[] = SETTINGS_SECTIONS.flatMap(section => section.tabs);

/** The section a tab belongs to, or null when the registry has a tab with no section yet. */
export function settingsSectionOf(tabId: string): SettingsSection | null {
  return SETTINGS_SECTIONS.find(section => section.tabs.includes(tabId)) || null;
}

/**
 * True when the search box should keep this setting. An empty search keeps everything.
 * Matches the label the person sees (both languages), the section name and the tab id.
 */
export function settingsTabMatches(query: string, tabId: string, labels: { en?: string; he?: string } = {}): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const section = settingsSectionOf(tabId);
  const haystack = [labels.en, labels.he, section?.label.en, section?.label.he, tabId, labels.en && labels.en.replace(/&/g, 'and')]
    .filter((value): value is string => Boolean(value))
    .map(value => value.toLowerCase());
  return needle.split(/\s+/).every(part => haystack.some(value => value.includes(part)));
}
