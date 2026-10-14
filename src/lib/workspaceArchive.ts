/**
 * E-21: read-only archive of the COMPLETE server JSON backup scope.
 *
 * ZIP is stored (no compression, no new dependency). Every collection present
 * in metadata.counts gets its own exact JSON and spreadsheet-safe UTF-8 CSV.
 * The original checksum-protected backup.json is retained for normal restore.
 * Ancillary workspace tables and uploaded file bytes NOT in that server backup
 * are not included: do not call this a database-wide disaster-recovery copy.
 */
import { toCsv } from './csvExport';
import { recordExportTable } from './workspaceExports';

type JsonObject = Record<string, unknown>;
const textEncoder = new TextEncoder();
const obj = (v: unknown): v is JsonObject => v !== null && typeof v === 'object' && !Array.isArray(v);
const safeKey = (s: string) => /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(s);

/**
 * CRC32 for ZIP stored entries; checksum of the authoritative backup itself
 * is verified separately with SHA-256 before any archive is assembled.
 */
export function zipCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry { path: string; content: string }

/** A portable UTF-8 ZIP archive with stored entries and correct central directory. */
export function makeStoredZip(files: readonly ZipEntry[]): Blob {
  if (!files.length || files.length > 65535) throw new Error('The archive has an invalid number of files.');
  const seen = new Set<string>();
  const chunks: ArrayBuffer[] = [];
  const central: ArrayBuffer[] = [];
  let offset = 0;
  let centralSize = 0;
  const version = 20;
  const flags = 0x0800; // UTF-8 file names

  for (const { path, content } of files) {
    if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')
      || Array.from(path).some(character => character.charCodeAt(0) < 32) || seen.has(path)) {
      throw new Error('Unsafe or duplicate ZIP entry name.');
    }
    seen.add(path);
    const name = textEncoder.encode(path);
    const bytes = textEncoder.encode(content);
    if (name.length > 65535 || bytes.length > 0xffffffff) throw new Error('ZIP entry is too large.');
    const crc = zipCrc32(bytes);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, version, true);
    lv.setUint16(6, flags, true);
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5021, true); // 2020-01-01
    lv.setUint32(14, crc, true);
    lv.setUint32(18, bytes.length, true);
    lv.setUint32(22, bytes.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    chunks.push(local.buffer as ArrayBuffer, bytes.buffer as ArrayBuffer);
    const directory = new Uint8Array(46 + name.length);
    const dv = new DataView(directory.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, version, true);
    dv.setUint16(6, version, true);
    dv.setUint16(8, flags, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint16(14, 0x5021, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, bytes.length, true);
    dv.setUint32(24, bytes.length, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, offset, true);
    directory.set(name, 46);
    central.push(directory.buffer as ArrayBuffer);
    centralSize += directory.length;
    offset += local.length + bytes.length;
    if (offset > 0xffffffff || centralSize > 0xffffffff || offset + centralSize + 22 > 0xffffffff) {
      throw new Error('Archive exceeds ZIP32 limits; request a server-side streamed archive.');
    }
  }
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end.buffer as ArrayBuffer], { type: 'application/zip' });
}

export interface WorkspaceArchiveResult {
  blob: Blob;
  collections: { key: string; count: number }[];
  manifest: JsonObject;
}

export async function buildWorkspaceArchive(payload: unknown, workspaceId: string): Promise<WorkspaceArchiveResult> {
  if (!obj(payload) || payload.schemaVersion !== 1 || !obj(payload.workspace)
    || payload.workspace.id !== workspaceId || !obj(payload.metadata)) {
    throw new Error('The server backup belongs to a different workspace or has an unsupported format.');
  }
  const meta = payload.metadata;
  if (meta.serverAuthoritative !== true || !obj(meta.counts) || typeof meta.checksum !== 'string'
    || !/^[a-f0-9]{64}$/.test(meta.checksum) || typeof payload.exportedAt !== 'string'
    || !Number.isFinite(Date.parse(payload.exportedAt))) {
    throw new Error('A verified server-authored backup is required; cached browser records are not sufficient.');
  }

  // The existing server computes SHA-256 before appending metadata.checksum.
  const { checksum, ...withoutChecksum } = meta;
  const original = { ...payload, metadata: withoutChecksum };
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(JSON.stringify(original)));
  const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== checksum) throw new Error('Server backup checksum verification failed.');

  const keys = Object.keys(meta.counts).sort();
  if (!keys.length || !keys.includes('transactions') || !keys.includes('accounts')) {
    throw new Error('The backup is missing required ledger collections.');
  }
  const topArrays = Object.keys(payload).filter(key => Array.isArray(payload[key])).sort();
  if (JSON.stringify(topArrays) !== JSON.stringify(keys)) {
    throw new Error('Backup collection inventory is incomplete or differs from its counts.');
  }
  const collections: WorkspaceArchiveResult['collections'] = [];
  const files: ZipEntry[] = [
    { path: 'backup.json', content: JSON.stringify(payload, null, 2) },
    { path: 'workspace.json', content: JSON.stringify(payload.workspace, null, 2) },
  ];
  for (const key of keys) {
    if (!safeKey(key) || key === 'workspace' || key === 'metadata') throw new Error('Invalid collection name in backup.');
    const count = meta.counts[key];
    const records = payload[key] as unknown[];
    if (!Array.isArray(records) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || records.length !== count) {
      throw new Error('Backup row count mismatch for ' + key + '.');
    }
    if (!records.every(record => obj(record) && typeof record.id === 'string' && record.workspaceId === workspaceId)) {
      throw new Error('Backup contains an invalid or other-workspace row in ' + key + '.');
    }
    collections.push({ key, count });
    const table = recordExportTable(records as JsonObject[]);
    files.push({ path: 'collections/' + key + '.json', content: JSON.stringify(records, null, 2) });
    files.push({ path: 'collections/' + key + '.csv', content: '\uFEFF' + toCsv(table.headers, table.rows) });
  }
  const manifest: JsonObject = {
    format: 'ledgerflow-backup-archive-v1',
    workspaceId,
    exportedAt: payload.exportedAt,
    sourceChecksumSha256: checksum,
    source: 'verified server workspace JSON backup',
    collections,
    collectionCount: collections.length,
    rowCount: collections.reduce((sum, item) => sum + item.count, 0),
    restoreFile: 'backup.json',
    notes: [
      'All arrays in the existing authoritative JSON backup are included, including empty collections.',
      'This is NOT a full database or uploaded-file archive: tables not present in the server backup, stored attachments and provider credentials are not collected.',
      'CSV is for human review, with a Record JSON column; use backup.json through the normal verified restore workflow.',
      'The ZIP uses stored (uncompressed) entries; store this sensitive archive securely.',
    ],
  };
  files.unshift({ path: 'manifest.json', content: JSON.stringify(manifest, null, 2) });
  return { blob: makeStoredZip(files), collections, manifest };
}
