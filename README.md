# Free Fly Driving School

Scrollytelling marketing site for a Tesla-only driving school in the Lower
Mainland, BC. A 3D Model 3 sits in a fixed canvas behind the document; scrolling
drives a camera through five beats tied to the content sections.

Vite + React + TypeScript · react-three-fiber + drei · GSAP ScrollTrigger ·
Tailwind v4 · deploys to Cloudflare Pages.

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on port 5180 (`.claude/launch.json` pins it).

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server. `/api/plans` is proxied to the deployed site, so pricing is live |
| `npm run dev:full` | Builds, then serves via wrangler so the Pages Function runs locally and reads `.env`. Use when changing the Function itself |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build locally (static only, no Functions) |
| `npm run deploy` | Build and direct-upload to Cloudflare Pages |
| `npm run typecheck` | Types only |
| `npm run model:optimize` | Rebuild both GLB LODs from the source model |
| `npm run photos` | Re-process client photos from `public/Pics/` into `public/photos/` |
| `npm run brand` | Re-extract the vector wordmark from the supplied logo SVG |
| `npm run favicons` | Regenerate favicons from the logo PNG |
| `npm run hero` | Re-render the no-WebGL fallback image (needs `npm run dev` running) |
| `npm run shoot` | Screenshot a page via headless Chrome, into `.captures/` |

### Local environment

```bash
cp .env.example .env   # then paste the Wix API key into .env
```

`.env` is gitignored. `.env.example` is committed, so **never put a real key in
it**. Only `npm run dev:full` reads these; plain `npm run dev` does not need
them (it proxies `/api/plans` to the deployed site instead).

### How fresh are the prices

A price edited in the Wix dashboard shows up on the next page load, within the
15-second edge TTL in `functions/api/plans.ts`. The browser is told `no-store`,
so it never holds a copy of its own, and the page refetches when the tab is
re-focused after 30s: edit in Wix, switch back to the site, see the new price.

To skip the edge copy entirely and check what Wix currently returns:

```bash
curl -s "https://new.freeflydriving.ca/api/plans?fresh=1" -D - -o /dev/null | grep -i x-plans-cache
```

`x-plans-cache` is on every response: `hit` (edge copy), `miss` (read Wix and
stored it), `bypass` (`?fresh=1`). If prices look wrong, that header separates
"stale" from "broken", and a `502` body with `error: upstream_*` means the key
or its scope is the problem, not the cache.

### Dev-only pages

- `/model-check.html`: compare the decimated LODs against the untouched source
  at the real camera angles. Use this before changing any decimation ratio.
- `/static-hero.html`: the bare render that `npm run hero` photographs.

Neither is in the production build; `build.rollupOptions.input` names only
`index.html` and `credits.html`.

### QA query string

`?scene=full|lite|none` forces a rendering tier, bypassing device detection.
Required to exercise the 3D path in a headless or software-rendered browser,
which the detection deliberately refuses to give real 3D to.

## Architecture: two deployables, one origin

```
new.freeflydriving.ca  (Pages: freefly-driving)
├── static site                     dist/
├── /api/plans                      functions/api/plans.ts   → Wix Pricing Plans
└── /api/contact                    functions/api/contact.ts → service binding ↓
                                                                    │
                          freefly-mailer (Worker, no public route)  ┘
                          └── send_email + ratelimit bindings → freeflydriving@gmail.com
```

The mailer is a **separate Worker with no route of its own**. The only way to
reach it is the `MAILER` service binding from `/api/contact`. Visitors only ever
talk to `new.freeflydriving.ca`, so there is no CORS anywhere and no public
email endpoint to abuse.

**Why it isn't a single deployable**, since that is the obvious question:

1. `send_email` and `ratelimits` are Workers-only bindings. Pages config
   rejects both outright, so a Pages Function cannot send mail.
2. The fix for (1) would be migrating the site to a Worker with static assets,
   but that breaks the live domain. `freeflydriving.ca` runs on Wix nameservers
   (`ns2.wixdns.net`), so the zone is not on this Cloudflare account.
   `new.freeflydriving.ca` works today because Pages accepts a CNAME from
   external DNS; **Workers Custom Domains require the zone to be on-account.**

If `freeflydriving.ca` is ever moved onto Cloudflare, this collapses into one
Worker: swap `pages_build_output_dir` for `"assets": { "directory": "./dist" }`,
build the Functions with `wrangler pages functions build --outdir=./dist/_worker.js/`,
fold `mailer/src/index.ts` in, and `wrangler deploy`.

### Email

