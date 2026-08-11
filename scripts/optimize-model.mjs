/**
 * Tesla Model 3 GLB optimisation pipeline.
 *
 *   npm run model:optimize            # build both LODs
 *   npm run model:optimize -- --lod=high
 *
 * Source: assets/models/tesla-model-3-ameer.glb
 *   "Tesla 2018 Model 3" by Ameer Studio (Sketchfab, CC-BY 4.0)
 *   684,315 tris / 394,055 verts / 176 meshes / 58 materials / 22 PNG textures.
 *   The 22.6 MB is almost entirely raw f32 geometry — textures are only ~2 MB.
 *
 * Why tiered rather than one global ratio: the triangle budget in this model is
 * badly distributed for our use case. Seats, carpet, steering wheel and door
 * leather account for ~35% of all triangles and are seen only through tinted
 * glass, while the body panels and wheels — which the hero camera pushes right
 * up against — are what actually has to hold up. A uniform 0.06 ratio (the
 * naive way to hit 40k) visibly facets the hood and wheel arches while wasting
 * triangles on seat stitching nobody will ever see. So each primitive is
 * assigned a tier by material, and each tier gets its own ratio + error bound.
 *
 * meshoptimizer stops early if the error bound is hit, so the ratios below are
 * targets, not guarantees — curved exterior panels keep more than their ratio
 * asks for, which is the intent.
 *
 * ─── Why the shell is not decimated at all ──────────────────────────────────
 * It used to be, at ratio 0.75, on the theory that a tight error bound would
 * keep it clean. It does not, and the earlier note here claiming otherwise was
 * wrong. Rendering the same view from the shipped GLB and from a build with the
 * shell spared (.captures/ab1-high.png vs ab1-trial.png) shows the boot lid,
 * rear quarter and A-pillar visibly crumpled, the panel-gap lines torn, and a
 * sawtooth along the rear window frame — while the silhouette is unchanged.
 *
 * That last part is the tell. meshoptimizer's simplifier minimises *positional*
 * error only; it has no view of the normals riding on those vertices. A tight
 * `error` bound therefore does exactly what it promises — the surface stays
 * where it was — while the normal field over it gets resampled onto a coarser
 * set of vertices and interpolated across larger triangles. On a matte material
 * that is invisible. On clearcoat paint, which is close to a mirror, it reads
 * as dents. No error bound fixes this, because the metric being bounded is not
 * the one that is going wrong.
 *
 * The cost of keeping it is small enough that the trade is not close: the shell
 * is 220k triangles that Draco packs into roughly +140 KB over the decimated
 * build, against a 5 MB budget. Everything the camera never inspects closely is
 * still cut hard, which is where the 22.6 MB actually goes.
 */
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, simplifyPrimitive, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'assets/models/tesla-model-3-ameer.glb');
const OUT_DIR = resolve(ROOT, 'public/models');

/* ------------------------------------------------------------------ tiers -- */

/**
 * Material name -> tier. Matching is by prefix, longest match wins, so
 * `movsteer_1.0.1` is caught by `movsteer` and `glass.0` by `glass`.
 */
const TIER_BY_MATERIAL = {
  // Body paint and everything the camera gets close to in scenes 1 and 4.
  primary: 'shell',
  glass: 'shell',
  front_black: 'shell',
  black_lights: 'shell',
  back_chrome_light: 'shell',
  aluminium_light: 'shell',
  light_pantulan: 'shell',
  pantulans: 'shell',
  'tembus red': 'shell',
  'tembus_red': 'shell',
  'right front light': 'shell',
  'left front light': 'shell',
  'right rear light': 'shell',
  'left rear light': 'shell',
  right_front_light: 'shell',
  left_front_light: 'shell',
  right_rear_light: 'shell',
  left_rear_light: 'shell',
  'breaklight l': 'shell',
  breaklight_l: 'shell',
  'foglight r': 'shell',
  'foglight l': 'shell',
  foglight_r: 'shell',
  foglight_l: 'shell',
  indicator: 'shell',
  revlight: 'shell',
  platnomor: 'shell',

  // Wheels — hero scene parks the camera on the front-left arch.
  wheels: 'wheels',
  hub_: 'wheels',

  // Seen only through glass. Heavy cuts here buy the shell its detail.
  'Seat Leather white': 'cabin',
  'Seat_Leather_white': 'cabin',
  'Putih': 'cabin',
  Carpet: 'cabin',
  Carpet_Light: 'cabin',
  movsteer: 'cabin',
  texture_Buttons: 'cabin',
  LCDs: 'cabin',
  belt: 'cabin',
  mirror_inside: 'cabin',
  'light night': 'cabin',
  light_night: 'cabin',

  // Underbody / suspension — never above the horizon line in any scene.
  chassis: 'hidden',
  suspensi: 'hidden',
};

