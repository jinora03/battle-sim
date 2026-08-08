export interface ReplayExportArchiveEntry {
  filename: string;
  blob: Blob;
  modifiedAt?: Date;
}

export interface ReplayExportArchiveOptions {
  signal?: AbortSignal;
}

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_VERSION_20 = 20;
const ZIP_MAX_UINT16 = 0xffff;
const ZIP_MAX_UINT32 = 0xffffffff;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

interface PreparedArchiveEntry {
  name: Uint8Array;
  blob: Blob;
  crc32: number;
  size: number;
  dosTime: number;
  dosDate: number;
  localOffset: number;
}

/**
 * Builds a dependency-free ZIP using the store method. Blob payloads remain
 * Blob parts, so packaging does not concatenate every completed video into one
 * giant in-memory Uint8Array before download.
 */
export async function createReplayExportArchive(
  entries: readonly ReplayExportArchiveEntry[],
  options: ReplayExportArchiveOptions = {}
): Promise<Blob> {
  if (entries.length === 0) throw new Error('At least one completed export is required to create a ZIP archive.');
  if (entries.length > ZIP_MAX_UINT16) throw new Error('Too many files for a standard ZIP archive.');

  const encoder = new TextEncoder();
  const usedNames = new Set<string>();
  const prepared: PreparedArchiveEntry[] = [];
  let localOffset = 0;

  for (let index = 0; index < entries.length; index += 1) {
    throwIfCancelled(options.signal);
    const entry = entries[index]!;
    if (!(entry.blob instanceof Blob)) throw new Error(`Archive entry ${index + 1} is not a Blob.`);
    if (entry.blob.size > ZIP_MAX_UINT32) throw new Error(`Archive file ${entry.filename} exceeds the standard ZIP size limit.`);

    const filename = uniqueArchiveFilename(entry.filename, usedNames, index);
    const name = encoder.encode(filename);
    if (name.length > ZIP_MAX_UINT16) throw new Error(`Archive filename is too long: ${filename}`);

    const { dosTime, dosDate } = toDosDateTime(entry.modifiedAt ?? new Date());
    const crc32 = await calculateBlobCrc32(entry.blob, options.signal);
    const localHeaderLength = 30 + name.length;
    ensureZip32(localOffset + localHeaderLength + entry.blob.size, 'ZIP archive exceeds the standard 4 GB limit.');

    prepared.push({
      name,
      blob: entry.blob,
      crc32,
      size: entry.blob.size,
      dosTime,
      dosDate,
      localOffset
    });
    localOffset += localHeaderLength + entry.blob.size;
  }

  function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }

  const parts: BlobPart[] = [];
  for (const entry of prepared) {
    parts.push(toArrayBuffer(createLocalHeader(entry)), entry.blob);
  }

  const centralOffset = localOffset;
  let centralSize = 0;
  for (const entry of prepared) {
    const central = createCentralDirectoryHeader(entry);
    centralSize += central.byteLength;
    parts.push(toArrayBuffer(central));
  }
  ensureZip32(centralOffset + centralSize + 22, 'ZIP archive exceeds the standard 4 GB limit.');
  parts.push(toArrayBuffer(createEndOfCentralDirectory(prepared.length, centralSize, centralOffset)));

  return new Blob(parts, { type: 'application/zip' });
}

