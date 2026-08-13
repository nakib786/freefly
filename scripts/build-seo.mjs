/**
 * Static SEO / AEO generator. Runs after `vite build`, writes into `dist/`.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * The site is a client-rendered React SPA. `dist/index.html` contains a `<div
 * id="root">` and a module script, and nothing else. Googlebot will render that
 * on a second pass; ClaudeBot, GPTBot, PerplexityBot, Applebot and CCBot will
 * not render it at all, because none of them execute JavaScript. So to the
 * crawlers that now feed AI answers, this site currently has no content.
 *
 * Everything below is the fix, and it is deliberately build-time rather than
 * runtime: the output is plain files on a CDN, so there is no server to be slow
 * and nothing to go stale between deploys.
 *
 *   /driving-lessons-<slug>      one zero-JavaScript HTML page per service
 *                                area, with the content in the markup
 *   /driving-lessons-<slug>.md   the same page as markdown, for `Accept:
 *                                text/markdown` content negotiation
 *   /index.md                    markdown twin of the homepage
 *   /llms.txt, /llms-full.txt    the site as one document, for LLM ingestion
 *   /robots.txt                  per-crawler rules + Cloudflare Content-Signal
 *   /sitemap.xml                 every canonical URL with a real lastmod
 *   /.well-known/*               api-catalog (RFC 9727), MCP server card,
 *                                agent-skills index
 *
 * It also rewrites two things inside `dist/index.html`: the JSON-LD block (so
 * the schema carries live prices instead of a snapshot) and a `<noscript>`
 * summary (so a non-rendering crawler gets the business facts rather than an
 * empty div).
 *
 * ── Prices ─────────────────────────────────────────────────────────────────
 *
 * Read live from the deployed /api/plans at build time, with the committed
 * `FALLBACK_PLANS` as the backstop when the network is unavailable. Baking a
 * price into a static page is only safe if the number is correct at the moment
 * it is baked, and the build is that moment.
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

/**
 * Where live prices come from, in order of preference.
 *
 * A list rather than one URL because the canonical host has moved before and
 * will move again: `www.` serves today, the apex will once the zone is on
 * Cloudflare, and the pages.dev host answers throughout. Trying them in order
 * means the build produces correct prices on either side of a move with nothing
 * to remember to edit on the day.
 *
 * The apex is last rather than first because it currently has no DNS record at
 * all, so it is the least likely of the three to answer, not the most.
 *
 * `new.` was removed when the hostname was retired. Leaving it in was not free:
 * it no longer 404s, it fails its TLS handshake, which is a slower failure to
 * fall through than a clean 404.
 */
const PLANS_APIS = [
  'https://www.freeflydriving.ca/api/plans',
  'https://freefly-driving.pages.dev/api/plans',
  'https://freeflydriving.ca/api/plans',
];
const PLANS_TIMEOUT_MS = 8000;

/* ------------------------------------------------------------------ data -- */

/**
 * The data modules are TypeScript and import each other by relative path, so
 * they are bundled with esbuild and imported as a data: URL rather than being
 * read as text or duplicated here. One source of truth, no parallel copy of the
 * business facts living in a build script.
 */