Sent from `freefly-enquiries@aurorabusiness.ca`. That zone is on this account
with Email Routing enabled, which `freeflydriving.ca` is not. `Reply-To` carries
the enquirer's own address, so replying from the inbox reaches the student
directly rather than the sending address.

To change the recipient: verify the new address under **Email Routing →
Destination addresses** first, then update `destination_address` in
`mailer/wrangler.jsonc` and redeploy. The binding is pinned to one verified
inbox at the platform level, so Cloudflare refuses to deliver anywhere else
even if the code says otherwise.

The template deliberately matches the house style used for the other Aurora
client sites (The Ninth House): logo card, labelled detail table, Aurora
attribution in the footer, in Free Fly's palette.

```bash
npm run deploy
```

That builds and deploys both, mailer first.

## Live deployment

| | |
| --- | --- |
| URL | https://freefly-driving.pages.dev |
| Project | `freefly-driving` |
| Cloudflare account | Nakibshaikh786@gmail.com (`47891dbd8bb00200d07113ef07d53fff`) |
| Production branch | `main` |
| Dashboard | https://dash.cloudflare.com/47891dbd8bb00200d07113ef07d53fff/pages/view/freefly-driving |

`WIX_API_KEY` and `WIX_SITE_ID` are already set as encrypted secrets on both
the production and preview environments. Redeploy with:

```bash
npm run deploy
```

If wrangler picks the wrong account (the token can see three), set
`CLOUDFLARE_ACCOUNT_ID=47891dbd8bb00200d07113ef07d53fff` first.

### Still to do by hand

- **Custom domain**: Pages → freefly-driving → Custom domains.
- **Git integration**: currently direct-upload from the CLI. Connecting the
  repo gives preview deploys per branch; set build command `npm run build`,
  output directory `dist`.

## Deploying to Cloudflare Pages

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 20 or newer (`NODE_VERSION` env var) |
| Functions directory | `functions` (picked up automatically) |

`public/_headers` and `public/_redirects` are copied into `dist/` by Vite and
applied by Pages. Headers set a strict CSP, immutable caching for fingerprinted
assets and the model/font/Draco files, and `must-revalidate` on the document.

### Environment variables

Set these in **Pages → Settings → Variables and Secrets**, for both Production
and Preview. Add `WIX_API_KEY` as an **encrypted secret**, not a plaintext
variable:

| Name | Type | Value |
| --- | --- | --- |
| `WIX_API_KEY` | Secret | A Wix API key with the **Read Pricing Plans** scope |
| `WIX_SITE_ID` | Variable | `eb31b268-571e-4711-a79e-b3aabdb44f2f` |

Without them, `/api/plans` returns `503 { configured: false }` and the pricing
section renders its bundled fallback prices. That is a safe default, not a
failure, but the prices then only change on redeploy, so set them.

The key never reaches the browser: it lives only in the Function, which is why
the site calls its own `/api/plans` rather than wixapis.com directly. There is
a build-time check you can run any time:

```bash
npm run build && grep -rl "IST.eyJ" dist/ ; echo "empty above = no key in bundle"
```

## Why Cloudflare Pages rather than Vercel

Either would host this, but Pages is the better fit and the project is wired
for it:

- The only server-side code is one function that proxies Wix and caches the
  result at the edge. That is a Pages Function in ~120 lines with no adapter,
  no framework preset, and no cold-start concern on Workers' isolate model.
- `_headers` gives per-path control of the CSP and the immutable caching that
  makes the 1.35 MB GLB and the font files cheap after first visit. On Vercel
  the same rules live in `vercel.json` and would need translating.
- Free-tier bandwidth is unmetered, which matters when every 3D visitor pulls
  ~1.4 MB of model.

To move to Vercel instead: `functions/api/plans.ts` becomes
`api/plans.ts` with a default export taking `(req, res)`, `_headers` becomes
the `headers` array in `vercel.json`, `_redirects` becomes `redirects`, and the
env vars move to the Vercel dashboard. Nothing in `src/` changes.

## How the scroll sequence works

Read `src/scene/keyframes.ts` first; its header explains every knob.

- The car **never moves**. It sits at the origin with its nose along −Z. The
  road texture scrolls beneath it, the wheels spin, the body pitches. This keeps
  drive length independent of copy length and avoids float drift over a long
  page.
- Camera positions are sampled from a Catmull-Rom spline through the keyframe
  points, so the move arcs rather than cutting between angles.
- **Beat timing is measured from the DOM, not authored.** Each keyframe names an
  `anchor` section id, and `src/scene/timing.ts` computes when that section comes
  into view. Add a section or lengthen a plan description and the sequence
  retimes itself. The authored `at` values are only a fallback.
