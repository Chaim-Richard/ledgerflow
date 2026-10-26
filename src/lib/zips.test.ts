import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoredZip, crc32, dosDateTime } from './zips';

const encoder = new TextEncoder();
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

test('CRC-32 matches the reference values', () => {
  assert.equal(crc32(encoder.encode('')), 0);
  assert.equal(crc32(encoder.encode('abc')), 0x352441c2);
  assert.equal(crc32(encoder.encode('The quick brown fox jumps over the lazy dog')), 0x414fa339);
});

test('a ZIP holds each file stored, with its name, size and CRC in both records', () => {
  const files = [
    { name: 'audit-log.csv', data: encoder.encode('When,Action\r\n2026-10-01,USER_LOGIN\r\n') },
    { name: 'access-review.csv', data: encoder.encode('Person,Role\r\nu-1,Owner\r\n') },
  ];
  const zip = buildStoredZip(files, new Date(2026, 9, 25, 12, 0, 0));
  const header = view(zip);
  assert.equal(header.getUint32(0, true), 0x04034b50);
  assert.equal(header.getUint16(4, true), 20);
  assert.equal(header.getUint16(6, true), 0x0800); // UTF-8 names
  assert.equal(header.getUint16(8, true), 0); // stored
  const firstNameLength = header.getUint16(26, true);
  assert.equal(new TextDecoder().decode(zip.slice(30, 30 + firstNameLength)), 'audit-log.csv');
  assert.equal(header.getUint32(14, true), crc32(files[0].data));
  assert.equal(header.getUint32(18, true), files[0].data.length);
  const dataAt = 30 + firstNameLength;
  assert.equal(new TextDecoder().decode(zip.slice(dataAt, dataAt + files[0].data.length)), 'When,Action\r\n2026-10-01,USER_LOGIN\r\n');

  // the end record: two files, and a central directory that really is where it says it is
  const endAt = zip.length - 22;
  const end = view(zip).getUint32(endAt, true);
  assert.equal(end, 0x06054b50);
  const endView = new DataView(zip.buffer, zip.byteOffset + endAt, 22);
  assert.equal(endView.getUint16(8, true), 2);
  assert.equal(endView.getUint16(10, true), 2);
  const centralSize = endView.getUint32(12, true);
  const centralOffset = endView.getUint32(16, true);
  assert.equal(centralOffset + centralSize, endAt);
  assert.equal(view(zip).getUint32(centralOffset, true), 0x02014b50);
  assert.equal(new DataView(zip.buffer, zip.byteOffset + centralOffset, 46).getUint32(42, true), 0); // first file at 0
});

test('Hebrew file names travel as UTF-8 and the timestamp stays inside the DOS range', () => {
  const zip = buildStoredZip([{ name: 'דוח-ביקורת.csv', data: encoder.encode('x') }], new Date(2026, 9, 25));
  const firstNameLength = view(zip).getUint16(26, true);
  assert.equal(new TextDecoder().decode(zip.slice(30, 30 + firstNameLength)), 'דוח-ביקורת.csv');
  assert.deepEqual(dosDateTime(new Date(1970, 0, 1)), dosDateTime(new Date(1980, 0, 1)));
  const future = dosDateTime(new Date(2200, 0, 1));
  assert.equal(((future.date >> 9) & 0x7f) + 1980, 2107);
  // the same bytes twice when the clock is given
  const at = new Date(2026, 9, 25, 8, 30);
  assert.deepEqual(buildStoredZip([{ name: 'a.csv', data: encoder.encode('a') }], at), buildStoredZip([{ name: 'a.csv', data: encoder.encode('a') }], at));
});

test('a name that is not a plain relative file name is refused', () => {
  const data = encoder.encode('x');
  assert.throws(() => buildStoredZip([{ name: '  ', data }]), /needs a name/);
  assert.throws(() => buildStoredZip([{ name: '/etc/passwd', data }]), /not a relative file name/);
  assert.throws(() => buildStoredZip([{ name: 'a/../../b.csv', data }]), /not a relative file name/);
  assert.throws(() => buildStoredZip([{ name: 'file:///c.csv', data }]), /not a relative file name/);
});
