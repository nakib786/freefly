/**
 * The boot screen.
 *
 * Deliberately not a centred logo over a spinner, and not a rounded card with a
 * rail in it. That silhouette is the single most template-looking screen on the
 * web, and it would be the first thing a visitor ever sees of this site.
 *
 * Instead it is built from the page's own structural idea: a ruled instrument
 * panel read down the left gutter. The header is the nav's exact height and
 * gutter, carrying the same wordmark in the same place, so when the gate lifts
 * the mark does not move: the loader resolves into the page rather than being
 * replaced by it. Below that a real readout: the ASCII gauge, and under it the
 * actual jobs with their actual byte counts, which is the honest way to say
 * "this is what you are waiting for" (see useBootSequence.ts, where every number
 * here is measured).
 *
 * The contact strip along the bottom is the important part. A gate that a
 * visitor cannot get past is a lost phone call, so the number is on screen,
 * tappable, from the first frame, next to a Skip that always works. Nobody has
 * to wait for a 3D car to book a driving lesson.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { Wordmark } from '@/components/primitives';
import { BUSINESS } from '@/data/business';
import { formatBytes, type BootJob, type BootSequence } from '@/lib/useBootSequence';

/** Long enough to read as a deliberate hand-off, short enough not to be a wait. */
const FADE_MS = 520;
/**
 * Under this, the assets were already cached and the screen would be a flash of
 * noise rather than information, so it is dropped without the transition.
 */
const FLASH_MS = 400;

const GAUGE_FILL = '#';
const GAUGE_EMPTY = '-';

type Props = BootSequence & { onDismissed: () => void };

/* ------------------------------------------------------------------ gauge -- */

/**
 * Measures how many characters actually fit rather than assuming a column
 * count: the gauge is drawn in Martian Mono at a fluid size, so the answer
 * changes with the viewport and again when the font itself finishes loading,
 * which, on this screen in particular, happens while it is on display.
 */