/** Anything unmatched (trim plastics, black detailing, frunk liner) lands here. */
const DEFAULT_TIER = 'trim';

const LODS = {
  high: {
    file: 'tesla-model-3.glb',
    texture: 1024,
    tiers: {
      // The shell is NOT decimated, at either LOD. See the header note on why
      // any ratio below 1 visibly crumples the paint.
      shell: { ratio: 1 },
      // Same reasoning, and the hero camera parks on the front arch: sparing
      // the wheels costs 36k tris / ~60 KB and removes the angular spoke edges
      // and the sawtooth along the arch lip that 0.6 left behind.
      wheels: { ratio: 1 },
      trim: { ratio: 0.18, error: 0.004 },
      cabin: { ratio: 0.08, error: 0.02 },
      hidden: { ratio: 0.06, error: 0.03 },
    },
  },
  low: {
    file: 'tesla-model-3-low.glb',
    texture: 512,
    tiers: {
      // Mobile is where the damage was worst — the phone scenes hold the car
      // at mid distance across a whole section, so a crumpled flank is on
      // screen far longer than it ever is on desktop. The shell is spared here
      // too; the mobile LOD earns its size back on textures and interior.
      shell: { ratio: 1 },
      // Still cut, but with the border locked so the arch lip and tyre edge
      // keep their outline. Rubber and dark rims hide interpolation error that
      // clearcoat magnifies, so this tier tolerates decimation.
      wheels: { ratio: 0.45, error: 0.002, lockBorder: true },
      trim: { ratio: 0.08, error: 0.01 },
      cabin: { ratio: 0.04, error: 0.04 },
      hidden: { ratio: 0.03, error: 0.05 },
    },
  },
};

/** Primitives below this never get simplified — badges, handles, small trim. */
const MIN_TRIANGLES = 128;

/* ------------------------------------------------------------------ utils -- */

const tris = (prim) => {
  const idx = prim.getIndices();
  return idx ? idx.getCount() / 3 : prim.getAttribute('POSITION').getCount() / 3;
};

const docTris = (root) =>
  root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((t, p) => t + tris(p), 0), 0);

