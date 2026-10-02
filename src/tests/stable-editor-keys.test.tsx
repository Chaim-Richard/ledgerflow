/** Editable rows keep their DOM identity while users edit, append, or remove legacy lines. */
import './helpers/dom';
import test, { afterEach, beforeEach, describe, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import JournalEntryModal from '../components/ledger/JournalEntryModal';
import SplitEditor from '../components/transactions/SplitEditor';
import TransactionEditModal from '../components/transactions/TransactionEditModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { Transaction, TransactionLine, Workspace } from '../types';
import { makeChartAccount, makeTransaction } from './fixtures';

const expense = makeChartAccount({ id: 'office', name: 'Office expenses', type: 'expense', category: 'COGS' });
const bank = makeChartAccount({ id: 'bank', name: 'Checking', type: 'asset', category: 'Cash' });
const accounts = [expense, bank];
const workspace: Workspace = {
  id: 'ws-1',
  uid: 'test-user',
  name: 'Office',
  businessType: 'custom',
  createdAt: '2026-01-01T00:00:00.000Z',
  currency: 'USD',
  dimensions: [],
};
const splitDescription = 'Line item description (e.g. Milk 2%)';
const modalDescription = 'Optional details...';

function legacyLines(): TransactionLine[] {
  return [
    { accountId: expense.id, accountName: expense.name, amountCents: 1000, description: 'First line' },
    { accountId: expense.id, accountName: expense.name, amountCents: 2000, description: 'Second line' },
    { accountId: expense.id, accountName: expense.name, amountCents: 3000, description: 'Third line' },
  ];
}

function splitTransaction(lines = legacyLines()) {
  return makeTransaction({
    description: 'Office purchase',
    totalAmountCents: lines.reduce((sum, line) => sum + line.amountCents, 0),
    lines,
  });
}

function descriptionInputs(placeholder: string): HTMLInputElement[] {
  return screen.getAllByPlaceholderText<HTMLInputElement>(placeholder);
}

function splitRemoveButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>(
    'button:has(svg.lucide-trash-2), button:has(svg.lucide-trash2)',
  ));
}

function captureDuplicateKeyErrors(context: TestContext): string[] {
  const errors: string[] = [];
  const originalError = console.error;
  context.mock.method(console, 'error', (...args: unknown[]) => {
    const message = args.map(String).join(' ');
    if (/same key|unique.*key/i.test(message)) errors.push(message);
    else originalError(...args);
  });
  return errors;
}

