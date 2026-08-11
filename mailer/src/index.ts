/**
 * freefly-mailer — sends the site's enquiry form to the school's inbox.
 *
 * Invoked ONLY through a service binding from the freefly-driving Pages project
 * (`/api/contact` → `env.MAILER.fetch`). It has no public route and no custom
 * domain, so the only way in is via that binding — which is why there is no
 * CORS handling here and no need for one.
 *
 * It is a separate Worker purely because Pages cannot hold the bindings this
 * needs: `send_email` and `ratelimits` are Workers-only, and migrating the site
 * itself to a Worker would break new.freeflydriving.ca (the zone lives on Wix
 * nameservers). See the comment block in ../wrangler.toml for the full story.
 *
 * ─── Abuse surface ────────────────────────────────────────────────────────
 * The traffic reaching this is ultimately unauthenticated public form input, so
 * it is treated as hostile:
 *
 *   - Rate limited per end-user IP, forwarded by the Pages Function.
 *   - `destination_address` in wrangler.jsonc means Cloudflare itself refuses
 *     to deliver anywhere but the one verified inbox. The recipient is never
 *     taken from request data.
 *   - Every value that lands in a MIME header is stripped of CR/LF first.
 *     Without that, a newline in the name field injects arbitrary headers
 *     (Bcc:, etc.) — classic email header injection.
 *   - Field lengths capped; all interpolated values HTML-escaped.
 *   - Hidden `website` honeypot: accepted and discarded so bots see success.
 */
import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage, Mailbox } from 'mimetext';

type Env = {
  EMAIL: { send(message: EmailMessage): Promise<void> };
  RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  MAIL_FROM: string;
  MAIL_FROM_NAME: string;
};

/** Must match `destination_address` in wrangler.toml. */
const DESTINATION = 'nakibshaikh786@gmail.com';
const SITE = 'https://new.freeflydriving.ca';
/** Rendered in the email header. PNG, not SVG — email clients won't render SVG. */
const LOGO_URL = `${SITE}/apple-touch-icon.png`;

const LIMITS = { name: 120, phone: 40, email: 200, plan: 80, message: 4000 } as const;

/* ------------------------------------------------------------------- utils -- */

/**
 * Strips CR/LF and control characters. Applied to everything that ends up in a
 * MIME header — subject, display names, Reply-To — to prevent header injection.
 *
 * The control class uses explicit \u escapes rather than literal characters:
 * a literal control range is invisible in an editor and silently degrades to a
 * no-op if the file is ever copied or re-encoded.
 */
const headerSafe = (value: string, max = 200) =>
  value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/* ------------------------------------------------------------------- email -- */

type Enquiry = { name: string; phone: string; email: string; plan: string; message: string };

/**
 * Deliberately built to match the house style already used for the other
 * Aurora client sites (The Ninth House): logo card on a tinted ground, a
 * labelled detail table, and the Aurora attribution in the footer. The palette
 * and type are Free Fly's own — azure/marine/cream, mono for labels — so the
 * email reads as the same system as the website it came from.
 *
 * Table-based layout with inline styles because that is what actually survives
 * Gmail, Outlook and Apple Mail; a flexbox/grid email silently collapses.
 */
