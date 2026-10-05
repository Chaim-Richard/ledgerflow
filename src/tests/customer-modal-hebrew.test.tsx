import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import CustomerModal from '../components/sales/CustomerModal';
import type { Customer } from '../types';

afterEach(cleanup);

test('customer dialog saves mixed-language contact fields and clears the form', () => {
  const saved: Partial<Customer>[] = [];
  let closed = 0;
  const view = render(<CustomerModal isOpen onClose={() => { closed++; }} onSave={customer => saved.push(customer)} />);
  assert.ok(view.getByRole('dialog', { name: 'Add Customer' }));
  fireEvent.change(view.getByLabelText('Customer Name'), { target: { value: 'לקוח Acme ירושלים' } });
  fireEvent.change(view.getByLabelText('Email Address'), { target: { value: 'acme@example.test' } });
  fireEvent.change(view.getByLabelText('Phone Number'), { target: { value: '+972-50-1234567' } });
  fireEvent.change(view.getByLabelText('Status'), { target: { value: 'inactive' } });
  fireEvent.click(view.getByRole('button', { name: 'Save Customer' }));
  assert.deepEqual(saved, [{ name: 'לקוח Acme ירושלים', email: 'acme@example.test', phone: '+972-50-1234567', status: 'inactive', balanceCents: 0 }]);
  assert.equal((view.getByLabelText('Customer Name') as HTMLInputElement).value, '');
  fireEvent.click(view.getByRole('button', { name: 'Cancel' }));
  assert.equal(closed, 1);
});

test('closed customer dialog renders no form; Escape closes the open dialog without saving', () => {
  let closed = 0;
  let saved = 0;
  const props = { onClose: () => { closed++; }, onSave: () => { saved++; } };
  const view = render(<CustomerModal {...props} isOpen={false} />);
  assert.equal(view.queryByRole('dialog'), null);
  view.rerender(<CustomerModal {...props} isOpen />);
  fireEvent.keyDown(view.getByLabelText('Customer Name'), { key: 'Escape' });
  assert.equal(closed, 1);
  assert.equal(saved, 0);
});
