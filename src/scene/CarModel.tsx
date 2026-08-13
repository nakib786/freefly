/**
 * Tesla Model 3 loader + material treatment.
 *
 * ─── Asset provenance ──────────────────────────────────────────────────────
 * "Tesla 2018 Model 3" by Ameer Studio (Sketchfab), CC-BY 4.0
 * https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f
 *
 * The visitor-facing side of that licence is /credits (src/credits/), which
 * publishes the attribution, the list of modifications below, and the original
 * file. src/data/credits.ts is the single copy of those facts; edit them there.
 *
 * Source GLB: 684,315 tris / 394,055 verts / 176 meshes / 58 materials, 21.6 MB.
 * Shipped GLB: 366,721 tris, 1.49 MB (desktop) / 343,798 tris, 1.29 MB (mobile).
 *
 * Produced by `npm run model:optimize` (scripts/optimize-model.mjs), which is
 * the authoritative record of the pipeline. In short, per LOD:
 *
 *   1. dedup()  collapses duplicate accessors/materials/textures
 *   2. weld()   indexes and merges coincident vertices (required before simplify)
 *   3. simplifyPrimitive() per primitive, meshoptimizer, ratio+error by tier:
 *        shell  (paint, glass, lights)  not decimated, either LOD
 *        wheels (rims, tyres, hubs)     not decimated, either LOD
 *        trim   (black plastics, misc)  ratio 0.18 / 0.08
 *        cabin  (seats, carpet, wheel)  ratio 0.08 / 0.04
 *        hidden (chassis, suspension)   ratio 0.06 / 0.03
 *      Primitives under 128 tris are left alone so badges and handles survive.
 *   4. sharp: 22 PNGs -> WebP @ q82, capped at 1024px (1.56 MB -> 0.20 MB)
 *   5. prune() then Draco EDGEBREAKER, quantisation P14/N10/UV12
 *
 * Tiering rather than one global ratio is the whole trick here: the cabin is
 * ~32% of the source triangles and is only ever seen through tinted glass, so
 * cutting it to 4-8% is what pays for leaving the body panels and wheels (the
 * surfaces the hero camera sits right on top of) completely alone.
 *
 * On the triangle count: this lands well above a 30-50k budget, and that is a
 * deliberate, measured call rather than a miss. Decimating the shell at all is
 * what made the paint look dented: meshoptimizer bounds positional error and
 * has no view of the normals, which is the thing clearcoat magnifies. See the
 * "Why the shell is not decimated" note in optimize-model.mjs for the A/B. The
 * constraint that actually binds is transfer size, and 1.49 MB is a 15x
 * reduction with a lot of headroom under the 5 MB budget. 367k triangles in one
 * draw-call-bound scene is not what limits frame rate on this page.
 *
 * ─── Geometry notes ────────────────────────────────────────────────────────
 * The export is in FBX-ish units (~525 long) with the origin at the car's
 * centre, so it is normalised at load: uniformly scaled to a real Model 3
 * wheelbase-to-nose length and dropped so the tyre contact patch sits at y=0.
 * Nothing downstream should have to know about the source scale.
 */
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/** Real Tesla Model 3 overall length, metres. Used to normalise the import. */
const MODEL_3_LENGTH_M = 4.694;

const DRACO_PATH = '/draco/';

export type WheelGroups = {
  frontLeft: THREE.Object3D;
  frontRight: THREE.Object3D;
  rearLeft: THREE.Object3D;
  rearRight: THREE.Object3D;
};

export function useCarGltf(url: string) {
  return useGLTF(url, DRACO_PATH) as unknown as { scene: THREE.Group };
}

/* --------------------------------------------------------------- materials -- */

/**
 * Free Fly's car is a white Model 3. The source model ships light-grey body
 * paint plus a couple of materials that exported with obviously wrong factors
 * (`primary.004` and `indicator_lr` come through as vivid chartreuse), so every
 * paint slot is normalised to one pearl-white physical material rather than
 * trusting the import.
 */
