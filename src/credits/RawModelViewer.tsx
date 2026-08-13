/**
 * The 21.6 MB source GLB, shown exactly as it was downloaded.
 *
 * This module is only ever reached through a dynamic import fired by a click,
 * which is the whole point: three.js, drei and the model itself are together
 * about 23 MB, and nobody who came to read an attribution should pay for that.
 * Nothing in here may be imported from the credits page's static graph.
 *
 * "Raw" is meant literally. CarModel.tsx re-authors the paint, glass and
 * emissive slots before the car reaches the homepage, and per the note there,
 * some source materials (`primary.004`, `indicator_lr`) export with wrong
 * factors, so untreated panels may come through discoloured at some angles.
 * That is not a bug to fix here: this is the asset as Ameer Studio published
 * it, and the treated one is on the site. The only thing done to it below is
 * the import-scale normalisation, without which the car is ~525 units long and
 * sits off-camera.
 */
import { OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

import { mb, RAW_MODEL } from '@/data/credits';
import { StudioEnvironment } from '@/scene/StudioEnvironment';

/** Real Tesla Model 3 overall length, metres. Matches CarModel.tsx. */
const MODEL_3_LENGTH_M = 4.694;

type Stats = { tris: number; meshes: number; materials: number };

function measure(root: THREE.Object3D): Stats {
  let tris = 0;
  let meshes = 0;
  const materials = new Set<THREE.Material>();

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    const index = mesh.geometry.getIndex();
    tris += (index ? index.count : mesh.geometry.getAttribute('position').count) / 3;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m);
  });

  return { tris: Math.round(tris), meshes, materials: materials.size };
}

function RawCar({ onLoaded }: { onLoaded: (s: Stats) => void }) {
  // No Draco decoder path: the source export is uncompressed. Passing one is
  // harmless but would imply this file goes through the shipped pipeline.
  const { scene } = useGLTF(RAW_MODEL.url) as unknown as { scene: THREE.Group };

  const car = useMemo(() => {
    const car = scene.clone(true);

    const raw = new THREE.Box3().setFromObject(car);
    const size = raw.getSize(new THREE.Vector3());
    car.scale.setScalar(MODEL_3_LENGTH_M / Math.max(size.x, size.y, size.z));
    car.updateMatrixWorld(true);

    const scaled = new THREE.Box3().setFromObject(car);
    const centre = scaled.getCenter(new THREE.Vector3());
    car.position.x -= centre.x;
    car.position.z -= centre.z;
    car.position.y -= scaled.min.y;
    car.updateMatrixWorld(true);

    return car;
  }, [scene]);

  useEffect(() => {
    onLoaded(measure(car));
  }, [car, onLoaded]);

  return <primitive object={car} />;
}

/**
 * Download readout. drei's progress store is global and updates on every
 * onProgress tick, so this sits outside the Canvas as ordinary DOM. A
 * percentage rendered by WebGL that has not started yet would be a nonsense.
 */
function TransferReadout() {
  const { progress, loaded, total } = useProgress();
  const pct = Math.min(100, Math.round(progress));

  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex w-full max-w-[22rem] flex-col gap-3 px-6">
        <div className="type-telemetry flex items-baseline justify-between text-cream-faint">
          <span>Downloading</span>
          <span className="text-azure-bright">{pct}%</span>
        </div>
        <div
          className="h-px w-full bg-ink-700"
          role="progressbar"
          aria-label="Downloading the raw model"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-azure transition-[width] duration-300 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="type-telemetry text-cream-faint">
          {total > 0 ? `${mb(loaded)} of ${mb(total)}` : mb(RAW_MODEL.bytes)} · decoding may pause
          the tab
        </p>
      </div>
    </div>
  );
}

export default function RawModelViewer({ reducedMotion }: { reducedMotion: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);

  return (
    <div className="relative aspect-[4/3] w-full bg-ink-900 md:aspect-[16/10]">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ fov: 34, near: 0.1, far: 200, position: [5.4, 2, 5.8] }}
      >
        <Suspense fallback={null}>
          <RawCar onLoaded={setStats} />
          <StudioEnvironment />
        </Suspense>
        <OrbitControls
          makeDefault
          target={[0, 0.72, 0]}
          enablePan={false}
          minDistance={3}
          maxDistance={14}
          // Never let the camera go under the floor: there is no underside
          // worth seeing and it makes the car look like it is flying.
          maxPolarAngle={Math.PI / 2.08}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.4}
        />
      </Canvas>

      {!stats && <TransferReadout />}

      {stats && (
        <div className="type-telemetry pointer-events-none absolute right-4 bottom-4 text-right text-cream-faint">
          <span className="text-cream-dim">{stats.tris.toLocaleString()}</span> tris ·{' '}
          <span className="text-cream-dim">{stats.meshes}</span> meshes ·{' '}
          <span className="text-cream-dim">{stats.materials}</span> materials
        </div>
      )}

      <p className="type-telemetry pointer-events-none absolute bottom-4 left-4 text-cream-faint">
        Drag to orbit · scroll to zoom
      </p>
    </div>
  );
}
