/**
 * Tesla Model 3 loader + material treatment.
 *
 * ─── Asset provenance ──────────────────────────────────────────────────────
 * "Tesla 2018 Model 3" by Ameer Studio — Sketchfab, CC-BY 4.0
 * https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f
 *
 * The visitor-facing side of that licence is /credits (src/credits/), which
 * publishes the attribution, the list of modifications below, and the original
 * file. src/data/credits.ts is the single copy of those facts — edit them there.
 *
 * Source GLB: 684,315 tris / 394,055 verts / 176 meshes / 58 materials, 21.6 MB.
 * Shipped GLB: 366,721 tris, 1.49 MB (desktop) / 291,534 tris, 1.18 MB (mobile).
 *
 * Produced by `npm run model:optimize` (scripts/optimize-model.mjs), which is
 * the authoritative record of the pipeline. In short, per LOD:
 *
 *   1. dedup()  — collapse duplicate accessors/materials/textures
 *   2. weld()   — index and merge coincident vertices (required before simplify)
 *   3. simplifyPrimitive() per primitive, meshoptimizer, ratio+error by tier:
 *        shell  (paint, glass, lights)  not decimated, either LOD
 *        wheels (rims, tyres, hubs)     not decimated / 0.45 on mobile
 *        trim   (black plastics, misc)  ratio 0.18 / 0.08
 *        cabin  (seats, carpet, wheel)  ratio 0.08 / 0.04
 *        hidden (chassis, suspension)   ratio 0.06 / 0.03
 *      Primitives under 128 tris are left alone so badges and handles survive.
 *   4. sharp: 22 PNGs -> WebP @ q82, capped at 1024px (1.56 MB -> 0.20 MB)
 *   5. prune() then Draco EDGEBREAKER, quantisation P14/N10/UV12
 *
 * Tiering rather than one global ratio is the whole trick here: the cabin is
 * ~32% of the source triangles and is only ever seen through tinted glass, so
 * cutting it to 4-8% is what pays for leaving the body panels and wheels — the
 * surfaces the hero camera sits right on top of — completely alone.
 *
 * On the triangle count: this lands well above a 30-50k budget, and that is a
 * deliberate, measured call rather than a miss. Decimating the shell at all is
 * what made the paint look dented — meshoptimizer bounds positional error and
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
};

const isPaint = (name: string) => /^primary/.test(name);
const isGlass = (name: string) => /^glass/.test(name);
/** Chrome/brightwork. `movsteer_1.0.1` is the export's shared polished-metal slot. */
const isChrome = (name: string) => /(chrome|aluminium|movsteer_1\.0\.1|mirror_inside)/i.test(name);

function treatMaterial(src: THREE.Material): THREE.Material {
  const name = src.name ?? '';
  const std = src as THREE.MeshStandardMaterial;

  if (isPaint(name)) {
    // Keep whatever base-colour/normal detail the panel carried (the sill and
    // door slots have maps with panel detail in them) but drive colour and
    // finish from PAINT, so `primary.004` — which exports as vivid chartreuse —
    // can't leak a green door panel into the render.
    const paint = new THREE.MeshPhysicalMaterial({ name, ...PAINT });
    paint.map = std.map ?? null;
    paint.normalMap = std.normalMap ?? null;
    return paint;
  }

  if (isGlass(name)) {
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

  if (isChrome(name)) {
    std.metalness = 0.95;
    std.roughness = 0.18;
    std.envMapIntensity = 1.5;
    return std;
  }

  // Lit elements are identified from the data, not the name: eight materials in
  // this GLB carry an emissive map (headlights, tail bar, indicators, LCDs).
  // Name matching would wrongly catch `black_lights` and `aluminium_light`,
  // which are the dark housing and the reflector — making those glow looks
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
 * The GLB has no wheel pivots — every wheel mesh is baked into one flat parent
 * chain, and the mesh names (`hub_lf`, `wheels`, `wheels.001`) do not map
 * cleanly onto four corners. So wheels are found by name, then bucketed by
 * their *world* position into four quadrants, and each bucket is re-parented to
 * a group placed at that bucket's centre. Rotating the group then spins the
 * wheel about its real axle.
 */
function buildWheelGroups(root: THREE.Object3D): WheelGroups | null {
  root.updateWorldMatrix(true, true);

  const parts: { mesh: THREE.Object3D; centre: THREE.Vector3 }[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    if (!/^(hub_|wheels)/i.test(o.name)) return;
    const box = new THREE.Box3().setFromObject(o);
    parts.push({ mesh: o, centre: box.getCenter(new THREE.Vector3()) });
  });
  if (parts.length < 4) return null;

  const bounds = new THREE.Box3().setFromObject(root);
  const mid = bounds.getCenter(new THREE.Vector3());

  const buckets: Record<keyof WheelGroups, typeof parts> = {
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
    const centre = bucket
      .reduce((acc, p) => acc.add(p.centre), new THREE.Vector3())
      .divideScalar(bucket.length);

    const pivot = new THREE.Group();
    pivot.name = `wheel-${key}`;
    root.add(pivot);
    // `centre` is a world-space point, but position is expressed in the
    // parent's local space — and `root` carries the import normalisation
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
  onWheels?: (wheels: WheelGroups | null) => void;
};

export function CarModel({ url, wireframe = false, onWheels }: CarModelProps) {
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
        if (!treated.has(m)) treated.set(m, treatMaterialSafe(m));
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
  }, [scene]);

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
function treatMaterialSafe(m: THREE.Material) {
  try {
    return treatMaterial(m);
  } catch {
    return m;
  }
}

useGLTF.preload('/models/tesla-model-3.glb', DRACO_PATH);