const PAINT = {
  color: new THREE.Color('#e8e9ec'),
  metalness: 0.55,
  roughness: 0.28,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
  envMapIntensity: 1.15,
  /**
   * The panels are large, smooth and near-white, which is the exact shape of
   * gradient an 8-bit output buffer cannot represent: the falloff across the
   * bonnet crosses maybe a dozen quantisation steps over hundreds of pixels, so
   * it lands as visible bands with mushy, wandering edges rather than a smooth
   * ramp. Desktop hides it: a 2x DPR buffer downsampled into a physical pixel
   * averages four samples and dithers the step by accident, and MSAA helps
   * further. A phone at half its native DPR with no MSAA has no such luck, and
   * the bands are what "melting" looks like on a moving car.
   *
   * three.js's dithering flag adds a sub-LSB ordered noise in the fragment
   * shader, which is the standard fix and costs one instruction. On for both
   * tiers: it is free, and the desktop buffer being able to mask the problem is
   * not a reason to ship the problem.
   */
  dithering: true,
};

const isPaint = (name: string) => /^primary/.test(name);
const isGlass = (name: string) => /^glass/.test(name);
/** Chrome/brightwork. `movsteer_1.0.1` is the export's shared polished-metal slot. */
const isChrome = (name: string) => /(chrome|aluminium|movsteer_1\.0\.1|mirror_inside)/i.test(name);

/**
 * The rim face.
 *
 * `wheels.6` is the only wheel slot in this export whose base-colour map is a
 * white rim on black; every other `wheels.*` map is already dark (tyre tread,
 * brake disc, wheel barrel). Left alone it renders as a bright silver wheel,
 * which is not the car the school teaches in: Free Fly's Model 3 is white with
 * dark graphite wheels. Same reasoning as PAINT above: the model is normalised
 * to the real vehicle rather than trusted.
 *
 * Tinting the existing map rather than dropping it keeps the moulded shading
 * baked into the spokes; replacing it with a flat colour flattens them out.
 */
const isRim = (name: string) => /^wheels\.6/.test(name);

const RIM = {
  color: new THREE.Color('#33383d'),
  metalness: 0.62,
  roughness: 0.41,
  envMapIntensity: 1.0,
};

/**
 * The tyre carcass slots: sidewall, tread and barrel (`wheels.0` ships no map
 * at all, `wheels.2` and `wheels.3` average 28/255).
 *
 * Stated outright rather than inherited from the maps, and the metal/roughness
 * maps are dropped, because rubber has exactly one failure mode worth guarding:
 * anything that lowers its roughness turns a large, curved, dark surface into a
 * mirror pointed at a 3.4-intensity overhead softbox, and it renders white. The
 * mobile LOD used to do that via decimated UVs. That specific cause is fixed in
 * the pipeline, but a tyre has no business sampling a gloss map either way.
 */
const isTyre = (name: string) => /^wheels\.[023](\.|$)/.test(name);

const TYRE = {
  color: new THREE.Color('#16181b'),
  metalness: 0,
  roughness: 0.92,
  envMapIntensity: 0.45,
};

