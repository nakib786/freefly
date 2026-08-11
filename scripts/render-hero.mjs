/**
 * Renders public/models/tesla-static-hero.webp — the image shown to visitors
 * who get no WebGL at all.
 *
 *   npm run dev          # in another terminal, must be on :5180
 *   npm run hero
 *
 * Photographs /static-hero.html, which draws the real car with the real
 * lighting rig at STATIC_FRAMING, so the fallback always matches the live
 * scene. Re-run it after changing the model, the lighting or STATIC_FRAMING.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT = resolve(ROOT, '.captures/static-hero-raw.png');
const OUT = resolve(ROOT, 'public/models/tesla-static-hero.webp');

// 2x the widest breakpoint we care about, then downscaled — cheap supersampling
// that hides SwiftShader's rougher antialiasing.
const WIDTH = 2560;
const HEIGHT = 1600;

execFileSync(
  process.execPath,
  [
    resolve(ROOT, 'scripts/shoot.mjs'),
    'http://localhost:5180/static-hero.html',
    `--w=${WIDTH}`,
    `--h=${HEIGHT}`,
    '--out=static-hero-raw',
    '--settle=25000',
  ],
  { stdio: 'inherit' },
);

const info = await sharp(readFileSync(SHOT))
  .resize(1920, 1200, { fit: 'cover', kernel: 'lanczos3' })
  .webp({ quality: 78, effort: 6 })
  .toFile(OUT);

unlinkSync(SHOT);
console.log(`static hero -> public/models/tesla-static-hero.webp  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
