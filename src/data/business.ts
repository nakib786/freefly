/**
 * Every business fact the site renders, in one place.
 *
 * Sourced from freeflydriving.ca and the brief. Nothing here is invented. If a
 * detail was not stated somewhere verifiable it is either absent or explicitly
 * marked as a placeholder (see `PLACEHOLDERS` at the bottom, which is what
 * drives the dev-only "needs real content" markers in the UI).
 */
import { CITY_PLACEHOLDER } from './cities';

export const BUSINESS = {
  legalName: 'Free Fly Driving School Limited',
  name: 'Free Fly Driving School',
  /** Verbatim from the current homepage. */
  tagline: 'Get Lessons in Tesla!',
  phone: '+1 250-572-1808',
  phoneHref: 'tel:+12505721808',
  email: 'freeflydriving@gmail.com',
  emailHref: 'mailto:freeflydriving@gmail.com',
  region: 'Lower Mainland, BC',
  /** Cities named in the live Wix pricing plan perks. */
  cities: ['Burnaby', 'Vancouver', 'Coquitlam'],
  licenceClasses: ['Class 5', 'Class 7'],
  currentSite: 'https://freeflydriving.ca',

  /** From the verified Google Business Profile (read 2026-08-11). */
  address: {
    street: '10843 132a St',
    city: 'Surrey',
    region: 'BC',
    postalCode: 'V3T 3Y2',
    country: 'CA',
  },
  /** Same hours every day, per the Google listing. */
  hours: { opens: '08:30', closes: '21:00', days: 'Every day' },
  mapsUrl: 'https://maps.app.goo.gl/',
} as const;

/**
 * Year the school started operating. Supplied by the client, and corroborated
 * by the Wix Pricing Plans, every one of which has a createdDate of 2022-08-17.
 */
export const FOUNDED = 2022;

/**
 * The instructor.
 *
 * Every clause below traces to something checkable: the founding year above,
 * the Google rating, the licence classes the school sells, and the reviews in
 * reviews.ts. Nothing here claims a certification, a number of years behind the
 * wheel, a teaching qualification or a personal history, because none of those
 * have been supplied. If Harry provides them, extend this; do not guess.
 */
export const INSTRUCTOR = {
  firstName: 'Harry',
  role: 'Owner & lead instructor',
  bio: [
    `Harry has run Free Fly since ${FOUNDED}, teaching Class 5 and Class 7 across the Lower Mainland in the school's Tesla Model 3.`,
    'Students describe the same three things over and over in their reviews: he is patient, he is methodical, and he picks up the phone when you need him. A lot of them pass on the first attempt.',
  ],
} as const;

export const SOCIALS = [
  { label: 'Instagram', handle: '@freeflydriving', href: 'https://www.instagram.com/freeflydriving/' },
  { label: 'Facebook', handle: 'freeflydriving', href: 'https://www.facebook.com/freeflydriving/' },
  {
    label: 'YouTube',
    handle: 'Free Fly Driving',
    href: 'https://www.youtube.com/channel/UCn79zN7UAQA_hMes59SRKfA',
  },
  { label: 'TikTok', handle: '@freeflydriving', href: 'https://www.tiktok.com/@freeflydriving' },
] as const;

/**
 * The "top 3" credential carried over from the current homepage.
 *
 * ⚠ The source link is deliberately null. The live site points this claim at
 * https://vancouverdigitalweek.com/best-driving-schools-vancouver/, and that
 * entire domain now 301-redirects to raja700toto.com, an unrelated gambling
 * site. Whoever owned vancouverdigitalweek.com let it lapse and it has been
 * re-registered. Linking there from a driving school would hand a spam domain a
 * backlink and send real students to a casino page, so the badge renders as
 * plain text until a live source exists.
 *
 * To restore the link: set `sourceUrl` and it becomes an anchor automatically.
 */
export const AWARD = {
  claim: 'Ranked among top 3 driving schools',
  attribution: 'Vancouver Digital Week',
  sourceUrl: null as string | null,
} as const;

/**
 * Why a Tesla is a better car to learn in. Each of these maps to a capability
 * the current site already claims it teaches, so none of it is a new claim.
 */
export const TESLA_ADVANTAGES = [
  {
    id: 'regen',
    index: '01',
    title: 'Regenerative braking',
    body: 'Lifting off the accelerator slows the car noticeably harder than in a petrol automatic. It forces you to read the road further ahead and plan your stops instead of reacting with the brake pedal, which is the habit examiners are watching for.',
    telemetry: 'One-pedal driving',
  },
  {
    id: 'safety',
    index: '02',
    title: 'Safety systems as a teacher',
    body: 'Blind-spot and collision warnings fire before a mistake becomes an incident, so a near-miss turns into a talking point rather than a scare. Learning beside them builds the shoulder-check habit rather than replacing it.',
    telemetry: 'Active assistance',
  },
  {
    id: 'autopilot',
    index: '03',
    title: 'Familiarity with assisted driving',
    body: 'Assisted driving is standard on most new cars now. Knowing exactly what it does, what it does not do, and when to take over is part of being a competent modern driver, not an optional extra.',
    telemetry: 'Hands on, eyes up',
  },
  {
    id: 'interface',
    index: '04',
    title: 'Touchscreen and cabin controls',
    body: 'Mirrors, wipers, lights and climate all live on a screen. Getting fluent with them before your road test means the setup you do in the first thirty seconds is muscle memory, not a fumble in front of an examiner.',
    telemetry: 'Cabin fluency',
  },
] as const;

/**
 * Steps from "never driven" to a full licence. Structure is ours; the substance
 * is BC's Graduated Licensing Program, which the labels must match exactly:
 * 7L is the learner stage, 7N the novice stage reached by passing the Class 7
 * road test, and Class 5 the full licence reached by passing the Class 5 road
 * test. Calling any of those by the wrong name misinforms a student about which
 * test they are actually booking, so do not shorten or reorder them.
 */
export const JOURNEY = [
  { step: '7L', label: 'Learner', note: 'Knowledge test passed, ready for the wheel' },
  { step: '01', label: 'Lessons', note: 'Beginner, intermediate or advanced, depending where you start' },
  { step: '02', label: 'Road test prep', note: 'Warm-up class, then our car for the test' },
  { step: '7N', label: 'Novice', note: 'Class 7 road test passed, driving on your own' },
  { step: '5', label: 'Full licence', note: 'Class 5 road test passed, restrictions lifted' },
] as const;

/**
 * Direction of travel through the classes above. `licenceClasses` is stored in
 * plain "we teach both" order for the header and footer; a student progresses
 * the other way, so the journey heading needs its own string.
 */
export const LICENCE_PATH = 'Class 7 to Class 5';

/**
 * Anything on the page that is NOT real client content yet. Surfaced in the
 * console on dev builds and used to render visible placeholder markers, so a
 * dummy section can never quietly ship.
 */
export const PLACEHOLDERS = [
  CITY_PLACEHOLDER,
  'Instructor credentials: Harry\'s photo and bio are in. Certifications, licence-instructor number and years of experience are still not supplied, so none are claimed.',
  'Reviews: 3 of 153 are quoted. Two are excerpts (Google truncated them) and are marked as such in the UI. Worth pasting the full text of both into src/data/reviews.ts.',
  'Award backlink: the "top 3" source domain (vancouverdigitalweek.com) 301-redirects to an unrelated site, so the badge renders unlinked. Client is checking; leave as-is meanwhile.',
  'Fleet: 11 of the supplied photos show the school\'s older Hyundai Sonata rather than the Tesla. They are processed but not displayed, since the site\'s proposition is learning in a Model 3.',
] as const;
