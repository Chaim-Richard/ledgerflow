/**
 * useDialog (E-08…E-20): a dialog is announced with its title, takes focus, keeps Tab inside,
 * closes on Escape (an inner dialog alone) and gives focus back when it closes. Also checks that
 * the money dialogs use it.
 */
import './helpers/dom';
import test, { afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useDialog } from '../hooks/useDialog';

function Dialog({ onClose, title, children }: { onClose: () => void; title: string; children?: React.ReactNode }) {
  const { dialogProps, titleId } = useDialog(onClose);
  return (
    <div {...dialogProps}>
      <h2 id={titleId}>{title}</h2>
      <button type="button">Close</button>
      <input aria-label={`${title} name`} />
      <button type="button">Save</button>
      {children}
    </div>
  );
}

function Page({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      {open && <Dialog title="New thing" onClose={() => { onClose(); setOpen(false); }} />}
    </>
  );
}

describe('useDialog', () => {
  before(() => {
    // jsdom has no layout: report every element as visible
    HTMLElement.prototype.getClientRects = function () { return [{}] as unknown as DOMRectList; };
  });
  afterEach(() => cleanup());

  test('announced as a modal dialog named by its title; focus moves to the first field', () => {
    render(<Page />);
    fireEvent.click(screen.getByText('Open'));
    const dialog = screen.getByRole('dialog', { name: 'New thing' });
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(document.activeElement, screen.getByLabelText('New thing name'));
  });

  test('Tab and Shift+Tab stay inside the dialog', () => {
    render(<Page />);
    fireEvent.click(screen.getByText('Open'));
    const dialog = screen.getByRole('dialog');
    const save = screen.getByText('Save');
    const close = screen.getByText('Close');
    save.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    // the hook moves focus itself only at the edges
    assert.equal(document.activeElement, close);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    assert.equal(document.activeElement, save);
  });

  test('Escape closes it and focus goes back to the button that opened it', () => {
    let closed = 0;
    render(<Page onClose={() => { closed++; }} />);
    const opener = screen.getByText('Open');
    opener.focus();
    fireEvent.click(opener);
    act(() => { fireEvent.keyDown(screen.getByLabelText('New thing name'), { key: 'Escape' }); });
    assert.equal(closed, 1);
    assert.equal(screen.queryByRole('dialog'), null);
    assert.equal(document.activeElement, opener);
  });

  test('Escape in a dialog inside another closes only the inner one', () => {
    let outer = 0;
    let inner = 0;
    render(
      <Dialog title="Outer" onClose={() => { outer++; }}>
        <Dialog title="Inner" onClose={() => { inner++; }} />
      </Dialog>,
    );
    fireEvent.keyDown(screen.getByLabelText('Inner name'), { key: 'Escape' });
    assert.equal(inner, 1);
    assert.equal(outer, 0);
  });

  test('the money dialogs use it', () => {
    const files = [
      'src/components/sales/InvoiceModal.tsx', 'src/components/purchases/BillModal.tsx', 'src/components/sales/ReceivePaymentModal.tsx',
      'src/components/common/PartyModal.tsx', 'src/components/transactions/TransactionEditModal.tsx',
      'src/components/ledger/JournalEntryModal.tsx', 'src/components/purchases/PurchaseOrdersView.tsx', 'src/components/finance/CreditNotesView.tsx',
      'src/components/inventory/InventoryItemDialog.tsx', 'src/components/inventory/StockAdjustDialog.tsx', 'src/components/inventory/StockCountDialog.tsx',
      'src/components/inventory/CogsDialog.tsx', 'src/components/sales/WriteOffModal.tsx', 'src/components/common/MergePartyDialog.tsx',
      'src/components/ledger/MergeAccountDialog.tsx',
    ];
    for (const f of files) assert.match(fs.readFileSync(f, 'utf8'), /useDialog\(/, f);
  });
});
