/**
 * A ZIP file of already-built text files, written in the browser with no dependency (C-36).
 *
 * Files are **stored**, not deflated: the evidence pack is a few small CSVs, and a stored archive is
 * the simplest thing that every unzip tool reads. The format follows APPNOTE 6.3.x — a local header
 * and the data for each file, then the central directory, then the end-of-directory record — with
 * the UTF-8 name flag set so a Hebrew file name survives.
 *
 * Only the pieces a pack needs are implemented; a name may not be empty, absolute or contain `..`,
 * and the DOS timestamp is clamped to the range the format can hold (1980–2107).
 */

export interface ZipFile {
  /** a relative path inside the archive, e.g. "audit-log.csv" */
  name: string;
  data: Uint8Array;
}

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const VERSION = 20; // 2.0: files are stored
const UTF8_FLAG = 0x0800;
const MAX_ENTRIES = 0xffff;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

/** The standard CRC-32 of the bytes, as the ZIP central directory records it. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, the only timestamp the classic ZIP header has. */
export function dosDateTime(at: Date): { time: number; date: number } {
  const year = Math.min(2107, Math.max(1980, at.getFullYear()));
  const date = ((year - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate();
  const time = (at.getHours() << 11) | (at.getMinutes() << 5) | Math.floor(at.getSeconds() / 2);
  return { time, date };
}

function safeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('A file in the pack needs a name.');
  if (trimmed.startsWith('/') || trimmed.includes('..') || /^[a-z]+:/i.test(trimmed)) {
    throw new Error(`"${trimmed}" is not a relative file name for the pack.`);
  }
  return trimmed;
}

/**
 * Builds the archive bytes. Pass `modified` to make the output repeatable (a test, or a pack that
 * must hash the same twice); it defaults to now.
 */
export function buildStoredZip(files: readonly ZipFile[], modified: Date = new Date()): Uint8Array {
  if (files.length > MAX_ENTRIES) throw new Error('A pack cannot hold more than 65,535 files.');
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(modified);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(safeName(file.name));
    const crc = crc32(file.data);

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, LOCAL_SIGNATURE, true);
    localView.setUint16(4, VERSION, true);
    localView.setUint16(6, UTF8_FLAG, true);
    localView.setUint16(8, 0, true); // stored
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, file.data.length, true);
    localView.setUint32(22, file.data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true); // no extra field
    local.set(name, 30);
    locals.push(local, file.data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, CENTRAL_SIGNATURE, true);
    centralView.setUint16(4, VERSION, true); // made by
    centralView.setUint16(6, VERSION, true); // needed
    centralView.setUint16(8, UTF8_FLAG, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true); // extra
    centralView.setUint16(32, 0, true); // comment
    centralView.setUint16(34, 0, true); // disk
    centralView.setUint16(36, 0, true); // internal attributes
    centralView.setUint32(38, 0, true); // external attributes
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length + file.data.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, END_SIGNATURE, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const parts = [...locals, ...centrals, end];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}