- `pan` offsets the framing along the camera's own axes to push the car off
  centre and leave room for copy. Positive x slides the car left on screen,
  positive y slides it down.

## Fallback behaviour

Three tiers, chosen in `src/lib/capability.ts`:

- **full**: scroll-scrubbed camera, high LOD, shadows.
- **lite**: low LOD, no shadows, reduced lighting. For low-memory/low-core
  devices and small touch screens, and demoted into automatically if a real
  frame-rate probe measures under 24 fps.
- **none**: no WebGL at all. Renders `public/models/tesla-static-hero.webp`.
  Devices in this tier never download three.js.

`prefers-reduced-motion` keeps the 3D but freezes the camera at `STATIC_FRAMING`
and disables content reveals; the preference is about motion, not about 3D.

## The 3D asset

Source: **"Tesla 2018 Model 3" by Ameer Studio**, Sketchfab, CC-BY 4.0.

The licence requires attribution and an indication that the work was modified.
Both are published on **`/credits`**, linked from the footer, along with the
untouched source file itself, behind a click, because it is 21.6 MB. The facts
live in one place, `src/data/credits.ts`; the footer no longer carries an inline
credit, so if that page or its link is removed the credit has to go back there.

684,315 tris / 21.6 MB down to 366,721 tris / 1.49 MB (desktop) and 291,534 tris
/ 1.18 MB (mobile). `scripts/optimize-model.mjs` documents the tiered
decimation and why it is tiered; `src/scene/CarModel.tsx` documents why the
triangle count is where it is.

> `package.json` pins `overrides.sharp`. Do not remove it:
> `@gltf-transform/functions` pulls in `ndarray-pixels`, which declares its own
> `sharp`. If the two resolve to different versions, npm nests a second copy,
> two native libvips builds load into one process, and every texture encode dies
> with a bogus colourspace error.

## Search and AI answer engines

The homepage is a client-rendered SPA: `dist/index.html` is a `<div id="root">`
and a module script. Googlebot renders that on a second pass. **ClaudeBot,
GPTBot, PerplexityBot, Applebot and CCBot do not run JavaScript at all**, so to
the crawlers that now feed AI answers the app is a blank page.

`scripts/build-seo.mjs` runs after `vite build` and generates the crawlable
surface into `dist/`. It is wired into `npm run build`; `npm run seo` re-runs
just the generator against an existing `dist/`.

| Output | What it is |
| --- | --- |
| `/driving-lessons-<slug>` × 12 | Static landing page per service area. **Zero JavaScript**, ~850 words, content in the markup. |
| `/driving-lessons-<slug>.md`, `/index.md` | Markdown twin of every page. A city page is 21 kB of HTML, 4.6 kB of markdown. |
| `/llms.txt`, `/llms-full.txt` | Site index and full text for LLM ingestion. |
| `/robots.txt` | Per-crawler rules plus Cloudflare `Content-Signal`. **Mirrored into `public/`** so it is in version control. |
| `/sitemap.xml` | Every indexable HTML page (14), with image entries and a real `lastmod` taken from the mtime of the data that produced each page. No `priority`/`changefreq` — Google and Bing both ignore them. **Mirrored into `public/`.** |

`robots.txt` and `sitemap.xml` are the two files anyone auditing the site opens
first, so they are written to `public/` as well as `dist/` and committed. They
are still generated: both carry a header saying so, and hand edits are
overwritten by the next build. The `.md` twins and `llms.txt` are deliberately
*not* in the sitemap — they are alternate representations of pages already
listed, and submitting both invites a duplicate-content call on the pair.
| `/.well-known/api-catalog` | RFC 9727 linkset. |
| `/.well-known/mcp/server-card.json`, `/.well-known/agent-skills/index.json` | Agent-readiness discovery documents. |

It also rewrites `dist/index.html`: the JSON-LD becomes a full `@graph`
(`WebSite` + `DrivingSchool` + `FAQPage`, with offers priced from the live Wix
read at build time), and a `<noscript>` summary is injected after `#root` so a
non-rendering crawler gets the business facts rather than an empty div.

`functions/_middleware.ts` serves the markdown twin on `Accept: text/markdown`
(q-values respected, `/api/*` passed straight through), and stamps
`X-Robots-Tag: noindex` on any `.pages.dev` host.

### Adding a service area

One object in `src/data/cities.ts`. The page, its markdown twin, the sitemap
entry, the `llms.txt` line, the `_headers` block and the footer link all follow.

