/**
 * Google reviews.
 *
 * Read from the business's verified Google Business Profile on 2026-08-11:
 * https://www.google.com/maps/place/Free+Fly+Driving+School+limited
 *
 * Rules this file follows, deliberately:
 *
 *  - Nothing is paraphrased or "cleaned up". Text is exactly as written,
 *    including the reviewers' own punctuation and capitalisation.
 *  - `truncated: true` marks a review whose full text was cut off by Google's
 *    "More" expander. Those render with a visible ellipsis and a link to the
 *    full review rather than being silently presented as complete — trimming a
 *    review to its flattering half is exactly the kind of edit that turns a
 *    real testimonial into a fabricated one.
 *  - No review is invented, and none may be added here that was not actually
 *    left by a real customer.
 *
 * To add more: open the listing, copy the reviewer name, star rating, relative
 * date and full text verbatim into a new entry.
 */

export type Review = {
  name: string;
  stars: number;
  /** Relative age as Google reported it at capture time. */
  when: string;
  text: string;
  /** True when Google's UI cut the text off and the rest was not captured. */
  truncated?: boolean;
};

/** Aggregate as shown on the Google Business Profile. */
export const REVIEW_SUMMARY = {
  rating: 5.0,
  count: 153,
  source: 'Google',
  /** Public listing, for "read all reviews". */
  url: 'https://www.google.com/maps/place/Free+Fly+Driving+School+limited/data=!4m7!3m6!1s0x5485d788947067fd:0xd9e5665b2e3bb24a!8m2!3d49.199814!4d-122.855305!16s%2Fg%2F11s3cc0s0w!19sChIJ_WdwlIjXhVQRSrI7Lltm5dk',
  capturedOn: '2026-08-11',
} as const;

export const REVIEWS: readonly Review[] = [
  {
    name: 'SEONGEUN JEON',
    stars: 5,
    when: '2 months ago',
    text: "Highly recommend Harry. He is the best driving instructor you can find in Vancouver. He's knowledgeable, patient, kind, and most importantly, he's always there for you when you need him. I took four lessons with him and passed my class 5 road test on the first try.",
  },
  {
    name: 'Sameena Hossain',
    stars: 5,
    when: '2 months ago',
    text: 'I got my class 5 license today. Harry is the most patient and methodical driving instructor I have ever had the privilege of working with. I migrated from Bangladesh 3yrs back. I had no prior driving experience in Canada. I had a license in',
    truncated: true,
  },
  {
    name: 'Claire Tang',
    stars: 5,
    when: '11 months ago',
    text: 'I cannot recommend this driving school enough — and especially my instructor, Harry. I passed my driving test on the first attempt, and the only comment from the examiner was simply: “Great job!” Honestly, I still can’t believe it, and this',
    truncated: true,
  },
];