function renderHtml(enquiry: Enquiry, meta: { when: string; country: string }) {
  const rows: [string, string][] = [
    ['Name', enquiry.name],
    ['Phone', enquiry.phone || '—'],
    ['Email', enquiry.email || '—'],
    ['Interested in', enquiry.plan || 'Not specified'],
  ];

  const cell = 'padding:12px 0;border-bottom:1px solid #ece7e0;font-size:15px;line-height:1.5';
  const label = `${cell};color:#8a837c;width:132px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;vertical-align:top`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New lesson enquiry</title></head>
<body style="margin:0;padding:0;background:#f4f2ee;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(enquiry.name)} — ${escapeHtml(enquiry.plan || 'enquiry')}${'&nbsp;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e6e0d8">

      <tr><td style="padding:28px 32px;border-bottom:1px solid #ece7e0">
        <img src="${LOGO_URL}" alt="Free Fly Driving School" width="44" height="44" style="display:block;border:0;width:44px;height:44px" />
      </td></tr>

      <tr><td style="padding:32px 32px 8px">
        <p style="margin:0 0 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#1a72d6">New lesson enquiry</p>
        <h1 style="margin:0;font-size:26px;line-height:1.15;letter-spacing:-.02em;color:#16121a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-weight:700">${escapeHtml(enquiry.name)}</h1>
      </td></tr>

      <tr><td style="padding:20px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
          ${rows
            .map(
              ([k, v]) =>
                `<tr><td style="${label}">${k}</td><td style="${cell};color:#16121a;font-weight:600;word-break:break-word">${escapeHtml(v)}</td></tr>`,
            )
            .join('')}
        </table>
      </td></tr>

      ${
        enquiry.message
          ? `<tr><td style="padding:24px 32px 0">
        <p style="margin:0 0 8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a837c">Message</p>
        <div style="border-left:3px solid #1a72d6;padding:2px 0 2px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2a2429;white-space:pre-wrap">${escapeHtml(enquiry.message)}</div>
      </td></tr>`
          : ''
      }

      ${
        enquiry.phone
          ? `<tr><td style="padding:28px 32px 0">
        <a href="tel:${escapeHtml(enquiry.phone.replace(/[^\d+]/g, ''))}" style="display:inline-block;background:#1a72d6;color:#ffffff;text-decoration:none;padding:13px 22px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700">Call ${escapeHtml(enquiry.phone)}</a>
      </td></tr>`
          : ''
      }

      <tr><td style="padding:28px 32px 32px">
        <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #ece7e0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;line-height:1.7;letter-spacing:.08em;color:#a8a099">
          Sent from <a href="${SITE}" style="color:#0d4a92;text-decoration:none">new.freeflydriving.ca</a> · ${escapeHtml(meta.country)} · ${escapeHtml(meta.when)}<br />
          Delivered by <a href="https://aurorabusiness.ca" style="color:#0d4a92;text-decoration:none">Aurora N&amp;N Business Solutions Inc.</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

function renderText(enquiry: Enquiry, meta: { when: string; country: string }) {
  return [
    'NEW LESSON ENQUIRY — FREE FLY DRIVING SCHOOL',
    '',
    `Name:          ${enquiry.name}`,
    `Phone:         ${enquiry.phone || '—'}`,
    `Email:         ${enquiry.email || '—'}`,
    `Interested in: ${enquiry.plan || 'Not specified'}`,
    '',
    'Message:',
    enquiry.message || '(none)',
    '',
    '—',
    `Sent from new.freeflydriving.ca · ${meta.country} · ${meta.when}`,
    'Delivered by Aurora N&N Business Solutions Inc.',
  ].join('\n');
}

function buildMessage(enquiry: Enquiry, env: Env, meta: { when: string; country: string }) {
  const msg = createMimeMessage();
  msg.setSender({ name: headerSafe(env.MAIL_FROM_NAME, 60), addr: env.MAIL_FROM });
  msg.setRecipient(DESTINATION);

  // Subject leads with the plan so the inbox list is scannable without opening.
  const plan = enquiry.plan && enquiry.plan !== 'Not sure yet' ? ` · ${enquiry.plan}` : '';
  msg.setSubject(headerSafe(`Lesson enquiry — ${enquiry.name}${plan}`, 160));

  // Reply goes straight to the student, not to the sending address.
  // Must be a Mailbox instance: mimetext validates Reply-To with an
  // `instanceof Mailbox` check and throws on a plain string.
  if (enquiry.email && isEmail(enquiry.email)) {
    msg.setHeader('Reply-To', new Mailbox({ addr: enquiry.email, name: enquiry.name }));
  }

  msg.addMessage({ contentType: 'text/plain', data: renderText(enquiry, meta) });
  msg.addMessage({ contentType: 'text/html', data: renderHtml(enquiry, meta) });

  return new EmailMessage(env.MAIL_FROM, DESTINATION, msg.asRaw());
}

/* ---------------------------------------------------------------- handler -- */

async function handle(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // The end user's IP, forwarded by the Pages Function. Over a service binding
  // CF-Connecting-IP is the caller's, not the visitor's, so the real address
  // arrives in X-Enquirer-IP — otherwise every submission would share one rate
  // limit bucket and the first spammer would lock out every real student.
  const ip =
    request.headers.get('X-Enquirer-IP') ?? request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return json(
      { error: 'rate_limited', message: 'Too many enquiries just now — please call us instead.' },
      429,
    );
  }

  let body: Record<string, unknown>;
  try {
    const contentType = request.headers.get('content-type') ?? '';
    body = contentType.includes('application/json')
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const field = (key: keyof typeof LIMITS) =>
    typeof body[key] === 'string' ? (body[key] as string).trim().slice(0, LIMITS[key]) : '';

  // Honeypot — a hidden input real users never see. 200 so bots don't retune.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: true }, 200);
  }

  const enquiry: Enquiry = {
    name: headerSafe(field('name'), LIMITS.name),
    phone: headerSafe(field('phone'), LIMITS.phone),
    email: headerSafe(field('email'), LIMITS.email),
    plan: headerSafe(field('plan'), LIMITS.plan),
    // Not headerSafe: body content, newlines are meaningful. Escaped at render.
    message: field('message'),
  };

  if (!enquiry.name) return json({ error: 'name_required', message: 'Please add your name.' }, 422);
  if (!enquiry.phone && !enquiry.email) {
    return json({ error: 'contact_required', message: 'Add a phone number or an email.' }, 422);
  }
  if (enquiry.email && !isEmail(enquiry.email)) {
    return json({ error: 'email_invalid', message: "That email doesn't look right." }, 422);
  }

  try {
    await env.EMAIL.send(
      buildMessage(enquiry, env, {
        when: new Date().toUTCString(),
        country: request.headers.get('CF-IPCountry') ?? '??',
      }),
    );
  } catch (error) {
    // Never surface the cause — it leaks the sending address and routing setup.
    console.error('contact send failed', error);
    return json(
      { error: 'send_failed', message: 'Could not send just now — please call us.' },
      502,
    );
  }

  return json({ ok: true }, 200);
}

export default {
  fetch: handle,
} satisfies ExportedHandler<Env>;
