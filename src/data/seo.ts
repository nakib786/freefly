/**
 * Search and answer-engine configuration.
 *
 * One origin, one crawler policy, one place to change either. Everything that
 * writes a URL into a canonical tag, a sitemap, an og:url, a JSON-LD @id or an
 * llms.txt line reads it from here, because the single most common way a site
 * loses its ranking to a duplicate is two files disagreeing about whether the
 * canonical host has a `www.`.
 */

/**
 * Canonical origin. No trailing slash.
 *
 * ⚠ Change this in one place only. Every canonical tag, og:url, JSON-LD @id,
 * sitemap <loc> and llms.txt link is derived from it, and the single most
 * common way a site loses its ranking to a duplicate of itself is two files
 * disagreeing about the host.
 *
 * ── Why `www.` and not the apex ────────────────────────────────────────────
 *
 * This is a stopgap, and the apex is still where this should end up.
 *
 * `freeflydriving.ca` has no DNS record of any kind. The zone runs on Wix
 * nameservers (ns2/ns3.wixdns.net) and Wix's DNS panel has no CNAME flattening
 * or ALIAS record, so the apex cannot be pointed at a Pages project at all:
 * DNS forbids a CNAME at the zone apex, and Pages publishes no stable A record
 * to use instead. The apex was canonical here before it was ever resolvable,
 * which meant every canonical tag, every sitemap <loc> and the `www.` redirect
 * all aimed at a host that answers nothing.
 *
 * `www.freeflydriving.ca` is a plain CNAME, which Wix DNS does support, and it
 * already resolves to the Pages project. So it is the only host the business
 * can advertise today that actually serves.
 *
 * Moving the zone onto Cloudflare restores the apex (CNAME flattening makes it
 * possible) and this should be changed back to `https://freeflydriving.ca` on
 * that day, together with `CANONICAL_HOST` in functions/_middleware.ts. Until
 * then, pointing canonicals at the apex points them at nothing.
 *
 * `new.freeflydriving.ca` and `freefly-driving.pages.dev` are deploy hosts and
 * must never appear here. They serve the identical site, so canonicalising onto
 * one would point the whole index at a URL the business does not advertise. The
 * middleware sends `noindex` on `.pages.dev` for the same reason.
 */
export const ORIGIN = 'https://www.freeflydriving.ca';

/** Host part of ORIGIN, for the redirect and for host comparisons. */
export const CANONICAL_HOST = new URL(ORIGIN).host;

/** Absolute URL from a root-relative path. */
export const abs = (path: string): string =>
  `${ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;

export const SITE = {
  locale: 'en-CA',
  /** Used in <title> after the page-specific part. */
  titleSuffix: 'Free Fly Driving School',
  /** og:image and the JSON-LD `image`. Absolute, because both require it. */
  image: abs('/models/tesla-static-hero.webp'),
  /**
   * Bumped by the generator on every build. Sitemap <lastmod> needs a real
   * date, and a hardcoded one that never moves is worse than none: it tells
   * Google the page is stale every time it checks.
   */
  buildDateFallback: '2026-08-12',
} as const;

/**
 * Crawler policy, written out rather than left to a bare `Allow: /`.
 *
 * The split is deliberate and it is the client's call to reverse:
 *
 *   Search and answer engines that cite  →  allowed
 *     Googlebot, Bingbot, and the retrieval bots that fetch a page to answer a
 *     live question and link back (OAI-SearchBot, ClaudeBot, PerplexityBot).
 *     For a local business these are the referral channel that is replacing
 *     "10 blue links", so blocking them is blocking customers.
 *
 *   Bulk training scrapers that do not cite  →  disallowed
 *     CCBot and Bytespider take the content into a corpus and send nothing
 *     back. There is no upside for a driving school in Surrey.
 *
 * Content-Signal (Cloudflare's robots.txt extension, RFC-shaped as
 * `search=yes, ai-input=yes, ai-train=no`) states the same preference in the
 * machine-readable form the agent-readiness scanners look for. It is a stated
 * preference, not an enforcement mechanism; enforcement would be Cloudflare's
 * AI Crawl Control on the zone itself.
 */
export const CONTENT_SIGNAL = 'search=yes, ai-input=yes, ai-train=no';

export const CRAWLERS = {
  /** Fetch to answer a live query and link back. */
  cite: [
    'Googlebot',
    'Google-Extended',
    'Bingbot',
    'DuckDuckBot',
    'Applebot',
    'Applebot-Extended',
    'OAI-SearchBot',
    'ChatGPT-User',
    'GPTBot',
    'ClaudeBot',
    'Claude-User',
    'Claude-SearchBot',
    'PerplexityBot',
    'Perplexity-User',
    'Amazonbot',
    'MistralAI-User',
  ],
  /** Bulk corpus collection with no referral path back. */
  block: ['CCBot', 'Bytespider', 'Diffbot', 'Omgilibot', 'ImagesiftBot', 'meta-externalagent'],
} as const;

/**
 * Paths that exist for machines. Listed here so the generator, the `_headers`
 * Link rels and the sitemap cannot drift apart.
 */
export const AGENT_ENDPOINTS = {
  llms: '/llms.txt',
  llmsFull: '/llms-full.txt',
  sitemap: '/sitemap.xml',
  robots: '/robots.txt',
  /** RFC 9727. */
  apiCatalog: '/.well-known/api-catalog',
  /** Cloudflare agent-readiness check. */
  mcpCard: '/.well-known/mcp/server-card.json',
  agentSkills: '/.well-known/agent-skills/index.json',
} as const;