async function loadData() {
  const entry = `
    export { BUSINESS, FOUNDED, INSTRUCTOR, SOCIALS, AWARD, JOURNEY, LICENCE_PATH,
             TESLA_ADVANTAGES, PLACEHOLDERS } from './src/data/business';
    export { CITIES, cityPath, TIER_AVAILABILITY } from './src/data/cities';
    export { FALLBACK_PLANS, mergeWithFallback, formatPrice } from './src/data/plans';
    export { REVIEWS, REVIEW_SUMMARY } from './src/data/reviews';
    export { siteFaqs, cityFaqs } from './src/data/faqs';
    export { ORIGIN, abs, SITE, CONTENT_SIGNAL, CRAWLERS, AGENT_ENDPOINTS } from './src/data/seo';
  `;

  const built = await esbuild.build({
    stdin: { contents: entry, resolveDir: ROOT, sourcefile: 'seo-data.ts', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });

  const code = built.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

/**
 * Live prices, or the committed snapshot.
 *
 * A failed fetch is a warning, never a build failure: an offline build should
 * still produce correct pages, just with the snapshot's numbers.
 */
async function loadPlans(data) {
  const failures = [];

  for (const api of PLANS_APIS) {
    try {
      const res = await fetch(api, { signal: AbortSignal.timeout(PLANS_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const live = Array.isArray(body) ? body : (body.plans ?? []);
      if (!live.length) throw new Error('empty plan list');
      console.log(`  prices: live (${live.length} plans) from ${new URL(api).host}`);
      return data.mergeWithFallback(live);
    } catch (err) {
      failures.push(`${new URL(api).host}: ${err.message}`);
    }
  }

  console.warn(`  prices: FALLBACK SNAPSHOT. Pages will show committed prices.`);
  for (const f of failures) console.warn(`    tried ${f}`);
  return data.FALLBACK_PLANS;
}

/** The three numbers the FAQ answers and the schema need. */
function priceContext(data, plans) {
  const cheapest = (tier) =>
    plans.filter((p) => p.tier === tier && p.price != null).sort((a, b) => a.price - b.price)[0];

  const single = cheapest('single') ?? plans[0];
  const capstone = cheapest('capstone') ?? single;
  const pkg = cheapest('package') ?? single;
  const priced = plans.filter((p) => p.price != null).map((p) => p.price);

  return {
    singleLesson: data.formatPrice(single),
    roadTest: data.formatPrice(capstone),
    fromPackage: data.formatPrice(pkg),
    low: Math.min(...priced),
    high: Math.max(...priced),
  };
}

/* --------------------------------------------------------------- helpers -- */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Newest mtime across the files that actually produce a page. */
function lastmod(...relPaths) {
  const times = relPaths.map((p) => {
    try {
      return statSync(join(ROOT, p)).mtime.getTime();
    } catch {
      return 0;
    }
  });
  return new Date(Math.max(...times, 0) || Date.now()).toISOString().slice(0, 10);
}

/**
 * Locate the hashed woff2 files Vite emitted, so the static pages use the same
 * self-hosted type as the app instead of falling back to a system stack. The
 * latin subsets are the only ones the copy needs; if a build ever stops
 * emitting them the @font-face block is simply omitted and the CSS font stack
 * degrades on its own.
 */
function discoverFonts() {
  let files = [];
  try {
    files = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.woff2'));
  } catch {
    return [];
  }

  const pick = (prefix) => files.find((f) => f.startsWith(prefix));
  return [
    { family: 'Archivo Variable', file: pick('archivo-latin-wdth-normal-'), stretch: '62% 125%' },
    { family: 'Instrument Sans Variable', file: pick('instrument-sans-latin-wght-normal-'), stretch: '100%' },
    { family: 'Martian Mono Variable', file: pick('martian-mono-latin-wdth-normal-'), stretch: '75% 112%' },
  ].filter((f) => f.file);
}

/* ------------------------------------------------------------------- css -- */

/**
 * The city pages carry their own stylesheet inline.
 *
 * They deliberately do not link `assets/index-<hash>.css`: that file is 42 kB
 * of Tailwind for an app these pages do not run, and a landing page whose whole
 * argument is "arrives instantly and is legible to a crawler" should not open
 * with a render-blocking request. This is roughly 4 kB, inline, so the page is
 * one round trip with nothing blocking paint.
 *
 * Tokens are copied from src/styles/index.css rather than imported, and that
 * duplication is the one real cost of this approach. Keep them in step.
 */
function pageCss(fonts) {
  const faces = fonts
    .map(
      (f) => `@font-face{font-family:'${f.family}';src:url('/assets/${f.file}') format('woff2-variations');font-weight:100 900;font-stretch:${f.stretch};font-display:swap}`,
    )
    .join('');

  return `${faces}
:root{--ink-950:#060809;--ink-900:#0a0d11;--ink-850:#0e1216;--ink-700:#1c242c;--ink-600:#28323c;--cream:#fffbf4;--cream-dim:#ded9d1;--cream-faint:#a8a29a;--azure:#1a72d6;--azure-bright:#5aa6ff;--marine:#0d4a92;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--ink-950);color:var(--cream);font-family:'Instrument Sans Variable',ui-sans-serif,system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:clip}
a{color:inherit}
.wrap{max-width:78rem;margin:0 auto;padding-inline:1.5rem}
@media(width>=48rem){.wrap{padding-inline:3rem}}
.tele{font-family:'Martian Mono Variable',ui-monospace,monospace;font-stretch:85%;font-weight:500;font-size:.6875rem;letter-spacing:.16em;line-height:1.45;text-transform:uppercase}
h1,h2,h3{font-family:'Archivo Variable',ui-sans-serif,system-ui,sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:-.03em;line-height:.92;font-stretch:115%}
h1{font-size:clamp(2.5rem,7vw,5.5rem);line-height:.86}
h2{font-size:clamp(1.75rem,3.6vw,2.75rem);font-weight:700;font-stretch:108%}
h3{font-size:1.0625rem;font-weight:700;font-stretch:104%;letter-spacing:-.015em;line-height:1.25}
p{max-width:68ch;color:var(--cream-dim)}
.lede{font-family:'Archivo Variable',ui-sans-serif,system-ui,sans-serif;font-stretch:76%;font-weight:500;font-size:clamp(1.125rem,2.2vw,1.5rem);line-height:1.28;color:var(--cream-dim);max-width:52ch}
nav.bar{border-bottom:1px solid var(--ink-700);position:sticky;top:0;background:rgba(6,8,9,.88);backdrop-filter:blur(12px);z-index:10}
nav.bar .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;height:4rem}
nav.bar a{text-decoration:none;color:var(--cream-faint)}
nav.bar a:hover{color:var(--cream)}
.brand{font-family:'Archivo Variable',ui-sans-serif,system-ui,sans-serif;font-weight:800;font-stretch:118%;text-transform:uppercase;letter-spacing:-.02em;font-size:1.0625rem;color:var(--cream)!important}
.cta{display:inline-block;background:var(--azure);color:var(--cream)!important;padding:.9rem 1.5rem;text-decoration:none;transition:background .2s}
.cta:hover{background:var(--azure-bright)}
.cta.ghost{background:0 0;border:1px solid var(--ink-600);color:var(--cream-dim)!important}
.cta.ghost:hover{border-color:var(--azure-bright);color:var(--cream)!important}
section{border-top:1px solid var(--ink-700);padding-block:clamp(3rem,7vw,5.5rem)}
section:first-of-type{border-top:0}
.eyebrow{color:var(--azure-bright);margin-bottom:1.5rem}
.hero{padding-top:clamp(2.5rem,6vw,4.5rem)}
.hero h1{margin-bottom:1.5rem}
.facts{display:grid;gap:1px;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));background:var(--ink-700);border:1px solid var(--ink-700);margin-top:2.5rem}
.facts>div{background:var(--ink-950);padding:1.25rem}
.facts dt{color:var(--cream-faint);margin-bottom:.4rem}
.facts dd{font-family:'Martian Mono Variable',ui-monospace,monospace;font-stretch:85%;font-size:.9375rem;color:var(--cream)}
.facts dd a{color:var(--azure-bright);text-decoration:none}
.rows>div{border-top:1px solid var(--ink-700);padding-block:1.75rem;display:grid;gap:.5rem 2.5rem}
@media(width>=56rem){.rows>div{grid-template-columns:4rem 1fr}}
.rows .n{font-family:'Martian Mono Variable',ui-monospace,monospace;font-size:.8125rem;color:var(--azure)}
.plans{display:grid;gap:1px;background:var(--ink-700);border:1px solid var(--ink-700);grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));margin-top:2rem}
.plans article{background:var(--ink-900);padding:1.75rem;display:flex;flex-direction:column;gap:.75rem}
.plans .price{font-family:'Martian Mono Variable',ui-monospace,monospace;font-stretch:85%;font-size:1.75rem;color:var(--cream);letter-spacing:-.02em}
.plans p{font-size:.9375rem}
.plans ul{list-style:none;font-size:.875rem;color:var(--cream-faint);display:flex;flex-direction:column;gap:.4rem;margin-top:auto;padding-top:.75rem}
.plans li::before{content:'— ';color:var(--azure)}
.faq{display:grid;gap:0;margin-top:1rem}
.faq>div{border-top:1px solid var(--ink-700);padding-block:1.5rem}
.faq h3{margin-bottom:.6rem}
.faq p{font-size:.9375rem}
.quotes{display:grid;gap:1px;background:var(--ink-700);border:1px solid var(--ink-700);grid-template-columns:repeat(auto-fit,minmax(17rem,1fr));margin-top:2rem}
.quotes figure{background:var(--ink-900);padding:1.75rem;display:flex;flex-direction:column;gap:1rem}
.quotes blockquote{color:var(--cream-dim);font-size:.9375rem}
.quotes figcaption{color:var(--cream-faint)}
.stars{color:var(--azure-bright);letter-spacing:.2em;font-size:.8125rem}
.areas{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:2rem;list-style:none}
.areas a{display:inline-block;border:1px solid var(--ink-600);padding:.55rem 1rem;text-decoration:none;color:var(--cream-dim);transition:border-color .2s,color .2s}
.areas a:hover,.areas a:focus-visible{border-color:var(--azure-bright);color:var(--cream)}
.areas .here{border-color:var(--azure);color:var(--cream);background:var(--marine)}
footer{border-top:1px solid var(--ink-700);padding-block:3rem;color:var(--cream-faint);font-size:.875rem}
footer .wrap{display:grid;gap:2rem}
@media(width>=48rem){footer .wrap{grid-template-columns:1fr auto}}
footer a{color:var(--cream-dim)}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2.5rem}
:focus-visible{outline:2px solid var(--azure-bright);outline-offset:3px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;
}

/* ------------------------------------------------------------ city pages -- */

/** The schema.org graph for one city page. */
function cityJsonLd(data, city, plans, price, faqs) {
  const url = data.abs(data.cityPath(city));
  const b = data.BUSINESS;

  const business = {
    '@type': 'DrivingSchool',
    '@id': `${data.ORIGIN}/#business`,
    name: b.legalName,
    url: `${data.ORIGIN}/`,
    telephone: b.phone.replace(/\s/g, '-'),
    email: b.email,
    image: data.SITE.image,
    priceRange: `$${price.low}-$${price.high}`,
    currenciesAccepted: 'CAD',
    foundingDate: String(data.FOUNDED),
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.address.street,
      addressLocality: b.address.city,
      addressRegion: b.address.region,
      postalCode: b.address.postalCode,
      addressCountry: b.address.country,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: String(data.REVIEW_SUMMARY.rating.toFixed(1)),
      reviewCount: String(data.REVIEW_SUMMARY.count),
      bestRating: '5',
    },
    areaServed: data.CITIES.map((c) => ({ '@type': 'City', name: c.name })),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      business,
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: `Driving lessons in ${city.name}, BC`,
        isPartOf: { '@id': `${data.ORIGIN}/#website` },
        about: { '@id': `${data.ORIGIN}/#business` },
        inLanguage: data.SITE.locale,
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${data.ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: `Driving lessons in ${city.name}`, item: url },
        ],
      },
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        serviceType: 'Driving instruction',
        name: `Driving lessons in ${city.name}`,
        provider: { '@id': `${data.ORIGIN}/#business` },
        areaServed: { '@type': 'City', name: city.name, containedInPlace: { '@type': 'AdministrativeArea', name: 'Lower Mainland, British Columbia' } },
        offers: plans
          .filter((p) => p.price != null)
          .map((p) => ({
            '@type': 'Offer',
            name: p.name,
            price: String(p.price),
            priceCurrency: p.currency || 'CAD',
            availability: 'https://schema.org/InStock',
            url: `${data.ORIGIN}/#lessons`,
          })),
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}

function renderCityHtml(data, city, plans, price, fonts) {
  const b = data.BUSINESS;
  const url = data.abs(data.cityPath(city));
  const faqs = data.cityFaqs(city, price);
  const title = `Driving lessons in ${city.name}, BC | Tesla Model 3 | ${data.SITE.titleSuffix}`;
  const desc = `Class 5 and Class 7 driving lessons in ${city.name}, taught in a Tesla Model 3. ${data.TIER_AVAILABILITY[city.tier]} Road test package with the car provided from ${price.roadTest}.`;
  const others = data.CITIES;

  const travel =
    city.tier === 'base'
      ? `${b.name} is based in ${city.name}.`
      : `About ${city.minutesFromBase} minutes from our ${b.address.city} base.`;

  return `<!doctype html>
<html lang="${data.SITE.locale}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#060809">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" type="text/markdown" href="${url}.md">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(b.name)}">
<meta property="og:title" content="${esc(`Driving lessons in ${city.name}, BC`)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${data.SITE.image}">
<meta property="og:locale" content="en_CA">
<meta name="twitter:card" content="summary_large_image">
<meta name="geo.region" content="CA-BC">
<meta name="geo.placename" content="${esc(city.name)}">
<style>${pageCss(fonts)}</style>
<script type="application/ld+json">${JSON.stringify(cityJsonLd(data, city, plans, price, faqs))}</script>
</head>
<body>
<nav class="bar"><div class="wrap">
  <a class="brand" href="/">Free Fly</a>
  <span style="display:flex;gap:1.5rem;align-items:center">
    <a class="tele" href="/#lessons">Plans &amp; prices</a>
    <a class="tele" href="${b.phoneHref}">${esc(b.phone)}</a>
  </span>
</div></nav>

<main class="wrap">
  <section class="hero">
    <p class="tele eyebrow">Service area · ${esc(city.name)}, British Columbia</p>
    <h1>Driving lessons<br>in ${esc(city.name)}</h1>
    <p class="lede">${esc(city.roads[0])}</p>
    <div class="actions">
      <a class="cta tele" href="${b.phoneHref}">Call ${esc(b.phone)}</a>
      <a class="cta ghost tele" href="/#lessons">See plans &amp; prices</a>
    </div>
    <dl class="facts">
      <div><dt class="tele">Rating</dt><dd>${data.REVIEW_SUMMARY.rating.toFixed(1)} · ${data.REVIEW_SUMMARY.count} Google reviews</dd></div>
      <div><dt class="tele">Car</dt><dd>Tesla Model 3</dd></div>
      <div><dt class="tele">Licence classes</dt><dd>Class 7 &amp; Class 5</dd></div>
      <div><dt class="tele">Open</dt><dd>${esc(b.hours.days)} ${b.hours.opens}–${b.hours.closes}</dd></div>
      <div><dt class="tele">Travel</dt><dd>${esc(travel)}</dd></div>
      <div><dt class="tele">Phone</dt><dd><a href="${b.phoneHref}">${esc(b.phone)}</a></dd></div>
    </dl>
  </section>

  <section>
    <p class="tele eyebrow">What driving here is actually like</p>
    <h2>Learning to drive<br>in ${esc(city.name)}</h2>
    <div class="rows">
      ${(city.roads.length > 1 ? city.roads.slice(1) : city.roads)
        .map(
          // roads[0] is already the hero lede above, so it is dropped here
          // rather than printed twice on one page. Numbering still counts from
          // 01 so the rail reads as a list, not as a list missing its first row.
          (para, i) =>
            `<div><span class="n">${String(i + 1).padStart(2, '0')}</span><p>${esc(para)}</p></div>`,
        )
        .join('\n      ')}
    </div>
    <p style="margin-top:2rem"><strong style="color:var(--cream)">Areas covered:</strong> ${city.areas.map(esc).join(' · ')}.</p>
  </section>

  <section>
    <p class="tele eyebrow">Lessons &amp; pricing</p>
    <h2>Packages</h2>
    <p style="margin-top:1rem">${esc(data.TIER_AVAILABILITY[city.tier])}</p>
    <div class="plans">
      ${plans
        .map(
          (p) => `<article>
        <h3>${esc(p.name)}</h3>
        <span class="price">${esc(data.formatPrice(p))}</span>
        <p>${esc(p.description)}</p>
        <ul>${p.perks.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
      </article>`,
        )
        .join('\n      ')}
    </div>
  </section>

  <section>
    <p class="tele eyebrow">Common questions</p>
    <h2>Driving lessons in ${esc(city.name)}, answered</h2>
    <div class="faq">
      ${faqs.map((f) => `<div><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join('\n      ')}
    </div>
  </section>

  <section>
    <p class="tele eyebrow">What students say</p>
    <h2>Five stars, no exceptions</h2>
    <div class="quotes">
      ${data.REVIEWS.slice(0, 3)
        .map(
          (r) => `<figure>
        <span class="stars" aria-label="${r.stars} out of 5 stars">${'★'.repeat(r.stars)}</span>
        <blockquote>${esc(r.text)}${r.truncated ? '…' : ''}</blockquote>
        <figcaption class="tele">${esc(r.name)} · ${esc(r.when)}</figcaption>
      </figure>`,
        )
        .join('\n      ')}
    </div>
  </section>

  <section>
    <p class="tele eyebrow">Elsewhere in the Lower Mainland</p>
    <h2>Other service areas</h2>
    <ul class="areas">
      ${others
        .map((c) =>
          c.slug === city.slug
            ? `<li><span class="areas-here tele here" style="display:inline-block;border:1px solid var(--azure);padding:.55rem 1rem;background:var(--marine)">${esc(c.name)}</span></li>`
            : `<li><a class="tele" href="${data.cityPath(c)}">${esc(c.name)}</a></li>`,
        )
        .join('\n      ')}
    </ul>
  </section>
</main>

<footer><div class="wrap">
  <div>
    <p style="color:var(--cream);margin-bottom:.5rem">${esc(b.legalName)}</p>
    <p>Class 7 &amp; Class 5 driving lessons in a Tesla Model 3.<br>
    ${esc(b.address.street)}, ${esc(b.address.city)}, ${esc(b.address.region)} ${esc(b.address.postalCode)}<br>
    <a href="${b.phoneHref}">${esc(b.phone)}</a> · <a href="${b.emailHref}">${esc(b.email)}</a></p>
  </div>
  <div><p><a href="/">Main site</a> · <a href="/#lessons">Plans</a> · <a href="/#contact">Contact</a> · <a href="/credits">Credits</a></p></div>
</div></footer>
</body>
</html>`;
}

/* ---------------------------------------------------------- markdown twins -- */

function planLines(data, plans) {
  return plans
    .map((p) => `- **${p.name}** — ${data.formatPrice(p)}. ${p.description} (${p.perks.join('; ')})`)
    .join('\n');
}

function renderCityMarkdown(data, city, plans, price) {
  const b = data.BUSINESS;
  const faqs = data.cityFaqs(city, price);

  return `# Driving lessons in ${city.name}, BC

> ${b.name} teaches Class 7 and Class 5 driving lessons in ${city.name}, British Columbia, in a Tesla Model 3. ${data.TIER_AVAILABILITY[city.tier]}

- **Business:** ${b.legalName}
- **Based in:** ${b.address.street}, ${b.address.city}, ${b.address.region} ${b.address.postalCode}
- **Phone:** ${b.phone}
- **Email:** ${b.email}
- **Hours:** ${b.hours.days}, ${b.hours.opens}–${b.hours.closes}
- **Rating:** ${data.REVIEW_SUMMARY.rating.toFixed(1)} from ${data.REVIEW_SUMMARY.count} Google reviews
- **Vehicle:** Tesla Model 3
- **Areas covered in ${city.name}:** ${city.areas.join(', ')}
- **Canonical page:** ${data.abs(data.cityPath(city))}

## Driving conditions in ${city.name}

${city.roads.join('\n\n')}

## Lesson packages

${planLines(data, plans)}

## Frequently asked questions

${faqs.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}

## Other service areas

${data.CITIES.filter((c) => c.slug !== city.slug)
  .map((c) => `- [Driving lessons in ${c.name}](${data.abs(data.cityPath(c))})`)
  .join('\n')}
`;
}

function renderHomeMarkdown(data, plans, price) {
  const b = data.BUSINESS;

  return `# ${b.legalName}

> ${b.name} is a driving school in ${b.address.city}, British Columbia, teaching Class 7 and Class 5 lessons across the Lower Mainland in a Tesla Model 3. Founded ${data.FOUNDED}. Rated ${data.REVIEW_SUMMARY.rating.toFixed(1)} from ${data.REVIEW_SUMMARY.count} Google reviews.

- **Phone:** ${b.phone}
- **Email:** ${b.email}
- **Address:** ${b.address.street}, ${b.address.city}, ${b.address.region} ${b.address.postalCode}, Canada
- **Hours:** ${b.hours.days}, ${b.hours.opens}–${b.hours.closes}
- **Licence classes taught:** ${b.licenceClasses.join(', ')}
- **Instructor:** ${data.INSTRUCTOR.firstName}, ${data.INSTRUCTOR.role}
- **Website:** ${data.ORIGIN}/

## What the school does

${data.INSTRUCTOR.bio.join('\n\n')}

## Lesson packages

${planLines(data, plans)}

## Why lessons are taught in a Tesla Model 3

${data.TESLA_ADVANTAGES.map((t) => `### ${t.title}\n\n${t.body}`).join('\n\n')}

## The BC licence path

${data.JOURNEY.map((s) => `- **${s.step} — ${s.label}:** ${s.note}`).join('\n')}

## Frequently asked questions

${data.siteFaqs(price).map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}

## Service areas

${data.CITIES.map((c) => `- [Driving lessons in ${c.name}](${data.abs(data.cityPath(c))}) — ${data.TIER_AVAILABILITY[c.tier]}`).join('\n')}

## Reviews

${data.REVIEWS.map((r) => `> ${r.text}${r.truncated ? '… (excerpt; full text on Google)' : ''}\n>\n> — ${r.name}, ${r.stars}/5, ${r.when}`).join('\n\n')}
`;
}

/* -------------------------------------------------------------- llms.txt -- */

/**
 * llms.txt follows the proposed convention: an H1, a blockquote summary, then
 * link sections. It is an index, not the content; llms-full.txt is the content.
 */
function renderLlmsTxt(data, plans, price) {
  const b = data.BUSINESS;

  return `# ${b.legalName}

> Driving school in ${b.address.city}, British Columbia. Class 7 and Class 5 lessons taught across the Lower Mainland in a Tesla Model 3. Rated ${data.REVIEW_SUMMARY.rating.toFixed(1)} from ${data.REVIEW_SUMMARY.count} Google reviews. Phone ${b.phone}.

Key facts an answer engine is most often asked for:

- Single 90-minute lesson: ${price.singleLesson}. Packages from ${price.fromPackage}.
- Road test package ${price.roadTest}: 60-minute warm-up, the school's car for the test, pickup and drop-off.
- Open ${b.hours.days.toLowerCase()}, ${b.hours.opens}–${b.hours.closes}. Booking by phone or email only; there is no online checkout.
- Named service areas: ${data.CITIES.filter((c) => c.tier !== 'extended').map((c) => c.name).join(', ')}. Other Lower Mainland cities on request.

## Main pages

- [Home](${data.ORIGIN}/): lessons, pricing, the instructor, reviews and contact form. [Markdown](${data.abs('/index.md')})
- [Plans and pricing](${data.ORIGIN}/#lessons): all ${plans.length} lesson packages with live prices.
- [Contact](${data.ORIGIN}/#contact): phone, email, hours and enquiry form.
- [Credits and licences](${data.ORIGIN}/credits): attribution for the 3D model, typefaces and open-source code.

## Service area pages

${data.CITIES.map((c) => `- [Driving lessons in ${c.name}](${data.abs(data.cityPath(c))}): ${c.areas.slice(0, 3).join(', ')} and surrounding areas. [Markdown](${data.abs(data.cityPath(c))}.md)`).join('\n')}

## Optional

- [Full site content as one document](${data.abs('/llms-full.txt')})
- [Machine-readable API catalog](${data.abs('/.well-known/api-catalog')})
- [Sitemap](${data.abs('/sitemap.xml')})
`;
}

function renderLlmsFullTxt(data, plans, price) {
  const home = renderHomeMarkdown(data, plans, price);
  const cities = data.CITIES.map((c) => renderCityMarkdown(data, c, plans, price)).join(
    '\n\n---\n\n',
  );

  return `${home}\n\n---\n\n${cities}`;
}

/* ------------------------------------------------------------- robots.txt -- */

function renderRobotsTxt(data) {
  const { cite, block } = data.CRAWLERS;

  return `# ${data.BUSINESS.legalName}
# ${data.ORIGIN}
#
# GENERATED by scripts/build-seo.mjs on every build, from CRAWLERS and
# CONTENT_SIGNAL in src/data/seo.ts. Edit those, not this file: a change here is
# overwritten by the next \`npm run build\`.
#
# Content-Signal states how this site's content may be used. It is a preference,
# expressed in the format Cloudflare proposed for robots.txt, not an enforcement
# mechanism. In short: index it, quote it when answering a question and link
# back, do not train on it.

User-agent: *
Content-Signal: ${data.CONTENT_SIGNAL}
Allow: /
Disallow: /api/

# Search and answer engines that fetch a page to answer a live question and
# cite the source. For a local business these send customers, so they are
# explicitly welcome.
${cite
  .map((ua) => `User-agent: ${ua}\nContent-Signal: ${data.CONTENT_SIGNAL}\nAllow: /\nDisallow: /api/\n`)
  .join('\n')}
# Bulk corpus collection with no referral path back to the business.
${block.map((ua) => `User-agent: ${ua}\nDisallow: /\n`).join('\n')}
Sitemap: ${data.abs('/sitemap.xml')}
`;
}

/* ------------------------------------------------------------- sitemap.xml -- */

/**
 * Sitemap.
 *
 * Every indexable HTML document, and only those. Deliberately absent:
 *
 *   the .md twins       They are alternate representations of a page that is
 *                       already listed, not pages. Listing them would submit
 *                       the same content twice and invite a duplicate-content
 *                       call on the pair.
 *   llms.txt etc.       Machine endpoints. They are discoverable through
 *                       robots.txt and the Link headers, which is where they
 *                       belong.
 *   #anchor sections    Not separate URLs.
 *
 * No <priority> and no <changefreq>. Google states plainly that it ignores
 * both, and Bing has said the same; what they actually do is rot, because
 * nobody revisits a hand-set priority after the site changes. <lastmod> is the
 * one hint that is still honoured, so it is the one that is computed for real,
 * from the mtime of the data files that produce each page rather than from the
 * build clock. A lastmod that says "now" on every build is worse than none: it
 * teaches the crawler the signal is meaningless.
 */
function renderSitemap(data) {
  const dataMod = lastmod(
    'src/data/business.ts',
    'src/data/plans.ts',
    'src/data/reviews.ts',
    'src/data/faqs.ts',
    'index.html',
  );
  const cityMod = lastmod('src/data/cities.ts', 'src/data/faqs.ts', 'scripts/build-seo.mjs');

  const urls = [
    { loc: `${data.ORIGIN}/`, mod: dataMod, title: `${data.BUSINESS.legalName}` },
    ...data.CITIES.map((c) => ({
      loc: data.abs(data.cityPath(c)),
      mod: cityMod,
      title: `Driving lessons in ${c.name}, BC`,
    })),
    { loc: `${data.ORIGIN}/credits`, mod: lastmod('credits.html'), title: null },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  GENERATED by scripts/build-seo.mjs. Do not edit by hand: it is rewritten on
  every build, from src/data/cities.ts and src/data/seo.ts.
  Adding a service area to cities.ts adds it here automatically.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map((u) => {
    const image = u.title
      ? `\n    <image:image>\n      <image:loc>${data.SITE.image}</image:loc>\n      <image:title>${esc(u.title)}</image:title>\n    </image:image>`
      : '';
    return `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.mod}</lastmod>${image}\n  </url>`;
  })
  .join('\n')}
</urlset>
`;
}

/* ----------------------------------------------------------- .well-known -- */

/**
 * RFC 9727 API catalog, plus the two discovery documents the Cloudflare
 * agent-readiness scanner looks for.
 *
 * These describe what actually exists: one public read-only endpoint returning
 * the lesson plans, and one write endpoint behind the contact form. Nothing is
 * advertised that the site does not serve, because a catalog that points at
 * imaginary endpoints is worse than no catalog.
 */
function wellKnownFiles(data) {
  const b = data.BUSINESS;

  const apiCatalog = {
    linkset: [
      {
        anchor: `${data.ORIGIN}/`,
        'service-desc': [
          { href: data.abs('/api/plans'), type: 'application/json', title: 'Lesson plans and live prices' },
        ],
        'service-doc': [{ href: data.abs('/llms.txt'), type: 'text/plain', title: 'Site summary for LLMs' }],
      },
    ],
  };

  const mcpCard = {
    name: 'freefly-driving-school',
    description: `Lesson packages, prices and service areas for ${b.legalName}, a driving school in ${b.address.city}, British Columbia.`,
    version: '1.0.0',
    // No MCP transport is deployed. This card advertises the discovery
    // documents that do exist rather than a server endpoint that does not,
    // because pointing an agent at a URL that will not connect is worse than
    // being absent from the registry.
    capabilities: { resources: { listChanged: false } },
    resources: [
      { uri: data.abs('/llms-full.txt'), name: 'Full site content', mimeType: 'text/markdown' },
      { uri: data.abs('/api/plans'), name: 'Live lesson plans', mimeType: 'application/json' },
    ],
    contact: { phone: b.phone, email: b.email, url: `${data.ORIGIN}/#contact` },
  };

  const agentSkills = {
    skills: [
      {
        name: 'check-lesson-prices',
        description: `Read current lesson package names, prices and contents for ${b.name}.`,
        endpoint: data.abs('/api/plans'),
        method: 'GET',
        authentication: 'none',
      },
      {
        name: 'find-service-area',
        description:
          'Determine whether the school teaches in a given Lower Mainland city, and on what terms.',
        resource: data.abs('/llms-full.txt'),
        method: 'GET',
        authentication: 'none',
      },
    ],
    contact: { email: b.email, phone: b.phone },
    // Booking is a phone call. Stating that plainly stops an agent hunting for
    // a checkout endpoint that has never existed.
    notes: 'Booking is not automated. Lessons are arranged by phone or email.',
  };

  return { apiCatalog, mcpCard, agentSkills };
}

/* ----------------------------------------------- index.html post-processing -- */

function homeJsonLd(data, plans, price) {
  const b = data.BUSINESS;
  const faqs = data.siteFaqs(price);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${data.ORIGIN}/#website`,
        url: `${data.ORIGIN}/`,
        name: b.name,
        inLanguage: data.SITE.locale,
        publisher: { '@id': `${data.ORIGIN}/#business` },
      },
      {
        '@type': 'DrivingSchool',
        '@id': `${data.ORIGIN}/#business`,
        name: b.legalName,
        alternateName: b.name,
        url: `${data.ORIGIN}/`,
        telephone: b.phone.replace(/\s/g, '-'),
        email: b.email,
        image: data.SITE.image,
        logo: data.SITE.image,
        description: `Class 7 and Class 5 driving lessons in a Tesla Model 3, across the Lower Mainland of British Columbia.`,
        priceRange: `$${price.low}-$${price.high}`,
        currenciesAccepted: 'CAD',
        paymentAccepted: 'Cash, e-transfer',
        foundingDate: String(data.FOUNDED),
        address: {
          '@type': 'PostalAddress',
          streetAddress: b.address.street,
          addressLocality: b.address.city,
          addressRegion: b.address.region,
          postalCode: b.address.postalCode,
          addressCountry: b.address.country,
        },
        geo: { '@type': 'GeoCoordinates', latitude: 49.199814, longitude: -122.855305 },
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: [
              'Monday',
              'Tuesday',
              'Wednesday',
              'Thursday',
              'Friday',
              'Saturday',
              'Sunday',
            ],
            opens: b.hours.opens,
            closes: b.hours.closes,
          },
        ],
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: data.REVIEW_SUMMARY.rating.toFixed(1),
          reviewCount: String(data.REVIEW_SUMMARY.count),
          bestRating: '5',
        },
        review: data.REVIEWS.filter((r) => !r.truncated).map((r) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.name },
          reviewRating: { '@type': 'Rating', ratingValue: String(r.stars), bestRating: '5' },
          reviewBody: r.text,
        })),
        areaServed: data.CITIES.map((c) => ({ '@type': 'City', name: c.name })),
        employee: {
          '@type': 'Person',
          name: data.INSTRUCTOR.firstName,
          jobTitle: data.INSTRUCTOR.role,
          worksFor: { '@id': `${data.ORIGIN}/#business` },
        },
        sameAs: data.SOCIALS.map((s) => s.href),
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Driving lesson packages',
          itemListElement: plans
            .filter((p) => p.price != null)
            .map((p) => ({
              '@type': 'Offer',
              name: p.name,
              description: p.description,
              price: String(p.price),
              priceCurrency: p.currency || 'CAD',
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: p.name,
                serviceType: 'Driving instruction',
                provider: { '@id': `${data.ORIGIN}/#business` },
              },
            })),
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${data.ORIGIN}/#faq`,
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}

