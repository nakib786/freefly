/**
 * Turns scroll progress into a camera position, orientation and car state.
 *
 * Reads nothing but KEYFRAMES — every angle, timing and framing decision lives
 * in keyframes.ts. See that file's header for how to tune the sequence.
 *
 * Positions and look-at targets are sampled from Catmull-Rom splines through
 * the keyframe points rather than lerped segment by segment. Straight lerping
 * makes the camera change direction abruptly at each keyframe; a spline arcs
 * through them, which is what makes the move read as a camera operator rather
 * than a slideshow. Timing is still piecewise-linear against the `at` values,
 * so the spline smooths the *path* without stealing control of the *schedule*.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { damp, driveState } from '@/scene/driveState';
import {
  KEYFRAMES,
  STATIC_FRAMING,
  type CameraFraming,
  type CarState,
} from '@/scene/keyframes';
import { timings } from '@/scene/timing';

/** Reusable scratch objects — allocating inside useFrame would churn the GC. */
const scratch = {
  position: new THREE.Vector3(),
  lookAt: new THREE.Vector3(),
  forward: new THREE.Vector3(),
  right: new THREE.Vector3(),
  up: new THREE.Vector3(0, 1, 0),
  panOffset: new THREE.Vector3(),
};

export type SampledDrive = CarState & { progress: number };

type Props = {
  /** Frozen framing instead of a scrubbed path (reduced motion / low power). */
  staticCamera?: boolean;
  /** Called every frame with the interpolated car state. */
  onSample?: (state: SampledDrive) => void;
};

function resolveFraming(isMobile: boolean): CameraFraming[] {
  return KEYFRAMES.map((kf) => ({ ...kf.camera, ...(isMobile ? kf.mobile : undefined) }));
}

export function CameraRig({ staticCamera = false, onSample }: Props) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const isMobile = useThree((s) => s.size.width) <= 900;

  const rig = useMemo(() => {
    const framings = resolveFraming(isMobile);
    return {
      framings,
      positionCurve: new THREE.CatmullRomCurve3(
        framings.map((f) => new THREE.Vector3(...f.position)),
        false,
        'catmullrom',
        0.5,
      ),
      lookAtCurve: new THREE.CatmullRomCurve3(
        framings.map((f) => new THREE.Vector3(...f.lookAt)),
        false,
        'catmullrom',
        0.5,
      ),
    };
  }, [isMobile]);

  const applied = useRef(false);

  useFrame((_, delta) => {
    // delta can spike hugely after a background tab regains focus; clamping
    // stops the camera from teleporting on the first frame back.
    const dt = Math.min(delta, 1 / 20);

    if (staticCamera) {
      if (!applied.current) {
        applyFraming(camera, STATIC_FRAMING);
        applied.current = true;
        onSample?.({ ...KEYFRAMES[0].car, lights: 1.3, progress: 0 });
      }
      return;
    }
    applied.current = false;

    driveState.value = damp(driveState.value, driveState.target, 6, dt);
    const p = THREE.MathUtils.clamp(driveState.value, 0, 1);

    const { index, local } = locate(p);
    const eased = smootherstep(local);

    // Spline parameter: piecewise-linear in keyframe index, so `at` still owns
    // the timing while the curve owns the shape of the path.
    const u = (index + eased) / (KEYFRAMES.length - 1);

    rig.positionCurve.getPoint(u, scratch.position);
    rig.lookAtCurve.getPoint(u, scratch.lookAt);

    const a = rig.framings[index];
    const b = rig.framings[Math.min(index + 1, rig.framings.length - 1)];
    const fov = THREE.MathUtils.lerp(a.fov, b.fov, eased);
    const panX = THREE.MathUtils.lerp(a.pan?.[0] ?? 0, b.pan?.[0] ?? 0, eased);
    const panY = THREE.MathUtils.lerp(a.pan?.[1] ?? 0, b.pan?.[1] ?? 0, eased);

    // Pan translates camera and target together, so it reframes without
    // changing what the shot is pointed at.
    scratch.forward.subVectors(scratch.lookAt, scratch.position).normalize();
    scratch.right.crossVectors(scratch.forward, scratch.up).normalize();
    scratch.panOffset.set(0, 0, 0).addScaledVector(scratch.right, panX).addScaledVector(scratch.up, panY);

    camera.position.copy(scratch.position).add(scratch.panOffset);
    camera.lookAt(scratch.lookAt.add(scratch.panOffset));

    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const carA = KEYFRAMES[index].car;
    const carB = KEYFRAMES[Math.min(index + 1, KEYFRAMES.length - 1)].car;
    onSample?.({
      speed: THREE.MathUtils.lerp(carA.speed, carB.speed, eased),
      pitch: THREE.MathUtils.lerp(carA.pitch, carB.pitch, eased),
      steer: THREE.MathUtils.lerp(carA.steer, carB.steer, eased),
      lights: THREE.MathUtils.lerp(carA.lights, carB.lights, eased),
      progress: p,
    });
  });

  return null;
}

/* ------------------------------------------------------------------ utils -- */

/**
 * Which keyframe segment `p` falls in, and how far through it. Reads the
 * measured timings rather than the authored `at` values — see timing.ts.
 */
function locate(p: number) {
  for (let i = KEYFRAMES.length - 2; i >= 0; i--) {
    const start = timings[i];
    if (p >= start) {
      const span = timings[i + 1] - start;
      return { index: i, local: span > 0 ? (p - start) / span : 0 };
    }
  }
  return { index: 0, local: 0 };
}

/** Ken Perlin's smootherstep — zero 1st and 2nd derivative at both ends. */
function smootherstep(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function applyFraming(camera: THREE.PerspectiveCamera, framing: CameraFraming) {
  const position = new THREE.Vector3(...framing.position);
  const lookAt = new THREE.Vector3(...framing.lookAt);
  const forward = new THREE.Vector3().subVectors(lookAt, position).normalize();
  const right = new THREE.Vector3().crossVectors(forward, scratch.up).normalize();
  const pan = new THREE.Vector3()
    .addScaledVector(right, framing.pan?.[0] ?? 0)
    .addScaledVector(scratch.up, framing.pan?.[1] ?? 0);

  camera.position.copy(position).add(pan);
  camera.lookAt(lookAt.add(pan));
  camera.fov = framing.fov;
  camera.updateProjectionMatrix();
}
