/**
 * Hero.
 *
 * Not a centred headline on a gradient. The copy is pinned to the lower-left
 * third of a full-height stage, leaving the right side to the car — which is
 * where keyframe 0's pan puts it. The headline uses Archivo's width axis: three
 * lines set EXPANDED, against a CONDENSED standfirst, so the type contrast is
 * structural rather than just a weight change.
 */
import { Scrim } from '@/components/primitives';
import { AWARD, BUSINESS } from '@/data/business';
import { REVIEW_SUMMARY } from '@/data/reviews';

export function Hero() {
  return (
    <section id="top" className="relative flex min-h-svh flex-col justify-end gutter pb-14 md:pb-20">
      <Scrim />

      <div className="mx-auto w-full max-w-[110rem]">
        <p className="reveal type-telemetry mb-6 text-azure" data-reveal>
          {BUSINESS.licenceClasses.join(' & ')} · {BUSINESS.region}
        </p>

        {/* Line breaks are set by hand rather than left to the measure: at
            display-lg the wrap point moves with every viewport width, and
            "Learn to / drive in a / Tesla" is the only break that keeps the
            three lines close to equal length. */}
        <h1 className="reveal type-display text-display-lg text-cream" data-reveal>
          <span className="block">Learn to</span>
          <span className="block">drive in a</span>
          <span className="block text-azure">Tesla</span>
        </h1>

        <div className="mt-10 grid gap-10 md:mt-14 md:grid-cols-[minmax(0,32rem)_auto] md:items-end md:gap-16">
          <p className="reveal type-condensed text-xl text-cream-dim md:text-2xl" data-reveal>
            {BUSINESS.tagline} Full lesson packages and road-test prep across{' '}
            {BUSINESS.cities.slice(0, -1).join(', ')} and {BUSINESS.cities.at(-1)} — taught in a
            Model&nbsp;3, with the car provided for your test.
          </p>

          <div className="reveal flex flex-wrap items-center gap-3" data-reveal>
            <a
              href={BUSINESS.phoneHref}
              className="type-telemetry bg-cream px-6 py-4 text-ink-950 transition-colors hover:bg-azure hover:text-cream"
            >
              Book a lesson
            </a>
            <a
              href="#lessons"
              className="type-telemetry border border-ink-600 px-6 py-4 text-cream transition-colors hover:border-azure hover:text-azure-bright"
            >
              See plans &amp; prices
            </a>
          </div>
        </div>

        {/* Credential strip. Set as telemetry so it reads as instrument data
            rather than as a marketing badge. The Google rating leads because it
            is the one credential that is independently verifiable — the "top 3"
            claim is carried unlinked (see AWARD in business.ts for why). */}
        <div
          className="reveal rule-t mt-12 flex flex-wrap items-center gap-x-10 gap-y-4 pt-6 md:mt-16"
          data-reveal
        >
          <a
            href={REVIEW_SUMMARY.url}
            target="_blank"
            rel="noopener noreferrer"
            className="type-telemetry text-cream transition-colors hover:text-azure-bright"
          >
            <span className="text-azure">★ {REVIEW_SUMMARY.rating.toFixed(1)}</span> ·{' '}
            {REVIEW_SUMMARY.count} {REVIEW_SUMMARY.source} reviews
          </a>
          <span className="type-telemetry text-cream-dim">
            {AWARD.claim}
            <span className="text-cream-faint"> · {AWARD.attribution}</span>
          </span>
          <span className="type-telemetry text-cream-faint">
            Regen braking · Safety tech · Assisted driving
          </span>
        </div>
      </div>
    </section>
  );
}
