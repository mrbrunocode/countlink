#!/usr/bin/env node
/**
 * Generates the PWA / home-screen icon PNGs from the CountLink mark.
 *
 * Why PNGs at all, when assets/favicon.svg already exists and is sharper:
 *
 *   - Safari ignores an SVG `apple-touch-icon` entirely. Every page here
 *     pointed at the SVG, so "Add to Home Screen" on iOS produced a screenshot
 *     of the page instead of the mark.
 *   - Android's install flow wants a 192 and a 512, and it wants a `maskable`
 *     one so the launcher can crop the icon to whatever shape that device uses
 *     without slicing through the artwork.
 *
 * Why generate rather than commit hand-drawn binaries: the mark is four
 * shapes, and the source of truth for its colours and proportions is
 * assets/favicon.svg. Drawing it here from the same numbers means the PNGs
 * cannot drift away from the SVG, and a colour change is one edit rather than
 * five files re-exported by hand. No dependencies — the rasteriser and the PNG
 * encoder are both below, and node:zlib does the compression.
 *
 * Usage:
 *     node scripts/build-icons.mjs
 *
 * Run by scripts/build-timer-pages.mjs? No — deliberately not. These outputs
 * change only when the mark does, and rasterising four icons on every content
 * build would be pure noise in `git status`. Run it by hand when the mark
 * changes; test/icons.test.mjs fails if the committed PNGs go missing or stop
 * matching the sizes the manifest promises.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "assets", "icons");

/* ---- The mark, in the same 64-unit space as assets/favicon.svg ---------- */
const INK = [0x1c, 0x1c, 0x1a];    // chassis dark
const FLAP = [0xf0, 0xea, 0xd9];   // cream flap
const AMBER = [0xe8, 0xa5, 0x3d];  // the one signal colour

/* The mark (2026-09-29 rebrand): two screen frames interlocked like chain
   links — one countdown, linked across screens — with the overlap, the shared
   instant, filled amber. Painter's order, in the same 64-unit space as
   assets/favicon.svg; keep the two in step. A frame is a rounded-rect STROKE
   (centre-line rect + width); a "halo" is the same stroke wider and in ink,
   which cuts the gap where one frame passes over the other.

   Weave: frame B passes over A at bottom-left, A passes over B at top-right. */
const FW = 4.6, HALO = 9;
const A = [11, 11, 29, 29, 6], B = [24, 24, 29, 29, 6];
const OPS = [
  ["fill", [24, 24, 16, 16, 3], AMBER],          // the shared zone
  ["stroke", A, FW, FLAP],
  ["stroke", B, HALO, INK],                       // B over A (bottom-left)
  ["stroke", B, FW, FLAP],
  ["fill", [35.5, 17, 9, 14, 0], INK],            // A over B (top-right): halo…
  ["fill", [40 - FW / 2, 16, FW, 16, 0], FLAP],   // …and A's edge on top
  ["fill", [26.3, 26.3, 11.4, 11.4, 1.5], AMBER], // restore the amber the halos cut
];

/* "any": the mark on a rounded tile. "maskable": full-bleed tile (the launcher
   supplies the shape) with the mark scaled to 0.8 about the centre, which
   puts its farthest artwork inside the 40%-radius safe circle. */
const ANY = { bgRadius: 14, scale: 1 };
const MASKABLE = { bgRadius: 0, scale: 0.8 };

/* ---- Rasteriser --------------------------------------------------------
   Every shape is opaque: a sample takes the colour of the topmost shape
   containing it, and averaging samples per pixel gives the antialiased edge. */
const SS = 4;

const inRoundRect = (x, y, rx, ry, w, h, r) => {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  if (r <= 0) return true;
  const cx = x < rx + r ? rx + r : x > rx + w - r ? rx + w - r : x;
  const cy = y < ry + r ? ry + r : y > ry + h - r ? ry + h - r : y;
  if (cx === x && cy === y) return true;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const inStroke = (x, y, [rx, ry, w, h, r], sw) => {
  const o = sw / 2;
  return inRoundRect(x, y, rx - o, ry - o, w + sw, h + sw, r + o)
    && !inRoundRect(x, y, rx + o, ry + o, w - sw, h - sw, Math.max(0, r - o));
};

function render(spec, size) {
  const px = new Uint8Array(size * size * 4);
  const u = 64 / size; // one output pixel, in mark units
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxi + (sx + 0.5) / SS) * u;
          const y = (py + (sy + 0.5) / SS) * u;
          // Outside the tile is transparent, so the "any" icon's corners read
          // as rounded rather than a dark square.
          if (!inRoundRect(x, y, 0, 0, 64, 64, spec.bgRadius)) continue;
          a++;
          const mx = 32 + (x - 32) / spec.scale, my = 32 + (y - 32) / spec.scale;
          let c = INK;
          for (const [kind, rect, w, col] of OPS) {
            if (kind === "fill" ? inRoundRect(mx, my, ...rect) : inStroke(mx, my, rect, w)) c = kind === "fill" ? w : col;
          }
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS, i = (py * size + pxi) * 4;
      // Averaged over the COVERED samples, so a partly-covered edge pixel keeps
      // the tile's real colour and carries the coverage in alpha.
      if (a) {
        px[i] = Math.round(r / a); px[i + 1] = Math.round(g / a); px[i + 2] = Math.round(b / a);
      }
      px[i + 3] = Math.round((a / n) * 255);
    }
  }
  return px;
}

/* ---- PNG encoder (8-bit RGBA, one IDAT) -------------------------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  // 10,11,12 = deflate / adaptive filtering / no interlace, all zero.
  // Filter byte 0 (None) per scanline: these are flat-colour images, so the
  // filter earns nothing that deflate does not already get.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---- Outputs ----------------------------------------------------------
   180: iOS apple-touch-icon (Safari will not take an SVG).
   192 + 512: the pair Android's install flow looks for.
   512 maskable: same mark, safe-zone composition, for adaptive launchers. */
const TARGETS = [
  ["icon-180.png", ANY, 180],
  ["icon-192.png", ANY, 192],
  ["icon-512.png", ANY, 512],
  ["icon-maskable-512.png", MASKABLE, 512],
];

mkdirSync(OUT, { recursive: true });
for (const [name, spec, size] of TARGETS) {
  const buf = png(render(spec, size), size);
  writeFileSync(join(OUT, name), buf);
  console.log(`${name.padEnd(24)} ${size}x${size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
console.log("\nIcons written to assets/icons/. Commit them — they are not rebuilt by the content build.");
