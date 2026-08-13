/**
 * The ground, and the only thing in the scene that actually moves.
 *
 * Since the car stays at the origin (see keyframes.ts), motion has to come from
 * somewhere else: this plane's texture scrolls along Z at the car's speed, the
 * wheels spin to match, and between them the car reads as driving. Scrolling a
 * texture is also the cheapest possible way to do it: one uniform update per
 * frame, no geometry churn.
 *
 * The texture is drawn to a canvas at runtime rather than shipped as an image:
 * it is a few hundred lines of noise and two dashed lines, so a file would cost
 * a request and a download to deliver something generated in under a
 * millisecond, and it can be tuned in code rather than in an image editor.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Side length of the ground plane, metres. */
const PLANE = 90;
/** Metres covered by one repeat of the texture. Also the dash cycle length. */
const TILE = 15;

type Props = {
  /** Current ground speed in m/s, read every frame. */
  speedRef: React.RefObject<number>;
  simplified?: boolean;
};

function createRoadTexture(simplified: boolean) {
  const size = simplified ? 256 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Asphalt base.
  ctx.fillStyle = '#0a0d11';
  ctx.fillRect(0, 0, size, size);

  // Aggregate speckle. Wrapped deliberately at the edges so the repeat seam
  // does not show as a hard line when the texture scrolls.
  const grains = simplified ? 2500 : 9000;
  for (let i = 0; i < grains; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.6 + 0.2;
    const v = 14 + Math.random() * 26;
    ctx.fillStyle = `rgba(${v},${v - 1},${v},${0.35 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Two dashed lane lines, one either side of the car. Drawn dimmer than real
  // road paint; at full white they strobe distractingly once scrolling.
  const drawDashes = (u: number) => {
    const x = u * size;
    ctx.fillStyle = 'rgba(236, 232, 225, 0.42)';
    const dashLength = size * 0.22;
    const gap = size * 0.28;
    for (let y = -gap; y < size + gap; y += dashLength + gap) {
      ctx.fillRect(x - size * 0.006, y, size * 0.012, dashLength);
    }
  };
  drawDashes(0.5 - 2.05 / TILE);
  drawDashes(0.5 + 2.05 / TILE);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(PLANE / TILE, PLANE / TILE);
  texture.anisotropy = simplified ? 2 : 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function Road({ speedRef, simplified = false }: Props) {
  const texture = useMemo(() => createRoadTexture(simplified), [simplified]);
  const offset = useRef(0);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    // Divided by TILE because texture offset is in repeats, not metres.
    offset.current = (offset.current + ((speedRef.current ?? 0) * dt) / TILE) % 1;
    // The car's nose points along −Z (keyframes.ts), so the ground has to flow
    // toward +Z for the car to read as moving forward.
    //
    // Sign chain, because it inverts twice and guessing it gets you a car that
    // cruises backwards: the plane is rotated −90° about X, which maps texture
    // +V onto world −Z. Raising `offset.y` samples from higher V, so the pattern
    // appears to travel toward −V, which is world +Z. Increasing offset is
    // therefore forward, and the negation that used to be here was the bug.
    texture.offset.y = offset.current * texture.repeat.y;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={!simplified}>
      <planeGeometry args={[PLANE, PLANE]} />
      <meshStandardMaterial
        map={texture}
        color="#ffffff"
        roughness={0.72}
        metalness={0.12}
        envMapIntensity={0.35}
      />
    </mesh>
  );
}
