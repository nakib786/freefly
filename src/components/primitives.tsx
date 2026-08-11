/**
 * Shared page furniture.
 *
 * The page is built on one structural idea: a ruled instrument panel. A single
 * hairline runs down the left gutter, sections are numbered like waypoints on a
 * route, and anything numeric is set in condensed mono so it reads as a
 * readout. That is what stops the layout collapsing into stacked centred bands
 * with a heading and three cards — the thing every generic template silhouette
 * looks like.
 */
import type { ReactNode } from 'react';

import wordmarkUrl from '@/assets/freefly-wordmark.svg';
import { BUSINESS } from '@/data/business';

/* ---------------------------------------------------------------- wordmark -- */

/**
 * The logo type, extracted to real vector by scripts/prepare-brand.mjs.
 * Rendered via mask rather than <img> so it inherits `currentColor` — the
 * supplied SVG is fixed to the brand slate, which disappears on near-black.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={BUSINESS.name}
      className={`inline-block bg-current ${className}`}
      style={{
        maskImage: `url(${wordmarkUrl})`,
        WebkitMaskImage: `url(${wordmarkUrl})`,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        aspectRatio: '1375 / 352',
      }}
    />
  );
}

/* ----------------------------------------------------------------- section -- */

type SectionProps = {
  id: string;
  /** Waypoint number shown in the left rail, e.g. "02". */
  index: string;
  /** Short label beside the number. */
  eyebrow: string;
  children: ReactNode;
  className?: string;
};

export function Section({ id, index, eyebrow, children, className = '' }: SectionProps) {
  return (
    <section id={id} className={`rule-t relative gutter ${className}`}>
      {/* scroll-margin keeps the nav from covering a section jumped to by
          anchor — the bar is fixed and 4rem/5rem tall. */}
      <div className="mx-auto max-w-[110rem] scroll-mt-24">
        <header
          className="reveal flex items-baseline gap-4 pt-6 pb-10 md:pt-8 md:pb-14"
          data-reveal
        >
          <span className="type-telemetry text-crimson">{index}</span>
          <span className="type-telemetry text-cream-faint">{eyebrow}</span>
        </header>
        {children}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- misc -- */

/**
 * Readable copy over a moving 3D render needs a floor under it. A soft scrim
 * rather than a solid panel, so the car still shows through and the layer
 * reads as one image instead of cards sitting on a wallpaper.
 *
 * `from` names which edge the copy sits against, so each section can darken the
 * side it actually uses and leave the car side clear. Passed as a prop rather
 * than a className because the gradient is set inline — a utility class would
 * lose to the inline style and silently do nothing.
 */
const SCRIM_GRADIENTS = {
  left: 'radial-gradient(120% 90% at 0% 50%, rgba(9,7,8,0.94) 0%, rgba(9,7,8,0.78) 38%, rgba(9,7,8,0) 74%)',
  right:
    'radial-gradient(120% 90% at 100% 50%, rgba(9,7,8,0.94) 0%, rgba(9,7,8,0.78) 38%, rgba(9,7,8,0) 74%)',
  top: 'linear-gradient(to bottom, rgba(9,7,8,0.95) 0%, rgba(9,7,8,0.8) 55%, rgba(9,7,8,0.35) 100%)',
  bottom:
    'linear-gradient(to top, rgba(9,7,8,0.5) 0%, rgba(9,7,8,0.88) 45%, rgba(9,7,8,0.96) 100%)',
} as const;

/**
 * On a phone there is no "other side" to give the car — the copy spans the full
 * width, so a directional scrim leaves type sitting straight on a wheel arch.
 * Below md the gradient is replaced by a heavy vertical one that keeps the car
 * as texture behind the lower third and nothing more.
 */
const MOBILE_SCRIM =
  'linear-gradient(to bottom, rgba(9,7,8,0.97) 0%, rgba(9,7,8,0.9) 45%, rgba(9,7,8,0.72) 100%)';

export function Scrim({ from = 'left' }: { from?: keyof typeof SCRIM_GRADIENTS }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden md:block"
        style={{ background: SCRIM_GRADIENTS[from] }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 md:hidden"
        style={{ background: MOBILE_SCRIM }}
      />
    </>
  );
}

/** A labelled value, set as an instrument readout. */
export function Readout({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = <span className="font-display text-lg tracking-tight md:text-xl">{value}</span>;
  return (
    <div className="flex flex-col gap-2">
      <span className="type-telemetry text-cream-faint">{label}</span>
      {href ? (
        <a href={href} className="text-cream transition-colors hover:text-crimson-bright">
          {body}
        </a>
      ) : (
        <span className="text-cream">{body}</span>
      )}
    </div>
  );
}

/**
 * Marks content that is structurally finished but waiting on the client. Made
 * deliberately conspicuous — a placeholder that looks like a design decision is
 * a placeholder that ships by accident.
 */
export function PlaceholderNote({ children }: { children: ReactNode }) {
  return (
    <p className="type-telemetry inline-flex items-center gap-2 border border-dashed border-crimson/50 px-3 py-2 text-crimson-bright">
      <span aria-hidden>◆</span>
      {children}
    </p>
  );
}
