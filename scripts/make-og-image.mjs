import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const WIDTH = 1200;
const HEIGHT = 630;

function makeCrc32() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return (bytes) => {
    let c = 0xffffffff;
    for (const b of bytes) {
      c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
}
const crc32 = makeCrc32();

function u32(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function chunk(type, data) {
  const len = u32(data.length);
  const typeBytes = [...Buffer.from(type)];
  const crc = crc32([...typeBytes, ...data]);
  return [...len, ...typeBytes, ...data, ...u32(crc)];
}

const rows = [];
for (let y = 0; y < HEIGHT; y++) {
  const row = [0]; // filter: None
  const ny = y / (HEIGHT - 1);
  for (let x = 0; x < WIDTH; x++) {
    const nx = x / (WIDTH - 1);
    const r = Math.round(30 + 60 * nx + 20 * ny);
    const g = Math.round(25 + 40 * ny);
    const b = Math.round(80 + 120 * (1 - nx) + 40 * ny);
    row.push(r, g, b);
  }
  rows.push(row);
}

const raw = new Uint8Array(rows.flat());
const compressed = deflateSync(raw, { level: 9 });

const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ihdrData = [
  ...u32(WIDTH),
  ...u32(HEIGHT),
  8, // bit depth
  2, // color type RGB
  0, // compression
  0, // filter
  0, // interlace
];
const ihdr = chunk('IHDR', ihdrData);
const idat = chunk('IDAT', [...compressed]);
const iend = chunk('IEND', []);

const bytes = new Uint8Array([...signature, ...ihdr, ...idat, ...iend]);
writeFileSync('public/og-image.png', bytes);
console.log(`public/og-image.png generado (${bytes.length} bytes)`);
