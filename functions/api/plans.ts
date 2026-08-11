/**
 * GET /api/plans — Wix Pricing Plans proxy (Cloudflare Pages Function).
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

/** Prices do not change minute to minute; an hour at the edge is plenty. */
const EDGE_TTL_SECONDS = 3600;
/** Browsers may serve stale for a day while revalidating in the background. */
const BROWSER_CACHE = 'public, max-age=300, stale-while-revalidate=86400';

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });

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

  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(new URL('/api/plans', request.url).toString(), { method: 'GET' });

  const hit = await cache.match(cacheKey);
  if (hit) return hit;

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
    // Surface the status but never the body — it can echo the key back.
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

  const response = json(
    { configured: true, plans, fetchedAt: new Date().toISOString() },
    200,
    { 'cache-control': BROWSER_CACHE, 'cdn-cache-control': `max-age=${EDGE_TTL_SECONDS}` },
  );

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};