function useColumns(target: React.RefObject<HTMLElement | null>) {
  const [columns, setColumns] = useState(24);

  useEffect(() => {
    const host = target.current;
    if (!host) return;

    const measure = () => {
      const probe = document.createElement('span');
      probe.textContent = GAUGE_FILL.repeat(20);
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
      host.appendChild(probe);
      const advance = probe.getBoundingClientRect().width / 20;
      probe.remove();
      if (advance > 0) {
        setColumns(Math.max(10, Math.floor(host.clientWidth / advance) - 2));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [target]);

  return columns;
}

function Gauge({ progress }: { progress: number }) {
  const host = useRef<HTMLDivElement>(null);
  const columns = useColumns(host);
  const filled = Math.round(progress * columns);

  return (
    <div
      ref={host}
      className="type-telemetry mt-6 w-full overflow-hidden whitespace-nowrap text-[clamp(0.75rem,3.2vw,1.35rem)] leading-none tracking-normal"
      aria-hidden
    >
      <span className="text-cream-faint">[</span>
      <span className="text-azure">{GAUGE_FILL.repeat(filled)}</span>
      <span className="text-ink-600">{GAUGE_EMPTY.repeat(Math.max(0, columns - filled))}</span>
      <span className="text-cream-faint">]</span>
    </div>
  );
}

/* ------------------------------------------------------------------- rows -- */

function JobRow({ job }: { job: BootJob }) {
  const value = () => {
    if (job.state === 'failed') return 'skipped';
    if (job.state === 'done') return 'ready';
    if (job.state === 'waiting') return 'queued';
    if (job.total > 0) return `${formatBytes(job.received)} / ${formatBytes(job.total)}`;
    return 'working';
  };

  return (
    <li className="flex items-baseline justify-between gap-6 border-t border-ink-700 py-3.5 md:py-4">
      <span className={job.state === 'done' ? 'text-cream-dim' : 'text-cream'}>{job.label}</span>
      <span
        className={`shrink-0 ${job.state === 'loading' ? 'text-azure-bright' : 'text-cream-faint'}`}
      >
        {value()}
      </span>
    </li>
  );
}

/* --------------------------------------------------------------- component -- */

export function Boot({ jobs, progress, done, skip, onDismissed }: Props) {
  const [leaving, setLeaving] = useState(false);
  const mounted = useRef(performance.now());
  const percent = Math.round(progress * 100);

  // The page underneath is fully rendered and would otherwise scroll behind the
  // overlay, which also scrubs the camera, so a visitor could arrive at a page
  // already halfway through its own sequence.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!done) return;

    const instant =
      performance.now() - mounted.current < FLASH_MS ||
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (instant) {
      onDismissed();
      return;
    }
    setLeaving(true);
    const timer = window.setTimeout(onDismissed, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [done, onDismissed]);

  const onSkip = useCallback(() => skip(), [skip]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Loading Free Fly Driving School"
      className="fixed inset-0 z-[70] flex flex-col bg-ink-950"
      style={{
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_MS}ms var(--ease-drive)`,
      }}
    >
      {/* Same height, gutter and mark as the nav, so nothing jumps on hand-off. */}
      <div className="rule-b">
        <div className="gutter mx-auto flex h-16 w-full max-w-[110rem] items-center justify-between gap-6 md:h-20">
          <Wordmark className="h-5 w-auto text-cream md:h-6" />
          <button
            type="button"
            onClick={onSkip}
            className="type-telemetry text-cream-faint transition-colors hover:text-azure-bright"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Statement and manifest at the top, gauge along the base, rather than
          one centred stack, which is the loader-card silhouette this is meant
          to avoid. It also matches how the rest of the page reads: content set
          against the top rule, instrumentation along the bottom. */}
      {/* The statement and the gauge hold their space; the manifest is the band
          that gives. On a short window (a 720px laptop, a phone in landscape)
          the rows clip from the bottom rather than shunting the gauge (and the
          contact strip) off the screen entirely, which is the one thing on
          here that must never happen. */}
      <div className="gutter mx-auto flex w-full min-h-0 max-w-[110rem] flex-1 flex-col gap-8 pt-10 pb-6 md:gap-10 md:pt-12 md:pb-8">
        <div className="shrink-0">
          <p className="type-telemetry text-azure">Getting you road ready</p>
          {/* Dropped on a very short window: a landscape phone, a small laptop.
              The gauge and the phone number are what this screen owes the
              visitor; the explanation is the part that can go. */}
          <p className="type-condensed mt-5 max-w-[34rem] text-xl text-cream md:text-2xl [@media(max-height:700px)]:hidden">
            {BUSINESS.name}: lessons, road-test prep and our car for the test day. Setting the
            site up now so it runs clean once you are in it. If you already know what you need,
            the number below works from here.
          </p>
        </div>

        {/* Full width and hairline-ruled, the same row treatment the pricing
            rows use. The manifest is the middle band of the panel rather than
            a sidebar, which is what carries the height on a large screen. */}
        {/* The fade is what makes the clipping read as a decision rather than a
            bug: a row sliced in half by an overflow edge looks broken, the same
            row dissolving looks like a list that continues. */}
        <ul
          className="type-telemetry min-h-0 w-full flex-1 overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to bottom, #000 calc(100% - 2rem), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 2rem), transparent 100%)',
          }}
        >
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </ul>

        <div className="shrink-0">
          <Gauge progress={progress} />

          <div className="mt-5 flex items-end justify-between gap-6">
            <span
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label="Loading progress"
              className="type-display text-[clamp(2.75rem,8vw,4.75rem)] leading-none text-cream"
            >
              {percent}
              <span className="text-azure">%</span>
            </span>
            <span className="type-telemetry pb-2 text-cream-faint">
              {done
                ? 'Ready'
                : `${jobs.filter((job) => job.state === 'done').length}/${jobs.length} complete`}
            </span>
          </div>
        </div>
      </div>

      {/* The escape hatch. Nobody should have to wait for a 3D car to book. */}
      <div className="rule-t">
        <div className="gutter mx-auto w-full max-w-[110rem] py-5 md:py-7">
          <p className="type-telemetry text-cream-faint">Booking, right now</p>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-10">
            <div className="flex flex-col gap-3">
              <a
                href={BUSINESS.phoneHref}
                className="font-display text-2xl tracking-tight text-cream transition-colors hover:text-azure-bright md:text-3xl"
              >
                {BUSINESS.phone}
              </a>
              <a
                href={BUSINESS.emailHref}
                className="type-telemetry text-cream-dim transition-colors hover:text-azure-bright"
              >
                {BUSINESS.email}
              </a>
            </div>
            <p className="type-telemetry text-cream-faint md:text-right">
              {BUSINESS.licenceClasses.join(' & ')} · {BUSINESS.cities.join(', ')}
              <br />
              {BUSINESS.hours.days} {BUSINESS.hours.opens}-{BUSINESS.hours.closes}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
