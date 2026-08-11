/**
 * Lighting rig for the car.
 *
 * Built from Lightformers rather than a drei `preset`, because the presets pull
 * HDRIs from a CDN at runtime — an external request the deploy has no control
 * over, and a blocking one at that. Everything here is generated in-process.
 *
 * The shape of the rig is the standard automotive one: two long, narrow strip
 * lights running the length of the car just above the beltline. Those are what
 * produce the continuous highlight streak down the flank that reads as "car
 * photography" — a point light or a plain ambient never does. The green kicker
 * on the near side ties the render to the site's aurora accent so the 3D layer
 * and the HTML layer look like the same design, not a widget dropped into a page.
 */
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';

type Props = {
  /** Drops the strip-light count and shadow work for the low-power path. */
  simplified?: boolean;
};

export function StudioEnvironment({ simplified = false }: Props) {
  return (
    <>
      <Environment resolution={simplified ? 128 : 256} environmentIntensity={1.45}>
        {/* Deep cold base so unlit surfaces never go flat black. */}
        <Lightformer
          form="rect"
          intensity={0.35}
          color="#1b2634"
          scale={[40, 40, 1]}
          position={[0, 4, -18]}
        />

        {/* Key: broad overhead softbox. */}
        <Lightformer
          form="rect"
          intensity={3.4}
          color="#ffffff"
          scale={[12, 7, 1]}
          position={[0, 9, 1]}
          rotation={[-Math.PI / 2, 0, 0]}
        />

        {/* Front fill. The camera spends most of the sequence ahead of the car,
            and without this the nose and bumper fall into shadow — which is
            what made the hero read as a charcoal car rather than a white one. */}
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#f2f6ff"
          scale={[9, 4, 1]}
          position={[-1.5, 2.6, -9]}
        />

        {/* The flank streaks. Long, thin, and close — this is the whole trick. */}
        <Lightformer
          form="rect"
          intensity={3.4}
          color="#dfeaff"
          scale={[0.6, 14, 1]}
          position={[5.5, 3.4, 0]}
          rotation={[0, -Math.PI / 2, 0]}
        />
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#cfe2ff"
          scale={[0.5, 12, 1]}
          position={[-5.5, 3.0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        />

        {/* Aurora kicker — the site's accent catching the rear haunch only. Kept
            deliberately weak and short: at full strength it washes the entire
            flank green and the car stops reading as white. */}
        <Lightformer
          form="rect"
          intensity={0.6}
          color="#4fe0a6"
          scale={[0.4, 3.5, 1]}
          position={[3.2, 1.0, -3.6]}
          rotation={[0, -Math.PI / 2.6, 0]}
        />

        {/* Warm rim from behind, separating the boot from the background. */}
        <Lightformer
          form="rect"
          intensity={0.9}
          color="#ffd2bb"
          scale={[6, 1.0, 1]}
          position={[-1.5, 2.2, -6.5]}
          rotation={[0, Math.PI, 0]}
        />

        {!simplified && (
          <>
            <Lightformer
              form="ring"
              intensity={1.1}
              color="#ffffff"
              scale={[3, 3, 1]}
              position={[-3.5, 5, 4]}
            />
            <Lightformer
              form="rect"
              intensity={1.0}
              color="#9fd8ff"
              scale={[7, 0.5, 1]}
              position={[0, 0.15, 5.5]}
            />
          </>
        )}
      </Environment>

      {/* A single real light for contact shadows; the rest is image-based. */}
      <directionalLight
        castShadow={!simplified}
        position={[4.5, 8, 3]}
        intensity={1.5}
        color="#eaf2ff"
        shadow-mapSize={simplified ? 512 : 2048}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-6, 6, 6, -6, 0.5, 30]} />
      </directionalLight>

      <hemisphereLight args={[new THREE.Color('#22303f'), new THREE.Color('#05070a'), 0.55]} />
    </>
  );
}
