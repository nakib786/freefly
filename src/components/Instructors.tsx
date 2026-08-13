/**
 * Instructor.
 *
 * The section is built around the one real portrait the client supplied: Harry
 * beside the branded Model 3. It runs full-bleed on the left against the bio
 * and the review evidence on the right, not a centred headshot in a rounded
 * card, and not three identical team tiles.
 *
 * The bio in business.ts asserts only what is sourced (founding year, licence
 * classes, the car, and what reviewers actually say). The TRAITS quotes below
 * must each appear word-for-word in reviews.ts: they are evidence for the
 * claims beside them, not decoration.
 */
import { useState } from 'react';

import { Scrim, Section } from '@/components/primitives';
import { BUSINESS, FOUNDED, INSTRUCTOR, JOURNEY } from '@/data/business';
import { INSTRUCTOR_PHOTO } from '@/data/photos.generated';
import { REVIEW_SUMMARY } from '@/data/reviews';

const TRAITS = [
  { word: 'Patient', quote: 'the most patient and methodical driving instructor', from: 'Sameena Hossain' },
  { word: 'Available', quote: "he's always there for you when you need him", from: 'SEONGEUN JEON' },
  { word: 'Effective', quote: 'passed my class 5 road test on the first try', from: 'SEONGEUN JEON' },
] as const;

function Portrait() {
  const [loaded, setLoaded] = useState(false);
  if (!INSTRUCTOR_PHOTO) return null;

  return (
    <figure className="reveal relative overflow-hidden bg-ink-850" data-reveal>
      <img
        src={INSTRUCTOR_PHOTO.blur}
        alt=""
        aria-hidden
        className={`absolute inset-0 h-full w-full scale-110 object-cover blur-lg transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`}
      />
      <img
        src={INSTRUCTOR_PHOTO.srcSmall}
        srcSet={`${INSTRUCTOR_PHOTO.srcSmall} 900w, ${INSTRUCTOR_PHOTO.src} 1600w`}
        sizes="(min-width: 768px) 55vw, 100vw"
        alt={`${INSTRUCTOR.firstName}, ${INSTRUCTOR.role.toLowerCase()} at ${BUSINESS.name}, beside the school's Tesla Model 3.`}
        loading="lazy"
        decoding="async"
        width={INSTRUCTOR_PHOTO.width}
        height={INSTRUCTOR_PHOTO.height}
        onLoad={() => setLoaded(true)}
        className={`w-full transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Ties the photo into the page's dark palette instead of letting a
          bright golden-hour shot sit on near-black like a pasted rectangle. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/10 to-transparent"
      />
      <figcaption className="type-telemetry absolute bottom-5 left-5 text-cream">
        {INSTRUCTOR.firstName}
        <span className="text-cream-faint"> · {INSTRUCTOR.role}</span>
      </figcaption>
    </figure>
  );
}

export function Instructors() {
  return (
    <Section id="instructors" index="03" eyebrow="Who teaches you" className="pb-24 md:pb-36">
      <Scrim from="right" />

      <div className="max-w-[62rem]">
        <h2 className="reveal type-heading text-display max-w-[13ch] text-cream" data-reveal>
          You are trusting a person, not a car
        </h2>
      </div>

      {/* Photo left, evidence right. Uneven split: the portrait earns the
          larger share because it is the only real face on the page. */}
      <div className="mt-14 grid gap-10 md:mt-20 md:grid-cols-12 md:gap-14">
        <div className="md:col-span-7">
          <Portrait />
        </div>

        <div className="flex flex-col gap-10 md:col-span-5">
          <div>
            <p className="type-telemetry text-azure">{INSTRUCTOR.role}</p>
            <p className="type-display mt-4 text-display-sm text-cream">{INSTRUCTOR.firstName}</p>
            {INSTRUCTOR.bio.map((para) => (
              <p key={para} className="mt-5 max-w-[46ch] text-base leading-relaxed text-cream-dim">
                {para}
              </p>
            ))}
            {/* Solid plate rather than bare text: this sits directly over the
                3D car, and thin telemetry type on a moving light-grey panel is
                unreadable without something opaque behind it. */}
            <a
              href={REVIEW_SUMMARY.url}
              target="_blank"
              rel="noopener noreferrer"
              className="type-telemetry mt-7 inline-flex items-baseline gap-2 border border-ink-600 bg-ink-950/90 px-4 py-3 text-cream transition-colors hover:border-azure hover:text-azure-bright"
            >
              <span className="text-azure">★ {REVIEW_SUMMARY.rating.toFixed(1)}</span>
              <span>from {REVIEW_SUMMARY.count} reviews</span>
            </a>
          </div>

          <ul className="rule-t flex flex-col gap-6 pt-8">
            {TRAITS.map((trait) => (
              <li key={trait.word} className="reveal flex flex-col gap-2" data-reveal>
                <span className="type-heading text-lg text-cream">{trait.word}</span>
                <blockquote className="type-condensed text-base text-cream-dim">
                  “{trait.quote}”
                </blockquote>
                <cite className="type-telemetry text-cream-faint not-italic">{trait.from}</cite>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The licence pathway: real, structural, and useful on its own.
          `relative` + its own backdrop because this band sits low in the
          section where the section-level scrim has already faded out, and the
          car's bright nose passes directly behind it. */}
      <div className="relative mt-20 md:mt-28">
        {/* Full-bleed and soft-edged. A padded rectangle here reads as a panel
            pasted over the render; running it past the viewport edges with a
            vertical fade keeps it as an atmospheric floor under the type,
            which is what the rest of the page does. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2"
          style={{
            marginBlock: '-3rem',
            background:
              'linear-gradient(to bottom, rgba(6,8,9,0) 0%, rgba(6,8,9,0.88) 18%, rgba(6,8,9,0.88) 82%, rgba(6,8,9,0) 100%)',
          }}
        />
        <p className="reveal type-telemetry mb-8 text-cream-dim" data-reveal>
          {BUSINESS.licenceClasses.join(' to ')}: how it runs · teaching since {FOUNDED}
        </p>
        <ol className="grid gap-px md:grid-cols-4">
          {JOURNEY.map((stage) => (
            <li key={stage.step} className="reveal rule-t pt-6" data-reveal>
              <span className="font-display text-4xl font-extrabold tracking-tight text-azure">
                {stage.step}
              </span>
              <p className="type-heading mt-4 text-lg text-cream">{stage.label}</p>
              <p className="mt-2 max-w-[28ch] text-sm text-cream-dim">{stage.note}</p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