async function calculateBlobCrc32(blob: Blob, signal?: AbortSignal): Promise<number> {
  let crc = 0xffffffff;
  const stream = blob.stream();
  const reader = stream.getReader();

  try {
    while (true) {
      throwIfCancelled(signal);
      const { done, value } = await reader.read();
      if (done) break;
      for (const byte of value) crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
    }
  } finally {
    reader.releaseLock();
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createLocalHeader(entry: PreparedArchiveEntry): Uint8Array {
  const bytes = new Uint8Array(30 + entry.name.length);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  offset = writeU32(view, offset, ZIP_LOCAL_FILE_HEADER);
  offset = writeU16(view, offset, ZIP_VERSION_20);
  offset = writeU16(view, offset, ZIP_UTF8_FLAG);
  offset = writeU16(view, offset, 0);
  offset = writeU16(view, offset, entry.dosTime);
  offset = writeU16(view, offset, entry.dosDate);
  offset = writeU32(view, offset, entry.crc32);
  offset = writeU32(view, offset, entry.size);
  offset = writeU32(view, offset, entry.size);
  offset = writeU16(view, offset, entry.name.length);
  writeU16(view, offset, 0);
  bytes.set(entry.name, 30);
  return bytes;
}

function createCentralDirectoryHeader(entry: PreparedArchiveEntry): Uint8Array {
  const bytes = new Uint8Array(46 + entry.name.length);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  offset = writeU32(view, offset, ZIP_CENTRAL_DIRECTORY_HEADER);
  offset = writeU16(view, offset, ZIP_VERSION_20);
  offset = writeU16(view, offset, ZIP_VERSION_20);
  offset = writeU16(view, offset, ZIP_UTF8_FLAG);
  offset = writeU16(view, offset, 0);
  offset = writeU16(view, offset, entry.dosTime);
  offset = writeU16(view, offset, entry.dosDate);
  offset = writeU32(view, offset, entry.crc32);
  offset = writeU32(view, offset, entry.size);
  offset = writeU32(view, offset, entry.size);
  offset = writeU16(view, offset, entry.name.length);
  offset = writeU16(view, offset, 0);
  offset = writeU16(view, offset, 0);
  offset = writeU16(view, offset, 0);
  offset = writeU16(view, offset, 0);
  offset = writeU32(view, offset, 0);
  writeU32(view, offset, entry.localOffset);
  bytes.set(entry.name, 46);
  return bytes;
}

function createEndOfCentralDirectory(entryCount: number, centralSize: number, centralOffset: number): Uint8Array {
  const bytes = new Uint8Array(22);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  offset = writeU32(view, offset, ZIP_END_OF_CENTRAL_DIRECTORY);
  offset = writeU16(view, offset, 0);
  offset = writeU16(view, offset, 0);
  offset = writeU16(view, offset, entryCount);
  offset = writeU16(view, offset, entryCount);
  offset = writeU32(view, offset, centralSize);
  offset = writeU32(view, offset, centralOffset);
  writeU16(view, offset, 0);
  return bytes;
}

function uniqueArchiveFilename(input: string, usedNames: Set<string>, index: number): string {
  const normalized = normalizeArchiveFilename(input, index);
  if (!usedNames.has(normalized)) {
    usedNames.add(normalized);
    return normalized;
  }

  const slash = normalized.lastIndexOf('/');
  const directory = slash >= 0 ? normalized.slice(0, slash + 1) : '';
  const leaf = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const dot = leaf.lastIndexOf('.');
  const stem = dot > 0 ? leaf.slice(0, dot) : leaf;
  const extension = dot > 0 ? leaf.slice(dot) : '';
  let suffix = 2;
  let candidate = `${directory}${stem}-${suffix}${extension}`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${directory}${stem}-${suffix}${extension}`;
  }
  usedNames.add(candidate);
  return candidate;
}

function normalizeArchiveFilename(input: string, index: number): string {
  const pieces = input.replace(/\\/g, '/').split('/').filter((piece) => piece && piece !== '.' && piece !== '..');
  return pieces.join('/') || `kinetic-export-${index + 1}.bin`;
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    dosTime: (hours << 11) | (minutes << 5) | seconds,
    dosDate: ((year - 1980) << 9) | (month << 5) | day
  };
}

function writeU16(view: DataView, offset: number, value: number): number {
  view.setUint16(offset, value, true);
  return offset + 2;
}

function writeU32(view: DataView, offset: number, value: number): number {
  view.setUint32(offset, value >>> 0, true);
  return offset + 4;
}

function ensureZip32(value: number, message: string): void {
  if (!Number.isSafeInteger(value) || value > ZIP_MAX_UINT32) throw new Error(message);
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error('ZIP packaging was cancelled.');
  error.name = 'AbortError';
  throw error;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();
