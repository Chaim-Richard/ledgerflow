/**
 * L-187: exchange rates are never made up. When the rate service can't be reached the server
 * says so (no fallback numbers that could reach the books), and the converter shows no amount.
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import axios from 'axios';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { FxService } from '../server/services/FxService';
import CurrencyConverter from '../components/finance/CurrencyConverter';
import { setComponentWorkspace } from './helpers/componentFixtures';

const realGet = axios.get;
afterEach(() => { axios.get = realGet; cleanup(); });

test('the rate service is down: an error, not a guessed rate', async () => {
  axios.get = (async () => { throw new Error('ECONNREFUSED'); }) as typeof axios.get;
  await assert.rejects(FxService.getRate('USD', 'NOK'), /not available/);
  await assert.rejects(FxService.getRatesForBase('USD'), /not available/);
  assert.equal(await FxService.getRate('EUR', 'EUR'), 1, 'the same currency needs no rate');
});

test('a live rate is used as given', async () => {
  axios.get = (async () => ({ data: { rates: { SEK: 11.2 } } })) as unknown as typeof axios.get;
  assert.equal(await FxService.getRate('USD', 'SEK'), 11.2);
});

test('the converter shows no amount and says why when there are no rates', async () => {
  setComponentWorkspace('owner');
  stubFetchWithBodies(503, { error: 'Exchange rates for USD are not available right now' });
  render(<CurrencyConverter />);
  await waitFor(() => assert.ok(screen.getByRole('status')));
  assert.match(screen.getByRole('status').textContent || '', /not available/);
  assert.ok(screen.getByText(/— EUR/));
});
