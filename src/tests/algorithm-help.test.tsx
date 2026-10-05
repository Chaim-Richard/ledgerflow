import './helpers/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { AlgorithmHelp } from '../components/platform/AlgorithmHelp';
import { MONTE_CARLO_ALGO } from '../lib/algorithms/monte-carlo';
test('Monte Carlo help describes actual simulation scaling, data requirements and partial-data limits', () => {
 const algorithm = MONTE_CARLO_ALGO;
 const view = render(<AlgorithmHelp algorithm={algorithm} incomplete />);
 try { assert.match(view.container.textContent || '', /5,000 paths over 90 days/); assert.match(view.container.textContent || '', /five distinct days/); assert.match(view.container.textContent || '', /default 50/); assert.doesNotMatch(view.container.textContent || '', /10,000/); assert.match(view.getByRole('status').textContent || '', /incomplete/); assert.match(view.container.textContent || '', /No ledger entry is created/); }
 finally { cleanup(); }
});