function treatMaterial(src: THREE.Material, simplified: boolean): THREE.Material {
  const name = src.name ?? '';
  const std = src as THREE.MeshStandardMaterial;

  if (isPaint(name)) {
    // Colour, finish AND base map all come from PAINT; the import is not
    // trusted for any of them. `primary.004` exports as vivid chartreuse, and
    // the two slots that do carry a base-colour map (`primary.001` on the
    // sills, `primary.002` on all four doors) are dark, high-contrast atlases
    // with mean luminance ~50/255 at a standard deviation of ~96. glTF multiplies
    // that into the base colour, so keeping it stained the white paint in
    // mottled grey patches, and at mobile texture sizes and mip levels the
    // patches blur into each other: the "watercolour" panels. The panel gaps
    // and shut lines are modelled geometry (the shell is never decimated), so
    // dropping the map costs no detail. normalMap is kept; no paint slot in
    // this export actually ships one, but a re-export might.
    const paint = new THREE.MeshPhysicalMaterial({ name, ...PAINT });
    paint.normalMap = std.normalMap ?? null;
    return paint;
  }

  if (isGlass(name)) {
    // Real refraction on desktop; plain tinted alpha on the low-power path.
    //
    // `transmission` is not a shading flag, it is a second render of the whole
    // scene: three.js renders everything else into a transmission render target
    // and the glass samples it, blurred by roughness. On mobile that buffer is
    // allocated at a fraction of the drawing buffer (which is itself already
    // capped at 1.5 DPR), and then sampled through a curved windscreen. The
    // result is a smeared, wobbling image of the car's own roof and pillars
    // dragged across the greenhouse as the camera moves, which is the melt.
    //
    // Dropping it also removes an entire extra scene pass per frame, which is
    // the single most expensive thing this scene asked of a phone. The tint,
    // roughness and env reflection all survive; what is lost is seeing the
    // headrests through the rear window at 1.5 DPR, which nobody was.
    if (simplified) {
      return new THREE.MeshPhysicalMaterial({
        name,
        color: new THREE.Color('#0d1218'),
        metalness: 0,
        roughness: 0.06,
        transparent: true,
        opacity: 0.86,
        envMapIntensity: 1.6,
        dithering: true,
      });
    }
    return new THREE.MeshPhysicalMaterial({
      name,
      color: new THREE.Color('#0d1218'),
      metalness: 0,
      roughness: 0.06,
      transmission: 0.82,
      thickness: 0.35,
      ior: 1.45,
      transparent: true,
      envMapIntensity: 1.6,
    });
  }

  if (isTyre(name)) {
    std.color.copy(TYRE.color);
    std.map = null;
    std.metalnessMap = null;
    std.roughnessMap = null;
    std.metalness = TYRE.metalness;
    std.roughness = TYRE.roughness;
    std.envMapIntensity = TYRE.envMapIntensity;
    return std;
  }

  if (isRim(name)) {
    std.color.copy(RIM.color);
    std.metalness = RIM.metalness;
    std.roughness = RIM.roughness;
    std.envMapIntensity = RIM.envMapIntensity;
    return std;
  }

  if (isChrome(name)) {
    std.metalness = 0.95;
    std.roughness = 0.18;
    std.envMapIntensity = 1.5;
    return std;
  }

  // Lit elements are identified from the data, not the name: eight materials in
  // this GLB carry an emissive map (headlights, tail bar, indicators, LCDs).
  // Name matching would wrongly catch `black_lights` and `aluminium_light`,
  // which are the dark housing and the reflector, so making those glow looks
  // broken. glTF multiplies emissiveFactor by emissiveMap, and this export
  // leaves some factors black, so the factor is forced white where a map exists.
  if (std.emissiveMap) {
    std.emissive = new THREE.Color('#ffffff');
    std.emissiveIntensity = 1.6;
    return std;
  }
  if (std.emissive && std.emissive.getHex() !== 0x000000) {
    std.emissiveIntensity = 1.3;
    return std;
  }

  // Everything else: black plastics, rubber, interior. Flatten the blown-out
  // roughness=1 / metalness=0 defaults the FBX export left behind.
  std.roughness = Math.min(std.roughness ?? 1, 0.72);
  std.envMapIntensity = 0.85;
  return std;
}

/* ------------------------------------------------------------------ wheels -- */

/**
 * This GLB does not contain four wheels. It contains two, and they are axles.
 *
 * `wheels` and `wheels.001` each hold BOTH wheels of one axle in a single mesh:
 * 2.16 units of lateral span against a 0.58 unit tyre diameter. Only the brake
 * hubs (`hub_lf`, `hub_rf`, `hub_lb`, `hub_rb`) exist per corner, and there are
 * no wheel pivots anywhere in the file.
 *
 * That is what made the wheels wobble. Bucketing meshes into four quadrants by
 * bounding-box centre puts an axle-pair mesh on the car's *centreline*, so both
 * front wheels landed in one bucket behind a pivot a metre inboard of either
 * tyre. Spin survived that by luck: the pivot still sat on the axle line, and
 * a rotation about the axle is correct for both wheels at once, but steering
 * did not: `rotation.y` swung the whole front axle about a vertical axis near
 * the car's middle, scything the wheels fore and aft instead of turning them on
 * the spot. So the pairs are split into real per-corner wheels first, and only
 * then bucketed.
 */

