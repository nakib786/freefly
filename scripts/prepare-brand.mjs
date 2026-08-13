/**
 * Extracts a web-usable wordmark from the supplied brand SVG.
 *
 *   npm run brand
 *
 * `assets/FreeFly Logo.svg` is 714 KB, and almost none of that is vector: the
 * car mark is three base64 PNGs embedded via <image>, plus a C2PA metadata
 * blob. What *is* real vector is the type: 21 paths filled #58646a, in two
 * groups: "FREEFLY" and "DRIVING SCHOOL". Those are worth pulling out, because
 * a vector wordmark recolours to `currentColor` and stays crisp at any size,
 * which a 1.16 MB opaque-cream PNG cannot do on a near-black page.
 *
 * The car mark is deliberately NOT extracted for site use. Keying the cream out
 * of it would eat the windscreen gradient and leave halos on dark, and the page
 * already has an actual 3D Tesla on it, and a Tesla-face logo beside a Tesla
 * render is redundant. The car mark stays where it reads well: the favicon
 * (see generate-favicons.mjs, which keeps the cream plate on purpose).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'assets/FreeFly Logo.svg');
const OUT_DIR = resolve(ROOT, 'src/assets');

/** The two top-level groups holding the type, by their transform signature. */
const GROUPS = [
  { name: 'FREEFLY', marker: '<g transform="matrix(1, 0, 0, 1, 86, 1046)">' },
  { name: 'DRIVING SCHOOL', marker: '<g transform="matrix(1, 0, 0, 1, 46, 1362)">' },
];

/**
 * Reads one balanced <g>…</g> starting at `start`.
 *
 * Has to tokenise rather than count "<g" vs "</g>": the export writes the word
 * space in "DRIVING SCHOOL" as a self-closing <g/>, which opens and closes in
 * one tag and throws off a naive depth counter.
 */
function readGroup(svg, start) {
  const tag = /<g(?:\s[^>]*?)?(\/?)>|<\/g>/g;
  tag.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tag.exec(svg))) {
    if (match[0] === '</g>') depth -= 1;
    else if (match[1] !== '/') depth += 1;
    if (depth === 0) return svg.slice(start, tag.lastIndex);
  }
  throw new Error('Unbalanced <g> while reading wordmark group');
}

const svg = readFileSync(SRC, 'utf8');

const groups = GROUPS.map(({ name, marker }) => {
  const at = svg.indexOf(marker);
  if (at === -1) throw new Error(`Could not find the ${name} group. Has the logo been re-exported?`);
  return readGroup(svg, at);
});

// Drop the clip-path references: they point at <defs> we are not carrying over,
// and they only clip to the type's own bounding box anyway.
const body = groups.join('\n  ').replace(/\s*clip-path="url\(#[^)]*\)"/g, '');

const paths = body.replace(/fill="#58646a"/g, 'fill="currentColor"');
const render = (viewBox) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor" role="img" aria-label="Free Fly Driving School">\n  ${paths}\n</svg>\n`;

/**
 * The glyph outlines overshoot the group transforms slightly, so a viewBox
 * derived from those numbers shaves the first and last letters. Rasterise once
 * against a generous box, find where the ink actually is, and map back into SVG
 * units, so a re-exported logo with different metrics still crops right.
 */
const PROBE = { x: -60, y: 940, w: 1660, h: 660 };
const PROBE_W = 1660;
const probe = await sharp(Buffer.from(render(`${PROBE.x} ${PROBE.y} ${PROBE.w} ${PROBE.h}`)))
  .resize(PROBE_W)
  .extractChannel('alpha')
  .raw()
  .toBuffer({ resolveWithObject: true });

const { data, info } = probe;
let minX = info.width;
let minY = info.height;
let maxX = -1;
let maxY = -1;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[y * info.width + x] > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX < 0) throw new Error('Extracted wordmark rendered empty');

const unitsPerPx = PROBE.w / info.width;
const PAD = 2; // SVG units of breathing room, so antialiased edges are not clipped
const box = {
  x: PROBE.x + minX * unitsPerPx - PAD,
  y: PROBE.y + minY * unitsPerPx - PAD,
  w: (maxX - minX + 1) * unitsPerPx + PAD * 2,
  h: (maxY - minY + 1) * unitsPerPx + PAD * 2,
};
const viewBox = [box.x, box.y, box.w, box.h].map((n) => Math.round(n * 100) / 100).join(' ');

mkdirSync(OUT_DIR, { recursive: true });
const out = render(viewBox);
writeFileSync(resolve(OUT_DIR, 'freefly-wordmark.svg'), out);

console.log(`wordmark -> src/assets/freefly-wordmark.svg`);
console.log(`  ${(out.match(/<path/g) ?? []).length} paths, ${(out.length / 1024).toFixed(1)} KB (source SVG was ${(svg.length / 1024).toFixed(1)} KB)`);
console.log(`  measured viewBox "${viewBox}"  aspect ${(box.w / box.h).toFixed(3)}`);
console.log(`  recolourable via currentColor`);