**Read the honesty rules in that file's header before adding one.** City pages
that differ only by a find-and-replace on the name are doorway pages, which
Google demotes by name. The `roads` field is what stops that: if there is
nothing specific to say about driving there, the city does not get a page.

### Hosts

`https://www.freeflydriving.ca` is the canonical origin. Every canonical tag,
`og:url`, JSON-LD `@id`, sitemap `<loc>` and llms.txt link derives from `ORIGIN`
in `src/data/seo.ts`. Change it there and nothing else.

`functions/_middleware.ts` enforces it:

| Host | Behaviour |
| --- | --- |
| `www.freeflydriving.ca` | Serves normally. The canonical host. |
| `freeflydriving.ca` | **301 to `www.`**, path and query preserved, forced to https. Unreachable today (see below), and correct the moment an apex record exists. |
| `new.freeflydriving.ca`, `*.pages.dev` | Serves normally with `X-Robots-Tag: noindex, nofollow`. They serve byte-identical pages, so left alone they compete with production. |

The `noindex` is applied by hostname, so it never touches the canonical domain
and there is nothing to undo after the cutover.

### Why `www.` and not the apex

The apex is where this should end up, and `www.` is a stopgap.

`freeflydriving.ca` has no A, AAAA or CNAME record at all. It does not serve the
old Wix site; it does not resolve. The zone runs on Wix nameservers
(`ns2`/`ns3.wixdns.net`), and Wix's DNS panel offers no CNAME flattening or
ALIAS record, so the apex cannot be pointed at a Pages project: DNS forbids a
CNAME at a zone apex, and Pages publishes no stable A record to use instead.
`www.` is a plain CNAME, which Wix DNS does support.

Canonicalising on the apex before it resolved is what took the site off its own
domain: every canonical tag and sitemap URL aimed at a dead host, and the
middleware's `www.` → apex redirect bounced real visitors into it, so the one
hostname that did work was the one being redirected away.

### Cutover checklist

Moving the zone onto Cloudflare is what restores the apex, because Cloudflare
does flatten a CNAME there. The generator's price fetch tries `www.`, `new.`,
`pages.dev` and the apex in that order, so builds produce correct prices on
either side of the move.

1. Change the nameservers at Wix to the Cloudflare pair and add the zone in
   Cloudflare. The zone has no MX and no TXT records, so there is no mail or
   domain verification to carry across; the two CNAMEs are the whole migration.
2. Add `freeflydriving.ca` to the Pages project (Pages → freefly-driving →
   Custom domains). Cloudflare creates the flattened apex record itself.
3. Set `ORIGIN` in `src/data/seo.ts` and `CANONICAL_HOST` in
   `functions/_middleware.ts` back to the apex, and invert the redirect so
   `www.` points at the apex again rather than the reverse. Both carry a comment
   pointing at the other.
4. `npm run deploy`.
5. `npm run deploy:mailer`. The enquiry email hotlinks its logo from `SITE`, so
   its header breaks if that host stops serving; this runs **after** DNS
   resolves, never before.
6. Verify the domain property in Search Console (it covers every subdomain),
   then submit the sitemap at whichever host is canonical at the time.

> [!NOTE]
> The sitemap is only safe to submit while `ORIGIN` names a host that resolves.
> Submitting one full of apex URLs before step 2 records the property as broken,
> which is the failure this section exists to prevent.

## Real content and where it came from

Nothing on this site is invented. Sources, so they can be re-verified:

| Content | Source |
| --- | --- |
| Prices, plan names, perks, terms | Live Wix Pricing Plans via `/api/plans` |
| 5.0 rating, 153 review count, 3 quoted reviews | Google Business Profile, read 2026-08-11 |
| Address, opening hours | Same Google listing |
| Instructor first name ("Harry") | Named repeatedly across those reviews |
| Student pass photos | Supplied by the client, `public/Pics/` |
| Phone, email, socials, tagline | freeflydriving.ca |
| City driving conditions on the service-area pages | Written from the observable road network (grades, arterials, interchanges, crossings). No ICBC office addresses are claimed anywhere; see `CITY_PLACEHOLDER`. |

Two supplied images (`jj result.jpg` and `sheet.jpg`) are photographs of
completed ICBC road test result forms carrying candidate names and licence
numbers. `scripts/prepare-photos.mjs` excludes them by name and
`vite.config.ts` keeps the whole raw folder out of `dist/`. Do not publish them.

## Outstanding content

See `PLACEHOLDERS` in `src/data/business.ts`. It is logged to the console on
dev builds and drives the visible markers in the UI.