describe('Stable editable transaction rows', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      currentWorkspaceId: 'ws-1',
      workspaces: [workspace],
    });
    useLedgerStore.setState({
      accounts,
      baseCurrency: 'USD',
      transactions: [],
      dimensionNodes: [],
      classes: [],
      locations: [],
      projects: [],
      autoRules: [],
      analyticalPatternCache: {},
      lockException: null,
    });
  });
  afterEach(() => cleanup());

  test('an ID-less split line keeps its input, value, and focus when an earlier line is removed', () => {
    const { container } = render(
      <SplitEditor transaction={splitTransaction()} accounts={accounts} projects={[]} onSave={() => {}} onClose={() => {}} />,
    );
    const expandButtons = container.querySelectorAll<HTMLButtonElement>('button:has(svg.lucide-layers)');
    fireEvent.click(expandButtons[2]);
    const classInput = screen.getByPlaceholderText<HTMLInputElement>('Type or select class');
    const thirdInput = descriptionInputs(splitDescription)[2];
    thirdInput.focus();
    fireEvent.change(thirdInput, { target: { value: 'Third line edited' } });
    assert.ok(descriptionInputs(splitDescription)[2] === thirdInput, 'editing must not replace the input');
    assert.ok(document.activeElement === thirdInput, 'editing keeps keyboard focus');

    fireEvent.click(splitRemoveButtons(container)[0]);
    assert.equal(descriptionInputs(splitDescription).length, 2);
    assert.ok(descriptionInputs(splitDescription)[1] === thirdInput, 'removing an earlier row must not replace the surviving row');
    assert.equal(thirdInput.value, 'Third line edited');
    assert.ok(document.activeElement === thirdInput);
    assert.ok(screen.getByPlaceholderText('Type or select class') === classInput, 'expanded details stay with the surviving line');

    fireEvent.change(thirdInput, { target: { value: 'Third line edited again' } });
    assert.ok(descriptionInputs(splitDescription)[1] === thirdInput);
    assert.equal(thirdInput.value, 'Third line edited again');
    assert.ok(document.activeElement === thirdInput, 'continued typing keeps focus after the row moves');
  });

  test('duplicate ID-less split lines remain distinct without React key errors', context => {
    const errors = captureDuplicateKeyErrors(context);
    const duplicate = { accountId: expense.id, accountName: expense.name, amountCents: 2500, description: 'Office supplies' };
    const { container } = render(
      <SplitEditor transaction={splitTransaction([{ ...duplicate }, { ...duplicate }])} accounts={accounts} projects={[]} onSave={() => {}} onClose={() => {}} />,
    );
    const secondInput = descriptionInputs(splitDescription)[1];
    fireEvent.change(secondInput, { target: { value: 'Second supplies line' } });
    assert.equal(descriptionInputs(splitDescription)[0].value, 'Office supplies');
    fireEvent.click(splitRemoveButtons(container)[0]);
    assert.ok(descriptionInputs(splitDescription)[0] === secondInput, 'the second duplicate keeps its input when the first is removed');
    assert.equal(secondInput.value, 'Second supplies line');
    assert.deepEqual(errors, [], 'identical line content still needs distinct React keys');
  });

  test('an appended split row survives earlier deletion and saves only transaction line data', async () => {
    const initialLines: TransactionLine[] = [
      { accountId: expense.id, accountName: expense.name, amountCents: 2000, description: 'First line' },
      { accountId: expense.id, accountName: expense.name, amountCents: 4000, description: 'Second line' },
    ];
    let saved: TransactionLine[] | undefined;
    const { container } = render(
      <SplitEditor transaction={splitTransaction(initialLines)} accounts={accounts} projects={[]} onSave={lines => { saved = lines; }} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Append Split Line' }));
    const appendedInput = descriptionInputs(splitDescription)[2];
    fireEvent.change(appendedInput, { target: { value: 'Added line' } });
    fireEvent.change(screen.getAllByPlaceholderText<HTMLInputElement>('Type or select account')[2], { target: { value: expense.name } });
    fireEvent.click(splitRemoveButtons(container)[0]);
    assert.ok(descriptionInputs(splitDescription)[1] === appendedInput, 'an appended row keeps its DOM node after an earlier deletion');
    assert.equal(appendedInput.value, 'Added line');

    // Replace the removed $20 with the appended line, keeping the original $60 split balanced.
    fireEvent.change(screen.getAllByRole('spinbutton')[5], { target: { value: '20' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Commit Atomic Split' })); });
    assert.deepEqual(saved, [
      initialLines[1],
      { accountId: expense.id, accountName: expense.name, amountCents: 2000, description: 'Added line' },
    ], 'UI row identifiers must not be persisted on legacy or appended transaction lines');
  });

  test('duplicate legacy lines in the transaction dialog retain identity while their content changes', context => {
    const errors = captureDuplicateKeyErrors(context);
    const duplicate = { accountId: expense.id, accountName: expense.name, amountCents: 1500, description: 'Office supplies' };
    const transaction = makeTransaction({
      description: 'Office purchase',
      totalAmountCents: 3000,
      lines: [{ ...duplicate }, { ...duplicate }, { accountId: bank.id, accountName: bank.name, amountCents: -3000, description: 'Bank payment' }],
    });
    render(<TransactionEditModal isOpen transaction={transaction} accounts={accounts} onClose={() => {}} onUpdate={() => {}} />);
    const thirdInput = descriptionInputs(modalDescription)[2];
    thirdInput.focus();
    fireEvent.change(thirdInput, { target: { value: 'Edited bank payment' } });
    const accountSelect = thirdInput.parentElement?.parentElement?.querySelector<HTMLSelectElement>('select');
    assert.ok(accountSelect);
    fireEvent.change(accountSelect, { target: { value: expense.id } });
    assert.ok(descriptionInputs(modalDescription)[2] === thirdInput, 'changing an account must not replace the row');
    assert.ok(document.activeElement === thirdInput);

    fireEvent.click(screen.getAllByTitle('Remove distribution vector')[0]);
    assert.ok(descriptionInputs(modalDescription)[1] === thirdInput, 'removing an earlier distribution row preserves the surviving input');
    assert.equal(thirdInput.value, 'Edited bank payment');
    assert.deepEqual(errors, [], 'duplicate account/content rows must not share a React key');
  });

  test('saving the transaction dialog preserves legacy line fields without UI row identifiers', async () => {
    const lines: TransactionLine[] = [
      { accountId: expense.id, accountName: expense.name, amountCents: 1500, description: 'Office supplies' },
      { accountId: expense.id, accountName: expense.name, amountCents: 1500, description: 'Office supplies' },
      { accountId: bank.id, accountName: bank.name, amountCents: -3000, description: 'Bank payment' },
    ];
    const transaction = makeTransaction({ description: 'Office purchase', totalAmountCents: 3000, lines });
    let saved: { id: string; updates: Partial<Transaction> } | undefined;
    render(<TransactionEditModal isOpen transaction={transaction} accounts={accounts} onClose={() => {}} onUpdate={(id, updates) => { saved = { id, updates }; }} />);
    fireEvent.change(descriptionInputs(modalDescription)[1], { target: { value: 'Edited supplies line' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record synchronized changes' })); });
    await waitFor(() => assert.ok(saved));
    assert.ok(saved);
    assert.equal(saved.id, transaction.id);
    assert.deepEqual(saved.updates.lines, lines.map((line, index) => ({
      ...line,
      description: index === 1 ? 'Edited supplies line' : line.description,
      project: undefined,
    })), 'saving must preserve the line payload without adding UI-only identifiers');
  });

  test('journal rows keep their inputs and focus across account edits, duplicate accounts, and earlier deletion', context => {
    const errors = captureDuplicateKeyErrors(context);
    render(<JournalEntryModal isOpen onClose={() => {}} user={{ uid: 'test-user' } as never} accounts={accounts} workspaceId="ws-1" />);
    assert.equal(screen.getAllByPlaceholderText('Select Account...').length, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Add Line' }));
    const thirdInput = screen.getByLabelText<HTMLInputElement>('Account for line 3');
    fireEvent.change(screen.getByLabelText('Account for line 1'), { target: { value: expense.id } });
    fireEvent.change(screen.getByLabelText('Account for line 2'), { target: { value: expense.id } });

    thirdInput.focus();
    fireEvent.change(thirdInput, { target: { value: bank.id } });
    assert.ok(screen.getByLabelText('Account for line 3') === thirdInput, 'assigning an account keeps the appended input');
    assert.ok(document.activeElement === thirdInput, 'assigning an account keeps keyboard focus');
    fireEvent.change(thirdInput, { target: { value: expense.id } });
    assert.ok(screen.getByLabelText('Account for line 3') === thirdInput, 'editing an assigned account keeps the input');
    assert.ok(document.activeElement === thirdInput);
    assert.deepEqual(errors, [], 'multiple rows can use the same account without sharing a React key');

    fireEvent.click(screen.getByRole('button', { name: 'Remove line 1' }));
    assert.equal(screen.getAllByPlaceholderText('Select Account...').length, 2);
    assert.ok(screen.getByLabelText('Account for line 2') === thirdInput, 'removing the first journal row preserves the appended row');
    assert.equal(thirdInput.value, `${expense.code} - ${expense.name}`);
    assert.ok(document.activeElement === thirdInput, 'removing an earlier row keeps focus on the surviving input');
  });
});
