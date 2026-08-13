/**
 * Reviews and the pass wall.
 *
 * Everything here is real: the aggregate from the verified Google Business
 * Profile, three reviews quoted verbatim, and ten photographs of actual
 * students holding their ICBC pass slips beside the school's Model 3.
 *
 * Three honesty rules are enforced in the markup rather than left to good
 * intentions:
 *
 *  - The review count is only ever printed as a review count. It is not a
 *    pass count and must never be presented as one: many more students have
 *    passed than have left a review, so the two numbers are not the same
 *    figure and the review count is the smaller of them.
 *  - Reviews flagged `truncated` render a visible ellipsis and link out to the
 *    full text on Google. Presenting a cut-off review as a complete one is how
 *    a genuine testimonial quietly becomes a fabricated one.
 *  - No name is attached to any student photograph. The filenames the client
 *    supplied imply first names, but a filename is not consent to publish a
 *    name next to a face, and the photos carry the proof on their own.
 */
import { useState } from 'react';

import { Scrim, Section } from '@/components/primitives';
import { REVIEWS, REVIEW_SUMMARY, type Review } from '@/data/reviews';
import { STUDENT_PHOTOS } from '@/data/photos.generated';

/* ----------------------------------------------------------------- reviews -- */

function Stars({ count }: { count: number }) {
  return (
    <span className="flex gap-1" role="img" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden>
          <path
            d="M10 1l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.4l6.1-.8z"
            fill={i < count ? 'var(--color-azure)' : 'var(--color-ink-600)'}
          />
        </svg>
      ))}
    </span>
  );
}

function ReviewCard({ review, wide }: { review: Review; wide: boolean }) {
  return (
    <blockquote
      className={`reveal rule-t flex flex-col justify-between gap-8 pt-6 ${wide ? 'md:col-span-7' : 'md:col-span-5'}`}
      data-reveal
    >
      <p className="type-condensed text-lg text-cream md:text-xl">
        {review.text}
        {review.truncated && (
          <>
            <span aria-hidden>… </span>
            <a
              href={REVIEW_SUMMARY.url}
              target="_blank"
              rel="noopener noreferrer"
              className="type-telemetry align-middle text-azure-bright underline underline-offset-4"
            >
              read in full
            </a>
          </>
        )}
      </p>
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Stars count={review.stars} />
        <cite className="type-telemetry text-cream not-italic">{review.name}</cite>
        <span className="type-telemetry text-cream-faint">{review.when}</span>
      </footer>
    </blockquote>
  );
}

/* -------------------------------------------------------------- pass wall -- */

function PassPhoto({ photo, index }: { photo: (typeof STUDENT_PHOTOS)[number]; index: number }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <figure
      className="reveal relative overflow-hidden bg-ink-850"
      data-reveal
      // Alternating aspect ratios and a periodic double-width tile keep the
      // wall from resolving into a uniform grid of identical thumbnails.
      style={{ aspectRatio: index % 5 === 0 ? '4 / 5' : '3 / 4' }}
    >
      <img
        src={photo.blur}
        alt=""
        aria-hidden
        className={`absolute inset-0 h-full w-full scale-110 object-cover blur-lg transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`}
      />
      <img
        src={photo.srcSmall}
        srcSet={`${photo.srcSmall} 640w, ${photo.src} 1100w`}
        sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 90vw"
        alt="A Free Fly student holding their ICBC road test pass slip beside the school's Tesla Model 3."
        loading="lazy"
        decoding="async"
        width={photo.width}
        height={photo.height}
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Slight bottom fade so the wall sits in the page's dark palette rather
          than reading as a bright photo grid pasted on top of it. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent"
      />
    </figure>
  );
}

/* ----------------------------------------------------------------- section -- */

export function Testimonials() {
  const photos = STUDENT_PHOTOS.filter((p) => p.car === 'tesla');

  return (
    <Section id="reviews" index="04" eyebrow="What students say" className="pb-24 md:pb-36">
      <Scrim from="top" />

      <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
        {/* Deliberately no number in this headline. The only count we can
            verify is the Google review count, and reviews are not passes: far
            more students have passed than have left a review, so printing the
            review count here would both misdescribe it and undersell the
            school. The rating readout beside it carries the number, correctly
            labelled as reviews. */}
        <h2 className="reveal type-heading text-display max-w-[10ch] text-cream" data-reveal>
          Five stars,
          <br />
          no exceptions
        </h2>

        {/* The aggregate, set as an instrument readout. This is the single
            strongest trust signal the business has: a 5.0 average with every
            review counted. */}
        <a
          href={REVIEW_SUMMARY.url}
          target="_blank"
          rel="noopener noreferrer"
          className="reveal group flex items-end gap-5"
          data-reveal
        >
          <span className="font-display text-6xl font-extrabold tracking-tight text-cream md:text-7xl">
            {REVIEW_SUMMARY.rating.toFixed(1)}
          </span>
          <span className="flex flex-col gap-2 pb-2">
            <Stars count={5} />
            <span className="type-telemetry text-cream-dim transition-colors group-hover:text-azure-bright">
              {REVIEW_SUMMARY.count} {REVIEW_SUMMARY.source} reviews
            </span>
          </span>
        </a>
      </div>

      <div className="mt-14 grid gap-x-12 gap-y-10 md:mt-20 md:grid-cols-12">
        {REVIEWS.map((review, i) => (
          <ReviewCard key={review.name} review={review} wide={i % 3 === 0} />
        ))}
      </div>

      <div className="mt-20 md:mt-28">
        <p className="reveal type-telemetry mb-8 text-cream-faint" data-reveal>
          Recent passes
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {photos.map((photo, i) => (
            <PassPhoto key={photo.slug} photo={photo} index={i} />
          ))}
        </div>
      </div>
    </Section>
  );
}
