import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { handlePdfRequest } from '../server/routes/documentRoutes';
import { generateDocumentPdf } from '../server/services/pdfService';

class MockPdfDb {
  private data: Record<string, Record<string, any>> = {
    workspaces: {
      'ws-test': { name: 'Acme International Workspace', uid: 'user-admin' }
    },
    invoices: {
      'inv-101': {
        id: 'inv-101',
        number: 'INV-1001',
        customerName: 'Global Corp',
        totalCents: 125000,
        amountCents: 125000,
        date: '2026-03-15',
        items: [
          { description: 'Cloud Infrastructure Architecture', quantity: 1, amountCents: 125000 }
        ]
      }
    },
    estimates: {
      'est-201': {
        id: 'est-201',
        number: 'EST-2001',
        customerName: 'Stark Enterprises',
        amountCents: 450000,
        date: '2026-03-20',
        items: [
          { description: 'Security Hardening Audit', quantity: 1, amountCents: 450000 }
        ]
      }
    },
    creditNotes: {
      'cn-301': {
        id: 'cn-301',
        number: 'CN-3001',
        customerName: 'Wayne Tech',
        amountCents: 35000,
        date: '2026-03-22',
        reason: 'Service Level Agreement Credit'
      }
    },
    payments: {
      'pay-401': {
        id: 'pay-401',
        number: 'PAY-4001',
        contactName: 'Oscorp Industries',
        amountCents: 85000,
        date: '2026-03-25',
        method: 'wire'
      }
    },
    customers: {
      'cust-501': {
        id: 'cust-501',
        name: 'Cyberdyne Systems',
        email: 'billing@cyberdyne.com',
        billingAddress: '100 Skynet Way, Sunnyvale, CA'
      }
    },
    vendors: {},
    bills: {}
  };

  collection(collName: string) {
    const collData = this.data[collName] || {};
    return {
      doc: (id: string) => ({
        id,
        get: async () => {
          const item = collData[id];
          return {
            exists: !!item,
            data: () => item ? JSON.parse(JSON.stringify(item)) : undefined
          };
        }
      }),
      where: function queryWhere() {
        const queryObj = {
          where: queryWhere,
          limit: () => queryObj,
          get: async () => {
            const docs = Object.entries(collData).map(([id, val]) => ({
              id,
              data: () => JSON.parse(JSON.stringify(val))
            }));
            return { docs, empty: docs.length === 0, size: docs.length };
          }
        };
        return queryObj;
      }
    };
  }
}

function createMockHttp(type: string, id: string, workspaceId = 'ws-test') {
  const req: any = {
    params: { type, id },
    query: { workspaceId },
    body: {},
    headers: {},
    user: { uid: 'user-admin', admin: true }
  };

  let responseBuffer: Buffer | null = null;
  let responseStatus = 200;
  const responseHeaders: Record<string, string> = {};

  const res: any = {
    status: (code: number) => {
      responseStatus = code;
      return res;
    },
    setHeader: (name: string, val: string) => {
      responseHeaders[name] = val;
      return res;
    },
    send: (payload: any) => {
      responseBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
      return res;
    },
    json: (obj: any) => {
      if (obj?.data?.pdfBase64) {
        responseBuffer = Buffer.from(obj.data.pdfBase64, 'base64');
      }
      return res;
    }
  };

  return { req, res, getBuffer: () => responseBuffer, getStatus: () => responseStatus, getHeaders: () => responseHeaders };
}

describe('Document PDF Generator & Endpoint (%PDF- Magic Bytes Guarantee)', () => {
  const mockDb = new MockPdfDb();

  const testCases = [
    { type: 'invoice', id: 'inv-101' },
    { type: 'estimate', id: 'est-201' },
    { type: 'creditNote', id: 'cn-301' },
    { type: 'payment', id: 'pay-401' },
    { type: 'statement', id: 'cust-501' }
  ];

  for (const { type, id } of testCases) {
    test(`handlePdfRequest generates valid PDF binary starting with %PDF- for type='${type}'`, async () => {
      const { req, res, getBuffer, getStatus, getHeaders } = createMockHttp(type, id);

      await handlePdfRequest(req, res, mockDb);

      const status = getStatus();
      assert.strictEqual(status, 200, `Expected 200 status for type=${type}, received ${status}`);

      const headers = getHeaders();
      assert.strictEqual(headers['Content-Type'], 'application/pdf');

      const buf = getBuffer();
      assert.ok(buf, `PDF buffer must not be null for type=${type}`);
      assert.ok(buf.length > 50, `PDF buffer length must be meaningful, got ${buf.length} bytes`);

      // Assert magic bytes %PDF-
      const magicBytes = buf.subarray(0, 5).toString('utf-8');
      assert.strictEqual(magicBytes, '%PDF-', `Buffer must start with %PDF- magic bytes for type=${type}`);

      // Assert PDF structure terminates with %%EOF
      const tail = buf.subarray(buf.length - 10).toString('utf-8');
      assert.ok(tail.includes('%%EOF'), `PDF must contain standard %%EOF termination`);
    });
  }

  test('generateDocumentPdf produces raw binary starting with %PDF- directly', async () => {
    const buffer = await generateDocumentPdf('invoice', {
      number: 'INV-TEST',
      customerName: 'Unit Test Client',
      amountCents: 9900
    }, { name: 'Direct PDF Workspace' });

    assert.ok(Buffer.isBuffer(buffer));
    const magic = buffer.subarray(0, 5).toString('utf-8');
    assert.strictEqual(magic, '%PDF-');
  });

  test('handlePdfRequest rejects unsupported document type with 400', async () => {
    const { req, res, getStatus } = createMockHttp('invalid_doc', '123');
    await handlePdfRequest(req, res, mockDb);
    assert.strictEqual(getStatus(), 400);
  });

  test('handlePdfRequest rejects missing workspaceId with 400', async () => {
    const { req, res, getStatus } = createMockHttp('invoice', 'inv-101', '');
    await handlePdfRequest(req, res, mockDb);
    assert.strictEqual(getStatus(), 400);
  });
});
