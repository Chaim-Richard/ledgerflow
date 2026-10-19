import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BankingValidationReportView from '../components/reporting/BankingValidationReportView';

describe('Banking validation report', () => {
  afterEach(() => cleanup());
  test('IBAN and routing checkers react to input', () => {
    render(<BankingValidationReportView />);
    const text = document.body.textContent || '';
    assert.match(text, /US routing/);
    assert.match(text, /IBAN lengths per country/);
    assert.ok(screen.getByRole('table'));
    // IBAN checker: default is valid IL
    assert.match(text, /Valid: length and check digits/);
    const ibanInput = screen.getByLabelText('IBAN') as HTMLInputElement;
    fireEvent.change(ibanInput, { target: { value: 'DE89 3704 0044 0532 0130 00' } });
    assert.match(document.body.textContent || '', /Germany.*22/);
    fireEvent.change(ibanInput, { target: { value: 'GB82 WEST 1234 5698 7654 33' } });
    assert.match(document.body.textContent || '', /check digits/);
    // routing
    const routingInput = screen.getByLabelText('Routing number') as HTMLInputElement;
    fireEvent.change(routingInput, { target: { value: '021000022' } });
    assert.match(document.body.textContent || '', /Invalid/);
    fireEvent.change(routingInput, { target: { value: '021000021' } });
    assert.match(document.body.textContent || '', /Valid: 9 digits/);
  });
});
