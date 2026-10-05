import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProjectInlineDetails } from '../components/projects/ProjectInlineDetails';
import { RecordInlineField } from '../components/ui/RecordInlineField';
import { setComponentWorkspace, markComponentCollectionsLoaded } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { Project } from '../types';
const project: Project = { id: 'p', uid: 'test-user', workspaceId: 'component-workspace', name: 'שלום', type: 'general', status: 'active', budgetCents: 1250, createdAt: '2026-01-01', dimensions: [] };
beforeEach(() => { setComponentWorkspace(); markComponentCollectionsLoaded('transactions'); useLedgerStore.setState({ projects: [project], transactions: [], truncatedCollections: {} }); });
afterEach(cleanup);
test('project client, budget and status can be edited; viewers read only', () => {
  render(<ProjectInlineDetails project={project} />);
  for (const name of ['Client', 'Budget', 'Status']) assert.ok(screen.getByRole('button', { name: `Edit ${name} of שלום` }));
  assert.ok(screen.getByText('$12.50')); cleanup(); setComponentWorkspace('viewer'); render(<ProjectInlineDetails project={project} />);
  assert.equal(screen.queryByRole('button', { name: /^Edit/ }), null);
});
test('Enter confirms a partial update and preserves a failed Hebrew draft for retry', async () => {
  let attempts = 0; const writes: unknown[] = [];
  const adapter = { session: () => ({ uid: 'test-user', workspaceId: 'component-workspace', writable: true }), read: async () => ({ ...project }), update: async (_target: unknown, fields: unknown) => { attempts++; if (attempts === 1) throw new Error('offline'); writes.push(fields); } };
  render(<RecordInlineField collection="projects" record={project} field="name" label="Project name" adapter={adapter} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project name' })); fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'חדש Supply' } });
  await act(async () => { fireEvent.keyDown(screen.getByLabelText('Project name'), { key: 'Enter' }); });
  assert.match(screen.getByRole('alert').textContent || '', /offline/);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry Project name' })); });
  assert.deepEqual(writes, [{ name: 'חדש Supply' }]); assert.equal(useLedgerStore.getState().projects[0].name, 'חדש Supply');
});
test('a project linked by legacy names refuses a rename rather than dropping its entries', async () => {
  const { makeTransaction } = await import('./fixtures');
  useLedgerStore.setState({ transactions: [makeTransaction({ project: project.name })], truncatedCollections: {} });
  let writes = 0;
  const adapter = { session: () => ({ uid: 'test-user', workspaceId: 'component-workspace', writable: true }), read: async () => ({ ...project }), update: async () => { writes++; } };
  render(<RecordInlineField collection="projects" record={project} field="name" label="Legacy project name" adapter={adapter} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Legacy project name' })); fireEvent.change(screen.getByLabelText('Legacy project name'), { target: { value: 'Changed' } });
  await act(async () => { fireEvent.keyDown(screen.getByLabelText('Legacy project name'), { key: 'Enter' }); });
  assert.match(screen.getByRole('alert').textContent || '', /Re-link/); assert.equal(writes, 0);
});
test('project names cannot save before their reference history has loaded', async () => {
  const { useDataNeedsStore } = await import('../stores/useDataNeedsStore');
  useDataNeedsStore.getState().resetLoaded(); let writes = 0;
  const adapter = { session: () => ({ uid: 'test-user', workspaceId: 'component-workspace', writable: true }), read: async () => ({ ...project }), update: async () => { writes++; } };
  render(<RecordInlineField collection="projects" record={project} field="name" label="Unloaded project name" adapter={adapter} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Unloaded project name' })); fireEvent.change(screen.getByLabelText('Unloaded project name'), { target: { value: 'Changed' } });
  await act(async () => { fireEvent.keyDown(screen.getByLabelText('Unloaded project name'), { key: 'Enter' }); });
  assert.match(screen.getByRole('alert').textContent || '', /Load complete project history/); assert.equal(writes, 0);
});
