export type ChangelogTag = 'Reports' | 'Banking' | 'Tax preview' | 'Onboarding' | 'Accessibility' | 'Controls';

export interface ChangelogItem {
  tag: ChangelogTag;
  text: string;
}

export interface ChangelogRelease {
  id: string;
  weekLabel: string;
  date: string;
  displayDate: string;
  title: string;
  items: readonly ChangelogItem[];
}

/**
 * G-4: Weekly user-facing changelog entries (newest first).
 * Strictly describes shipped capabilities only (DA-05 / docs/CAPABILITIES.md).
 */
export const CHANGELOG_RELEASES: readonly ChangelogRelease[] = [
  {
    id: '2026-10-20-this-week-workflows-imports-reports',
    weekLabel: 'This week (Oct 14 – Oct 20, 2026)',
    date: '2026-10-20',
    displayDate: 'October 20, 2026',
    title: 'Statement staging, bilingual help, group export, and accessibility polish',
    items: [
      {
        tag: 'Banking',
        text: 'Banking -> Import Statement stages single-account OFX and QFX bank/card downloads with strict balance, date, and currency checks before saving.',
      },
      {
        tag: 'Banking',
        text: 'CSV imports compare the row count in your source file against the server response count immediately after import.',
      },
      {
        tag: 'Reports',
        text: 'Reports -> Group Summary exports consolidated multi-book figures and intercompany eliminations to CSV, and printed reports force light paper even when dark mode is active.',
      },
      {
        tag: 'Tax preview',
        text: 'US Quarter Journey, Israel Month Journey, US mileage rate reference tables, and local US state/ZIP draft assistance help prepare accountant review packs (calculation only, not direct filing).',
      },
      {
        tag: 'Onboarding',
        text: 'Help & Guide includes a 5-step First-Month Checklist, 20 bilingual EN/HE how-to guides, and safe in-memory Israel (ILS) and US (USD) guest sample companies with tester reset controls.',
      },
      {
        tag: 'Accessibility',
        text: 'Searchable Settings groups, inline-editor accessible names, report layout controls, and contrast improvements pass WCAG AA checks across phone and desktop views.',
      },
    ],
  },
  {
    id: '2026-10-12-controls-and-tax-tables',
    weekLabel: 'Prior week (Oct 6 – Oct 13, 2026)',
    date: '2026-10-12',
    displayDate: 'October 12, 2026',
    title: 'Cash-basis reports, bookmarks, workpapers, and tax certificate tracking',
    items: [
      {
        tag: 'Reports',
        text: 'Profit & Loss and Balance Sheet support Cash or Accrual basis, column choosers, saved export templates, and printable client Report Packs.',
      },
      {
        tag: 'Controls',
        text: 'Month-End Close supports account workpapers, period comparison variance flags, and audited reopen reasons.',
      },
      {
        tag: 'Tax preview',
        text: 'Customer tax certificate expiry tracking, vendor withholding views, and multi-jurisdiction rate tables are available in Reports and Settings -> Tax profiles.',
      },
    ],
  },
  {
    id: '2026-10-02-bookkeeping-and-workspace-controls',
    weekLabel: 'Earlier in October (Oct 1 – Oct 5, 2026)',
    date: '2026-10-02',
    displayDate: 'October 2, 2026',
    title: 'Clearer bookkeeping and safer workspace controls',
    items: [
      {
        tag: 'Controls',
        text: 'Data Health flags duplicate documents, entries that do not balance, missing accounts, and overdue invoices, with links to the records that need attention.',
      },
      {
        tag: 'Tax preview',
        text: 'Tax codes support multiple parts, compound tax, zero-rated and exempt sales, and reverse-charge bills. The Tax return screen keeps a copy when you file a return.',
      },
      {
        tag: 'Onboarding',
        text: 'New workspaces can choose a chart of accounts and enter opening balances, or start from zero.',
      },
      {
        tag: 'Controls',
        text: 'Settings -> Security lets you download your personal data and manage workspace retention and deletion.',
      },
      {
        tag: 'Reports',
        text: 'Reports offer period comparisons, shareable links, and Print / Save as PDF.',
      },
      {
        tag: 'Accessibility',
        text: 'Form labels and keyboard controls are clearer, and dates follow your Date Display Format preference.',
      },
    ],
  },
];

export const CHANGELOG_TAGS: readonly ChangelogTag[] = [
  'Reports',
  'Banking',
  'Tax preview',
  'Onboarding',
  'Accessibility',
  'Controls',
];

export function filterChangelogReleases(
  tag: ChangelogTag | 'All',
): ChangelogRelease[] {
  if (tag === 'All') return [...CHANGELOG_RELEASES];
  return CHANGELOG_RELEASES
    .map(release => ({
      ...release,
      items: release.items.filter(item => item.tag === tag),
    }))
    .filter(release => release.items.length > 0);
}
