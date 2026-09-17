import { test, describe } from 'node:test';
import assert from 'node:assert';
import { validateFileMagicBytes } from './fileValidation';

describe('Server-side File Validation Suite', () => {
  test('validates valid PDF magic bytes', () => {
    const pdfBuffer = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');
    const res = validateFileMagicBytes(pdfBuffer);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.detectedMimeType, 'application/pdf');
  });

  test('validates PNG magic bytes', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
    const res = validateFileMagicBytes(pngBuffer);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.detectedMimeType, 'image/png');
  });

  test('validates CSV plain text', () => {
    const csvBuffer = Buffer.from('Date,Amount,Description\n2026-01-01,100.00,Office Supplies\n');
    const res = validateFileMagicBytes(csvBuffer);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.detectedMimeType, 'text/csv');
  });

  test('rejects Windows PE executable', () => {
    const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]);
    const res = validateFileMagicBytes(exeBuffer);
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /Executable files/);
  });

  test('rejects Linux ELF executable', () => {
    const elfBuffer = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01]);
    const res = validateFileMagicBytes(elfBuffer);
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /Binary executables/);
  });

  test('rejects EICAR antivirus test signature', () => {
    const eicarBuffer = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
    const res = validateFileMagicBytes(eicarBuffer);
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /Anti-virus test signature detected/);
  });
});
