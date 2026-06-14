// Generates the Doppio extension icon set — the two-circle "double" mark (plum
// "you" + coral "echo" + spark overlap), from Doppio_Logo_System.html.
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

// ── the mark: two overlapping circles on a transparent ground ────────────────
// Geometry (100×100 viewBox): "you" plum (42,46,r26), "echo" coral (62,58,r22),
// "spark" = their overlap. Slight inset so the mark breathes inside the canvas.
const PLUM = [59, 44, 86];
const CORAL = [240, 102, 74];
const SPARK = [244, 164, 126];

// Toolbar/store icons should fill their frame — scale the mark up around the
// canvas centre so it reads big at 16px (the brand's roomy clear space, kept in
// the in-panel lockups, would otherwise look tiny here).
const FILL = 1.35;

function render(size) {
  const ss = 4; // supersampling for anti-aliasing
  const n = ss * ss;
  const sc = size / 100;
  const tc = (v) => (50 + (v - 50) * FILL) * sc; // scale a centre coord about 50
  const tr = (v) => v * FILL * sc; // scale a radius
  const you = { cx: tc(42), cy: tc(46), r: tr(26) };
  const echo = { cx: tc(62), cy: tc(58), r: tr(22) };
  const inC = (x, y, c) => {
    const dx = x - c.cx;
    const dy = y - c.cy;
    return dx * dx + dy * dy <= c.r * c.r;
  };

  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let cov = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = px + (sx + 0.5) / ss;
          const y = py + (sy + 0.5) / ss;
          const inY = inC(x, y, you);
          const inE = inC(x, y, echo);
          const col = inY && inE ? SPARK : inE ? CORAL : inY ? PLUM : null;
          if (col) {
            r += col[0];
            g += col[1];
            b += col[2];
            cov++;
          }
        }
      }
      const i = (py * size + px) * 4;
      if (cov > 0) {
        buf[i] = Math.round(r / cov);
        buf[i + 1] = Math.round(g / cov);
        buf[i + 2] = Math.round(b / cov);
        buf[i + 3] = Math.round((cov / n) * 255);
      }
    }
  }
  return png(size, size, buf);
}

mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(outDir, `icon${size}.png`), render(size));
  console.log(`wrote icon${size}.png`);
}
