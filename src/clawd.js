// Піксельна модель Clawd (16x10) + генератор PNG для іконки в треї.
const zlib = require('zlib');

const COLORS = { O: [217, 119, 87], B: [0, 0, 0] };

const GRID = [
  '..OOOOOOOOOOOO..',
  '..OOOOOOOOOOOO..',
  '..BBBBBBBBBBBB..',
  '..OOBBBOOBBBOO..',
  '..OOBBBOOBBBOO..',
  'OOOOOOOOOOOOOOOO',
  'OOOOOOOOOOOOOOOO',
  '..OOOOOOOOOOOO..',
  '...O.O....O.O...',
  '...O.O....O.O...',
];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// Малює Clawd у квадратну PNG розміром size x size
function clawdPng(size = 32, mono = false) {
  const cols = GRID[0].length, rows = GRID.length;
  const scale = Math.floor(size / cols);
  const offY = Math.floor((size - rows * scale) / 2);
  const offX = Math.floor((size - cols * scale) / 2);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - offX) / scale), gy = Math.floor((y - offY) / scale);
      const ch = gx >= 0 && gy >= 0 && gx < cols && gy < rows ? GRID[gy][gx] : '.';
      const i = y * (size * 4 + 1) + 1 + x * 4;
      if (ch === '.' || (mono && ch === 'B')) continue; // прозоро
      const [r, g, b] = mono ? [0, 0, 0] : COLORS[ch];
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 біт, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { GRID, clawdPng };