/**
 * A crawler that does not run JavaScript gets an empty div from the SPA. This
 * puts the business facts into the served markup for those crawlers.
 *
 * It is a <noscript>, not a hidden div, and that distinction is the whole
 * point: <noscript> is the documented no-JavaScript fallback, it says the same
 * things the rendered page says, and it is not shown to one audience while a
 * different page is shown to another. A visually hidden block carrying keyword
 * copy would be cloaking and is exactly what earns a manual action.
 */
function noscriptBlock(data, plans, price) {
  const b = data.BUSINESS;

  return `<noscript>
<div style="max-width:64rem;margin:0 auto;padding:2rem 1.5rem;font-family:system-ui,sans-serif;color:#ded9d1;line-height:1.6">
<h1 style="color:#fffbf4">${esc(b.legalName)}</h1>
<p>Class 7 and Class 5 driving lessons in a Tesla Model 3, across the Lower Mainland of British Columbia. Based at ${esc(b.address.street)}, ${esc(b.address.city)}, ${esc(b.address.region)} ${esc(b.address.postalCode)}. Rated ${data.REVIEW_SUMMARY.rating.toFixed(1)} from ${data.REVIEW_SUMMARY.count} Google reviews.</p>
<p><strong>Phone:</strong> <a style="color:#5aa6ff" href="${b.phoneHref}">${esc(b.phone)}</a> · <strong>Email:</strong> <a style="color:#5aa6ff" href="${b.emailHref}">${esc(b.email)}</a> · <strong>Open:</strong> ${esc(b.hours.days)}, ${b.hours.opens}–${b.hours.closes}</p>
<h2 style="color:#fffbf4">Lesson packages</h2>
<ul>${plans.map((p) => `<li><strong>${esc(p.name)}</strong> — ${esc(data.formatPrice(p))}. ${esc(p.description)}</li>`).join('')}</ul>
<h2 style="color:#fffbf4">Service areas</h2>
<ul>${data.CITIES.map((c) => `<li><a style="color:#5aa6ff" href="${data.cityPath(c)}">Driving lessons in ${esc(c.name)}</a></li>`).join('')}</ul>
<h2 style="color:#fffbf4">Common questions</h2>
<dl>${data
    .siteFaqs(price)
    .map((f) => `<dt style="color:#fffbf4;margin-top:1rem"><strong>${esc(f.q)}</strong></dt><dd style="margin:0">${esc(f.a)}</dd>`)
    .join('')}</dl>
<p>This page needs JavaScript for its interactive version. The full site is at <a style="color:#5aa6ff" href="${data.ORIGIN}/">${data.ORIGIN}/</a>.</p>
</div>
</noscript>`;
}

