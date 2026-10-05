import { APP_TABS, REPORT_TABS_REGISTRY, SETTINGS_TABS_REGISTRY } from './registry';
import type { PinnedPage } from '../lib/pinnedPages';

type Labelled = { id: string; label: Record<string, string> };

/** "Reports · Profit & Loss", "Customers", … in the chosen language. */
export function pageLabel(page: PinnedPage, language = 'en'): string {
  const name = (list: readonly Labelled[], id?: string) => {
    const entry = list.find(t => t.id === id);
    return entry ? entry.label[language] || entry.label.en : id || '';
  };
  const main = name(APP_TABS as Labelled[], page.tab);
  if (!page.sub) return main;
  const sub = name((page.tab === 'reports' ? REPORT_TABS_REGISTRY : SETTINGS_TABS_REGISTRY) as Labelled[], page.sub);
  return `${main} · ${sub}`;
}

