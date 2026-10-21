import './helpers/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_TABS,
  VIEW_COMPONENTS,
  REPORT_TABS_REGISTRY,
  SETTINGS_TABS_REGISTRY,
  INTELLIGENCE_TABS_REGISTRY,
  ANALYTICAL_LENSES_REGISTRY,
  REPORT_COMPONENTS,
  SETTINGS_COMPONENTS,
} from '../config/registry';

/**
 * AI #2 guard: a tab the sidebar or the Reports strip shows must have something to render.
 * `Reports.tsx` does `REPORT_COMPONENTS[tab.componentName]` with no fallback, and `Settings.tsx`
 * does the same with `SETTINGS_COMPONENTS` — a name that is not registered there is a dead tab
 * (an error boundary at best, an empty screen at worst). Types cannot catch it: `componentName`
 * is a plain string. This test can, at the moment the entry is added.
 */
test('every report tab resolves to a registered report component', () => {
  const missing = REPORT_TABS_REGISTRY.filter(tab => !REPORT_COMPONENTS_HAS(tab.componentName));
  assert.deepEqual(missing.map(t => `${t.id} → ${t.componentName}`), []);
});

test('every settings tab resolves to a registered settings component', () => {
  const missing = SETTINGS_TABS_REGISTRY.filter(tab => !SETTINGS_COMPONENTS_HAS(tab.componentName));
  assert.deepEqual(missing.map(t => `${t.id} → ${t.componentName}`), []);
});

test('every main tab resolves to a view component by its own id', () => {
  const missing = APP_TABS.filter(tab => !VIEW_COMPONENTS[tab.id]);
  assert.deepEqual(missing.map(t => t.id), []);
});

test('report, settings and lens ids are unique inside their registry', () => {
  const dupes = (ids: string[]) => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  assert.deepEqual(dupes(REPORT_TABS_REGISTRY.map(t => t.id)), []);
  assert.deepEqual(dupes(SETTINGS_TABS_REGISTRY.map(t => t.id)), []);
  assert.deepEqual(dupes(INTELLIGENCE_TABS_REGISTRY.map(t => t.id)), []);
  assert.deepEqual(dupes(ANALYTICAL_LENSES_REGISTRY.map(t => t.id)), []);
});

/** The screens resolve `componentName` against these maps with no fallback, so a name that is not
 * in one of them is a dead tab. */
function REPORT_COMPONENTS_HAS(name: string): boolean {
  return Boolean(REPORT_COMPONENTS[name]);
}
function SETTINGS_COMPONENTS_HAS(name: string): boolean {
  return Boolean(SETTINGS_COMPONENTS[name]);
}