/**
 * Rewrites dist/index.html in place: swaps the hand-written JSON-LD for the
 * generated graph, and injects the noscript summary after the app root.
 *
 * Both edits are anchored to markers that exist in the committed index.html, so
 * if this script never runs the deployed page still carries the original valid
 * schema rather than nothing.
 */
function patchIndexHtml(data, plans, price) {
  const file = join(DIST, 'index.html');
  let html = readFileSync(file, 'utf8');

  const ld = `<script type="application/ld+json">${JSON.stringify(homeJsonLd(data, plans, price))}</script>`;
  const ldPattern = /<script type="application\/ld\+json">[\s\S]*?<\/script>/;
  if (!ldPattern.test(html)) throw new Error('index.html: no JSON-LD block to replace');
  html = html.replace(ldPattern, ld);

  const root = '<div id="root"></div>';
  if (!html.includes(root)) throw new Error('index.html: no #root to anchor noscript to');
  html = html.replace(root, `${root}\n${noscriptBlock(data, plans, price)}`);

  writeFileSync(file, html);
}

/**
 * Per-page Link headers, appended to the copied _headers.
 *
 * `rel="alternate"; type="text/markdown"` is the standards-track half and is
 * what tells an agent the markdown twin exists; api-catalog is RFC 9727. The
 * llms-txt rel is not registered anywhere, and is included because the agent
 * readiness scanners look for it.
 */
