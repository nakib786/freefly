/**
 * GET /api/plans: Wix Pricing Plans proxy (Cloudflare Pages Function).
 *
 * Exists so the Wix API key stays server-side. Calling wixapis.com straight
 * from the browser would mean shipping a key that can read the site's plans to
 * every visitor, and Wix does not offer a public read for this collection.
 *
 * Shape confirmed against
 * https://dev.wix.com/docs/rest/business-solutions/pricing-plans/plans-v3/query-plans
 *   POST https://www.wixapis.com/pricing-plans/v3/plans/query
 *   -> { plans: [{ id, name, description, currency, visibility, buyable,
 *                  perks: [{ id, description }],
 *                  pricingVariants: [{ pricingStrategies: [{ flatRate: { amount } }] }] }] }
 * Note the REST field names are unprefixed (`id`); the JS SDK returns `_id`
 * and `_items` instead. This talks REST.
 *
 * Required environment variables (Pages project -> Settings -> Variables):
 *   WIX_API_KEY   an API key with the "Read Pricing Plans" permission scope
 *   WIX_SITE_ID   eb31b268-571e-4711-a79e-b3aabdb44f2f
 *
 * If either is missing the function returns 503 with `{ configured: false }`,
 * and the client quietly renders its bundled fallback plans. That is deliberate:
 * a pricing section that vanishes is worse than one showing last-known prices.
 *
 * Freshness: an edit in the Wix dashboard reaches the site within
 * EDGE_TTL_SECONDS. `GET /api/plans?fresh=1` skips even that. Check which layer
 * answered with the `x-plans-cache` response header (hit | miss | bypass).
 */

type Env = {
  WIX_API_KEY?: string;
  WIX_SITE_ID?: string;
};

type WixPerk = { id?: string; description?: string };
type WixPricingVariant = {
  pricingStrategies?: { flatRate?: { amount?: string } }[];
};
type WixPlan = {
  id?: string;
  name?: string;
  description?: string;
  currency?: string;
  visibility?: string;
  buyable?: boolean;
  status?: string;
  archived?: boolean;
  termsAndConditions?: string;
  displayIndex?: number;
  perks?: WixPerk[];
  pricingVariants?: WixPricingVariant[];
};

type PagesContext = {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
};

const WIX_ENDPOINT = 'https://www.wixapis.com/pricing-plans/v3/plans/query';

/**
 * Short enough that a price edit in the Wix dashboard is visible on the next
 * reload, long enough that a burst of traffic cannot spend the site's Wix API
 * quota. Enforced by storing the response with this `Cache-Control`: the Cache
 * API definitely honours `max-age`, whereas whether `CDN-Cache-Control` wins
 * over it is not something to bet propagation time on.
 */
const EDGE_TTL_SECONDS = 15;

/**
 * The copy handed to the browser is never stored. A browser cache stacks on top
 * of the edge TTL, and `stale-while-revalidate` in particular paints the *old*
 * price and only picks the new one up on the load after, which is precisely
 * what made a saved edit look like it had not synced at all.
 */
const CLIENT_CACHE = 'no-store';

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });

/**
 * Same body, different `Cache-Control`: the stored copy carries the edge TTL,
 * the client copy carries none. `x-plans-cache` says which layer answered, so
 * "is this stale or is it broken?" is one curl away instead of a guess.
 */
function forClient(stored: Response, state: 'hit' | 'miss' | 'bypass'): Response {
  const out = new Response(stored.body, stored);
  out.headers.set('cache-control', CLIENT_CACHE);
  out.headers.set('x-plans-cache', state);
  return out;
}

function toPlan(plan: WixPlan) {
  const amount = plan.pricingVariants?.[0]?.pricingStrategies?.[0]?.flatRate?.amount;
  const price = amount === undefined ? null : Number.parseFloat(amount);

  return {
    id: plan.id ?? plan.name ?? crypto.randomUUID(),
    name: plan.name ?? 'Untitled plan',
    description: plan.description ?? '',
    price: price !== null && Number.isFinite(price) ? price : null,
    currency: plan.currency ?? 'CAD',
    perks: (plan.perks ?? []).map((perk) => perk.description?.trim()).filter((d): d is string => !!d),
    terms: plan.termsAndConditions?.trim() || undefined,
  };
}

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;

  if (!env.WIX_API_KEY || !env.WIX_SITE_ID) {
    return json({ configured: false, plans: [] }, 503, { 'cache-control': 'no-store' });
  }

  /**
   * `?fresh=1` re-reads Wix regardless of what is at the edge, and refreshes
   * the stored copy for everyone else while it is at it. The cache key below is
   * a fixed path, so without an explicit bypass there is no way at all (not a
   * hard refresh, not incognito, not a redeploy) to make the edge re-read
   * before the TTL lapses. That made "did my edit actually save?" unanswerable.
   */
  const bypass = new URL(request.url).searchParams.has('fresh');

  const cache = (caches as unknown as { default: Cache }).default;
  // Fixed key on purpose: every visitor shares one read, and a query string
  // cannot be used to multiply the number of calls we make against Wix.
  const cacheKey = new Request(new URL('/api/plans', request.url).toString(), { method: 'GET' });

  if (!bypass) {
    const hit = await cache.match(cacheKey);
    if (hit) return forClient(hit, 'hit');
  }

  let upstream: Response;
  try {
    upstream = await fetch(WIX_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: env.WIX_API_KEY,
        'wix-site-id': env.WIX_SITE_ID,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: {
          filter: { visibility: 'PUBLIC' },
          cursorPaging: { limit: 100 },
        },
      }),
    });
  } catch {
    return json({ configured: true, error: 'upstream_unreachable', plans: [] }, 502, {
      'cache-control': 'no-store',
    });
  }

  if (!upstream.ok) {
    // Surface the status but never the body; it can echo the key back.
    return json({ configured: true, error: `upstream_${upstream.status}`, plans: [] }, 502, {
      'cache-control': 'no-store',
    });
  }

  const data = (await upstream.json()) as { plans?: WixPlan[] };
  const plans = (data.plans ?? [])
    // `buyable: false` plans are dashboard-assigned only and can't be bought
    // from the site, so showing them with a price would be misleading.
    // Archived and non-ACTIVE plans are filtered for the same reason: the
    // PUBLIC visibility filter alone does not exclude them.
    .filter((plan) => plan.buyable !== false && !plan.archived && plan.status !== 'ARCHIVED')
    .map(toPlan);

  const stored = json({ configured: true, plans, fetchedAt: new Date().toISOString() }, 200, {
    'cache-control': `public, max-age=${EDGE_TTL_SECONDS}`,
  });

  context.waitUntil(cache.put(cacheKey, stored.clone()));
  return forClient(stored, bypass ? 'bypass' : 'miss');
};
