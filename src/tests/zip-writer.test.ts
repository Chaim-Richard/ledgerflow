/** The minimal zip writer (Y-18): CRC-32 and a readable archive (checked against the standard). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zipStore } from '../server/utils/zip';

test('CRC-32 matches the standard check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.equal(crc32(Buffer.alloc(0)), 0);
});

test('an archive has a local header per file, a central directory and the end record', () => {
  const zip = zipStore([{ name: 'a.txt', data: Buffer.from('hello') }, { name: 'קבלה.pdf', data: Buffer.from('%PDF') }], new Date(2026, 9, 5, 12, 30, 10));
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt32LE(14), crc32(Buffer.from('hello')));
  assert.equal(zip.subarray(30, 35).toString(), 'a.txt');
  assert.equal(zip.subarray(35, 40).toString(), 'hello');
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50);
  assert.equal(zip.readUInt16LE(end + 10), 2);
  const central = zip.readUInt32LE(end + 16);
  assert.equal(zip.readUInt32LE(central), 0x02014b50);
  assert.equal(zip.readUInt16LE(central + 8) & 0x0800, 0x0800, 'names are UTF-8');
  assert.equal(zip.readUInt16LE(12), ((2026 - 1980) << 9) | (10 << 5) | 5, 'DOS date');
});
