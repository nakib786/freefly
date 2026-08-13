/**
 * Questions and answers, written for extraction rather than for reading.
 *
 * These feed three things at once: the FAQPage JSON-LD on the homepage and on
 * every city page, the visible FAQ block on the city pages, and the Q&A section
 * of llms.txt. An answer engine quoting this site is quoting these strings, so
 * they are written to survive being lifted out of context: each answer opens
 * with the direct answer, names the business, and carries its own units and
 * qualifiers rather than relying on the question or the surrounding page.
 *
 * ── What is allowed in an answer ────────────────────────────────────────────
 *
 * Only facts that are already verified somewhere in src/data: the Google
 * Business Profile (address, hours, rating), the live Wix Pricing Plans
 * (package contents, prices, the cities named in the perks) and the licence
 * classes the school sells. Prices are interpolated from the plan data at build
 * time rather than typed here, so a change in Wix cannot leave a stale number
 * sitting inside a rich result.
 *
 * Deliberately NOT answered here: how long the L and N stages last, what the
 * GLP waiting periods are, and whether an out-of-province licence transfers.
 * Those are ICBC's rules, they change, and an answer engine quoting a stale
 * regulatory claim from a driving school's own site is a genuinely harmful
 * outcome. Those questions get a pointer to ICBC instead of a number.
 */
import { BUSINESS, INSTRUCTOR } from './business';
import { CITIES, TIER_AVAILABILITY, type City } from './cities';

export type Faq = { q: string; a: string };

/** Prices vary with the live Wix read, so answers take them as inputs. */
export type PriceContext = {
  /** Cheapest single lesson, formatted, e.g. "$90". */
  singleLesson: string;
  /** Road Test Package price, formatted. */
  roadTest: string;
  /** Cheapest package price, formatted. */
  fromPackage: string;
};

const CORE = CITIES.filter((c) => c.tier === 'core')
  .map((c) => c.name)
  .join(', ');

/**
 * Site-wide FAQs. Order is deliberate: the two questions people actually search
 * for ("do you provide the car", "how much") come first, because an answer
 * engine asked a general question about the business tends to surface the
 * opening entries of a FAQPage.
 */
export function siteFaqs(price: PriceContext): readonly Faq[] {
  return [
    {
      q: 'Do you provide a car for the ICBC road test?',
      a: `Yes. ${BUSINESS.name}'s Road Test Package is ${price.roadTest} and includes a 60-minute warm-up lesson immediately before the test, the school's Tesla Model 3 for the test itself, and pickup and drop-off.`,
    },
    {
      q: 'How much do driving lessons cost?',
      a: `A single 90-minute lesson with ${BUSINESS.name} is ${price.singleLesson}. Lesson packages start at ${price.fromPackage} and run up to a 30-hour beginner package of twenty 90-minute lessons. Prices are in Canadian dollars and are quoted live from the school's booking system.`,
    },
    {
      q: 'Which cities do you teach in?',
      a: `${BUSINESS.name} is based in ${BUSINESS.address.city}, BC and teaches across the Lower Mainland. ${CORE} are named areas in the lesson packages. Other Lower Mainland cities are arranged by request.`,
    },
    {
      q: 'What car will I learn to drive in?',
      a: `A Tesla Model 3. It is an electric car with a single-speed transmission, so it drives as an automatic, and lessons cover the things that are specific to it: regenerative braking, the driver-assistance warnings, and the touchscreen controls for mirrors, wipers and lights that you have to set up before an examiner starts timing you.`,
    },
    {
      q: 'Do you teach both Class 7 and Class 5?',
      a: `Yes. ${BUSINESS.name} teaches the full BC path: Class 7 learner and novice stages, and the Class 5 road test that lifts the novice restrictions. Lessons are matched to where you are starting from rather than to a fixed syllabus.`,
    },
    {
      q: 'I already drive. Do you teach experienced drivers?',
      a: `Yes. The Intermediate package is built for drivers who already have basic skills and want to refine their technique, and the Advanced package is aimed at drivers preparing specifically for the Class 5 road test. A single lesson is also available if you only want a problem looked at.`,
    },
    {
      q: 'What are your hours?',
      a: `${BUSINESS.name} operates ${BUSINESS.hours.days.toLowerCase()}, ${BUSINESS.hours.opens} to ${BUSINESS.hours.closes}. Booking is by phone on ${BUSINESS.phone} or by email at ${BUSINESS.email}.`,
    },
    {
      q: 'Who is the instructor?',
      a: `${INSTRUCTOR.firstName} owns the school and teaches the lessons himself, and has run ${BUSINESS.name} since 2022. Every lesson is taught in the school's Tesla Model 3.`,
    },
    {
      q: 'How long do I have to hold a learner licence before the road test?',
      a: `That is set by ICBC, not by the school, and the waiting periods change, so check icbc.com for the current Graduated Licensing Program rules before you book a test. What the school can tell you is whether you are ready for the test, which is what the road-test warm-up lesson is for.`,
    },
  ];
}

/**
 * Per-city FAQs.
 *
 * The last entry is the one that matters. "What is difficult about driving in
 * X" is a real question with a genuinely different answer in every city, drawn
 * from that city's own `roads` copy, so each city page carries an answer no
 * other page on the site can give. That is also the honest test of whether a
 * city deserves a page at all: if there is nothing specific to say, there is
 * nothing to rank.
 */
export function cityFaqs(city: City, price: PriceContext): readonly Faq[] {
  const availability = TIER_AVAILABILITY[city.tier];

  return [
    {
      q: `Do you offer driving lessons in ${city.name}?`,
      a: `${BUSINESS.name} teaches in ${city.name}, BC. ${availability} The school is based in ${BUSINESS.address.city} and every lesson is taught in a Tesla Model 3.`,
    },
    {
      q: `Can I use your car for a road test in ${city.name}?`,
      a: `Yes. The Road Test Package is ${price.roadTest} and covers a 60-minute warm-up lesson, the school's Tesla Model 3 for the test, and pickup and drop-off. Book it far enough ahead of your ICBC appointment that the warm-up lands on the same day.`,
    },
    {
      q: `How much are driving lessons in ${city.name}?`,
      a:
        city.tier === 'extended'
          ? `A single 90-minute lesson is ${price.singleLesson} and packages start at ${price.fromPackage}. ${city.name} sits outside the areas named in the packages, so confirm travel and availability by phone on ${BUSINESS.phone} before booking.`
          : `A single 90-minute lesson is ${price.singleLesson} and packages start at ${price.fromPackage}. ${city.name} is a named area in the lesson packages, so the package price shown for it is the price you pay.`,
    },
    {
      // `roads` is ordered strongest first, so this takes the opening
      // paragraph rather than the last one. Taking the last used to answer the
      // question with whatever the page had chosen to wind down on, which on
      // several cities was the easy-roads paragraph.
      q: `What is difficult about driving in ${city.name}?`,
      a: city.roads[0],
    },
  ];
}