function tierFor(prim) {
  const name = prim.getMaterial()?.getName() ?? '';
  let best = null;
  for (const key of Object.keys(TIER_BY_MATERIAL)) {
    if (name.startsWith(key) && (!best || key.length > best.length)) best = key;
  }
  return best ? TIER_BY_MATERIAL[best] : DEFAULT_TIER;
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

/* --------------------------------------------------------------- pipeline -- */

/**
 * `--tier=shell:0.85,wheels:0.6` overrides ratios for a one-off run, and
 * `--out=trial.glb` writes somewhere other than the LOD's normal filename.
 * Used to A/B decimation levels against the source in model-check.html without
 * editing the committed tier table.
 */
function applyOverrides(lod) {
  const tierArg = process.argv.find((a) => a.startsWith('--tier='))?.slice(7);
  const outArg = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
  const next = { ...lod, tiers: structuredClone(lod.tiers) };
  if (tierArg) {
    for (const pair of tierArg.split(',')) {
      const [tier, ratio] = pair.split(':');
      if (!next.tiers[tier]) throw new Error(`Unknown tier "${tier}"`);
      next.tiers[tier].ratio = Number(ratio);
    }
  }
  if (outArg) next.file = outArg;
  return next;
}

async function build(lodName) {
  const lod = applyOverrides(LODS[lodName]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });

  const doc = await io.read(SRC);
  const root = doc.getRoot();
  const before = docTris(root);

  // Weld first — meshoptimizer collapses far better on a welded, indexed mesh,
  // and Sketchfab's FBX export leaves a lot of split vertices behind.
  await doc.transform(dedup(), weld());
  const welded = docTris(root);

  // Per-primitive simplification by tier.
  await MeshoptSimplifier.ready;
  const stats = {};
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const tier = tierFor(prim);
      const opts = lod.tiers[tier];
      const n = tris(prim);
      const s = (stats[tier] ??= { before: 0, after: 0, prims: 0, skipped: 0 });
      s.before += n;
      s.prims += 1;
      // ratio >= 1 means "leave this tier alone". Passing it to meshoptimizer
      // anyway is not a no-op: it still runs a collapse pass and can weld across
      // smoothing seams, which is exactly the damage this tier is meant to avoid.
      if (n < MIN_TRIANGLES || opts.ratio >= 1) {
        s.after += n;
        s.skipped += 1;
        continue;
      }
      simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ...opts });
      s.after += tris(prim);
    }
  }

  // PNG -> WebP. Cheap win: ~2 MB of PNG down to a few hundred KB.
  //
  // Driving sharp directly rather than via textureCompress() so that textures
  // already at or under the cap skip the resize instead of being round-tripped
  // for nothing, and so the before/after byte totals can be reported.
  //
  // NOTE: package.json pins `overrides.sharp` for a reason. @gltf-transform/
  // functions pulls in ndarray-pixels, which declares its own sharp dependency.
  // If that resolves to a different version than the top-level one, npm nests a
  // second copy, two native libvips DLLs get loaded into the same process, and
  // every encode dies with "colourspace: parameter space not set" (or an
  // outright ERR_DLOPEN_FAILED, depending on import order). Keep them deduped.
  let texBefore = 0;
  let texAfter = 0;
  for (const texture of root.listTextures()) {
    const src = texture.getImage();
    if (!src) continue;
    texBefore += src.byteLength;

    const [w, h] = texture.getSize() ?? [0, 0];
    let pipeline = sharp(Buffer.from(src));
    if (w > lod.texture || h > lod.texture) {
      const scale = lod.texture / Math.max(w, h);
      pipeline = pipeline.resize(Math.round(w * scale), Math.round(h * scale), {
        fit: 'fill',
        kernel: 'lanczos3',
      });
    }
    const out = await pipeline.webp({ quality: lodName === 'high' ? 82 : 72, effort: 6 }).toBuffer();

    texAfter += out.byteLength;
    texture
      .setImage(new Uint8Array(out))
      .setMimeType('image/webp')
      .setURI((texture.getURI() || `texture-${texture.getName() || 'x'}`).replace(/\.\w+$/, '') + '.webp');
  }

  await doc.transform(prune({ keepAttributes: false }));

  doc.createExtension(EXTTextureWebP).setRequired(true);
  doc
    .createExtension(KHRDracoMeshCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
      encodeSpeed: 3,
      decodeSpeed: 5,
      quantizationBits: { POSITION: 14, NORMAL: 10, TEX_COORD: 12, COLOR: 8, GENERIC: 12 },
    });

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, lod.file);
  await io.write(outPath, doc);

  const after = docTris(root);
  console.log(`\n=== ${lodName.toUpperCase()} -> public/models/${lod.file} ===`);
  console.table(
    Object.entries(stats).map(([tier, s]) => ({
      tier,
      prims: s.prims,
      untouched: s.skipped,
      before: Math.round(s.before).toLocaleString(),
      after: Math.round(s.after).toLocaleString(),
      kept: (100 * s.after / s.before).toFixed(1) + '%',
    })),
  );
  console.log(
    `geometry  ${before.toLocaleString()} tris -> welded ${welded.toLocaleString()} -> ${Math.round(after).toLocaleString()} tris`,
  );
  console.log(`textures  ${mb(texBefore)} PNG -> ${mb(texAfter)} WebP`);
  console.log(`file      ${mb(statSync(SRC).size)} -> ${mb(statSync(outPath).size)}`);
  return { tris: after, bytes: statSync(outPath).size };
}

/* ------------------------------------------------------------------- main -- */

if (!existsSync(SRC)) {
  console.error(`Source model not found: ${SRC}`);
  process.exit(1);
}

const only = process.argv.find((a) => a.startsWith('--lod='))?.split('=')[1];
for (const name of only ? [only] : Object.keys(LODS)) {
  if (!LODS[name]) {
    console.error(`Unknown LOD "${name}". Expected one of: ${Object.keys(LODS).join(', ')}`);
    process.exit(1);
  }
  await build(name);
}
