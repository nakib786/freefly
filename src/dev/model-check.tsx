/**
 * Dev-only harness for eyeballing the decimated GLB. Not part of the production
 * build; `model-check.html` is deliberately left out of rollup's inputs.
 *
 * Run `npm run dev` and open /model-check.html. Compare source vs. high vs. low
 * at the angles the real camera path actually uses.
 */
import { OrbitControls, Stats } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';

import { CarModel, useCarGltf, type WheelGroups } from '@/scene/CarModel';
import { StudioEnvironment } from '@/scene/StudioEnvironment';
import '@/styles/index.css';

const SOURCES = {
  high: '/models/tesla-model-3.glb',
  low: '/models/tesla-model-3-low.glb',
  source: '/src-model/tesla-model-3-ameer.glb',
} as const;

type SourceKey = keyof typeof SOURCES;

/** Camera presets matching the four scroll scenes, so what I check is what ships. */
const VIEWS = {
  'hero / wheel': { pos: [1.9, 0.85, 2.4], target: [0.55, 0.5, 0.9] },
  'hero / charge port': { pos: [-1.5, 1.05, -2.6], target: [-0.75, 0.85, -1.5] },
  'three-quarter': { pos: [5.2, 1.9, 5.6], target: [0, 0.7, 0] },
  'alongside': { pos: [7.5, 1.2, 0.2], target: [0, 0.75, 0] },
  'front-on': { pos: [0.1, 1.15, 7.2], target: [0, 0.8, 0] },
  'hood curve': { pos: [1.2, 1.5, 3.6], target: [0, 0.85, 1.6] },
} as const;

type ViewKey = keyof typeof VIEWS;

function ApplyView({ view }: { view: ViewKey }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update(): void } | null;
  useEffect(() => {
    const { pos, target } = VIEWS[view];
    camera.position.set(...(pos as unknown as [number, number, number]));
    if (controls) {
      controls.target.set(...(target as unknown as [number, number, number]));
      controls.update();
    }
  }, [view, camera, controls]);
  return null;
}

function Readout({ src }: { src: string }) {
  const { scene } = useCarGltf(src);
  const stats = useMemo(() => {
    let tris = 0;
    let meshes = 0;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes += 1;
      const idx = m.geometry.getIndex();
      tris += (idx ? idx.count : m.geometry.getAttribute('position').count) / 3;
    });
    return { tris: Math.round(tris), meshes };
  }, [scene]);

  return (
    <div className="type-telemetry pointer-events-none absolute right-4 bottom-4 text-right text-aurora">
      {stats.tris.toLocaleString()} tris / {stats.meshes} draw calls
    </div>
  );
}

/**
 * Exposes the harness controls on `window` so captures can be driven from a
 * headless context, because the browser pane here can't composite frames for a normal
 * screenshot, so renders are pulled out of the drawing buffer instead.
 */
function CaptureBridge(controls: {
  setSource: (k: SourceKey) => void;
  setView: (k: ViewKey) => void;
  setWire: (v: boolean) => void;
}) {
  return function Bridge() {
    const gl = useThree((s) => s.gl);
    const scene = useThree((s) => s.scene);
    const camera = useThree((s) => s.camera);

    // R3F draws on requestAnimationFrame, which never fires when the page is
    // not being composited, and its ResizeObserver never sizes the canvas past
    // the 300x150 default. A timer plus an explicit setSize sidesteps both, so
    // toDataURL() captures work in a headless pane.
    useEffect(() => {
      const [W, H] = [1600, 1000];
      const tick = () => {
        if (gl.domElement.width !== W) {
          gl.setSize(W, H, false);
          const cam = camera as THREE.PerspectiveCamera;
          cam.aspect = W / H;
          cam.updateProjectionMatrix();
        }
        gl.render(scene, camera);
      };
      const id = setInterval(tick, 200);
      return () => clearInterval(id);
    }, [gl, scene, camera]);

    useEffect(() => {
      Object.assign(window as never, {
        __ff: {
          ...controls,
          views: Object.keys(VIEWS),
          sources: Object.keys(SOURCES),
          async capture(name: string) {
            gl.render(scene, camera);
            const png = gl.domElement.toDataURL('image/png');
            const res = await fetch('/dev-capture', {
              method: 'POST',
              body: JSON.stringify({ name, png }),
            });
            return res.json();
          },
        },
      });
    }, [gl, scene, camera]);
    return null;
  };
}

function App() {
  const [source, setSource] = useState<SourceKey>('high');
  const [view, setView] = useState<ViewKey>('hero / wheel');
  const [wire, setWire] = useState(false);
  const [bg, setBg] = useState('#0d1118');

  const Bridge = useMemo(() => CaptureBridge({ setSource, setView, setWire }), []);

  /**
   * Publishes the resolved wheel rig on `window.__wheels`, in world metres.
   * The rig is derived from mesh bounds rather than authored pivots (the GLB has
   * none; see CarModel), so "did it find four wheels, and are they at the four
   * corners" is worth being able to check directly instead of inferring it from
   * a still frame, where a mis-placed pivot only shows up once it rotates.
   */
  const onWheels = useCallback((groups: WheelGroups | null) => {
    const report =
      groups &&
      Object.fromEntries(
        Object.entries(groups).map(([corner, pivot]) => [
          corner,
          {
            world: pivot
              .getWorldPosition(new THREE.Vector3())
              .toArray()
              .map((n) => +n.toFixed(3)),
            meshes: pivot.children.length,
          },
        ]),
      );
    Object.assign(window as never, { __wheels: report });
    console.info('[model-check] wheel rig', report);
  }, []);

  return (
    <div className="fixed inset-0">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          preserveDrawingBuffer: true,
        }}
        camera={{ fov: 32, near: 0.1, far: 200 }}
      >
        <Bridge />
        <color attach="background" args={[bg]} />
        <Suspense fallback={null}>
          <CarModel key={source} url={SOURCES[source]} wireframe={wire} onWheels={onWheels} />
          <StudioEnvironment />
        </Suspense>
        <OrbitControls makeDefault target={[0, 0.7, 0]} />
        <ApplyView view={view} />
        <Stats />
      </Canvas>

      <div className="type-telemetry absolute top-4 left-4 flex flex-col gap-3 text-bone">
        <div className="flex gap-2">
          {(Object.keys(SOURCES) as SourceKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSource(k)}
              className={`border px-3 py-2 ${source === k ? 'border-aurora text-aurora' : 'border-ink-600 text-bone-dim'}`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(VIEWS) as ViewKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`border px-3 py-2 ${view === k ? 'border-aurora text-aurora' : 'border-ink-600 text-bone-dim'}`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setWire((w) => !w)}
            className={`border px-3 py-2 ${wire ? 'border-ember text-ember' : 'border-ink-600 text-bone-dim'}`}
          >
            wireframe
          </button>
          {['#0d1118', '#8b8b8b', '#f2f2f2'].map((c) => (
            <button
              key={c}
              onClick={() => setBg(c)}
              className={`h-9 w-9 border ${bg === c ? 'border-aurora' : 'border-ink-600'}`}
              style={{ background: c }}
              aria-label={`background ${c}`}
            />
          ))}
        </div>
      </div>

      <Suspense fallback={null}>
        <Readout src={SOURCES[source]} />
      </Suspense>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
