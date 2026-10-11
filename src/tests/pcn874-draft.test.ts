import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPcn874FixtureDraft, PCN874_DRAFT_CLOSING_WIDTH, PCN874_DRAFT_HEADER_WIDTH, PCN874_DRAFT_TRANSACTION_WIDTH, type Pcn874FixtureDocument } from '../lib/tax/pcn874Draft';
const one = (overrides: Partial<Pcn874FixtureDocument> = {}): Pcn874FixtureDocument => ({
  entryType:'S',category:'taxable-sale',counterpartyId:'123456789',invoiceDate:'2026-09-15',
  referenceGroup:'0000',referenceNumber:'45',vatNis:180,baseNis:1000,sign:'+',...overrides,
});
test('E-9 PCN874 historical Appendix A record widths and header counts from identical rows', () => {
 const draft=buildPcn874FixtureDraft({dealerId:'012345678',month:'2026-09',generatedOn:'2026-10-11',
   documents:[one(),one({entryType:'L',category:'zero-sale',counterpartyId:'000000000',referenceNumber:'46',vatNis:0,baseNis:200}),
     one({entryType:'T',category:'input-other',referenceNumber:'47',vatNis:36,baseNis:200}),
     one({entryType:'R',category:'input-equipment',referenceNumber:'48',vatNis:18,baseNis:100,sign:'-'})]});
 assert.equal(draft.filingReady,false);
 assert.equal(draft.header.length,PCN874_DRAFT_HEADER_WIDTH);
 assert.ok(draft.transactions.every(row=>row.length===PCN874_DRAFT_TRANSACTION_WIDTH));
 assert.equal(draft.closing.length,PCN874_DRAFT_CLOSING_WIDTH);
 assert.equal(draft.transactions[0].slice(0,10),'S123456789');
 assert.equal(draft.transactions[0].slice(31,40),'000000180');
 assert.equal(draft.transactions[0][40],'+');
 assert.equal(draft.transactions[0].slice(41,51),'0000001000');
 assert.equal(draft.header.slice(25,37),'+00000001000');
 assert.equal(draft.header.slice(37,47),'+000000180');
 assert.ok(draft.text.endsWith('\r\n'));
});
test('E-9 refuses bad dates, mismatched entry classes, too-long fields and fractional amounts', () => {
 const build=(documents:Pcn874FixtureDocument[])=>buildPcn874FixtureDraft({dealerId:'012345678',month:'2026-09',generatedOn:'2026-10-11',documents});
 assert.throws(()=>build([one({invoiceDate:'2026-08-31'})]),/outside report month/);
 assert.throws(()=>build([one({referenceNumber:'1234567890'})]),/reference number/);
 assert.throws(()=>build([one({vatNis:12.5})]),/whole NIS/);
 assert.throws(()=>build([one({entryType:'T'})]),/classification mismatch/);
 assert.throws(()=>build([one({invoiceDate:'2026-09-31'})]),/document date/);
});
