import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SETTINGS_TABS_REGISTRY, SETTINGS_COMPONENTS } from '../../config/registry';
import { SETTINGS_SECTIONS, settingsTabMatches } from '../../lib/settingsSections';
import { useUIStore } from '../../stores/useUIStore';
import { ViewErrorBoundary } from '../common/ViewErrorBoundary';

type SettingsTab = (typeof SETTINGS_TABS_REGISTRY)[number];

/** The words a person reads for one settings screen (both languages; English is the fallback). */
function tabLabels(tab: SettingsTab) {
  return { en: tab.label?.en || tab.id, he: tab.label?.he || '' };
}

/**
 * D-90: Settings is a short list of five sections with one search box, not 31 tabs in a row.
 * Every registered settings screen stays reachable: a screen that has no section yet is listed
 * under "Other" rather than disappearing, and `settings-navigation.test.ts` fails until it is
 * given a real section. Display only: choosing a screen renders exactly the same component.
 */
export default function Settings() {
  const language = useUIStore(state => state.language);
  const activeSubTab = useUIStore(state => state.activeSettingsTab || 'appearance');
  const setActiveSubTab = useUIStore(state => state.setActiveSettingsTab);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo(() => {
    const known = new Set<string>();
    const sections = SETTINGS_SECTIONS.map(section => {
      const tabs = section.tabs
        .map(id => SETTINGS_TABS_REGISTRY.find(tab => tab.id === id))
        .filter((tab): tab is SettingsTab => Boolean(tab));
      tabs.forEach(tab => known.add(tab.id));
      return { ...section, tabs };
    });
    const other = SETTINGS_TABS_REGISTRY.filter(tab => !known.has(tab.id));
    return other.length > 0
      ? [...sections, { id: 'other', label: { en: 'Other', he: 'אחר' }, description: 'Settings screens that are not grouped yet.', tabs: other }]
      : sections;
  }, []);

  const filtered = useMemo(
    () => groups.map(section => ({ ...section, tabs: section.tabs.filter(tab => settingsTabMatches(query, tab.id, tabLabels(tab))) }))
      .filter(section => section.tabs.length > 0),
    [groups, query],
  );
  const matchCount = filtered.reduce((count, section) => count + section.tabs.length, 0);

  const activeTabDef = SETTINGS_TABS_REGISTRY.find(tab => tab.id === activeSubTab) || SETTINGS_TABS_REGISTRY[0];
  const ActiveComponent = activeTabDef ? SETTINGS_COMPONENTS[activeTabDef.componentName] : null;
  const activeLabel = activeTabDef ? tabLabels(activeTabDef)[language as 'en' | 'he'] || tabLabels(activeTabDef).en : '';

  // Keep the selected screen in view without moving the page: only the navigation scrolls.
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeSubTab, query]);

  const choose = (id: string) => setActiveSubTab(id);
  const label = (tab: SettingsTab) => tabLabels(tab)[language as 'en' | 'he'] || tabLabels(tab).en;

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 md:py-8 md:px-8 space-y-6 text-[var(--text)]">
      <header className="flex flex-col gap-4 pb-5 border-b border-[var(--line)] lg:flex-row lg:items-end lg:justify-between lg:pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-xl">Set up your business, your books and who can use them.</p>
        </div>
        <div className="w-full lg:w-80">
          <label htmlFor="settings-search" className="block text-xs font-medium text-[var(--muted)] mb-1">Find a setting</label>
          <div className="relative">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            <input
              ref={searchRef}
              id="settings-search"
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="For example, tax or invoice numbering"
              className="min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] ps-9 pe-9 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear the search"
                onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                className="absolute end-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <p role="status" className="sr-only">
            {query ? `${matchCount} ${matchCount === 1 ? 'setting matches' : 'settings match'} ${query}` : `${SETTINGS_TABS_REGISTRY.length} settings`}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 lg:gap-10">
        <nav aria-label="Settings sections" className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:max-h-[calc(100dvh-220px)] lg:overflow-y-auto custom-scrollbar">
          {matchCount === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--text)]">
              <p className="font-medium">No setting matches “{query}”.</p>
              <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} className="mt-2 min-h-11 underline">
                Show all settings
              </button>
            </div>
          ) : filtered.map(section => (
            <div key={section.id} className="mb-5 last:mb-0">
              <h2 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{section.label[language as 'en' | 'he'] || section.label.en}</h2>
              <p className="px-3 mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{section.description}</p>
              <ul className="mt-2 space-y-0.5">
                {section.tabs.map(tab => {
                  const active = tab.id === activeSubTab;
                  return (
                    <li key={tab.id}>
                      <button
                        ref={active ? activeRef : undefined}
                        type="button"
                        onClick={() => choose(tab.id)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex w-full min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-start text-[13px] font-medium transition-colors',
                          active
                            ? 'bg-[var(--elevated)] text-[var(--text)] ring-1 ring-[var(--brass-line)]'
                            : 'text-[var(--text)] hover:bg-[var(--elevated)]',
                        )}
                      >
                        <tab.icon size={15} aria-hidden="true" className={cn('shrink-0', active ? 'text-[var(--brass)]' : 'text-[var(--faint)]')} />
                        <span className="truncate">{label(tab)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="min-w-0">
          {matchCount === 0 ? null : (
            <section aria-label={activeLabel} className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{activeLabel}</h2>
              </div>
              {activeTabDef?.help ? <p className="text-sm text-[var(--muted)] max-w-2xl">{activeTabDef.help}</p> : null}
              <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-[var(--muted)]">Loading {activeLabel}…</div>}>
                <ViewErrorBoundary viewName={activeLabel}>
                  {ActiveComponent ? <ActiveComponent /> : <p className="text-sm">This setting is not available in this build.</p>}
                </ViewErrorBoundary>
              </Suspense>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
