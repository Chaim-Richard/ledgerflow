import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { brandingForLabels, BrandingProfiles } from '../lib/entityBranding';
import type { WorkspaceBranding } from '../lib/branding';

const base: WorkspaceBranding = {
  color: '#111111',
  address: 'HQ 1',
  footer: 'HQ footer',
  terms: { invoice: 'HQ invoice terms', estimate: 'HQ estimate' },
  logoDataUrl: '',
  showPaymentQr: true,
  style: 'classic',
};

describe('entityBranding: brandingForLabels', () => {
  test('no profiles: returns workspace branding untouched', () => {
    const out = brandingForLabels(base, undefined, { property: 'A' }, ['property']);
    assert.deepEqual(out, base);
  });

  test('direct label override wins for its fields, inherits the rest from workspace', () => {
    const profiles: BrandingProfiles = {
      labels: {
        'property:A': { color: '#AA0000', address: 'Property A, London' },
      },
    };
    const out = brandingForLabels(base, profiles, { property: 'A' }, ['property']);
    assert.equal(out.color, '#AA0000');
    assert.equal(out.address, 'Property A, London');
    assert.equal(out.footer, base.footer, 'footer inherits from workspace');
    assert.equal(out.terms?.invoice, base.terms?.invoice, 'terms inherit');
  });

  test('child inherits parent and overrides only what it sets (tree inheritance)', () => {
    const profiles: BrandingProfiles = {
      labels: {
        'property:A': { address: 'Building A', footer: 'A footer', color: '#AA0000' },
        'property:A/C1': { address: 'Unit C1, Building A' }, // child overrides address only
      },
    };
    const out = brandingForLabels(base, profiles, { property: 'A/C1' }, ['property']);
    assert.equal(out.address, 'Unit C1, Building A');
    assert.equal(out.footer, 'A footer', 'footer inherited from parent A');
    assert.equal(out.color, '#AA0000', 'colour inherited from parent A');
  });

  test('parent does not get child branding', () => {
    const profiles: BrandingProfiles = {
      labels: { 'property:A/C1': { address: 'Unit C1' } },
    };
    const out = brandingForLabels(base, profiles, { property: 'A' }, ['property']);
    assert.equal(out.address, base.address);
  });

  test('terms merge per document type: child overrides one type, keeps parent sibling types', () => {
    const profiles: BrandingProfiles = {
      labels: {
        'property:A': { terms: { invoice: 'A invoice', estimate: 'A estimate' } },
        'property:A/C1': { terms: { invoice: 'C1 invoice' } },
      },
    };
    const out = brandingForLabels(base, profiles, { property: 'A/C1' }, ['property']);
    assert.equal(out.terms?.invoice, 'C1 invoice');
    assert.equal(out.terms?.estimate, 'A estimate', 'estimate inherited from parent');
  });

  test('dimension order: first dimension in order wins when both have profiles (like tax profiles)', () => {
    const profiles: BrandingProfiles = {
      labels: {
        'region:US': { address: 'US address' },
        'property:A': { address: 'Property A' },
      },
    };
    const out = brandingForLabels(base, profiles, { region: 'US', property: 'A' }, ['property', 'region']);
    assert.equal(out.address, 'Property A', 'property is first in order, so wins');
    const out2 = brandingForLabels(base, profiles, { region: 'US', property: 'A' }, ['region', 'property']);
    assert.equal(out2.address, 'US address', 'region wins when first');
  });

  test('logo override per label, child inherits logo when it does not set one', () => {
    const logoA = 'data:image/png;base64,AAA';
    const profiles: BrandingProfiles = {
      labels: { 'property:A': { logoDataUrl: logoA } },
    };
    const outChild = brandingForLabels(base, profiles, { property: 'A/C1' }, ['property']);
    const outParent = brandingForLabels(base, profiles, { property: 'A' }, ['property']);
    assert.equal(outParent.logoDataUrl, logoA);
    assert.equal(outChild.logoDataUrl, logoA, 'child inherits logo from parent');
  });

  test('empty string override does not erase parent/workspace', () => {
    const profiles: BrandingProfiles = {
      labels: { 'property:A/C1': { address: '' } },
    };
    const baseWithParent: WorkspaceBranding = { ...base, address: 'HQ 1' };
    const profilesWithParent: BrandingProfiles = {
      labels: {
        'property:A': { address: 'Building A' },
        'property:A/C1': { address: '' },
      },
    };
    const out = brandingForLabels(baseWithParent, profilesWithParent, { property: 'A/C1' }, ['property']);
    assert.equal(out.address, 'Building A');
    void profiles; // keep lint
  });

  test('three-level ancestry: deepest, middle, root all contribute', () => {
    const profiles: BrandingProfiles = {
      labels: {
        'property:A': { color: '#A00000', footer: 'Root footer' },
        'property:A/B': { address: 'Middle address' },
        'property:A/B/C': { footer: 'Leaf footer' },
      },
    };
    const out = brandingForLabels(base, profiles, { property: 'A/B/C' }, ['property']);
    assert.equal(out.color, '#A00000', 'root colour');
    assert.equal(out.address, 'Middle address', 'middle address');
    assert.equal(out.footer, 'Leaf footer', 'leaf footer wins over root');
  });
});
