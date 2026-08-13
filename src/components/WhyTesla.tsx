/**
 * Why a Tesla.
 *
 * Four points, laid out as a numbered ledger rather than a card grid: each is a
 * full-width row, hairline-ruled, with the index in the left rail, the title in
 * expanded display type, and the body in a narrow measure to the right. Rows
 * step progressively further right as you read down, so the block has a
 * diagonal edge instead of resolving into a rectangle of equal boxes.
 *
 * Keyframe 1 puts the car on the LEFT here, so the copy runs right of centre.
 */
import { Scrim, Section } from '@/components/primitives';
import { TESLA_ADVANTAGES } from '@/data/business';

/** Indent per row, in rem. The staggered left edge is the point. */
const STEP = [0, 2.5, 5, 7.5];

export function WhyTesla() {
  return (
    <Section id="why-tesla" index="01" eyebrow="Why a Tesla" className="pb-24 md:pb-36">
      {/* Copy runs down the right here, car sits left. */}
      <Scrim from="right" />

      <div className="ml-auto max-w-[64rem]">
        <h2 className="reveal type-heading text-display max-w-[14ch] text-cream" data-reveal>
          The car is part of the lesson
        </h2>

        <p className="reveal type-condensed mt-8 max-w-[46ch] text-xl text-cream-dim" data-reveal>
          An EV changes what a learner has to think about, and most of those changes make you a
          more deliberate driver, not a lazier one.
        </p>

        <ul className="mt-12 md:mt-16">
          {TESLA_ADVANTAGES.map((item, i) => (
            <li
              key={item.id}
              className="reveal rule-t group py-8 md:py-10"
              data-reveal
              style={{ paddingLeft: `${STEP[i % STEP.length]}rem` }}
            >
              <div className="grid gap-4 md:grid-cols-[4rem_minmax(0,18rem)_minmax(0,1fr)] md:items-baseline md:gap-8">
                <span className="type-telemetry text-azure">{item.index}</span>
                <h3 className="type-heading text-2xl text-cream md:text-3xl">{item.title}</h3>
                <div>
                  <p className="max-w-[52ch] text-base leading-relaxed text-cream-dim">{item.body}</p>
                  <p className="type-telemetry mt-4 text-cream-faint">{item.telemetry}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
