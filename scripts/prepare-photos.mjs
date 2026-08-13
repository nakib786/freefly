/**
 * Turns the client's raw phone photos into web assets.
 *
 *   npm run photos
 *
 * Source: public/Pics/ (23 JPEGs, ~40 MB total), straight off a phone at up to
 * 4032px. Most carry EXIF orientation 6 (rotate 90° CW), which browsers respect
 * inconsistently once an image is drawn into a CSS object-fit box, so rotation
 * is baked in here rather than left to chance.
 *
 * Output: public/photos/<slug>-{800,1400}.webp plus a tiny blurred placeholder
 * inlined as a data URI in the generated manifest, so a card never pops from
 * empty to loaded.
 *
 * DELIBERATELY EXCLUDED (see EXCLUDE below). Two of the supplied files are
 * photographs of completed ICBC road test result forms. They carry candidate
 * names, licence numbers and examiner signatures, and one is only partially
 * redacted. Those are not marketing assets, they are other people's personal
 * data, and they must not be published. They stay in public/Pics/ untouched but
 * never reach public/photos/.
 *
 * The source directory is excluded from the build (see vite.config.ts) so the
 * 40 MB of originals is not deployed alongside the optimised copies.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'public/Pics');
const OUT = resolve(ROOT, 'public/photos');
const MANIFEST = resolve(ROOT, 'src/data/photos.generated.ts');

/** Personal data. Never publish. See the header. */
const EXCLUDE = new Set(['jj result.jpg', 'sheet.jpg']);

/**
 * The instructor portrait, handled separately from the student pass wall: it is
 * a posed landscape shot used large in the Instructors section, so it gets its
 * own widths and is not cropped to a portrait tile.
 */
const PORTRAIT = 'harryPIC.png';
const PORTRAIT_WIDTHS = [900, 1600];

/**
 * Which car is in shot. The site's whole proposition is "learn in a Tesla", so
 * a Model 3 photo and a photo of the school's older Hyundai Sonata are not
 * interchangeable: a Sonata shot directly under a "Learn to drive in a Tesla"
 * headline reads as a bait-and-switch. Classified by eye, once.
 */
const TESLA = new Set([
  'aileen.jpg',
  'IMG_4037.jpg',
  'IMG_4044.jpg',
  'IMG_4436 (1).jpg',
  'IMG_4810.jpg',
  'IMG_5238.jpg',
  'IMG_5708.jpg',
  'IMG_5773.jpg',
  'IMG_5808.jpg',
  'vera tesla.jpg',
]);

/**
 * Only the Tesla shots are emitted. The Sonata photos are kept classified in
 * the manifest for the record, but there is no point shipping bytes for images
 * the site will not display, and at 21 photos x 2 widths the full set came to
 * 13 MB, which is ten times the 3D model.
 */
const EMIT_ONLY_TESLA = true;

/**
 * Gallery tiles are ~380px wide at the largest breakpoint and the lightbox
 * caps at ~1100. 640/1100 covers both, including 2x on the tile.
 */
const WIDTHS = [640, 1100];

const slugify = (name) =>
  name
    .replace(extname(name), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC)
  .filter((f) => /\.(jpe?g|png)$/i.test(f))
  .filter((f) => !EXCLUDE.has(f) && f !== PORTRAIT);

const entries = [];
let srcBytes = 0;
let outBytes = 0;

for (const file of files) {
  const slug = slugify(file);
  const input = resolve(SRC, file);
  const isTesla = TESLA.has(file);
  const base = sharp(input).rotate(); // bake EXIF orientation
  srcBytes += statSync(input).size;

  if (EMIT_ONLY_TESLA && !isTesla) continue;

  for (const width of WIDTHS) {
    const info = await base
      .clone()
      .resize(width, null, { withoutEnlargement: true })
      .webp({ quality: width > 800 ? 70 : 74, effort: 6 })
      .toFile(resolve(OUT, `${slug}-${width}.webp`));
    outBytes += info.size;
  }

  // 20px blurred LQIP, inlined. Costs ~400 bytes and removes the pop-in.
  const placeholder = await base
    .clone()
    .resize(20, null)
    .blur(1.4)
    .webp({ quality: 30 })
    .toBuffer();

  // Rotation swaps the reported dimensions for orientation 6/8.
  const rotated = await base.clone().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = rotated.info;

  entries.push({
    slug,
    src: `/photos/${slug}-${WIDTHS[1]}.webp`,
    srcSmall: `/photos/${slug}-${WIDTHS[0]}.webp`,
    width: w,
    height: h,
    car: isTesla ? 'tesla' : 'sonata',
    blur: `data:image/webp;base64,${placeholder.toString('base64')}`,
  });
}

entries.sort((a, b) => (a.car === b.car ? a.slug.localeCompare(b.slug) : a.car === 'tesla' ? -1 : 1));

/* ------------------------------------------------------- instructor portrait -- */

let portrait = null;
try {
  const base = sharp(resolve(SRC, PORTRAIT)).rotate();
  srcBytes += statSync(resolve(SRC, PORTRAIT)).size;

  for (const width of PORTRAIT_WIDTHS) {
    const info = await base
      .clone()
      .resize(width, null, { withoutEnlargement: true })
      .webp({ quality: width > 1000 ? 76 : 80, effort: 6 })
      .toFile(resolve(OUT, `instructor-${width}.webp`));
    outBytes += info.size;
  }

  const blur = await base.clone().resize(24, null).blur(1.4).webp({ quality: 30 }).toBuffer();
  const { info } = await base.clone().toBuffer({ resolveWithObject: true });

  portrait = {
    src: `/photos/instructor-${PORTRAIT_WIDTHS[1]}.webp`,
    srcSmall: `/photos/instructor-${PORTRAIT_WIDTHS[0]}.webp`,
    width: info.width,
    height: info.height,
    blur: `data:image/webp;base64,${blur.toString('base64')}`,
  };
} catch (error) {
  console.warn(`  ! instructor portrait (${PORTRAIT}) not processed: ${error.message}`);
}

const banner = `/**
 * GENERATED by scripts/prepare-photos.mjs. Do not edit by hand.
 * Run \`npm run photos\` after adding or replacing images in public/Pics/.
 *
 * \`car\` records which vehicle is in the shot. Only 'tesla' images are used in
 * the pass gallery, because the site's proposition is learning in a Model 3.
 */`;

writeFileSync(
  MANIFEST,
  `${banner}

export type StudentPhoto = {
  slug: string;
  src: string;
  srcSmall: string;
  width: number;
  height: number;
  car: 'tesla' | 'sonata';
  blur: string;
};

export const STUDENT_PHOTOS: readonly StudentPhoto[] = ${JSON.stringify(entries, null, 2)};

export type Portrait = Omit<StudentPhoto, 'slug' | 'car'>;

/** The instructor portrait, or null if the source image is missing. */
export const INSTRUCTOR_PHOTO: Portrait | null = ${JSON.stringify(portrait, null, 2)};
`,
);

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`${entries.length} student photos (${files.length} read, ${EXCLUDE.size} excluded as personal data)`);
console.log(`  instructor portrait: ${portrait ? 'yes' : 'MISSING'}`);
console.log(`  tesla: ${entries.filter((e) => e.car === 'tesla').length}   sonata: ${entries.filter((e) => e.car === 'sonata').length}`);
console.log(`  ${mb(srcBytes)} source -> ${mb(outBytes)} webp across ${WIDTHS.length} widths`);
console.log(`  manifest -> src/data/photos.generated.ts`);
