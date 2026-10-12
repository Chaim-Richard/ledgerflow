import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, waitFor, act } from '@testing-library/react';
import { parseExportTemplates, templateMatches, exportTemplateKey } from '../lib/exportTemplates';
import ReportTableScroll from '../components/reporting/ReportTableScroll';
import ExportTemplateControls from '../components/reporting/ExportTemplateControls';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
afterEach(() => { cleanup(); localStorage.clear(); });
test('saved templates validate their version, schema and layout and preserve Hebrew names', () => {
  const rows = parseExportTemplates(JSON.stringify({ version: 1, templates: [{ name: 'דוח Monthly', columns: ['Label', 'Amount', 'Count'], layout: { order: ['2','0','2','unknown','1'], hidden: ['0','1','2'] } }, { name: 'דוח Monthly', columns: ['duplicate'] }, { name: '', columns: ['empty'] }] }));
  assert.equal(rows.length, 1); assert.equal(rows[0].name, 'דוח Monthly');
  assert.deepEqual(rows[0].layout, { order: ['2','0','1'], hidden: ['0','1'] });
  assert.equal(templateMatches(rows[0], ['Label', 'Amount', 'Count']), true);
  assert.equal(templateMatches(rows[0], ['Label', 'Tax', 'Count']), false);
  assert.deepEqual(parseExportTemplates('{bad'), []);
  assert.deepEqual(parseExportTemplates(JSON.stringify({ version: 2, templates: rows })), []);
  assert.notEqual(exportTemplateKey('א', 'ב', 'Report'), exportTemplateKey('ב', 'א', 'Report'));
});
function Report() { return <ReportTableScroll><table><caption>Sales by item</caption><thead><tr><th>Item</th><th>Units</th><th>Amount</th></tr></thead><tbody><tr><td>כיסא Chair</td><td>2</td><td>$123.45</td></tr></tbody></table></ReportTableScroll>; }
test('named column choice restores actual order and visibility after reopening the report', async () => {
  setComponentWorkspace(); localStorage.clear();
  let view = render(<Report />);
  await waitFor(() => assert.ok(view.getByRole('button', { name: 'Columns', exact: true })));
  fireEvent.click(view.getByRole('button', { name: 'Columns', exact: true }));
  await waitFor(() => assert.ok(view.getByRole('button', { name: 'Move Amount earlier' })));
  fireEvent.click(view.getByRole('button', { name: 'Move Amount earlier' }));
  fireEvent.click(view.getByRole('checkbox', { name: 'Units' }));
  fireEvent.click(view.getByText('Export templates', { exact: true }));
  fireEvent.change(view.getByLabelText('Template name'), { target: { value: 'דוח Summary' } });
  fireEvent.click(view.getByRole('button', { name: 'Save these columns as…' }));
  fireEvent.click(view.getByRole('checkbox', { name: 'Units' }));
  fireEvent.click(view.getByRole('button', { name: 'Move Amount later' }));
  view.unmount(); view = render(<Report />);
  await waitFor(() => assert.ok(view.getByRole('button', { name: 'Columns', exact: true })));
  fireEvent.click(view.getByRole('button', { name: 'Columns', exact: true }));
  fireEvent.click(view.getByText('Export templates', { exact: true }));
  fireEvent.click(view.getByRole('button', { name: 'Use template דוח Summary' }));
  assert.deepEqual(Array.from(view.container.querySelectorAll('thead th')).map(cell=>cell.textContent), ['Item','Amount','Units']);
  assert.deepEqual(Array.from(view.container.querySelectorAll('tbody td')).map(cell=>cell.textContent), ['כיסא Chair','$123.45','2']);
  assert.match(view.container.querySelector('style')!.textContent!, /nth-child\(3\)/);
  assert.equal((view.getByRole('checkbox', { name: 'Units' }) as HTMLInputElement).checked, false);
});
test('duplicate names and storage refusal retain choices, context changes isolate templates', () => {
  const workspace = setComponentWorkspace(); localStorage.clear();
  const props = { report: 'Report', columns: ['Label','Amount'], layout: { order: ['0','1'], hidden: [] }, onUse: () => {} };
  const view = render(<ExportTemplateControls {...props} />);
  fireEvent.click(view.getByText('Export templates', { exact: true }));
  const prototype = Object.getPrototypeOf(localStorage), original = prototype.setItem;
  try {
    prototype.setItem = () => { throw new Error('blocked'); };
    fireEvent.change(view.getByLabelText('Template name'), { target: { value: 'Local' } });
    fireEvent.click(view.getByRole('button', { name: 'Save these columns as…' }));
    assert.match(view.getByRole('alert').textContent!, /until this screen reloads/);
    assert.ok(view.getByRole('button', { name: 'Use template Local' }));
    fireEvent.change(view.getByLabelText('Template name'), { target: { value: 'Local' } });
    fireEvent.click(view.getByRole('button', { name: 'Save these columns as…' }));
    assert.match(view.getByRole('alert').textContent!, /already exists/);
  } finally { prototype.setItem = original; }
  act(() => useAuthStore.setState({ currentWorkspaceId: 'other' }));
  assert.equal(view.queryByRole('button', { name: 'Use template Local' }), null);
  assert.notEqual(workspace.id, 'other');
});
test('changed report headings refuse stale template application', () => {
  setComponentWorkspace(); localStorage.clear();
  const key = exportTemplateKey(useAuthStore.getState().user!.uid, useAuthStore.getState().currentWorkspaceId!, 'Report');
  localStorage.setItem(key, JSON.stringify({ version: 1, templates: [{ name: 'Old', columns: ['Label','Amount'], layout: { order: ['1','0'], hidden: [] } }] }));
  const view = render(<ExportTemplateControls report="Report" columns={['Label','Tax']} layout={{order:['0','1'],hidden:[]}} onUse={() => assert.fail('incompatible template must not apply')} />);
  fireEvent.click(view.getByText('Export templates', { exact: true }));
  assert.equal((view.getByRole('button', { name: 'Use template Old' }) as HTMLButtonElement).disabled, true);
  assert.match(view.getByText(/Columns have changed/).textContent!, /cannot be applied/);
});
