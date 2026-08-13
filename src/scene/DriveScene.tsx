/**
 * The 3D layer: a fixed, full-viewport canvas that the document scrolls over.
 *
 * Everything here is lazy-loaded (see SceneLayer.tsx) so three.js never blocks
 * first paint. The canvas itself is `position: fixed` and pointer-events: none;
 * it is scenery, not a control surface, and it must never eat a scroll gesture
 * or a tap on a link above it.
 */
import { ContactShadows } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useCallback, useRef } from 'react';
import * as THREE from 'three';

import type { Capability } from '@/lib/capability';
import { CameraRig, type SampledDrive } from '@/scene/CameraRig';
import { CarModel, type WheelGroups } from '@/scene/CarModel';
import { Road } from '@/scene/Road';
import { sceneReady } from '@/scene/sceneReady';
import { StudioEnvironment } from '@/scene/StudioEnvironment';

type Props = { capability: Capability };

/**
 * Applies the sampled drive state to the car: wheel rotation, steering, and
 * body pitch. Split out from CameraRig so the camera has no opinion about the
 * car's rig and vice versa.
 */
function CarRig({
  capability,
  driveRef,
  speedRef,
}: {
  capability: Capability;
  driveRef: React.RefObject<SampledDrive>;
  speedRef: React.RefObject<number>;
}) {
  const wheels = useRef<WheelGroups | null>(null);
  const radius = useRef(0.34);
  const body = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const loaded = useRef(false);
  const announced = useRef(false);

  const onWheels = useCallback((groups: WheelGroups | null) => {
    wheels.current = groups;
    // Fires once the GLB has been parsed, whether or not a rig came out of it.
    loaded.current = true;
    if (!groups) return;
    // Derive the rolling radius from the model rather than assuming a tyre
    // size, so wheel spin stays correct if the model is ever swapped.
    const box = new THREE.Box3().setFromObject(groups.frontLeft);
    const size = box.getSize(new THREE.Vector3());
    radius.current = Math.max(size.y, size.z) / 2 || 0.34;

    for (const key of ['frontLeft', 'frontRight'] as const) {
      // Steer (Y) must be the outer rotation and spin (X) the inner one, or
      // the wheel spins about a tilted axle once it is turned.
      groups[key].rotation.order = 'YXZ';
    }
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);

    // Announce from inside the loop, not from onWheels: by the time a frame
    // runs, the decode, texture upload and shader compile are all behind us, so
    // this is the first moment the car is genuinely on screen rather than
    // merely downloaded. The boot gate waits on it.
    if (loaded.current && !announced.current) {
      announced.current = true;
      sceneReady.mark();
    }

    const drive = driveRef.current;
    if (!drive) return;

    speedRef.current = drive.speed;

    if (wheels.current) {
      // Negative: rotating a wheel positively about +X carries its top toward
      // +Z, and a rolling wheel's top travels the way the car does, so forward
      // (−Z, per keyframes.ts) is a negative spin.
      spin.current -= (drive.speed / radius.current) * dt;
      const steer = THREE.MathUtils.degToRad(drive.steer);
      for (const key of ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'] as const) {
        const wheel = wheels.current[key];
        wheel.rotation.x = spin.current;
        if (key.startsWith('front')) wheel.rotation.y = steer;
      }
    }

    if (body.current) {
      body.current.rotation.x = THREE.MathUtils.degToRad(drive.pitch);
    }
  });

  return (
    <group ref={body}>
      <CarModel
        url={capability.modelUrl}
        simplified={capability.tier === 'lite'}
        onWheels={onWheels}
      />
    </group>
  );
}

export default function DriveScene({ capability }: Props) {
  const drive = useRef<SampledDrive>({ speed: 0, pitch: 0, steer: 0, lights: 1, progress: 0 });
  const speed = useRef(0);
  const simplified = capability.tier === 'lite';

  const onSample = useCallback((sample: SampledDrive) => {
    drive.current = sample;
  }, []);

  return (
    <Canvas
      className="!pointer-events-none"
      shadows={capability.shadows}
      dpr={[1, capability.maxDpr]}
      gl={{
        // MSAA on both tiers. Turning it off was the wrong economy on a phone:
        // mobile GPUs are tile-based, so multisampling happens inside tile
        // memory and resolves on write-out; it does not multiply bandwidth the
        // way it does on a desktop immediate-mode GPU. What it buys is the
        // whole silhouette of a white car against a near-black page, plus every
        // panel-gap and pillar edge, holding still instead of crawling as the
        // camera moves. Aliased edges on a moving object read as the surface
        // boiling, which is most of what "melting" describes.
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        // ACES rolls highlights off hard, which on a white car against a
        // near-black page reads as grey. Exposure above 1 puts the paint back
        // where it belongs without blowing out the specular streaks.
        toneMappingExposure: 1.45,
      }}
      camera={{ fov: 32, near: 0.1, far: 220, position: [-5.6, 1.75, -6.6] }}
      // The scene is scenery, never a control surface: it must not intercept a
      // scroll gesture or a tap on a link sitting above it.
      style={{ pointerEvents: 'none' }}
    >
      <color attach="background" args={['#060809']} />
      {/* Fog hides the far edge of the ground plane so the road reads as
          endless rather than as a 90m square floating in the dark. */}
      <fog attach="fog" args={['#060809', 14, 46]} />

      <Suspense fallback={null}>
        <CarRig capability={capability} driveRef={drive} speedRef={speed} />
        <Road speedRef={speed} simplified={simplified} />
        <StudioEnvironment simplified={simplified} />
        <ContactShadows
          position={[0, 0.012, 0]}
          scale={14}
          resolution={simplified ? 256 : 1024}
          blur={2.4}
          opacity={0.75}
          far={4}
          frames={simplified ? 1 : Infinity}
        />
      </Suspense>

      <CameraRig staticCamera={capability.staticCamera} onSample={onSample} />
    </Canvas>
  );
}
