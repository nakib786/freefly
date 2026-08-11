/**
 * Lessons & pricing — the five live Wix plans.
 *
 * Three deliberate departures from the default pricing section:
 *
 * 1. No photography. All five plans in Wix share one placeholder stock image,
 *    so the section differentiates tiers structurally instead.
 * 2. No three equal columns with a glowing middle. The three package tiers are
 *    sized in proportion to the instruction hours they contain — the Beginners
 *    column really is wider because it really is 30 hours against Advanced's 9.
 *    The layout *is* the data, so no tier needs a "Most popular" sticker.
 * 3. The motif is a charge meter. Each plan draws its lesson count as a row of
 *    segments, which reads as an EV state-of-charge gauge and gives an instant
 *    visual sense of scale between a 1-lesson top-up and a 20-lesson course.
 *
 * Prices come from /api/plans (live Wix) with the bundled plans as fallback —
 * see usePlans.ts.
 */
import { Scrim, Section } from '@/components/primitives';
import { BUSINESS } from '@/data/business';
import { formatPrice, type Plan } from '@/data/plans';
import { usePlans } from '@/lib/usePlans';

/* ------------------------------------------------------------------- meter -- */

function ChargeMeter({ count, max = 20, tone }: { count: number; max?: number; tone: string }) {
  return (
    <div
      className="flex items-end gap-[3px]"
      role="img"
      aria-label={`${count} ${count === 1 ? 'lesson' : 'lessons'}`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`h-6 w-[3px] ${i < count ? tone : 'bg-ink-700'}`}
          // Filled segments taper slightly so the bar has a direction of
          // travel rather than reading as a flat barcode.
          style={i < count ? { height: `${1 + (i / max) * 0.9}rem` } : undefined}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- rows -- */

function PerkList({ perks }: { perks: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {perks.map((perk) => (
        <li key={perk} className="flex gap-3 text-sm text-cream-dim">
          <span aria-hidden className="mt-[0.45em] h-px w-3 shrink-0 bg-crimson" />
          {perk}
        </li>
      ))}
    </ul>
  );
}

function Price({ plan, className = '' }: { plan: Plan; className?: string }) {
  return (
    <p className={`font-display font-extrabold tracking-tight text-cream ${className}`}>
      {formatPrice(plan)}
      <span className="type-telemetry ml-2 align-middle text-cream-faint">{plan.currency}</span>
    </p>
  );
}

function SingleLesson({ plan }: { plan: Plan }) {
  return (
    <article
      className="reveal rule-t rule-b flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between md:gap-12"
      data-reveal
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:gap-6">
        <h3 className="type-heading text-2xl text-cream">{plan.name}</h3>
        <p className="max-w-[44ch] text-sm text-cream-dim">{plan.description}</p>
      </div>
      <div className="flex items-center gap-8">
        <ChargeMeter count={plan.sessions} tone="bg-cream" />
        <Price plan={plan} className="text-3xl" />
      </div>
    </article>
  );
}

function PackageColumn({ plan, maxHours }: { plan: Plan; maxHours: number }) {
  return (
    <article
      className="reveal rule-l flex min-w-0 flex-col justify-between gap-10 px-6 py-10 md:px-8"
      data-reveal
      // Column width tracks instruction hours. This is the whole anti-"three
      // equal cards" move: the grid encodes the product.
      style={{ flexGrow: plan.hours, flexBasis: `${(plan.hours / maxHours) * 100}%` }}
    >
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="type-heading text-xl text-cream md:text-2xl">{plan.name}</h3>
          <span className="type-telemetry shrink-0 text-crimson">{plan.hours} hrs</span>
        </div>
        <p className="mt-4 max-w-[36ch] text-sm text-cream-dim">{plan.description}</p>
        <div className="mt-8">
          <ChargeMeter count={plan.sessions} tone="bg-crimson" />
          <p className="type-telemetry mt-3 text-cream-faint">{plan.sessions} lessons</p>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <PerkList perks={plan.perks} />
        <div>
          <Price plan={plan} className="text-4xl md:text-5xl" />
          {/* Shown because it is a condition on the price directly above it —
              all three package tiers are "paid in advance" prices. */}
          {plan.terms && <p className="mt-3 max-w-[30ch] text-xs text-cream-dim">{plan.terms}</p>}
          <a
            href={BUSINESS.phoneHref}
            className="type-telemetry mt-6 inline-block border border-ink-600 px-5 py-3 text-cream transition-colors hover:border-crimson hover:text-crimson-bright"
          >
            Enquire
          </a>
        </div>
      </div>
    </article>
  );
}

function Capstone({ plan }: { plan: Plan }) {
  return (
    <article
      className="reveal relative mt-16 overflow-hidden border border-crimson/40 md:mt-24"
      data-reveal
    >
      {/* Chequered flag, drawn rather than imported — two rows of squares is
          not worth an icon dependency, and this way it inherits the palette. */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-40 opacity-25 md:w-72"
        style={{
          backgroundImage:
            'linear-gradient(45deg, #cd1d4f 25%, transparent 25%, transparent 75%, #cd1d4f 75%), linear-gradient(45deg, #cd1d4f 25%, transparent 25%, transparent 75%, #cd1d4f 75%)',
          backgroundSize: '22px 22px',
          backgroundPosition: '0 0, 11px 11px',
          maskImage: 'linear-gradient(to right, transparent, #000)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000)',
        }}
      />
      <div className="relative flex flex-col gap-8 bg-gradient-to-r from-wine-deep/60 to-transparent p-8 md:flex-row md:items-end md:justify-between md:p-12">
        <div>
          <p className="type-telemetry text-crimson-bright">Final step</p>
          <h3 className="type-heading mt-4 text-3xl text-cream md:text-4xl">{plan.name}</h3>
          <p className="mt-4 max-w-[46ch] text-sm text-cream-dim">{plan.description}</p>
          <div className="mt-8">
            <PerkList perks={plan.perks} />
          </div>
        </div>
        <div className="shrink-0">
          <Price plan={plan} className="text-5xl md:text-6xl" />
          <a
            href={BUSINESS.phoneHref}
            className="type-telemetry mt-6 inline-block bg-crimson px-6 py-4 text-cream transition-colors hover:bg-crimson-bright"
          >
            Book road test
          </a>
        </div>
      </div>
    </article>
  );
}

/* ----------------------------------------------------------------- section -- */

export function Plans() {
  const { plans, live, unconfigured } = usePlans();

  const single = plans.find((p) => p.tier === 'single');
  const packages = plans.filter((p) => p.tier === 'package');
  const capstone = plans.find((p) => p.tier === 'capstone');
  const maxHours = Math.max(...packages.map((p) => p.hours), 1);

  return (
    <Section id="lessons" index="02" eyebrow="Lessons & pricing" className="pb-24 md:pb-36">
      {/* Car drops to a band along the bottom in this scene, so the scrim
          protects everything above it. */}
      <Scrim from="bottom" />

      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <h2 className="reveal type-heading text-display max-w-[12ch] text-cream" data-reveal>
          Pick your
          <br />
          starting point
        </h2>
        <p className="reveal type-condensed max-w-[38ch] text-lg text-cream-dim" data-reveal>
          Every package is taught in the Model 3 across {BUSINESS.cities.join(', ')}. Prices are in
          Canadian dollars and come straight from our booking system.
        </p>
      </div>

      <div className="mt-12 md:mt-16">
        {single && <SingleLesson plan={single} />}

        {/* Unequal columns, widths proportional to instruction hours. */}
        <div className="rule-b flex flex-col md:flex-row md:items-stretch">
          {packages.map((plan) => (
            <PackageColumn key={plan.id} plan={plan} maxHours={maxHours} />
          ))}
        </div>

        {capstone && <Capstone plan={capstone} />}
      </div>

      {import.meta.env.DEV && (
        <p className="type-telemetry mt-10 text-cream-faint">
          pricing source: {unconfigured ? 'fallback — /api/plans has no Wix credentials' : live ? 'live Wix' : 'bundled fallback'}
        </p>
      )}
    </Section>
  );
}
