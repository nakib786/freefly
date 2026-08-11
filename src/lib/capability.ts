/**
 * What kind of 3D, if any, this device should get.
 *
 * Three tiers, decided once on mount:
 *
 *   'full'   scroll-scrubbed camera, high LOD, shadows
 *   'lite'   3D but simplified — low LOD, no shadows, fewer lights, and on
 *            mobile a shorter camera path
 *   'none'   no WebGL at all; the page renders a static hero image
 *
 * Deliberately conservative. A janky 3D scene on a mid-range phone is a worse
 * outcome than a clean static one, so anything ambiguous lands in 'lite'.
 */

export type Tier = 'full' | 'lite' | 'none';

export type Capability = {
  tier: Tier;
  reducedMotion: boolean;
  /** True when the camera should not be scroll-scrubbed at all. */
  staticCamera: boolean;
  modelUrl: string;
  shadows: boolean;
  /** Upper bound for the renderer's pixel ratio. */
  maxDpr: number;
};

const HIGH_LOD = '/models/tesla-model-3.glb';
const LOW_LOD = '/models/tesla-model-3-low.glb';

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Probes for a *working* WebGL2 context, not just the presence of the API.
 * Some older Android browsers expose the constructor and then fail to create a
 * context, and software rasterisers report success but run at single-digit fps.
 */
function detectWebGL(): { ok: boolean; softwareRenderer: boolean } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return { ok: false, softwareRenderer: false };

    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? '')
      : String(gl.getParameter(gl.RENDERER) ?? '');

    // SwiftShader/llvmpipe/ANGLE-on-CPU all mean "no GPU", whatever the API says.
    const softwareRenderer = /swiftshader|llvmpipe|software|microsoft basic/i.test(renderer);

    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, softwareRenderer };
  } catch {
    return { ok: false, softwareRenderer: false };
  }
}

const TIERS: readonly Tier[] = ['full', 'lite', 'none'];

/**
 * `?scene=full|lite|none` forces a tier. For QA only — it is the only way to
 * exercise the 3D path in a headless/software-rendered browser, which the
 * detection below (correctly) refuses to give real 3D to.
 */
function forcedTier(): Tier | null {
  if (typeof location === 'undefined') return null;
  const value = new URLSearchParams(location.search).get('scene') as Tier | null;
  return value && TIERS.includes(value) ? value : null;
}

export function detectCapability(): Capability {
  const reducedMotion = prefersReducedMotion();

  const forced = forcedTier();
  if (forced) {
    return {
      tier: forced,
      reducedMotion,
      staticCamera: forced === 'none' || reducedMotion,
      modelUrl: forced === 'full' ? HIGH_LOD : LOW_LOD,
      shadows: forced === 'full',
      maxDpr: forced === 'full' ? 2 : 1.5,
    };
  }

  if (typeof window === 'undefined') {
    return {
      tier: 'none',
      reducedMotion,
      staticCamera: true,
      modelUrl: LOW_LOD,
      shadows: false,
      maxDpr: 1,
    };
  }

  const { ok, softwareRenderer } = detectWebGL();
  if (!ok || softwareRenderer) {
    return { tier: 'none', reducedMotion, staticCamera: true, modelUrl: LOW_LOD, shadows: false, maxDpr: 1 };
  }

  // navigator.deviceMemory and hardwareConcurrency are both advisory and both
  // absent on Safari, so a missing value must never be read as "low end".
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory;
  const cores = nav.hardwareConcurrency;
  const coarsePointer = matchMedia('(pointer: coarse)').matches;
  const smallViewport = Math.min(window.innerWidth, window.innerHeight) < 820;

  const weak =
    (memory !== undefined && memory <= 4) ||
    (cores !== undefined && cores <= 4) ||
    (coarsePointer && smallViewport);

  if (weak) {
    return {
      tier: 'lite',
      reducedMotion,
      staticCamera: reducedMotion,
      modelUrl: LOW_LOD,
      shadows: false,
      maxDpr: 1.5,
    };
  }

  return {
    tier: 'full',
    reducedMotion,
    // Reduced motion keeps the 3D — it just stops the scroll-scrubbing, which
    // is what the preference is actually about.
    staticCamera: reducedMotion,
    modelUrl: HIGH_LOD,
    shadows: true,
    maxDpr: 2,
  };
}

/**
 * Watches real frame times after the scene is live and demotes if the device
 * cannot hold a reasonable rate. The static probe above catches obvious cases;
 * this catches the phone that looks capable on paper and is not.
 *
 * Returns an unsubscribe function.
 */
export function watchFrameRate(onDemote: () => void, { sampleMs = 4000, minFps = 24 } = {}) {
  let frames = 0;
  let raf = 0;
  const started = performance.now();
  // Ignore the first stretch: shader compilation and texture upload make the
  // opening second unrepresentative of steady-state performance.
  const graceMs = 1500;

  const tick = () => {
    const elapsed = performance.now() - started;
    if (elapsed > graceMs) frames += 1;
    if (elapsed >= graceMs + sampleMs) {
      if (frames / ((elapsed - graceMs) / 1000) < minFps) onDemote();
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
