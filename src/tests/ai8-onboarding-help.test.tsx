import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  buildResetDemoWorkspace,
  canUseDemoSandbox,
  seedCountryDemoWorkspace,
} from '../lib/countryDemoWorkspace';
import {
  evaluateFirstMonthChecklist,
  loadFirstMonthManualState,
  saveFirstMonthStep,
} from '../lib/firstMonthChecklist';
import { buildOnboardingEmails } from '../lib/onboardingEmails';
import {
  articlesForScreen,
  findScreenHelpDoc,
  HOW_TO_ARTICLES,
  SCREEN_HELP_DOCS,
  searchHowToArticles,
} from '../lib/helpCenterArticles';
import { CHANGELOG_RELEASES, filterChangelogReleases } from '../lib/changelogEntries';
import {
  auditScreenTranslations,
  SCREEN_TRANSLATION_TABLE,
  translateScreenString,
} from '../lib/i18n/screenTranslations';
import GuestCountrySamplePicker from '../components/support/GuestCountrySamplePicker';
import FirstMonthOnboardingHub from '../components/support/FirstMonthOnboardingHub';
import AccessibilityAndLanguagePanel from '../components/support/AccessibilityAndLanguagePanel';
import HelpGuideView from '../components/support/HelpGuideView';
import ScreenHelpHeader, { ScreenHelpDialog } from '../components/support/ScreenHelpHeader';
import ReleaseNotes from '../components/support/ReleaseNotes';
import { useAuthStore } from '../stores/useAuthStore';
import { computeBalanceSheet, computeProfitAndLoss, computeTrialBalance } from '../server/reports/computeReports';

afterEach(() => {
  cleanup();
  localStorage.clear();
  useAuthStore.setState({ user: null, isGuest: true });
});

describe('G-3, G-9, G-23: 1-year Israel & US sample workspaces and guest-only reset safety', () => {
  test('canUseDemoSandbox blocks signed-in users and permits only unsigned guest sessions', () => {
    assert.equal(canUseDemoSandbox({ isGuest: true, user: null }), true);
    assert.equal(canUseDemoSandbox({ isGuest: false, user: null }), false);
    assert.equal(canUseDemoSandbox({ isGuest: false, user: { uid: 'user-123' } }), false);
    assert.equal(canUseDemoSandbox({ isGuest: true, user: { uid: 'user-123' } }), false);
  });

  test('IL and US sample companies cover all 12 months with strictly balanced double-entry books', () => {
    for (const country of ['IL', 'US'] as const) {
      const seeded = seedCountryDemoWorkspace(`ws-${country.toLowerCase()}`, country);
      assert.equal(seeded.currency, country === 'IL' ? 'ILS' : 'USD');
      assert.equal(seeded.accounts.length, 6);
      assert.equal(seeded.invoices.length, 12);
      assert.equal(seeded.bills.length, 12);

      const months = new Set(seeded.transactions.map(tx => tx.date.slice(0, 7)));
      assert.equal(months.size, 12, `${country} sample must span all 12 months`);

      const tb = computeTrialBalance(seeded.accounts, seeded.transactions, '2025-12-31');
      assert.equal(tb.isBalanced, true, `${country} trial balance must balance to the minor unit`);
      assert.equal(tb.totalDebit, tb.totalCredit);

      const bs = computeBalanceSheet(seeded.accounts, seeded.transactions, '2025-12-31');
      assert.equal(bs.isBalanced, true, `${country} balance sheet must balance`);

      const pl = computeProfitAndLoss(seeded.accounts, seeded.transactions, '2025-01-01', '2025-12-31');
      assert.ok(pl.income.total > pl.expense.total, `${country} sample produces positive annual profit`);
    }
  });

  test('buildResetDemoWorkspace supports both clean starter books and empty zeroed books', () => {
    const starter = buildResetDemoWorkspace('ws-demo', 'starter');
    assert.equal(starter.transactions.length, 2);
    const starterTb = computeTrialBalance(starter.accounts, starter.transactions, '2026-12-31');
    assert.equal(starterTb.isBalanced, true);

    const clean = buildResetDemoWorkspace('ws-demo', 'empty');
    assert.equal(clean.accounts.length, 0);
    assert.equal(clean.transactions.length, 0);
    assert.equal(clean.invoices.length, 0);
    assert.equal(clean.bills.length, 0);
  });
});

describe('G-2 & G-8: First-month checklist and Day 1 / Day 3 / Day 7 onboarding email templates', () => {
  test('evaluates automatic ledger milestones and per-user manual overrides cleanly', () => {
    const emptyEval = evaluateFirstMonthChecklist(
      {
        hasBankActivity: false,
        hasOpeningBalance: false,
        hasIssuedInvoice: false,
        hasReconciledStatement: false,
        hasTaxSetupOrReturn: false,
      },
      {},
    );
    assert.equal(emptyEval.totalCount, 5);
    assert.equal(emptyEval.completedCount, 0);

    const saved = saveFirstMonthStep('owner-1', 'ws-alpha', 'first-vat-report', true);
    assert.equal(loadFirstMonthManualState('owner-1', 'ws-alpha')['first-vat-report'], true);
    assert.equal(loadFirstMonthManualState('owner-2', 'ws-alpha')['first-vat-report'], undefined);

    const fullEval = evaluateFirstMonthChecklist(
      {
        hasBankActivity: true,
        hasOpeningBalance: true,
        hasIssuedInvoice: true,
        hasReconciledStatement: true,
        hasTaxSetupOrReturn: false,
      },
      saved,
    );
    assert.equal(fullEval.completedCount, 5);
  });

  test('builds Day 1, Day 3, and Day 7 templates in both English and Hebrew with deep links', () => {
    const sequence = buildOnboardingEmails({
      ownerName: 'Dana',
      workspaceName: 'Studio Dana',
      appOrigin: 'https://books.example.com',
    });
    assert.deepEqual(sequence.map(item => item.day), [1, 3, 7]);
    for (const template of sequence) {
      assert.ok(template.subjectEn.includes('Studio Dana'));
      assert.ok(template.subjectHe.includes('Studio Dana'));
      assert.ok(template.plainTextEn.includes('https://books.example.com/#'));
      assert.ok(template.plainTextHe.includes('https://books.example.com/#'));
    }
  });
});

