/**
 * Renders the car alone, at STATIC_FRAMING, with no UI over it.
 *
 * This page exists purely so `npm run hero` can photograph it. The result is
 * the image shown to anyone who gets no WebGL at all. Generating the fallback
 * from the same model, lighting rig and camera as the live scene is the point:
 * a hand-picked stock render would drift out of sync the first time the
 * lighting is touched.
 *
 * Not part of the production build; static-hero.html is left out of rollup's
 * inputs.
 */
import { ContactShadows } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';

import { CarModel } from '@/scene/CarModel';
import { CameraRig } from '@/scene/CameraRig';
import { Road } from '@/scene/Road';
import { StudioEnvironment } from '@/scene/StudioEnvironment';

const stillSpeed = { current: 0 };

function Scene() {
  return (
    <Canvas
      shadows
      dpr={2}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }}
      camera={{ fov: 32, near: 0.1, far: 220 }}
      style={{ width: '100vw', height: '100vh' }}
    >
      <color attach="background" args={['#060809']} />
      <fog attach="fog" args={['#060809', 14, 46]} />
      <Suspense fallback={null}>
        <CarModel url="/models/tesla-model-3.glb" />
        <Road speedRef={stillSpeed} />
        <StudioEnvironment />
        <ContactShadows position={[0, 0.012, 0]} scale={14} resolution={1024} blur={2.4} opacity={0.75} far={4} />
      </Suspense>
      <CameraRig staticCamera />
    </Canvas>
  );
}

createRoot(document.getElementById('root')!).render(<Scene />);