function appendHeaders(data) {
  const file = join(DIST, '_headers');
  const common = `Link: </.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="llms-txt"`;

  const blocks = [
    `\n# ── Generated by scripts/build-seo.mjs. Edits here are overwritten. ──\n`,
    `/\n  ${common}, </index.md>; rel="alternate"; type="text/markdown"\n  Vary: Accept\n`,
    ...data.CITIES.map(
      (c) =>
        `${data.cityPath(c)}\n  ${common}, <${data.cityPath(c)}.md>; rel="alternate"; type="text/markdown"\n  Vary: Accept\n  Cache-Control: public, max-age=0, must-revalidate\n`,
    ),
    `/*.md\n  Content-Type: text/markdown; charset=utf-8\n  Cache-Control: public, max-age=3600\n`,
    `/llms.txt\n  Content-Type: text/plain; charset=utf-8\n  Cache-Control: public, max-age=3600\n`,
    `/llms-full.txt\n  Content-Type: text/plain; charset=utf-8\n  Cache-Control: public, max-age=3600\n`,
    // Three sibling rules rather than one wildcard plus an override. Cloudflare
    // Pages APPENDS the headers of every matching rule instead of letting the
    // most specific one win, so `/.well-known/*` alongside a specific
    // `/.well-known/api-catalog` produced a literal
    // `Content-Type: application/linkset+json, application/json`, which is not
    // a valid media type and which nothing would have parsed.
    // RFC 9727 wants linkset+json for the catalog; the other two are plain JSON.
    `/.well-known/api-catalog\n  Content-Type: application/linkset+json; charset=utf-8\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=3600\n`,
    `/.well-known/mcp/*\n  Content-Type: application/json; charset=utf-8\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=3600\n`,
    `/.well-known/agent-skills/*\n  Content-Type: application/json; charset=utf-8\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=3600\n`,
    `/sitemap.xml\n  Content-Type: application/xml; charset=utf-8\n`,
  ];

  writeFileSync(file, readFileSync(file, 'utf8') + blocks.join('\n'));
}