describe('G-1, G-4, G-6, G-7, G-10, G-11, G-22: Bilingual help center, docs, changelog, and translations', () => {
  test('every SCREEN_HELP_DOCS entry points to an existing bilingual Markdown file under docs/help/', () => {
    for (const doc of SCREEN_HELP_DOCS) {
      const absPath = path.resolve(process.cwd(), doc.docPath);
      assert.equal(fs.existsSync(absPath), true, `Missing help markdown: ${doc.docPath}`);
      const markdown = fs.readFileSync(absPath, 'utf8');
      assert.match(markdown, /## English/);
      assert.match(markdown, /## עברית/);
    }
    assert.equal(fs.existsSync(path.resolve(process.cwd(), 'docs/ACCESSIBILITY.md')), true);
  });

  test('provides 20 bilingual EN/HE how-to guides searchable in both English and Hebrew', () => {
    assert.equal(HOW_TO_ARTICLES.length, 20);
    assert.equal(searchHowToArticles('').length, 20);
    assert.ok(searchHowToArticles('PCN874').length >= 1);
    assert.ok(searchHowToArticles('מע״מ').length >= 1);
    assert.ok(searchHowToArticles('התאמת חשבון בנק').length >= 1);
    assert.ok(articlesForScreen('sales').length >= 2);
    assert.equal(findScreenHelpDoc('reconciliation').slug, 'reconciliation');
  });

  test('weekly changelog entries filter by tag cleanly', () => {
    assert.ok(CHANGELOG_RELEASES.length >= 3);
    const banking = filterChangelogReleases('Banking');
    assert.ok(banking.length >= 1);
    assert.ok(banking.every(r => r.items.every(i => i.tag === 'Banking')));
  });

  test('audits all 12 core screen translation bundles and flags missing keys accurately', () => {
    assert.equal(SCREEN_TRANSLATION_TABLE.length, 12);
    const fullAudit = auditScreenTranslations();
    assert.equal(fullAudit.every(row => row.coveragePercent === 100 && row.untranslatedKeys.length === 0), true);
    assert.equal(translateScreenString('sales', 'action.newInvoice', 'he'), 'חשבונית חדשה');
    assert.equal(translateScreenString('sales', 'action.newInvoice', 'en'), 'New Invoice');

    const withGap = auditScreenTranslations([
      {
        screenId: 'sales',
        screenNameEn: 'Sales',
        screenNameHe: 'מכירות',
        strings: [
          { key: 'title', en: 'Sales', he: 'מכירות' },
          { key: 'missing.key', en: 'Untranslated label', he: '' },
        ],
      },
    ]);
    assert.deepEqual(withGap[0].untranslatedKeys, ['missing.key']);
    assert.equal(withGap[0].coveragePercent, 50);
  });
});

describe('UI component rendering: HelpGuideView, GuestCountrySamplePicker, FirstMonthOnboardingHub, AccessibilityAndLanguagePanel, ScreenHelpHeader, ReleaseNotes', () => {
  test('renders HelpGuideView tabs, switches sample books in guest mode, and renders ReleaseNotes', () => {
    useAuthStore.setState({ user: null, isGuest: true });
    render(
      <>
        <HelpGuideView />
        <GuestCountrySamplePicker />
        <FirstMonthOnboardingHub />
        <AccessibilityAndLanguagePanel />
        <ScreenHelpHeader activeTab="sales" />
        <ReleaseNotes />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /How-to \(20 EN\/HE\)/i }));
    assert.ok(screen.getByText(/20 Step-by-Step How-To Articles/i));

    fireEvent.click(screen.getAllByRole('button', { name: /Load Israel 1-year sample \(ILS\)/i })[0]);
    assert.ok(screen.getByText(/Loaded Galil Design Studio/i));
  });

  test('ScreenHelpDialog keeps Close help first and Open Help & Guide last for focus wrap', () => {
    render(
      <ScreenHelpDialog
        entry={{
          key: 'sales',
          id: 'sales',
          group: 'Core',
          label: 'Sales',
          labels: ['Sales'],
          help: 'Create and track invoices.',
        }}
        activeTab="sales"
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    const buttons = Array.from(dialog.querySelectorAll('button'));
    assert.match(buttons[0].textContent || '', /Close help/);
    assert.match(buttons[buttons.length - 1].textContent || '', /Open Help & Guide/);
  });
});
