/**
 * Markdown content negotiation (Cloudflare Pages Function).
 *
 * An agent that sends `Accept: text/markdown` gets the markdown twin of the
 * page instead of the HTML. `scripts/build-seo.mjs` writes those twins at build
 * time, so this only has to route to them: `/` serves `/index.md`, and
 * `/driving-lessons-burnaby` serves `/driving-lessons-burnaby.md`.
 *
 * Why bother, when the same content is already at a `.md` URL an agent could
 * fetch directly: content negotiation is the half that works without the agent
 * knowing the convention. It asks for the URL a human gave it and gets markup
 * it can read, at roughly a fifth of the tokens of the equivalent HTML, and it
 * is the check the agent-readiness scanners actually test.
 *
 * ── Costs and blast radius ─────────────────────────────────────────────────
 *
 * A root `_middleware.ts` wraps EVERY request to the project, including static
 * assets and /api/*. So the first thing it does is establish that this request
 * is not interesting and hand it straight back. The work only happens for a GET
 * whose Accept header actively prefers markdown, which no browser sends.
 *
 * `Vary: Accept` is mandatory on both branches. Without it Cloudflare's cache
 * can hand a browser the markdown that was fetched for an agent, or the reverse.
 */

/**
 * Hand-rolled rather than pulled from @cloudflare/workers-types, matching
 * functions/api/*.ts. The project does not depend on that package and these
 * three members are all this file touches.
 */
type Env = {
  /** Pages binding that serves the static files in dist/. */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
};

type PagesContext = {
  request: Request;
  env: Env;
  /** Continues to the static asset (or the next Function) for this request. */
  next: () => Promise<Response>;
};

/** Paths that have a `.md` twin. Anything else is passed through untouched. */
const MARKDOWN_ROUTES = /^\/(?:driving-lessons-[a-z-]+)?$/;

/**
 * The one host this site is canonical on. Must match `ORIGIN` in
 * src/data/seo.ts, which is where every canonical tag and sitemap URL comes
 * from. Duplicated as a literal rather than imported because Pages Functions
 * are bundled separately from the app and cannot reach into src/.
 */
const CANONICAL_HOST = 'www.freeflydriving.ca';

/**
 * The apex, which is currently not resolvable.
 *
 * Wix DNS holds the zone and cannot point an apex at a Pages project, so
 * `freeflydriving.ca` has no A, AAAA or CNAME record at all. See the long note
 * on `ORIGIN` in src/data/seo.ts for why the canonical host is `www.` until the
 * zone moves onto Cloudflare.
 */
const APEX_HOST = 'freeflydriving.ca';

/**
 * Hosts that serve the identical site and must not accumulate their own index.
 *
 * The apex gets a permanent redirect to the canonical host, which is the only
 * way to stop the two ranking as separate duplicates of each other; a canonical
 * tag alone is a hint that Google is free to ignore. The deploy hosts get
 * `noindex` instead of a redirect, because redirecting them would break the
 * ability to test a deploy before the domain points at it.
 */
const isDeployHost = (host: string) =>
  host.endsWith('.pages.dev') || host.startsWith('new.');

/**
 * Highest q-value for a media type in an Accept header.
 *
 * Returns null when the type is absent. `*​/*` deliberately does not count as a
 * markdown match: every curl and every browser sends it, and treating it as
 * "prefers markdown" would serve markdown to people.
 */
function quality(accept: string, type: string): number | null {
  let best: number | null = null;

  for (const part of accept.split(',')) {
    const [media, ...params] = part.trim().split(';');
    if (media.trim().toLowerCase() !== type) continue;

    const q = params
      .map((p) => p.trim().match(/^q=([\d.]+)$/i))
      .find(Boolean)?.[1];

    const value = q === undefined ? 1 : Number.parseFloat(q);
    if (Number.isFinite(value) && (best === null || value > best)) best = value;
  }

  return best;
}

/** True when the client asked for markdown and did not ask for HTML more. */
function prefersMarkdown(accept: string): boolean {
  const md = quality(accept, 'text/markdown');
  if (md === null || md === 0) return false;

  const html = quality(accept, 'text/html');
  return html === null || md >= html;
}

/** Markdown twin for this request, or null to let the request pass through. */
async function markdownTwin(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;

  const accept = request.headers.get('accept') ?? '';
  if (!accept.toLowerCase().includes('text/markdown')) return null;

  // Trailing slash is normalised so /driving-lessons-burnaby/ matches too.
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname;
  if (!MARKDOWN_ROUTES.test(path)) return null;
  if (!prefersMarkdown(accept)) return null;

  const twin = new URL(path === '/' ? '/index.md' : `${path}.md`, url.origin);

  let asset: Response;
  try {
    asset = await env.ASSETS.fetch(new Request(twin, { method: 'GET' }));
  } catch {
    // The binding is unavailable (or this is a preview without assets). The
    // HTML is always a correct answer, so fall back rather than 500.
    return null;
  }

  if (!asset.ok) return null;

  const headers = new Headers(asset.headers);
  headers.set('content-type', 'text/markdown; charset=utf-8');
  headers.set('vary', 'Accept');
  headers.set('cache-control', 'public, max-age=3600');
  headers.set('link', `<${url.pathname}>; rel="canonical"`);

  return new Response(request.method === 'HEAD' ? null : asset.body, { status: 200, headers });
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const host = url.hostname;

  // apex → www, before any work is done. 301 so the redirect is cached and the
  // link equity consolidates onto the canonical host rather than being split
  // across two hostnames serving byte-identical pages. Path and query are
  // preserved, so a deep link into a city page survives the hop.
  //
  // This runs in the direction opposite to what the README describes, and it is
  // deliberate: the apex has no DNS record, so the old www → apex redirect sent
  // every visitor who typed the advertised domain to a host that does not
  // resolve. Nothing can reach this branch today (an unresolvable host never
  // gets as far as a request), so it costs nothing, and it is already correct
  // for the moment an apex record starts existing.
  if (host === APEX_HOST) {
    url.hostname = CANONICAL_HOST;
    // Cloudflare already upgrades http at the edge, so this is belt and braces:
    // it guarantees the canonical redirect can never resolve to an http URL and
    // cost a second hop.
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }

  const response = (await markdownTwin(request, env, url)) ?? (await next());

  /**
   * Keep the deploy hosts out of the index.
   *
   * freefly-driving.pages.dev, any per-branch preview host and new.* all serve
   * the identical pages. Left alone that is a duplicate of the whole site on a
   * domain nobody advertises, competing with the real one and splitting its
   * signals, which is the classic way a staging host outranks production.
   *
   * The canonical tags alone are a hint, not a directive. `X-Robots-Tag:
   * noindex` is the directive. It is applied by host, so it never touches the
   * canonical domain and there is nothing to remember to undo after the
   * cutover.
   */
  if (isDeployHost(host)) {
    const guarded = new Response(response.body, response);
    guarded.headers.set('x-robots-tag', 'noindex, nofollow');
    return guarded;
  }

  return response;
};