type WheelPart = { mesh: THREE.Object3D; box: THREE.Box3; centre: THREE.Vector3 };

/**
 * A mesh at least this much wider across the car than it is tall holds both
 * wheels of an axle. A single wheel is a disc, and its lateral span is the tyre
 * width, a fraction of its diameter, so the two cases are far apart: the axle
 * pairs measure ~3.7, and the widest hub ~0.9.
 */
const AXLE_PAIR_RATIO = 1.6;

/**
 * Splits one axle-pair mesh into a left and a right mesh either side of
 * `splitX` (world space), returning them parented alongside the original.
 *
 * The halves share the source attribute buffers and differ only in their index,
 * so this costs one extra index rather than a second copy of the geometry.
 * Bounding volumes are set by hand on purpose: computeBoundingBox() reads the
 * whole position attribute regardless of which vertices the index actually
 * references, so both halves would report the bounds of the entire axle, and
 * the bucketing below would put us straight back on the centreline.
 */
function splitAxlePair(mesh: THREE.Mesh, splitX: number): THREE.Mesh[] | null {
  const source = mesh.geometry;
  const position = source.getAttribute('position');
  const parent = mesh.parent;
  if (!position || !parent) return null;

  const index = source.getIndex();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  const side = new Uint8Array(position.count);
  const bounds = [new THREE.Box3(), new THREE.Box3()];

  for (let i = 0; i < position.count; i++) {
    local.fromBufferAttribute(position, i);
    world.copy(local).applyMatrix4(mesh.matrixWorld);
    const s = world.x >= splitX ? 1 : 0;
    side[i] = s;
    bounds[s].expandByPoint(local);
  }

  const triangles = index ? index.count / 3 : position.count / 3;
  const indices: number[][] = [[], []];
  for (let t = 0; t < triangles; t++) {
    const a = index ? index.getX(t * 3) : t * 3;
    const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    // The two wheels are disjoint clusters with a metre of air between them, and
    // no triangle bridges the gap, so one vertex decides the whole triangle.
    indices[side[a]].push(a, b, c);
  }
  if (!indices[0].length || !indices[1].length) return null;

  const halves = indices.map((list, s) => {
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) {
      geometry.setAttribute(name, attribute);
    }
    geometry.setIndex(list);
    geometry.boundingBox = bounds[s].clone();
    geometry.boundingSphere = bounds[s].getBoundingSphere(new THREE.Sphere());

    const half = new THREE.Mesh(geometry, mesh.material);
    half.name = `${mesh.name}-${s ? 'r' : 'l'}`;
    half.castShadow = mesh.castShadow;
    half.receiveShadow = mesh.receiveShadow;
    half.frustumCulled = mesh.frustumCulled;
    half.position.copy(mesh.position);
    half.quaternion.copy(mesh.quaternion);
    half.scale.copy(mesh.scale);
    parent.add(half);
    half.updateMatrixWorld(true);
    return half;
  });

  mesh.removeFromParent();
  return halves;
}

