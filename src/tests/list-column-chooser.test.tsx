import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import ListColumnChooser from '../components/ui/ListColumnChooser';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import {
  listColumnCss,
  listColumnKey,
  normalizeListHidden,
  toggleListColumn,
} from '../lib/listColumns';

const columns = ['Selection', 'Number', 'Customer', 'Date', 'Amount', 'Actions'];
const view = () => render(
  <div data-list-columns="test-list">
    <ListColumnChooser scope="test-list" label="Invoices" columns={columns} />
    <table><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
      <tbody><tr>{columns.map(c => <td key={c}>{c}</td>)}</tr></tbody></table>
  </div>,
);

afterEach(() => { cleanup(); localStorage.clear(); });

test('selection, actions, at least two columns and bad stored indices are protected', () => {
  assert.deepEqual(normalizeListHidden([1, 1, 9, -1, '2'], columns.length), [1]);
  assert.deepEqual(toggleListColumn([], 0, columns.length), []);
  assert.deepEqual(toggleListColumn([], columns.length - 1, columns.length), []);
  assert.deepEqual(toggleListColumn([], 2, columns.length), [2]);
  assert.deepEqual(toggleListColumn([1, 2, 3], 4, columns.length), [1, 2, 3, 4],
    'the last hideable middle column leaves the two locked columns visible');
  assert.deepEqual(toggleListColumn([1, 2, 3, 4], 5, columns.length), [1, 2, 3, 4],
    'the last column cannot be hidden');
  assert.deepEqual(toggleListColumn([1, 2, 3], 2, columns.length), [1, 3]);
  const css = listColumnCss('scope-1', [2]);
  assert.match(css, /@media screen/);
  assert.match(css, /thead > tr:not\(:has\(> \[colspan\]\)\) > :nth-child\(3\)/);
  assert.match(css, /tbody > tr:not\(:has\(> \[colspan\]\)\) > :nth-child\(3\)/);
  assert.equal(listColumnCss('scope-1', []), '');
});

test('on screen the choice persists, resets and is isolated by workspace', () => {
  const workspace = setComponentWorkspace();
  localStorage.clear();
  let rendered = view();
  fireEvent.click(rendered.container.querySelector('summary')!);
  assert.equal((rendered.getByRole('checkbox', { name: 'Column 1 visibility' }) as HTMLInputElement).disabled, true);
  assert.equal((rendered.getByRole('checkbox', { name: 'Column 6 visibility' }) as HTMLInputElement).disabled, true);
  fireEvent.click(rendered.getByRole('checkbox', { name: 'Column 3 visibility' }));
  assert.match(rendered.container.querySelector('summary')?.textContent || '', /1 hidden/);
  const key = listColumnKey(useAuthStore.getState().user!.uid, workspace.id, 'Invoices');
  assert.equal(localStorage.getItem(key), '[2]');
  assert.match(rendered.container.querySelector('style')?.textContent || '', /nth-child\(3\)/);

  rendered.unmount();
  rendered = view();
  fireEvent.click(rendered.container.querySelector('summary')!);
  assert.equal((rendered.getByRole('checkbox', { name: 'Column 3 visibility' }) as HTMLInputElement).checked, false);
  fireEvent.click(rendered.getByRole('button', { name: 'Show all columns' }));
  assert.equal(localStorage.getItem(key), null);
  assert.equal((rendered.getByRole('checkbox', { name: 'Column 3 visibility' }) as HTMLInputElement).checked, true);

  fireEvent.click(rendered.getByRole('checkbox', { name: 'Column 4 visibility' }));
  act(() => { useAuthStore.setState({ currentWorkspaceId: 'another-workspace' }); });
  assert.equal((rendered.getByRole('checkbox', { name: 'Column 4 visibility' }) as HTMLInputElement).checked, true,
    'a different workspace starts from its own column choice');
});
