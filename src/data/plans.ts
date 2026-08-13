/**
 * Lesson plans.
 *
 * The live source of truth is Wix Pricing Plans on site
 * eb31b268-571e-4711-a79e-b3aabdb44f2f, read through /api/plans (a Cloudflare
 * Pages Function, so the API key never reaches the browser). The data below is
 * the fallback the page renders if that call fails or has not been configured
 * yet. It mirrors the five plans that are live in Wix today.
 *
 * Deliberately no plan imagery: all five plans in Wix share one placeholder
 * stock photo (image id e6f1d6_3c26a3066071457a80d225115e6034b4~mv2.jpg), so
 * the section differentiates tiers through structure instead; see PlanMeter,
 * which draws each plan's session count as a charge-meter of segments.
 */

export type PlanTier = 'single' | 'package' | 'capstone';

export type Plan = {
  id: string;
  name: string;
  description: string;
  /** Price in dollars. Null means "call for pricing" rather than free. */
  price: number | null;
  currency: string;
  perks: readonly string[];
  /** Wix `termsAndConditions`. Shown verbatim; empty on most plans. */
  terms?: string;
  /** Number of lessons in the plan; drives the meter graphic. */
  sessions: number;
  /** Total instruction hours. Drives the relative width of package columns. */
  hours: number;
  tier: PlanTier;
};

/**
 * Ordering and tiering are ours, not Wix's. Wix has no concept of a capstone
 * plan. Matching is by name (see `mergeWithFallback`), so if the client renames
 * a plan in the dashboard it still renders, just without the tier styling.
 */
/**
 * Copied verbatim from the live Wix plans (read 2026-08-11), so the fallback is
 * a true snapshot rather than a paraphrase. Descriptions and perks are exactly
 * as the client wrote them, including the parenthesised city prices, which
 * are the client's own wording for a surcharge, not a typo to be tidied up.
 */
export const FALLBACK_PLANS: readonly Plan[] = [
  {
    id: '8b275c8c-74ae-4b28-8955-85d7b4af4981',
    name: 'Individual Lesson',
    description: 'One lesson to examine the mistakes and providing solutions.',
    price: 90,
    currency: 'CAD',
    perks: ['90 minutes lesson'],
    sessions: 1,
    hours: 1.5,
    tier: 'single',
  },
  {
    id: '106b3ce9-668f-44f1-9532-6328cb5e96dd',
    name: 'Beginners Plan',
    description: 'Perfect for beginners with no prior driving experience',
    price: 1600,
    currency: 'CAD',
    perks: ['30 Hours (20 sessions of 90 minute length)', 'Burnaby, Vancouver, Coquitlam (1900)'],
    terms: 'Only applicable if paid in advance.',
    sessions: 20,
    hours: 30,
    tier: 'package',
  },
  {
    id: '9d013d88-96ff-42f8-89be-b3dd3c7762e7',
    name: 'Intermediate Plan',
    description: 'Ideal for drivers with basic skills who want to refine their technique.',
    price: 1200,
    currency: 'CAD',
    perks: ['21 Hours (14 lessons of 90 minute length)', 'Burnaby, Vancouver, Coquitlam ($1400)'],
    terms: 'Only applicable if whole amount will be paid in advance.',
    sessions: 14,
    hours: 21,
    tier: 'package',
  },
  {
    id: 'fc8b7bbc-e4f1-4e90-a475-a6bf0e280b33',
    name: 'Advanced Plan',
    description: 'Ideal for individuals preparing for their Class 5 license.',
    price: 520,
    currency: 'CAD',
    perks: ['9 Hours practice (6 lessons)'],
    terms: 'Only applicable if whole fees will be paid in advance.',
    sessions: 6,
    hours: 9,
    tier: 'package',
  },
  {
    id: 'c5eeae03-b9cc-4888-85b9-f53f9a70b581',
    name: 'Road Test Package',
    description: '60 minute warm up class and car is being provided for test.',
    price: 180,
    currency: 'CAD',
    perks: ['60 minutes warm up lesson (Pickup & Drop Off Included)'],
    sessions: 1,
    hours: 1,
    tier: 'capstone',
  },
] as const;

/**
 * What Wix actually owns. `sessions`, `hours` and `tier` have no equivalent in
 * the Pricing Plans model, so a live plan arrives without them.
 */
export type LivePlan = Pick<Plan, 'id' | 'name' | 'description' | 'price' | 'currency' | 'terms'> & {
  perks: readonly string[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Best-effort read of a lesson count out of a plan's own text, used only for
 * plans the client adds in Wix that we have no fallback entry for. Matches
 * "20 x 90min sessions", "6 lessons", "14 x 90 minute lessons".
 */
function guessSessions(plan: LivePlan): number {
  const haystack = [plan.description, ...plan.perks].join(' ');
  const times = haystack.match(/(\d+)\s*[x×]\s*\d+\s*(?:min|minute)/i);
  if (times) return Number(times[1]);
  const lessons = haystack.match(/(\d+)\s*(?:lessons|sessions)/i);
  if (lessons) return Number(lessons[1]);
  return 1;
}

function guessHours(plan: LivePlan): number {
  const hours = [plan.description, ...plan.perks].join(' ').match(/(\d+(?:\.\d+)?)\s*hours?/i);
  return hours ? Number(hours[1]) : guessSessions(plan) * 1.5;
}

/**
 * Wix owns name, description, price and perks; we own tier, session count and
 * hours, none of which exist in the Pricing Plans model. This grafts the two
 * together by name so live price changes flow through while the layout keeps
 * the structure it needs.
 *
 * A plan added in Wix that we have no fallback entry for still renders; it
 * just lands in the `package` tier with its meter derived from its own perks.
 */
export function mergeWithFallback(live: readonly LivePlan[]): readonly Plan[] {
  if (live.length === 0) return FALLBACK_PLANS;

  const byName = new Map(FALLBACK_PLANS.map((p) => [norm(p.name), p]));
  const merged: Plan[] = live.map((plan) => {
    const known = byName.get(norm(plan.name));
    return known
      ? { ...known, ...plan, tier: known.tier, sessions: known.sessions, hours: known.hours }
      : { ...plan, tier: 'package', sessions: guessSessions(plan), hours: guessHours(plan) };
  });

  // Preserve our deliberate order (single -> packages by size -> capstone)
  // rather than whatever order Wix returns.
  const rank = new Map(FALLBACK_PLANS.map((p, i) => [norm(p.name), i]));
  return merged.sort((a, b) => (rank.get(norm(a.name)) ?? 99) - (rank.get(norm(b.name)) ?? 99));
}

export function formatPrice(plan: Pick<Plan, 'price' | 'currency'>): string {
  if (plan.price === null) return 'Enquire';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: plan.currency || 'CAD',
    maximumFractionDigits: 0,
  }).format(plan.price);
}
