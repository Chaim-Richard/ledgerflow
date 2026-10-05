import './helpers/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { NumericAlgorithmInput } from '../components/platform/NumericAlgorithmInput';
function Harness() { const [value, setValue] = useState(90); return <><NumericAlgorithmInput input={{ key: 'days', label: 'Days', min: 30, max: 365, step: 15, defaultValue: 90 }} value={value} onChange={setValue} /><output>{value}</output><button onClick={() => setValue(90)}>Reset</button></>; }
test('numeric drafts apply on Enter/blur, refuse invalid ranges/steps and synchronize sliders/reset', () => {
  const view = render(<Harness />);
  try {
    const input = view.getByRole('spinbutton', { name: 'Days' });
    fireEvent.change(input, { target: { value: '1' } }); assert.equal(view.getByRole('status').textContent, '90');
    fireEvent.change(input, { target: { value: '120' } }); fireEvent.keyDown(input, { key: 'Enter' }); assert.equal(view.getByRole('status').textContent, '120');
    fireEvent.change(input, { target: { value: '400' } }); fireEvent.blur(input); assert.equal(view.getByRole('status').textContent, '120'); assert.ok(view.getByRole('alert'));
    fireEvent.change(input, { target: { value: '31' } }); fireEvent.blur(input); assert.equal(view.getByRole('status').textContent, '120');
    fireEvent.change(input, { target: { value: '' } }); fireEvent.blur(input); assert.equal(view.getByRole('status').textContent, '120');
    fireEvent.keyDown(input, { key: 'Escape' }); assert.equal((input as HTMLInputElement).value, '120');
    fireEvent.change(view.getByRole('slider', { name: 'Days slider' }), { target: { value: '180' } }); assert.equal((input as HTMLInputElement).value, '180');
    fireEvent.click(view.getByText('Reset')); assert.equal((input as HTMLInputElement).value, '90');
  } finally { cleanup(); }
});
