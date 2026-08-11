/**
 * Binds each camera beat to the section it belongs to.
 *
 * The `at` values authored in keyframes.ts are a starting point, not the truth.
 * They were written against an assumed page length, and the moment copy is
 * added, a plan is renamed, or a font loads at a different height, "0.55" stops
 * meaning "the pricing section". The symptom is subtle and awful: the camera is
 * doing its cruise move while the reader is looking at the instructors.
 *
 * So the timings are measured from the DOM instead. Each keyframe names an
 * anchor element, and its beat lands at the scroll offset where that section
 * has come properly into view. Authored `at` is the fallback for any anchor
 * that is missing, which keeps the file honest if a section is ever removed.
 *
 * Re-measured on resize and whenever the document height changes, because both
 * move every section's offset.
 */
import { KEYFRAMES } from '@/scene/keyframes';

/**
 * How far down the viewport a section's top sits when its beat is reached.
 * 0.25 means "a quarter of the way down" — far enough in that the section is
 * clearly what you are reading, not so far that the camera arrives late.
 */
const ARRIVAL = 0.25;

/** Live timings, read every frame by CameraRig. Mutated in place. */
export const timings: number[] = KEYFRAMES.map((kf) => kf.at);

export function resolveTimings(): void {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return;

  const measured = KEYFRAMES.map((kf, i) => {
    const el = kf.anchor ? document.getElementById(kf.anchor) : null;
    if (!el) return timings[i] ?? kf.at;

    const top = el.getBoundingClientRect().top + window.scrollY;
    const target = top - window.innerHeight * ARRIVAL;
    return Math.min(Math.max(target / maxScroll, 0), 1);
  });

  // First beat always starts at the top of the page and the last always ends at
  // the bottom, so the full scroll range is used no matter where the anchors
  // happen to sit.
  measured[0] = 0;
  measured[measured.length - 1] = 1;

  // Force strictly ascending. Two sections can measure to the same offset on a
  // short page, and a zero-length segment divides by zero in CameraRig.
  const MIN_GAP = 0.02;
  for (let i = 1; i < measured.length; i++) {
    if (measured[i] <= measured[i - 1] + MIN_GAP) {
      measured[i] = Math.min(measured[i - 1] + MIN_GAP, 1);
    }
  }
  // If clamping pushed the tail past 1, redistribute backwards from the end.
  for (let i = measured.length - 2; i > 0; i--) {
    if (measured[i] >= measured[i + 1] - MIN_GAP) {
      measured[i] = measured[i + 1] - MIN_GAP;
    }
  }

  for (let i = 0; i < measured.length; i++) timings[i] = measured[i];
}

/**
 * Keeps `timings` in step with the layout. Returns an unsubscribe function.
 */
export function watchTimings(): () => void {
  resolveTimings();

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      resolveTimings();
    });
  };

  window.addEventListener('resize', schedule, { passive: true });
  // Section heights change as fonts swap in and as live pricing lands, and
  // neither fires a resize event.
  const observer = new ResizeObserver(schedule);
  observer.observe(document.body);

  return () => {
    window.removeEventListener('resize', schedule);
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
