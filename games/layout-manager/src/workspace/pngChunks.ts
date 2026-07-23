/**
 * PNG tEXt chunk reader/writer for embedding LayoutManager metadata.
 *
 * PNG files are: 8-byte signature, then a series of chunks.
 * Each chunk is: 4-byte length | 4-byte type | data | 4-byte CRC.
 * We inject a tEXt chunk (keyword + null + value) before the IEND chunk.
 */

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CHUNK_KEY = 'LayoutManager:ScaleFilter';

/* ---- CRC-32 (PNG uses ISO 3309 / ITU-T V.42) ---- */

let crcTable: Uint32Array | null = null;

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

function crc32(buf: Uint8Array): number {
  if (!crcTable) crcTable = buildCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/* ---- Helpers ---- */

function readU32(data: Uint8Array, offset: number): number {
  return (
    ((data[offset]! << 24) |
      (data[offset + 1]! << 16) |
      (data[offset + 2]! << 8) |
      data[offset + 3]!) >>>
    0
  );
}

function writeU32(data: Uint8Array, offset: number, value: number) {
  data[offset] = (value >>> 24) & 0xff;
  data[offset + 1] = (value >>> 16) & 0xff;
  data[offset + 2] = (value >>> 8) & 0xff;
  data[offset + 3] = value & 0xff;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ---- Public API ---- */

/**
 * Read a LayoutManager:ScaleFilter tEXt chunk from a PNG file.
 * Returns the value string (e.g. "nearest" or "bicubic") or null if not found.
 */
export async function readPngScaleFilter(file: File): Promise<string | null> {
  const buf = new Uint8Array(await file.arrayBuffer());

  // Verify PNG signature
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) return null;
  }

  let offset = 8;
  while (offset + 12 <= buf.length) {
    const length = readU32(buf, offset);
    const typeBytes = buf.slice(offset + 4, offset + 8);
    const typeStr = decoder.decode(typeBytes);

    if (typeStr === 'tEXt') {
      const data = buf.slice(offset + 8, offset + 8 + length);
      // tEXt chunk: keyword (null-terminated) + value
      const nullIdx = data.indexOf(0);
      if (nullIdx !== -1) {
        const keyword = decoder.decode(data.slice(0, nullIdx));
        if (keyword === CHUNK_KEY) {
          return decoder.decode(data.slice(nullIdx + 1));
        }
      }
    }

    if (typeStr === 'IEND') break;
    offset += 12 + length; // 4 length + 4 type + data + 4 crc
  }

  return null;
}

/**
 * Inject a LayoutManager:ScaleFilter tEXt chunk into a PNG blob.
 * Inserts the chunk just before IEND.
 * Returns a new Blob with the chunk embedded.
 */
export async function writePngScaleFilter(blob: Blob, scaleFilter: string): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());

  // Find IEND chunk offset
  let iendOffset = -1;
  let offset = 8;
  while (offset + 12 <= buf.length) {
    const length = readU32(buf, offset);
    const typeStr = decoder.decode(buf.slice(offset + 4, offset + 8));
    if (typeStr === 'IEND') {
      iendOffset = offset;
      break;
    }
    offset += 12 + length;
  }

  if (iendOffset === -1) return blob; // malformed PNG, return as-is

  // Build tEXt chunk
  const keyBytes = encoder.encode(CHUNK_KEY);
  const valBytes = encoder.encode(scaleFilter);
  const chunkData = new Uint8Array(keyBytes.length + 1 + valBytes.length);
  chunkData.set(keyBytes, 0);
  chunkData[keyBytes.length] = 0; // null separator
  chunkData.set(valBytes, keyBytes.length + 1);

  const chunkType = encoder.encode('tEXt');

  // CRC covers type + data
  const crcInput = new Uint8Array(4 + chunkData.length);
  crcInput.set(chunkType, 0);
  crcInput.set(chunkData, 4);
  const crcVal = crc32(crcInput);

  // Full chunk: length(4) + type(4) + data + crc(4)
  const chunk = new Uint8Array(12 + chunkData.length);
  writeU32(chunk, 0, chunkData.length);
  chunk.set(chunkType, 4);
  chunk.set(chunkData, 8);
  writeU32(chunk, 8 + chunkData.length, crcVal);

  // Splice: everything before IEND + new chunk + IEND to end
  const before = buf.slice(0, iendOffset);
  const after = buf.slice(iendOffset);
  const result = new Uint8Array(before.length + chunk.length + after.length);
  result.set(before, 0);
  result.set(chunk, before.length);
  result.set(after, before.length + chunk.length);

  return new Blob([result], { type: 'image/png' });
}
