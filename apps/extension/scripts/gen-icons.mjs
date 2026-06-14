// Generates the Doppio extension icon set (teal rounded tile + white mic) as PNGs.
// Pure Node (zlib for the PNG IDAT) so there's no image dependency.
//   node scripts/gen-icons.mjs   →   public/icons/icon{16,32,48,128}.png
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../public/icons");

// ── tiny PNG (RGBA, 8-bit) encoder ───────────────────────────────────────────
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td), 0);
  return Buffer.concat([len, td, crc]);
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── shape coverage (normalized 0..1 coords) ──────────────────────────────────
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const nx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const ny = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy <= r * r;
}
function inRing(x, y, cx, cy, rin, rout, a0, a1) {
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (d < rin || d > rout) return false;
  let a = Math.atan2(dy, dx);
  if (a < 0) a += 2 * Math.PI;
  return a >= a0 && a <= a1;
}
// white microphone = capsule ∪ bottom bracket ∪ stand ∪ base
function inMic(x, y) {
  return (
    inRoundRect(x, y, 0.41, 0.2, 0.59, 0.54, 0.09) || // capsule
    inRing(x, y, 0.5, 0.5, 0.225, 0.265, Math.PI * 0.12, Math.PI * 0.88) || // U bracket
    inRoundRect(x, y, 0.485, 0.6, 0.515, 0.76, 0.015) || // stand
    inRoundRect(x, y, 0.4, 0.75, 0.6, 0.785, 0.017) // base
  );
}

function render(size) {
  const ss = 4; // supersampling
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let mic = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) / size;
          const y = (py + (sy + 0.5) / ss) / size;
          if (inRoundRect(x, y, 0, 0, 1, 1, 0.22)) bg++;
          if (inMic(x, y)) mic++;
        }
      }
      const n = ss * ss;
      const bgA = bg / n;
      const micA = mic / n;
      // vertical teal gradient #0f4c5c → #0c3d4a
      const t = py / size;
      const tr = Math.round(15 + (12 - 15) * t);
      const tg = Math.round(76 + (61 - 76) * t);
      const tb = Math.round(92 + (74 - 92) * t);
      // composite white mic over teal, premultiplied by bg coverage (rounded tile)
      const r = Math.round(tr * (1 - micA) + 255 * micA);
      const g = Math.round(tg * (1 - micA) + 255 * micA);
      const b = Math.round(tb * (1 - micA) + 255 * micA);
      const i = (py * size + px) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = Math.round(bgA * 255);
    }
  }
  return png(size, size, buf);
}

mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(outDir, `icon${size}.png`), render(size));
  console.log(`wrote icon${size}.png`);
}
