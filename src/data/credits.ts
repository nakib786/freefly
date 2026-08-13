/**
 * Everything the site owes an attribution to.
 *
 * Only one entry here is a legal obligation: the Sketchfab car is CC-BY 4.0,
 * which requires the title, the author, a link to the material, the licence,
 * and an indication that it was modified. That is what MODEL and MODEL_CHANGES
 * below carry, and /credits is where they are published.
 *
 * The rest (type, code) is not strictly required, since MIT and the OFL are both
 * satisfied by the notices shipped in node_modules, but a credits page that
 * lists one dependency and hides the other twenty is not really a credits page.
 *
 * Nothing here is guessed. Where a designer, a maintainer or a canonical
 * licence URL was not verifiable, the field is a plain string rather than a
 * link, because a wrong attribution is worse than a plain one.
 */

/* ------------------------------------------------------------------- model -- */

export const MODEL = {
  title: 'Tesla 2018 Model 3',
  author: 'Ameer Studio',
  /** The Licensed Material, per CC-BY 4.0 §3(a)(1)(A). */
  source: 'https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f',
  licence: 'CC Attribution 4.0 International',
  licenceShort: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
} as const;

/**
 * CC-BY 4.0 §3(a)(1)(B): modifications must be indicated. These are the actual
 * pipeline steps from scripts/optimize-model.mjs, not a summary of intent.
 */
export const MODEL_CHANGES = [
  'Duplicate accessors, materials and textures collapsed; coincident vertices welded.',
  'Geometry decimated per part with meshoptimizer: body panels, glass and lights left untouched, interior and chassis cut to 4-8% of their source triangles.',
  '22 PNG textures converted to WebP at quality 82 and capped at 1024px.',
  'Draco EDGEBREAKER compression, quantised P14 / N10 / UV12.',
  'Paint, glass and emissive materials re-authored in code. The shipped car is pearl white, and several source materials export with wrong factors.',
  'Wheel meshes re-parented to four pivots so they can be rotated independently.',
] as const;

/**
 * Read out of each GLB's JSON chunk, not estimated. Accessor counts survive
 * Draco compression, so the shipped figures are the real ones. Re-measure if a
 * decimation ratio changes; these are published to the visitor.
 */
export const MODEL_BUILDS = [
  { label: 'Source (this page)', tris: 684_315, bytes: 22_671_680 },
  { label: 'Shipped (desktop)', tris: 366_721, bytes: 1_566_660 },
  { label: 'Shipped (mobile)', tris: 291_534, bytes: 1_242_560 },
] as const;

export const RAW_MODEL = {
  /**
   * Served from `assets/models/`, deliberately outside `public/`, so a 21.6 MB
   * file can never be pulled in by anything except this page. A dev middleware
   * and a build-time copy both put it at this one path (see vite.config.ts).
   */
  url: '/models/source/tesla-model-3-ameer.glb',
  bytes: 22_671_680,
  tris: 684_315,
  meshes: 176,
  materials: 58,
} as const;

/* -------------------------------------------------------------------- type -- */

export const TYPE_CREDITS = [
  {
    name: 'Archivo',
    by: 'Omnibus-Type',
    licence: 'SIL Open Font Licence 1.1',
    href: 'https://fonts.google.com/specimen/Archivo',
    use: 'Headlines and standfirsts',
  },
  {
    name: 'Instrument Sans',
    by: 'Instrument',
    licence: 'SIL Open Font Licence 1.1',
    href: 'https://fonts.google.com/specimen/Instrument+Sans',
    use: 'Body copy',
  },
  {
    name: 'Martian Mono',
    by: 'Evil Martians',
    licence: 'SIL Open Font Licence 1.1',
    href: 'https://fonts.google.com/specimen/Martian+Mono',
    use: 'Telemetry, prices, labels',
  },
] as const;

/* -------------------------------------------------------------------- code -- */

export const CODE_CREDITS = [
  { name: 'React', by: 'Meta and contributors', licence: 'MIT', href: 'https://react.dev' },
  { name: 'three.js', by: 'mrdoob and contributors', licence: 'MIT', href: 'https://threejs.org' },
  {
    name: 'React Three Fiber',
    by: 'Poimandres',
    licence: 'MIT',
    href: 'https://github.com/pmndrs/react-three-fiber',
  },
  { name: 'drei', by: 'Poimandres', licence: 'MIT', href: 'https://github.com/pmndrs/drei' },
  { name: 'GSAP', by: 'Webflow', licence: 'Standard licence', href: 'https://gsap.com' },
  { name: 'Tailwind CSS', by: 'Tailwind Labs', licence: 'MIT', href: 'https://tailwindcss.com' },
  { name: 'Vite', by: 'Vite contributors', licence: 'MIT', href: 'https://vite.dev' },
  {
    name: 'Draco',
    by: 'Google',
    licence: 'Apache 2.0',
    href: 'https://github.com/google/draco',
    note: 'Decodes the compressed car in your browser',
  },
  {
    name: 'meshoptimizer',
    by: 'Arseny Kapoulkine',
    licence: 'MIT',
    href: 'https://github.com/zeux/meshoptimizer',
    note: 'Decimated the car at build time',
  },
  {
    name: 'glTF-Transform',
    by: 'Don McCurdy',
    licence: 'MIT',
    href: 'https://gltf-transform.dev',
    note: 'Drove the optimisation pipeline',
  },
] as const;

/* ---------------------------------------------------------------- the build -- */

export const DEVELOPER = {
  /**
   * The space before "Inc." is non-breaking. In the site footer the line is one
   * word too long on a phone, and a normal space drops "Inc." alone onto a
   * second line; binding it wraps the name as "…Business / Solutions Inc."
   */
  name: 'Aurora N&N Business Solutions\u00A0Inc.',
  href: 'https://aurorabusiness.ca',
  role: 'Design, build and deployment',
} as const;

/* ------------------------------------------------------------------ helpers -- */

/** Bytes as MB to one decimal: the unit people recognise on a download prompt. */
export function mb(bytes: number) {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}
