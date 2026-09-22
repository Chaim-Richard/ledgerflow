import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  VIEW_COMPONENTS, 
  REPORT_COMPONENTS, 
  SETTINGS_COMPONENTS, 
  APP_TABS,
  REPORT_TABS_REGISTRY,
  SETTINGS_TABS_REGISTRY
} from '../config/registry.js';
import { PARTY_SIDE_CONFIGS } from '../config/partySides.js';

describe('Registry Smoke & Coverage Tests', () => {
  it('should have valid lazy components for all VIEW_COMPONENTS', () => {
    const keys = Object.keys(VIEW_COMPONENTS);
    assert.ok(keys.length > 20, 'Should have over 20 view components');

    for (const key of keys) {
      const comp = VIEW_COMPONENTS[key];
      assert.ok(comp, `VIEW_COMPONENT '${key}' should be defined`);
    }
  });

  it('should have valid lazy components for all REPORT_COMPONENTS', () => {
    const keys = Object.keys(REPORT_COMPONENTS);
    assert.ok(keys.length > 5, 'Should have over 5 report components');

    for (const key of keys) {
      const comp = REPORT_COMPONENTS[key];
      assert.ok(comp, `REPORT_COMPONENT '${key}' should be defined`);
    }
  });

  it('should have valid lazy components for all SETTINGS_COMPONENTS', () => {
    const keys = Object.keys(SETTINGS_COMPONENTS);
    assert.ok(keys.length > 5, 'Should have over 5 settings components');

    for (const key of keys) {
      const comp = SETTINGS_COMPONENTS[key];
      assert.ok(comp, `SETTINGS_COMPONENT '${key}' should be defined`);
    }
  });

  it('should map every report tab to a valid REPORT_COMPONENT', () => {
    for (const tab of REPORT_TABS_REGISTRY) {
      const comp = REPORT_COMPONENTS[tab.componentName];
      assert.ok(comp, `Report tab '${tab.id}' component '${tab.componentName}' missing in REPORT_COMPONENTS`);
    }
  });

  it('should map every settings tab to a valid SETTINGS_COMPONENT', () => {
    for (const tab of SETTINGS_TABS_REGISTRY) {
      const comp = SETTINGS_COMPONENTS[tab.componentName];
      assert.ok(comp, `Settings tab '${tab.id}' component '${tab.componentName}' missing in SETTINGS_COMPONENTS`);
    }
  });

  it('should have valid APP_TABS with icons and labels', () => {
    assert.ok(APP_TABS.length > 15, 'Should have over 15 app tabs');
    for (const tab of APP_TABS) {
      assert.ok(tab.id, 'Tab must have an id');
      assert.ok(tab.label.en, 'Tab must have an english label');
      assert.ok(tab.icon, 'Tab must have an icon');
    }
  });

  it('should have valid partySides configuration for customer and vendor', () => {
    assert.ok(PARTY_SIDE_CONFIGS.customer, 'Customer party side must exist');
    assert.ok(PARTY_SIDE_CONFIGS.vendor, 'Vendor party side must exist');

    assert.equal(PARTY_SIDE_CONFIGS.customer.partySingular, 'Customer');
    assert.equal(PARTY_SIDE_CONFIGS.vendor.partySingular, 'Vendor');

    assert.equal(PARTY_SIDE_CONFIGS.customer.storeDocKey, 'invoices');
    assert.equal(PARTY_SIDE_CONFIGS.vendor.storeDocKey, 'bills');
  });
});