/* ------------------------------------------------------------------ main -- */

function write(rel, contents) {
  const target = join(DIST, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
  return `${rel} (${(Buffer.byteLength(contents) / 1024).toFixed(1)} kB)`;
}

/**
 * Write to `dist/` AND mirror into `public/`.
 *
 * Used for robots.txt and sitemap.xml only. Everything else this script emits
 * lives in `dist/` alone, which is gitignored — correct for build output, but
 * it means those two files, the two that anyone auditing the site's SEO expects
 * to find and open, were invisible in the repo and existed only after a build.
 *
 * Mirroring them puts them under version control, so a change to the crawler
 * policy or the page list shows up in a diff instead of silently shipping. Vite
 * copies publicDir into dist at the start of the build and this script
 * overwrites both copies afterwards, so the two never disagree.
 *
 * They stay generated, not hand-authored: both carry a header saying so.
 */
function writeMirrored(rel, contents) {
  const pub = join(ROOT, 'public', rel);
  mkdirSync(dirname(pub), { recursive: true });
  writeFileSync(pub, contents);
  return `${write(rel, contents)} → also public/${rel}`;
}

async function main() {
  console.log('\nseo: generating static search + agent surface');

  const data = await loadData();
  const plans = await loadPlans(data);
  const price = priceContext(data, plans);
  const fonts = discoverFonts();
  console.log(`  fonts: ${fonts.length ? fonts.map((f) => f.family.split(' ')[0]).join(', ') : 'none found, using system stack'}`);

  const written = [];

  for (const city of data.CITIES) {
    const path = data.cityPath(city).slice(1);
    written.push(write(`${path}.html`, renderCityHtml(data, city, plans, price, fonts)));
    written.push(write(`${path}.md`, renderCityMarkdown(data, city, plans, price)));
  }

  written.push(write('index.md', renderHomeMarkdown(data, plans, price)));
  written.push(write('llms.txt', renderLlmsTxt(data, plans, price)));
  written.push(write('llms-full.txt', renderLlmsFullTxt(data, plans, price)));
  written.push(writeMirrored('robots.txt', renderRobotsTxt(data)));
  written.push(writeMirrored('sitemap.xml', renderSitemap(data)));

  const { apiCatalog, mcpCard, agentSkills } = wellKnownFiles(data);
  written.push(write('.well-known/api-catalog', JSON.stringify(apiCatalog, null, 2)));
  written.push(write('.well-known/mcp/server-card.json', JSON.stringify(mcpCard, null, 2)));
  written.push(write('.well-known/agent-skills/index.json', JSON.stringify(agentSkills, null, 2)));

  patchIndexHtml(data, plans, price);
  appendHeaders(data);

  console.log(`  wrote ${written.length} files for ${data.CITIES.length} service areas`);
  console.log(`  patched dist/index.html (JSON-LD graph + noscript summary)`);
  console.log('seo: done\n');
}

main().catch((err) => {
  console.error('\nseo: FAILED\n', err);
  process.exit(1);
});
