/**
 * POST /api/contact — the site's enquiry form endpoint.
 *
 * Thin proxy onto the freefly-mailer Worker over a service binding. All the
 * validation, rate limiting and mail composition live there; this exists so the
 * form posts same-origin to new.freeflydriving.ca (no CORS, no second hostname
 * for a visitor's browser to reach) while the mailer stays private with no
 * public route at all.
 *
 * The split is forced by the platform: `send_email` and `ratelimits` are
 * Workers-only bindings that Pages config rejects. See ../../wrangler.toml.
 */

type Env = {
  MAILER: { fetch(request: Request): Promise<Response> };
};

type PagesContext = { request: Request; env: Env };

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;

  // Forward the visitor's real IP. Across a service binding the mailer's own
  // CF-Connecting-IP is this Function, not the visitor, so without this every
  // submission would share a single rate-limit bucket.
  const headers = new Headers(request.headers);
  headers.set('X-Enquirer-IP', request.headers.get('CF-Connecting-IP') ?? 'unknown');

  try {
    return await env.MAILER.fetch(
      new Request('https://freefly-mailer/submit', {
        method: 'POST',
        headers,
        body: request.body,
        // Required by fetch when a body is streamed rather than buffered.
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
    );
  } catch (error) {
    console.error('mailer unreachable', error);
    return new Response(
      JSON.stringify({ error: 'send_failed', message: 'Could not send just now — please call us.' }),
      { status: 502, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
    );
  }
};

/** Anything other than POST on this path is a mistake, not a route. */
export const onRequest = async (context: PagesContext): Promise<Response> => {
  if (context.request.method === 'POST') return onRequestPost(context);
  return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
    status: 405,
    headers: { 'content-type': 'application/json', allow: 'POST' },
  });
};
