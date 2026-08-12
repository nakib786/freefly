/**
 * The boot screen's progress, measured rather than performed.
 *
 * The rule this file exists to keep: every number the loader shows corresponds
 * to work that has actually happened. No timers pretending to be bandwidth, no
 * easing curve standing in for a download. Each job below either reports real
 * bytes off the wire (via a streamed fetch, reading `content-length`) or is a
 * genuine binary event we wait on — fonts resolved, first frame of the car
 * drawn. The percentage is those jobs weighted by their real byte cost, so the
 * bar moves in proportion to the work left rather than in equal steps.
 *
 * ─── Why preload at all ────────────────────────────────────────────────────
 * Not for the ceremony. The page's heavy assets — a 1.5 MB Draco GLB, three
 * variable fonts, a 110 KB portrait — otherwise land while the visitor is
 * already scrolling, and the scroll-scrubbed camera competes with a Draco
 * decode on the same thread. Pulling that forward into a gate trades a few
 * seconds of honest waiting for a page that does not stutter once it is up.
 *
 * ─── Why it can never trap you ─────────────────────────────────────────────
 * A gate is a liability: if it hangs, the business loses the call. So there is
 * a hard deadline after which the gate opens regardless, a failed job counts as
 * satisfied rather than blocking, a Skip control is present from the first
 * frame, and the phone number lives on the boot screen itself — a visitor on a
 * bad connection can act without waiting for any of this to finish.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { INSTRUCTOR_PHOTO } from '@/data/photos.generated';
import { detectCapability, type Capability } from '@/lib/capability';
import { sceneReady } from '@/scene/sceneReady';

/** Open the gate regardless after this long. */
const DEADLINE_MS = 14_000;

export type JobState = 'waiting' | 'loading' | 'done' | 'failed';

export type BootJob = {
  id: string;
  label: string;
  /**
   * Relative cost used to weight the overall percentage — bytes, so the bar
   * tracks the work rather than the step count. For the two jobs that are not
   * downloads (fonts, first frame) this is a considered estimate of what they
   * cost in practice, which is the honest way to size a step whose progress is
   * genuinely not observable.
   */
  weight: number;
  received: number;
  total: number;
  state: JobState;
};

export type BootSequence = {
  jobs: BootJob[];
  /** 0..1, weighted and monotonic. */
  progress: number;
  done: boolean;
  /**
   * True while the model file is still downloading. SceneLayer holds the 3D
   * mount until it clears, so the GLTFLoader's request lands after ours and is
   * served from cache instead of racing it for the same 1.5 MB.
   */
  holdScene: boolean;
  skip: () => void;
};

const bytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`;

export const formatBytes = bytes;

/* ------------------------------------------------------------------ fetch -- */

/**
 * Streams a URL, reporting bytes as they arrive, and discards the body.
 *
 * The point is the side effect: the response lands in the HTTP cache, so the
 * loader that needs it next (GLTFLoader, or an <img>) gets it without a second
 * trip. `/models/*` and `/photos/*` are served immutable, so this holds in
 * production; in dev Vite revalidates and the asset may be fetched twice, which
 * costs nothing over localhost.
 */
async function streamBytes(
  url: string,
  signal: AbortSignal,
  onProgress: (received: number, total: number) => void,
) {
  const response = await fetch(url, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);

  const declared = Number(response.headers.get('content-length')) || 0;
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress(buffer.byteLength, buffer.byteLength);
    return;
  }

  const reader = response.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    // `content-length` counts compressed bytes while `value` is decompressed,
    // so a transfer-encoded response overshoots its own declared length. Taking
    // the max keeps the fraction inside 0..1 rather than pinning it at 100%
    // with the download still running.
    onProgress(received, Math.max(declared, received));
  }
  onProgress(received, Math.max(declared, received));
}

/** Resolves once the three families are actually loaded, not merely declared. */
async function loadFonts() {
  if (!('fonts' in document)) return;
  await Promise.all([
    document.fonts.load('800 1em "Archivo Variable"'),
    document.fonts.load('500 1em "Instrument Sans Variable"'),
    document.fonts.load('500 1em "Martian Mono Variable"'),
  ]);
  await document.fonts.ready;
}

function waitForScene(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (sceneReady.value) return resolve();
    const stop = sceneReady.subscribe(() => {
      stop();
      resolve();
    });
    signal.addEventListener('abort', () => {
      stop();
      resolve();
    });
  });
}

/* ------------------------------------------------------------------- plan -- */

function planJobs(capability: Capability): BootJob[] {
  const job = (id: string, label: string, weight: number): BootJob => ({
    id,
    label,
    weight,
    received: 0,
    total: 0,
    state: 'waiting',
  });

  const plan = [job('fonts', 'Signage & type', 160_000)];

  if (capability.tier === 'none') {
    // No WebGL here, so there is no GLB to wait on — waiting on one would hang
    // the gate on a file this device is never going to ask for.
    plan.push(job('hero', 'Cover photo', 34_000));
  } else {
    plan.push(job('model', 'Training vehicle', capability.tier === 'full' ? 1_566_660 : 1_242_560));
    plan.push(job('scene', 'Setting up the lot', 260_000));
  }

  if (INSTRUCTOR_PHOTO) plan.push(job('portrait', 'Meet the team', 109_584));

  return plan;
}

/* ------------------------------------------------------------------- hook -- */

