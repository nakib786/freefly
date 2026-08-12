/**
 * Owns the 3D layer's lifecycle: capability detection, lazy loading, the
 * scroll->progress bridge, and every fallback path.
 *
 * Load order matters here. three.js + drei + the GLB are together the heaviest
 * thing on the page, and none of it is needed to read the copy, so:
 *   1. the document renders and LCP happens with no 3D code involved,
 *   2. capability is probed,
 *   3. only then is the scene chunk imported, and only if it can be used.
 * A device that fails the probe never downloads three.js at all.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import { detectCapability, watchFrameRate, type Capability } from '@/lib/capability';
import { driveState } from '@/scene/driveState';
import { watchTimings } from '@/scene/timing';

const DriveScene = lazy(() => import('@/scene/DriveScene'));

/** Matches the STATIC_FRAMING angle in keyframes.ts. */
const STATIC_HERO = '/models/tesla-static-hero.webp';

function SceneSkeleton() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 grid place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-px w-40 overflow-hidden bg-ink-700"
          role="progressbar"
          aria-label="Loading 3D scene"
        >
          <div className="h-full w-1/3 animate-[slide_1.4s_var(--ease-drive)_infinite] bg-azure" />
        </div>
        <p className="type-telemetry text-cream-faint">Loading scene</p>
      </div>
      <style>{`@keyframes slide { 0% { transform: translateX(-100%) } 100% { transform: translateX(300%) } }`}</style>
    </div>
  );
}

function StaticHero() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950">
      <img
        src={STATIC_HERO}
        alt="A white Tesla Model 3, the car used for Free Fly Driving School lessons."
        className="absolute inset-0 h-full w-full object-cover opacity-90"
        decoding="async"
        fetchPriority="low"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-ink-950/70" />
    </div>
  );
}

type SceneLayerProps = {
  /**
   * Keeps the 3D layer unmounted while the boot screen is still streaming the
   * GLB. Without it, GLTFLoader would request the same file at the same time as
   * the preloader and the browser would fetch 1.5 MB twice — neither request
   * can be served from a cache entry the other has not finished writing.
   */
  hold?: boolean;
};

export function SceneLayer({ hold = false }: SceneLayerProps) {
  const [capability, setCapability] = useState<Capability | null>(null);
  const demoted = useRef(false);

  // Warm the scene chunk immediately, even while held. `hold` exists only to
  // stop GLTFLoader racing the boot preloader for the same GLB — it should not
  // also delay ~1 MB of three.js, which has nothing to do with that conflict.
  // Kicking the dynamic import off here downloads it alongside the model rather
  // than after it; lazy() below reuses this very module promise.
  useEffect(() => {
    void import('@/scene/DriveScene');
  }, []);

  useEffect(() => {
    if (hold) return;
    setCapability(detectCapability());
  }, [hold]);

  // Keep camera beats pinned to where the sections actually are.
  useEffect(() => {
    if (!capability || capability.tier === 'none') return;
    return watchTimings();
  }, [capability]);

  // Scroll -> progress. onUpdate rather than a scrubbed tween because the
  // camera does its own frame-rate-independent damping (see driveState.ts).
  useEffect(() => {
    if (!capability || capability.tier === 'none' || capability.staticCamera) return;

    let trigger: { kill(): void } | null = null;
    let cancelled = false;

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);
      driveState.scrubbing = true;
      trigger = ScrollTrigger.create({
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          driveState.target = self.progress;
        },
      });
    })();

    return () => {
      cancelled = true;
      trigger?.kill();
    };
  }, [capability]);

  // Real-world frame rate check. The static probe in capability.ts catches the
  // obvious cases; this catches a device that looks fine on paper and isn't.
  useEffect(() => {
    if (!capability || capability.tier !== 'full') return;
    return watchFrameRate(() => {
      if (demoted.current) return;
      demoted.current = true;
      setCapability((c) =>
        c ? { ...c, tier: 'lite', modelUrl: '/models/tesla-model-3-low.glb', shadows: false, maxDpr: 1.5 } : c,
      );
    });
  }, [capability]);

  if (!capability) return <div className="fixed inset-0 -z-10 bg-ink-950" />;
  if (capability.tier === 'none') return <StaticHero />;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Suspense fallback={<SceneSkeleton />}>
        <DriveScene capability={capability} />
      </Suspense>
    </div>
  );
}
