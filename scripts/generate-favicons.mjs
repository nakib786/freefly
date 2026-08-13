/**
 * Favicon generation from the brand logo.
 *
 *   npm run favicons
 *
 * Source: assets/FreeFly Logo.png (2000x2000, opaque cream #fffff2).
 * The companion .svg is not usable here: it is a 714 KB wrapper around the
 * same embedded PNG rasters, so it buys no crispness and would be a heavy
 * favicon. Everything is generated from the PNG instead.
 *
 * The full logo lays out as three stacked bands: the Tesla-face car mark, the
 * FREEFLY wordmark, then DRIVING SCHOOL. Only the car mark survives a 16px
 * render (the wordmarks turn to mush), so the script isolates the topmost
 * ink band and drops the type. Bands are detected rather than hardcoded so a
 * re-exported logo with shifted spacing still crops correctly.
 *
 * The cream background is kept rather than made transparent: it is the logo's
 * own background, it gives the crimson car contrast against both light and
 * dark browser chrome, and iOS composites apple-touch-icon over black.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'assets/FreeFly Logo.png');
const OUT_DIR = resolve(ROOT, 'public');

/** Per-channel distance from the background above which a pixel counts as ink. */
const INK_THRESHOLD = 40;
/** Ink rows below this count are treated as empty; kills stray resample noise. */
const MIN_ROW_INK = 3;
/** Vertical run of empty rows that separates the car mark from the wordmark. */
const BAND_GAP = 40;
/**
 * Breathing room around the mark, as a fraction of its longest side. Kept
 * almost nil: the car is a 1.5:1 mark in a square tile, so it is already
 * letterboxed vertically, and every pixel of padding is legibility lost at
 * 16px. The sliver that remains is so the wing mirrors are not shaved off by
 * the rounded mask iOS applies to apple-touch-icon.
 */
const MARGIN = 0.02;

/** Sizes packed into favicon.ico. */
const ICO_SIZES = [16, 32, 48];

/**
 * At or below this size, downscaling averages the mark's thin crimson outlines
 * toward the cream background and the car turns into a pale blob. A light
 * unsharp mask afterwards puts the edge contrast back.
 */
const SHARPEN_AT_OR_BELOW = 96;
const SHARPEN = { sigma: 0.6, m1: 1, m2: 2 };

/* --------------------------------------------------------------- cropping -- */

/**
 * Bounding box of the topmost ink band, i.e. the car mark without the type.
 */
async function findMarkBox() {
  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Top-left pixel is background by construction of the logo.
  const bg = [data[0], data[1], data[2]];

  const isInk = (x, y) => {
    const i = (y * width + x) * channels;
    return (
      Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) >
      INK_THRESHOLD
    );
  };

  const rowInk = [];
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (isInk(x, y)) n++;
    rowInk.push(n);
  }

  const top = rowInk.findIndex((n) => n >= MIN_ROW_INK);
  if (top === -1) throw new Error(`No ink found in ${SRC}`);

  // Walk down until a gap wide enough to be band separation, not internal
  // whitespace inside the car (the hood is a large light area).
  let bottom = top;
  for (let y = top, gap = 0; y < height; y++) {
    if (rowInk[y] >= MIN_ROW_INK) {
      bottom = y;
      gap = 0;
    } else if (++gap > BAND_GAP) {
      break;
    }
  }

  let left = width;
  let right = 0;
  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < left; x++) if (isInk(x, y)) { left = x; break; }
    for (let x = width - 1; x > right; x--) if (isInk(x, y)) { right = x; break; }
  }

  return { bg, left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * The mark cropped out and centred on a square cream canvas, at full source
 * resolution so every downscale resamples from the same master.
 */
async function buildMaster() {
  const box = await findMarkBox();
  const side = Math.round(Math.max(box.width, box.height) * (1 + MARGIN * 2));
  const [r, g, b] = box.bg;

  const master = await sharp(SRC)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .extend({
      top: Math.floor((side - box.height) / 2),
      bottom: Math.ceil((side - box.height) / 2),
      left: Math.floor((side - box.width) / 2),
      right: Math.ceil((side - box.width) / 2),
      background: { r, g, b, alpha: 1 },
    })
    .png()
    .toBuffer();

  return { master, box, side };
}

/* ------------------------------------------------------------------- .ico -- */

/**
 * Assemble a multi-resolution .ico from PNG-encoded entries. PNG payloads
 * (rather than BMP) are read by every browser we target and keep the file
 * a few KB instead of ~15 KB of uncompressed bitmap.
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width, 0 means 256
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette size, 0 for truecolour
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

/* ------------------------------------------------------------------- main -- */

function resize(master, size) {
  const pipeline = sharp(master).resize(size, size, { kernel: 'lanczos3' });
  if (size <= SHARPEN_AT_OR_BELOW) pipeline.sharpen(SHARPEN);
  return pipeline.png({ compressionLevel: 9 }).toBuffer();
}

const { master, box, side } = await buildMaster();
mkdirSync(OUT_DIR, { recursive: true });

const written = [];
const write = (name, data) => {
  writeFileSync(resolve(OUT_DIR, name), data);
  written.push([name, data.length]);
};

write('favicon.ico', buildIco(await Promise.all(ICO_SIZES.map(async (size) => ({ size, data: await resize(master, size) })))));
write('favicon-96.png', await resize(master, 96));
write('apple-touch-icon.png', await resize(master, 180));

console.log(`mark  ${box.width}x${box.height} at (${box.left}, ${box.top}) -> ${side}x${side} square`);
for (const [name, bytes] of written) {
  console.log(`  ${name.padEnd(22)} ${(bytes / 1024).toFixed(1)} KB`);
}