export function useBootSequence(): BootSequence {
  const [jobs, setJobs] = useState<BootJob[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [holdScene, setHoldScene] = useState(true);

  const abort = useRef<(() => void) | null>(null);

  /**
   * Explicit "I do not want to wait". Unlike the deadline this also stops the
   * preload and hands the model to GLTFLoader, because the visitor has asked to
   * be in the page now and holding the 3D layer back on their behalf would be
   * second-guessing them.
   */
  const skip = useCallback(() => {
    abort.current?.();
    setHoldScene(false);
    setDone(true);
  }, []);

  useEffect(() => {
    const capability = detectCapability();

    // Everything below is scoped to this run of the effect, not to the
    // component. React's StrictMode mounts, tears down and remounts in dev, and
    // the first run's aborted promises keep resolving after its cleanup — so a
    // job array or an animation-frame handle held on a ref would be shared with
    // the run that replaced it. That is not a dev-only nuisance: it had the
    // dead run marking the live run's jobs complete, which opened the gate
    // before the car existed.
    const plan = planJobs(capability);
    let frame = 0;
    let peak = 0;
    let cancelled = false;

    setJobs(plan.map((job) => ({ ...job })));

    const controller = new AbortController();
    const { signal } = controller;
    abort.current = () => controller.abort();

    const publish = () => {
      if (frame || cancelled) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (cancelled) return;

        const total = plan.reduce((sum, job) => sum + job.weight, 0) || 1;
        const carried = plan.reduce((sum, job) => {
          const fraction =
            job.state === 'done' || job.state === 'failed'
              ? 1
              : job.total > 0
                ? Math.min(job.received / job.total, 1)
                : 0;
          return sum + job.weight * fraction;
        }, 0);

        // Monotonic: a job's weight is an estimate until its content-length
        // arrives, so the true denominator can shift under us. Never showing a
        // number lower than one already shown keeps that invisible, and only
        // ever understates.
        peak = Math.max(peak, Math.min(carried / total, 1));
        setProgress(peak);
        setJobs(plan.map((job) => ({ ...job })));
      });
    };

    const update = (id: string, patch: Partial<BootJob>) => {
      if (cancelled) return;
      const job = plan.find((candidate) => candidate.id === id);
      if (!job) return;
      Object.assign(job, patch);
      publish();
    };

    const run = async (id: string, task: () => Promise<void>) => {
      if (!plan.some((job) => job.id === id)) return;
      update(id, { state: 'loading' });
      try {
        await task();
        update(id, { state: 'done' });
      } catch {
        // A missing or blocked asset must not hold the page hostage; the site
        // degrades perfectly well without any single one of these.
        update(id, { state: 'failed' });
      }
    };

    const onBytes = (id: string) => (received: number, total: number) =>
      update(id, { received, total });

    // Declared before the sequence so finishing normally can cancel it.
    //
    // Note what this deliberately does NOT do: release the scene. The visitor
    // has waited long enough and gets the page, but the model is still in
    // flight, and mounting the 3D layer now would have GLTFLoader request the
    // same 1.5 MB our preloader is already halfway through — doubling the
    // traffic on precisely the connection that was too slow in the first place.
    // The preload keeps its single ownership of the file and the car appears
    // when it lands, a few seconds into a page that is already fully usable.
    const deadline = window.setTimeout(() => {
      if (cancelled) return;
      if (import.meta.env.DEV) console.warn('[boot] deadline reached, opening the gate');
      setDone(true);
    }, DEADLINE_MS);

    // The Draco decoder is on the critical path — the GLB cannot be parsed
    // without it — but it is fetched lazily by GLTFLoader, which means it would
    // otherwise start only once everything else has finished. Warmed here, and
    // deliberately untracked: it is 250 KB against the model's 1.5 MB, and
    // giving it its own row would be noise rather than information.
    for (const asset of ['/draco/draco_wasm_wrapper.js', '/draco/draco_decoder.wasm']) {
      void fetch(asset, { signal, credentials: 'same-origin' }).catch(() => {});
    }

    const sequence = (async () => {
      // The model first and alone: it is 90% of the bytes, and sharing the
      // connection with the portrait would only make both arrive later.
      const model = run('model', () =>
        streamBytes(capability.modelUrl, signal, onBytes('model')),
      );
      const hero = run('hero', () =>
        streamBytes('/models/tesla-static-hero.webp', signal, onBytes('hero')),
      );

      await Promise.all([model, hero]);
      if (cancelled) return;

      // Bytes are cached, so the 3D layer can mount and start decoding without
      // racing us for the same file.
      setHoldScene(false);

      await Promise.all([
        run('fonts', loadFonts),
        run('portrait', () =>
          INSTRUCTOR_PHOTO
            ? streamBytes(INSTRUCTOR_PHOTO.srcSmall, signal, onBytes('portrait'))
            : Promise.resolve(),
        ),
        run('scene', () => waitForScene(signal)),
      ]);
    })();

    void sequence.then(() => {
      if (cancelled) return;
      window.clearTimeout(deadline);
      if (import.meta.env.DEV) {
        console.info(
          '[boot] all jobs settled',
          plan.map((job) => `${job.id}:${job.state}`).join(' '),
          `sceneReady=${sceneReady.value}`,
        );
      }
      setDone(true);
    });

    return () => {
      cancelled = true;
      abort.current = null;
      controller.abort();
      window.clearTimeout(deadline);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return { jobs, progress, done, holdScene, skip };
}
