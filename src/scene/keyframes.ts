/**
 * The drive sequence, as data.
 *
 * ─── How to tune this ──────────────────────────────────────────────────────
 * Everything about the camera move lives in KEYFRAMES below. Nothing else in
 * the scene hardcodes a camera number. To adjust the sequence you only ever
 * edit this file:
 *
 *   anchor    id of the section this beat belongs to. When present, the beat's
 *             real timing is MEASURED from that element's position on the page
 *             (see timing.ts), so adding copy or renaming a plan retimes the
 *             sequence automatically instead of silently desynchronising the
 *             camera from what the reader is looking at.
 *   at        fallback timing, 0 (page top) to 1 (page bottom), used only if
 *             the anchor element is missing. Must ascend.
 *   position  camera position in metres, world space.
 *   lookAt    what it points at.
 *   fov       vertical field of view. Lower = longer lens = flatter, more
 *             "product shot"; higher = wider, more dramatic near the car.
 *   pan       framing offset in metres along the camera's own right/up axes,
 *             applied after position+lookAt. This is how the car is pushed off
 *             centre to leave room for the copy. Positive x moves the *camera*
 *             right, so the car slides LEFT on screen; positive y raises the
 *             camera, so the car slides DOWN. The sequence alternates which
 *             side the car sits on rather than parking it in one place, so the
 *             page does not settle into a single repeated split.
 *   mobile    partial override merged over the desktop values under ~900px.
 *
 * ─── Coordinate system ─────────────────────────────────────────────────────
 * The car sits at the origin and never translates. Its nose points along −Z,
 * its roof along +Y, and tyre contact is y = 0 (CarModel normalises the import
 * to guarantee this). So:
 *
 *     −Z  in front of the car        +Z  behind it
 *     −X  driver's side (LHD)        +X  passenger side
 *
 * The car staying put is deliberate. Moving it through the world over a long
 * page accumulates float error, drags the lighting rig and shadow frustum along
 * with it, and couples drive distance to copy length: add a section and the
 * whole path needs retiming. Instead the *road* scrolls beneath it, the wheels
 * spin, and the body pitches. Visually identical, far less to fight.
 */

export type SceneId = 'standstill' | 'pullout' | 'cruise' | 'approach' | 'parked';

export type CameraFraming = {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  pan?: [number, number];
};

export type CarState = {
  /** Ground speed, m/s. Drives wheel spin and road scroll, nothing else. */
  speed: number;
  /** Body pitch, degrees. Negative = nose down (braking), positive = squat. */
  pitch: number;
  /** Front wheel steering angle, degrees. */
  steer: number;
  /** Headlight and tail-light emissive multiplier. */
  lights: number;
};

export type Keyframe = {
  id: SceneId;
  /** Shown in the nav's scene readout. */
  label: string;
  /** DOM id of the section this beat is tied to. */
  anchor?: string;
  at: number;
  camera: CameraFraming;
  car: CarState;
  mobile?: Partial<CameraFraming>;
};

export const KEYFRAMES: readonly Keyframe[] = [
  {
    id: 'standstill',
    label: 'Standstill',
    anchor: 'top',
    at: 0,
    // Low and close on the driver's-side front corner: headlight, arch, wheel.
    // Long lens so the panel curve reads rather than the perspective.
    camera: {
      position: [-2.85, 0.72, -4.15],
      lookAt: [-0.55, 0.62, -1.15],
      fov: 28,
      // Car sits right of centre; the hero headline runs down the left.
      pan: [-1.0, 0.02],
    },
    car: { speed: 0, pitch: 0, steer: 0, lights: 1 },
    // Mobile pans are positive-y throughout: the copy runs full-width on a
    // phone, so the car is pushed DOWN out from under it rather than sideways.
    mobile: { position: [-2.5, 0.9, -4.9], fov: 36, pan: [0, 0.5] },
  },
  {
    id: 'pullout',
    label: 'Pull out',
    anchor: 'why-tesla',
    at: 0.28,
    // Pull back and up into a front three-quarter as the car gets under way.
    camera: {
      // Kept near the car's own beltline. Anything above ~1.8m starts looking
      // down onto the roof, which reads as a configurator screenshot rather
      // than a photograph.
      position: [-6.4, 1.45, -6.9],
      lookAt: [0, 0.8, -0.2],
      fov: 33,
      // Flips to the left so "Why a Tesla" reads down the right-hand side.
      pan: [1.7, 0],
    },
    car: { speed: 7, pitch: 0.7, steer: -4, lights: 1 },
    mobile: { position: [-6.9, 1.6, -7.6], fov: 38, pan: [0, 0.6] },
  },
  {
    id: 'cruise',
    label: 'Cruise',
    anchor: 'lessons',
    at: 0.55,
    // Side-on tracking shot at door height; the plans section runs alongside.
    camera: {
      position: [-8.6, 1.18, 0.55],
      lookAt: [0, 0.82, 0],
      fov: 36,
      // Plans is the densest section, so the car drops to a band along the
      // bottom rather than competing with the pricing grid. 0.78 did not
      // actually get it there: at this distance and fov one metre of pan is
      // only ~18% of the frame, so it left the car sitting across the middle of
      // the pricing columns. 1.9 is what puts its roof line under them.
      pan: [0, 1.9],
    },
    car: { speed: 14, pitch: 0, steer: 0, lights: 1 },
    mobile: { position: [-10.5, 1.5, 0.4], fov: 40, pan: [0, 2.2] },
  },
  {
    id: 'approach',
    label: 'Approach',
    anchor: 'instructors',
    at: 0.79,
    // Swings back around the nose as the car slows for the kerb.
    camera: {
      position: [-4.35, 1.3, -6.2],
      lookAt: [0, 0.78, -0.35],
      fov: 31,
      // Instructors has no free side: the portrait takes the left, the bio and
      // review evidence take the right. So the car goes under both rather than
      // beside either; the sideways offset is kept only so its nose is not
      // centred directly beneath the bio paragraphs.
      pan: [-1.2, 1.15],
    },
    car: { speed: 5, pitch: -0.8, steer: 6, lights: 1 },
    mobile: { position: [-4.9, 1.45, -7.0], fov: 37, pan: [0, 1.5] },
  },
  {
    id: 'parked',
    label: 'Parked',
    anchor: 'contact',
    at: 1,
    // Settled, front-on, slightly below the badge line. Headlights up.
    camera: {
      position: [0.15, 1.02, -8.4],
      lookAt: [0, 0.78, -0.1],
      fov: 29,
      // Settles centred and low, under the contact details.
      pan: [0, 0.5],
    },
    car: { speed: 0, pitch: 0, steer: 0, lights: 1.6 },
    mobile: { position: [0.1, 1.15, -9.6], fov: 35, pan: [0, 0.55] },
  },
];

/** Static framing used for reduced-motion and low-power fallbacks. */
export const STATIC_FRAMING: CameraFraming = {
  position: [-5.6, 1.75, -6.6],
  lookAt: [0, 0.82, -0.1],
  fov: 32,
  pan: [1.1, 0],
};

if (import.meta.env.DEV) {
  for (let i = 1; i < KEYFRAMES.length; i++) {
    if (KEYFRAMES[i].at <= KEYFRAMES[i - 1].at) {
      console.error(
        `[keyframes] "at" must ascend: "${KEYFRAMES[i].id}" (${KEYFRAMES[i].at}) is not after "${KEYFRAMES[i - 1].id}" (${KEYFRAMES[i - 1].at}).`,
      );
    }
  }
}
