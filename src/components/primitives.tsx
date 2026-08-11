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
          <span className="type-telemetry text-azure">{index}</span>
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
  left: 'radial-gradient(105% 95% at 0% 50%, rgba(6,8,9,0.95) 0%, rgba(6,8,9,0.82) 34%, rgba(6,8,9,0.3) 62%, rgba(6,8,9,0) 80%)',
  right:
    'radial-gradient(105% 95% at 100% 50%, rgba(6,8,9,0.95) 0%, rgba(6,8,9,0.82) 34%, rgba(6,8,9,0.3) 62%, rgba(6,8,9,0) 80%)',
  top: 'linear-gradient(to bottom, rgba(6,8,9,0.95) 0%, rgba(6,8,9,0.8) 55%, rgba(6,8,9,0.35) 100%)',
  bottom:
    'linear-gradient(to top, rgba(6,8,9,0.62) 0%, rgba(6,8,9,0.76) 45%, rgba(6,8,9,0.86) 100%)',
} as const;

/**
 * On a phone there is no "other side" to give the car — the copy spans the full
 * width, so a directional scrim leaves type sitting straight on a wheel arch.
 *
 * Two gradients rather than one, because a single vertical wash heavy enough to
 * carry type at the bottom of the hero (it was 0.72 there) also takes the car
 * down to a black shape — on a phone the render stopped reading as a car at all.
 * So the vertical pass now only has to protect the headline block and falls off
 * to 0.4, and a second left-to-right pass puts the remaining density under the
 * copy, which is left-aligned on every section. The right-hand third — where
 * the mobile keyframes put the car's lit flank — is left comparatively open.
 *
 * Multiply through at the corners: top-left ~0.99, bottom-left ~0.83 (the
 * standfirst and credential strip still have a floor), bottom-right ~0.40.
 */
const MOBILE_SCRIM = [
  'linear-gradient(to bottom, rgba(6,8,9,0.96) 0%, rgba(6,8,9,0.82) 42%, rgba(6,8,9,0.4) 100%)',
  'linear-gradient(to right, rgba(6,8,9,0.72) 0%, rgba(6,8,9,0.3) 55%, rgba(6,8,9,0) 85%)',
].join(', ');

/**
 * A note on why these are shaped the way they are, since it is not obvious.
 *
 * The thing being masked — the car — is on a `position: fixed` canvas, so it is
 * always somewhere in the *viewport*. A scrim element is sized to its section,
 * and Plans and Instructors are each two to three screens tall. A vertical ramp
 * therefore does not mean on screen what it means in the source: "clear at the
 * bottom" resolves to the bottom of the *section*, one screenful out of three,
 * and every other screenful gets a flat slice of the dense end. That is most of
 * why a white car read as black through the middle of the page.
 *
 * The horizontal gradients do not have this problem — a section being tall does
 * not change where its left and right edges are — so `left` and `right` carry
 * the real shaping, and `bottom` is kept close to a flat wash at a level that is
 * legible over the car rather than pretending to be a ramp it cannot be.
 *
 * `background-attachment: fixed` would resolve the gradient against the viewport
 * and fix this properly. Do not reach for it: on a scrim this large it stops
 * IntersectionObserver from delivering entries for the section's own children,
 * so every `data-reveal` below the fold stays at opacity 0 and the section's
 * copy never appears. Measured, not theoretical — 7 of 7 in-view reveals went
 * unfired with it on, 7 of 7 fired with it off.
 */
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
        <a href={href} className="text-cream transition-colors hover:text-azure-bright">
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
    <p className="type-telemetry inline-flex items-center gap-2 border border-dashed border-azure/50 px-3 py-2 text-azure-bright">
      <span aria-hidden>◆</span>
      {children}
    </p>
  );
}