function buildWheelGroups(root: THREE.Object3D): WheelGroups | null {
  root.updateWorldMatrix(true, true);

  const bounds = new THREE.Box3().setFromObject(root);
  const mid = bounds.getCenter(new THREE.Vector3());

  const candidates: THREE.Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!/^(hub_|wheels)/i.test(mesh.name)) return;
    candidates.push(mesh);
  });
  if (!candidates.length) return null;

  const parts: WheelPart[] = [];
  const record = (mesh: THREE.Object3D, box: THREE.Box3) =>
    parts.push({ mesh, box, centre: box.getCenter(new THREE.Vector3()) });

  for (const mesh of candidates) {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const halves =
      size.x > AXLE_PAIR_RATIO * Math.max(size.y, size.z) ? splitAxlePair(mesh, mid.x) : null;

    if (!halves) {
      record(mesh, box);
      continue;
    }
    for (const half of halves) record(half, new THREE.Box3().setFromObject(half));
  }
  if (parts.length < 4) return null;

  const buckets: Record<keyof WheelGroups, WheelPart[]> = {
    frontLeft: [],
    frontRight: [],
    rearLeft: [],
    rearRight: [],
  };
  for (const part of parts) {
    // The nose points along −Z (keyframes.ts), so the front pair is the one
    // with the *smaller* z. Getting this backwards steers the rear wheels,
    // which reads as the car crabbing rather than turning.
    const front = part.centre.z < mid.z;
    const left = part.centre.x < mid.x;
    buckets[`${front ? 'front' : 'rear'}${left ? 'Left' : 'Right'}` as keyof WheelGroups].push(part);
  }
  if (Object.values(buckets).some((b) => b.length === 0)) return null;

  const groups = {} as WheelGroups;
  for (const key of Object.keys(buckets) as (keyof WheelGroups)[]) {
    const bucket = buckets[key];
    // Union of the bucket's boxes, not the mean of their centres. The tyre is
    // symmetric about the axle, so the union's centre is the axle; the mean is
    // dragged off it by the brake caliper, which is not symmetric and counts
    // for as much as the wheel it sits inside.
    const box = new THREE.Box3();
    for (const part of bucket) box.union(part.box);
    const centre = box.getCenter(new THREE.Vector3());

    const pivot = new THREE.Group();
    pivot.name = `wheel-${key}`;
    root.add(pivot);
    // `centre` is a world-space point, but position is expressed in the
    // parent's local space, and `root` carries the import normalisation
    // (~0.0089 uniform scale plus a translation). Assigning the world value
    // directly puts the pivot roughly a hundred metres away, which looks fine
    // until the wheel rotates and then swings it across the sky.
    pivot.position.copy(root.worldToLocal(centre.clone()));
    pivot.updateMatrixWorld(true);
    // attach() keeps each mesh's world transform while changing its parent.
    for (const { mesh } of bucket) pivot.attach(mesh);
    groups[key] = pivot;
  }
  return groups;
}

/* --------------------------------------------------------------- component -- */

type CarModelProps = {
  url: string;
  wireframe?: boolean;
  /** Low-power path: swaps refractive glass for tinted alpha. See treatMaterial. */
  simplified?: boolean;
  onWheels?: (wheels: WheelGroups | null) => void;
};

export function CarModel({ url, wireframe = false, simplified = false, onWheels }: CarModelProps) {
  const { scene } = useCarGltf(url);

  const { car, wheels } = useMemo(() => {
    const car = scene.clone(true);

    // De-duplicate material instances across the clone, then treat each once.
    const treated = new Map<THREE.Material, THREE.Material>();
    car.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = list.map((m) => {
        if (!treated.has(m)) treated.set(m, treatMaterialSafe(m, simplified));
        return treated.get(m)!;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });

    // Normalise scale + ground the car, so scene code can work in real metres.
    const raw = new THREE.Box3().setFromObject(car);
    const size = raw.getSize(new THREE.Vector3());
    const scale = MODEL_3_LENGTH_M / Math.max(size.x, size.y, size.z);
    car.scale.setScalar(scale);
    car.updateMatrixWorld(true);

    const scaled = new THREE.Box3().setFromObject(car);
    const centre = scaled.getCenter(new THREE.Vector3());
    car.position.x -= centre.x;
    car.position.z -= centre.z;
    car.position.y -= scaled.min.y;
    car.updateMatrixWorld(true);

    return { car, wheels: buildWheelGroups(car) };
  }, [scene, simplified]);

  useEffect(() => {
    onWheels?.(wheels);
  }, [wheels, onWheels]);

  useEffect(() => {
    car.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of list) (m as THREE.MeshStandardMaterial).wireframe = wireframe;
    });
  }, [car, wireframe]);

  return <primitive object={car} />;
}

/** Guards against a treatment throwing on an unexpected material class. */
function treatMaterialSafe(m: THREE.Material, simplified: boolean) {
  try {
    return treatMaterial(m, simplified);
  } catch {
    return m;
  }
}

useGLTF.preload('/models/tesla-model-3.glb', DRACO_PATH);
