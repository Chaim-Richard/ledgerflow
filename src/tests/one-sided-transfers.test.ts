import test from 'node:test';
import assert from 'node:assert/strict';
import { oneSidedTransfers } from '../lib/oneSidedTransfers';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { BankStatementLine, Transaction } from '../types';
const accounts = [makeChartAccount({id:'bank-a',name:'Main checking', category:'Cash'}),makeChartAccount({id:'bank-b',name:'Reserve bank', category:'Cash'}),makeChartAccount({id:'clearing',name:'Transfers in transit',category:'Deposits'})];
const tx = (id: string, lines: Array<{accountId:string;amountCents:number}>, extra: Partial<Transaction>={}) => makeTransaction({id, date:'2026-03-04', isTransfer:true, lines, ...extra});
const statement = (id: string, accountId: string, matchedTransactionId: string, extra: Partial<BankStatementLine>={}): BankStatementLine => ({id,uid:'test',workspaceId:'ws-1',date:'2026-03-05',description:'Transfer',amountCents:1000,accountId,matchedTransactionId,status:'matched',...extra});
test('E-6 distinguishes genuinely one-sided ledger, incomplete bank matching and balanced transfer', () => {
 const transactions=[
   tx('balanced',[{accountId:'bank-a',amountCents:-1000},{accountId:'bank-b',amountCents:1000}]),
   tx('one-bank',[{accountId:'bank-a',amountCents:-2500},{accountId:'bank-b',amountCents:2500}]),
   tx('one-ledger',[{accountId:'bank-a',amountCents:-3000},{accountId:'clearing',amountCents:3000}]),
   tx('unequal',[{accountId:'bank-a',amountCents:-500},{accountId:'bank-b',amountCents:400},{accountId:'clearing',amountCents:100}]),
   tx('not-transfer',[{accountId:'bank-a',amountCents:-2000},{accountId:'bank-b',amountCents:2000}],{isTransfer:false}),
   tx('future',[{accountId:'bank-a',amountCents:-900},{accountId:'bank-b',amountCents:900}],{date:'2026-04-01'}),
 ];
 const bankLines=[statement('b1','bank-a','balanced'),statement('b2','bank-b','balanced'),statement('u1','bank-a','one-bank'),statement('future','bank-b','one-bank',{date:'2026-05-01'}),statement('unknown','', 'one-bank')];
 const issues=oneSidedTransfers(accounts,transactions,bankLines,'2026-03-31');
 assert.deepEqual(issues.map(x=>[x.id,x.kind,x.amountCents]),[['one-bank','one-bank-side-matched',2500],['one-ledger','one-ledger-side',3000],['unequal','unequal-cash-lines',500]]);
 assert.match(issues[0].status,/incoming side not confirmed/);
 assert.throws(()=>oneSidedTransfers(accounts,transactions,bankLines,'2026-02-30'),/valid end date/);
});
