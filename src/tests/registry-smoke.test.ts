import { describe, it, expect } from 'vitest';
import { 
  VIEW_COMPONENTS, 
  REPORT_COMPONENTS, 
  SETTINGS_COMPONENTS, 
  APP_TABS,
  REPORT_TABS_REGISTRY,
  SETTINGS_TABS_REGISTRY
} from '../config/registry';
import { PARTY_SIDE_CONFIGS } from '../config/partySides';

describe('Registry Smoke & Coverage Tests', () => {
  it('should have valid lazy components for all VIEW_COMPONENTS', () => {
    const keys = Object.keys(VIEW_COMPONENTS);
    expect(keys.length).toBeGreaterThan(20);

    for (const key of keys) {
      const comp = VIEW_COMPONENTS[key];
      expect(comp, `VIEW_COMPONENT '${key}' should be defined`).toBeDefined();
    }
  });

  it('should have valid lazy components for all REPORT_COMPONENTS', () => {
    const keys = Object.keys(REPORT_COMPONENTS);
    expect(keys.length).toBeGreaterThan(5);

    for (const key of keys) {
      const comp = REPORT_COMPONENTS[key];
      expect(comp, `REPORT_COMPONENT '${key}' should be defined`).toBeDefined();
    }
  });

  it('should have valid lazy components for all SETTINGS_COMPONENTS', () => {
    const keys = Object.keys(SETTINGS_COMPONENTS);
    expect(keys.length).toBeGreaterThan(5);

    for (const key of keys) {
      const comp = SETTINGS_COMPONENTS[key];
      expect(comp, `SETTINGS_COMPONENT '${key}' should be defined`).toBeDefined();
    }
  });

  it('should map every report tab to a valid REPORT_COMPONENT', () => {
    for (const tab of REPORT_TABS_REGISTRY) {
      const comp = REPORT_COMPONENTS[tab.componentName];
      expect(comp, `Report tab '${tab.id}' component '${tab.componentName}' missing in REPORT_COMPONENTS`).toBeDefined();
    }
  });

  it('should map every settings tab to a valid SETTINGS_COMPONENT', () => {
    for (const tab of SETTINGS_TABS_REGISTRY) {
      const comp = SETTINGS_COMPONENTS[tab.componentName];
      expect(comp, `Settings tab '${tab.id}' component '${tab.componentName}' missing in SETTINGS_COMPONENTS`).toBeDefined();
    }
  });

  it('should have valid APP_TABS with icons and labels', () => {
    expect(APP_TABS.length).toBeGreaterThan(15);
    for (const tab of APP_TABS) {
      expect(tab.id).toBeTruthy();
      expect(tab.label.en).toBeTruthy();
      expect(tab.icon).toBeDefined();
    }
  });

  it('should have valid partySides configuration for customer and vendor', () => {
    expect(PARTY_SIDE_CONFIGS.customer).toBeDefined();
    expect(PARTY_SIDE_CONFIGS.vendor).toBeDefined();

    expect(PARTY_SIDE_CONFIGS.customer.partySingular).toBe('Customer');
    expect(PARTY_SIDE_CONFIGS.vendor.partySingular).toBe('Vendor');

    expect(PARTY_SIDE_CONFIGS.customer.storeDocKey).toBe('invoices');
    expect(PARTY_SIDE_CONFIGS.vendor.storeDocKey).toBe('bills');
  });
});
