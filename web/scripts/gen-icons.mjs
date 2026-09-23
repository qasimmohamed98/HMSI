import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function makePng(filename, size, bg, fg, safe = 0) {
  const [br, bg_, bb] = hex(bg);
  const [fr, fg_, fb] = hex(fg);
  const rows = [];
  const inH = (x, y) => {
    const s = safe * size;
    const u = size - 2 * s;
    const barW = Math.max(2, Math.round(u * 0.16));
    const crossW = Math.max(2, Math.round(u * 0.82));
    const crossH = Math.max(2, Math.round(u * 0.18));
    const x0 = s + (u - crossW) / 2;
    const y0 = s + (u - crossH) / 2;
    const leftBar = x >= x0 && x <= x0 + barW && y >= y0 && y <= y0 + u * 0.86;
    const rightBar = x >= x0 + crossW - barW && x <= x0 + crossW && y >= y0 && y <= y0 + u * 0.86;
    const cross = y >= y0 + (u * 0.86 - crossH) / 2 && y <= y0 + (u * 0.86 + crossH) / 2 && x >= x0 && x <= x0 + crossW;
    return leftBar || rightBar || cross;
  };
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const isFg = inH(x, y);
      row[1 + x * 4] = isFg ? fr : br;
      row[2 + x * 4] = isFg ? fg_ : bg_;
      row[3 + x * 4] = isFg ? fb : bb;
      row[4 + x * 4] = 255;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateSync(Buffer.concat(rows));
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  writeFileSync(join(outDir, filename), png);
  console.log(`wrote ${filename}`);
}

makePng('icon-192.png', 192, '#0e7c66', '#ffffff', 0);
makePng('icon-512.png', 512, '#0e7c66', '#ffffff', 0);
makePng('maskable-512.png', 512, '#0e7c66', '#ffffff', 0.12);