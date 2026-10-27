import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import GlossaryView from '../components/support/GlossaryView';
import { GLOSSARY_TERMS, searchGlossary } from '../lib/accountingGlossary';

afterEach(() => { cleanup(); });

test('C-97: every term has unique identity and real English and Hebrew explanations', () => {
  assert.ok(GLOSSARY_TERMS.length >= 30);
  assert.equal(new Set(GLOSSARY_TERMS.map(term => term.id)).size, GLOSSARY_TERMS.length);
  for (const term of GLOSSARY_TERMS) {
    assert.ok(term.titleEn.trim() && term.plainEn.trim().length > 20, `${term.id}: English too short`);
    assert.match(term.titleHe + term.plainHe, /[\u0590-\u05FF]/, `${term.id}: no Hebrew`);
    assert.ok(term.plainHe.trim().length > 15, `${term.id}: Hebrew too short`);
  }
  assert.deepEqual(searchGlossary('accrual').map(term => term.id).includes('accrual'), true);
  assert.deepEqual(searchGlossary('מלאי').map(term => term.id).includes('inventory'), true);
  assert.equal(GLOSSARY_TERMS.find(term => term.id === 'chart-of-accounts')?.titleHe, 'תוכנית חשבונות');
  assert.ok(searchGlossary('תוכנית חשבונות').some(term => term.id === 'chart-of-accounts'));
  assert.deepEqual(searchGlossary('מע״מ').map(term => term.id), ['vat'], 'Hebrew gershayim matches the stored ASCII quote');
  assert.ok(searchGlossary('מע"מ').some(term => term.id === 'vat'));
  assert.ok(searchGlossary('Tax').every(term => term.categoryEn === 'Tax' || term.plainEn.toLowerCase().includes('tax')));
  assert.equal(searchGlossary('').length, GLOSSARY_TERMS.length);
  assert.equal(searchGlossary('zzzz-no-term').length, 0);
});

test('the screen searches both languages and offers a working empty-state action', () => {
  const view = render(<GlossaryView />);
  assert.ok(view.getByRole('heading', { name: /Accounting glossary/ }));
  assert.match(view.getByRole('status').textContent || '', /of \d+ terms shown/);

  fireEvent.change(view.getByLabelText('Search English or Hebrew'), { target: { value: 'accrual' } });
  assert.ok(view.getByText('Accrual basis'));
  assert.equal(view.queryByText('Asset'), null);

  fireEvent.change(view.getByLabelText('Search English or Hebrew'), { target: { value: 'מלאי' } });
  assert.ok(view.getByText('Inventory'));
  const hebrewDefinition = view.container.querySelector('dd[lang="he"]');
  assert.equal(hebrewDefinition?.getAttribute('dir'), 'rtl');

  fireEvent.change(view.getByLabelText('Search English or Hebrew'), { target: { value: 'not-a-term' } });
  assert.ok(view.getByText('No glossary terms match your search'));
  fireEvent.click(view.getByRole('button', { name: 'Clear search' }));
  assert.match(view.getByRole('status').textContent || '', new RegExp(`${GLOSSARY_TERMS.length} of ${GLOSSARY_TERMS.length}`));
});
