/**
 * A-190 screen: top customers. Big Ltd invoiced $1,000 this January inside the default
 * year-to-date period and ranks above Small Ltd's $200 (lib test works the full figures).
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import TopPartiesReportView from '../components/reporting/TopPartiesReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';
import { getLocalDateISO } from '../lib/utils';

const year = getLocalDateISO().slice(0, 4);

describe('Top customers and vendors screen', () => {
  beforeEach(() => {
    stubFetch(404);
    setComponentWorkspace('owner');
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({
      customers: [
        { id: 'c1', name: 'Big Ltd', workspaceId: 'component-workspace' },
        { id: 'c2', name: 'Small Ltd', workspaceId: 'component-workspace' },
      ],
      vendors: [],
      invoices: [
        { id: 'i1', customerId: 'c1', status: 'sent', date: `${year}-01-10`, amountCents: 100_000, amountPaidCents: 0, currency: 'USD', workspaceId: 'component-workspace' },
        { id: 'i2', customerId: 'c2', status: 'sent', date: `${year}-01-12`, amountCents: 20_000, amountPaidCents: 0, currency: 'USD', workspaceId: 'component-workspace' },
      ],
      bills: [], payments: [], creditNotes: [], vendorCredits: [], truncatedCollections: {},
    } as never);
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('the biggest customer is first with its invoiced amount and a labelled trend', () => {
    render(<TopPartiesReportView />);
    const big = screen.getByRole('rowheader', { name: 'Big Ltd' });
    const small = screen.getByRole('rowheader', { name: 'Small Ltd' });
    assert.ok(big.compareDocumentPosition(small) & Node.DOCUMENT_POSITION_FOLLOWING, 'Big Ltd ranks first');
    assert.match(big.parentElement!.textContent || '', /\$1,000\.00/);
    assert.match(small.parentElement!.textContent || '', /\$200\.00/);
    assert.ok(screen.getByRole('img', { name: /12-month trend: highest month \$1,000\.00/ }), 'the trend line says its figures');
  });
});
