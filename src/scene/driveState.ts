/**
 * The bridge between GSAP ScrollTrigger and the render loop.
 *
 * A plain mutable module object rather than React state, on purpose: scroll
 * fires far more often than we ever want to re-render, and routing camera
 * progress through useState would re-render the whole tree on every scroll
 * pixel. ScrollTrigger writes `target` here; the render loop reads it and eases
 * `value` toward it inside useFrame. No React involved in the hot path.
 */
export const driveState = {
  /** Where the scroll position says we are, 0..1. Written by ScrollTrigger. */
  target: 0,
  /** Where the camera actually is. Eased toward `target` each frame. */
  value: 0,
  /** Set false to freeze the camera (reduced motion, static fallback). */
  scrubbing: true,
};

/**
 * Exponential smoothing that is correct at any frame rate.
 *
 * A naive `value += (target - value) * k` moves faster on a 144Hz display than
 * a 60Hz one, so the camera would literally lag differently per monitor. This
 * converts a per-second smoothing factor into a per-frame one.
 *
 * @param lambda higher = snappier. ~6 tracks scroll closely, ~2 is very floaty.
 */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return target + (current - target) * Math.exp(-lambda * dt);
}
