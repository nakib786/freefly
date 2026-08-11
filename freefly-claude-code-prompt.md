# Free Fly Driving School — Tesla Scrollytelling Site Build

## Project summary

Build a standalone marketing site for Free Fly Driving School, a Tesla-only
driving school (Class 5 & 7) operating in the Lower Mainland, BC. The site's
centerpiece is a 3D Tesla Model 3 that drives across the screen as the user
scrolls, with the camera following the car through a sequence of scenes tied
to the page's content sections. Target aesthetic: Awwwards-tier automotive
microsite — bold typography, confident whitespace, cinematic camera moves.
Explicitly avoid generic SaaS-template design: no centered-hero-text-on-
gradient-blob layout, no stock photography, no default Bootstrap/Tailwind
component look.

**No AI slop — this is a hard requirement, not a vibe.** "AI slop" web
design has become a well-documented, recognizable pattern in 2026 (it's
now specific enough to be checklist-testable, not just a feeling). Check
the build against every item below before calling any section done:

- **Typography**: no default Inter as the primary typeface. Pick something
  with actual character (see Design Direction below) and commit to it.
- **Color**: no Tailwind-default blue-to-indigo/violet gradient hero
  (`from-blue-600 to-indigo-700` and anything in that 200–290° hue range
  used as a decorative gradient). If a gradient is used, it should be
  drawn from Free Fly's own palette decisions, not a framework default.
- **Layout**: no generic three-column feature-card grid with a "glowing"
  or highlighted middle tier — that pattern is now instantly recognizable
  as AI-generated regardless of topic. If cards are used, break the
  symmetry deliberately (uneven sizing, asymmetric grid, staggered
  reveal) rather than three equal boxes in a row.
- **Components**: no `rounded-2xl`-everything default card style, no
  decorative Lucide icons used just to fill visual space next to headings,
  no default shadcn button styling left untouched, no reflexive
  `backdrop-blur` glassmorphism nav bar unless it's a deliberate choice
  tied to the rest of the design system.
- **Imagery**: no stock photography, no generic isometric/"Stripe-light"
  illustrations. Where real photos exist (instructors, cars, students),
  use them — buyers are ultimately trusting a person to teach them to
  drive, and a stock photo undercuts that. Where real photos don't exist
  yet (see the Pricing Plans section below), lean into the site's own
  type/color/icon system rather than filling the gap with stock imagery.
- **Sameness test**: reduce the finished homepage to a rough grayscale
  block silhouette (sections as blocks, text as lines) mentally, or
  literally as a quick check. If it would be indistinguishable from a
  generic SaaS/local-service template in that silhouette, the structure
  itself is slop — not just the surface styling — and needs rework, not
  just a palette swap.

The goal is a page where the layout, type, and color choices are
specifically Free Fly's, tied to the 3D Tesla concept and this business —
not a template with a car bolted on.

## Stack

- Vite + React + TypeScript
- react-three-fiber + drei (Three.js wrapper) for the 3D scene
- GSAP + ScrollTrigger for scroll-scrubbed camera/animation timelines
- Tailwind CSS for layout and typography (utility-first, but override
  defaults heavily — see Design Direction below)
- Deploy target: Cloudflare Pages (static build, no server-side rendering
  needed for the 3D/scroll parts — but see Pricing Plans section below,
  which needs either a build-time data fetch or a small serverless function
  to talk to the Wix API without exposing credentials client-side)

## 3D asset

Model: "Tesla 2018 Model 3" by Ameer Studio, Sketchfab, CC Attribution
license (https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f).
Confirmed direct GLB download available at 21.6MB (texture size 1k) — no
Blender conversion needed. Already downloaded and placed at
`/assets/models/tesla-model-3-ameer.glb`.

Note: this GLB is far heavier than typical for scroll-scrubbed 3D (roughly
100x the size of a true low-poly asset). It likely carries a high triangle
count (confirm once loaded — the original Sketchfab listing shows ~684k
triangles/364k vertices pre-export). Decimation toward ~30-50k triangles
plus Draco compression is expected as a required step, not optional
cleanup — see step 1 below. This model was chosen over the lighter
alternative specifically for its visual quality, so preserve fidelity as
much as possible while getting the triangle count down; don't over-
decimate just to hit a number if it starts looking rough.

Fallback model if Ameer's model breaks visually after decimation (common
with aggressive decimation on complex geometry) or turns out to be
unworkable: "VEHICLE - TESLA MODEL 3" by Thcyrax, also CC Attribution, true
low-poly/game-ready
(https://sketchfab.com/3d-models/vehicle-tesla-model-3-43512c27667f412297bced6b9857a735).
Confirmed direct GLB download at 208KB, already downloaded and placed at
`/assets/models/tesla-model-3-thcyrax.glb` — usable immediately with no
decimation needed if you have to switch to it.

Your job on the asset:
1. Start with `tesla-model-3-ameer.glb`. Load it, confirm actual triangle
   count, then decimate (Blender Decimate modifier or gltf-transform's
   simplify command) down toward the 30-50k triangle range, watching
   visual quality as you go rather than blindly hitting a target number.
   Follow with Draco compression via gltf-transform CLI, aiming for the
   final GLB under 5MB. Document the exact commands used in a comment at
   the top of the loader component.
2. Actually render the decimated result and check it — if it looks rough,
   faceted, or broken on curved panels (hood, roof, wheel arches), try a
   less aggressive decimation pass before giving up on it.
3. Only if Ameer's model still looks bad after a reasonable decimation
   attempt, switch to `tesla-model-3-thcyrax.glb` instead (drop-in, no
   decimation needed). Tell me clearly which model ended up in the final
   build and why.
4. Add a small, unobtrusive attribution credit for "Ameer Studio" (or
   "Thcyrax" if you end up using the fallback) in the site footer,
   satisfying the CC Attribution license.

## Core interaction: scroll-driven drive sequence

- The Tesla model sits in a fixed/pinned Three.js canvas layer. Page content
  scrolls in a normal document flow on top of or alongside it (not literally
  scroll-jacking the entire page — regular scroll physics should still feel
  native).
- GSAP ScrollTrigger drives a timeline that moves the car and camera through
  3-5 distinct "scenes" as the user scrolls, roughly matching these content
  beats (adjust as needed once copy is drafted):
  1. Hero: car idle/reveal, camera close on badge details (charge port,
     wheel, headlight) — establishes "this is a Tesla," not a generic car
  2. Car pulls out, camera pulls back to 3/4 view — transitions into "why
     learn on a Tesla" content (regen braking, autopilot familiarity, safety
     tech)
  3. Car driving steadily, camera tracks alongside — transitions into
     lessons/pricing content
  4. Car arrives/parks, camera settles front-on — transitions into
     instructor/testimonials or contact section
- Build the camera path as a reusable, tunable system (e.g., an array of
  keyframes with position/lookAt/car-position, interpolated by scroll
  progress) — not hardcoded per-scene magic numbers scattered through the
  component. I need to be able to nudge timing and camera angles without a
  rewrite.

## Mandatory fallback behavior (non-negotiable)

- Respect `prefers-reduced-motion`: if set, skip the scroll-driven camera
  animation entirely and show a static hero render of the car (still 3D,
  just not scroll-scrubbed) or a high-quality static image.
- Detect low-power/low-end devices (basic heuristic: WebGL capability check,
  device memory API where available, or a simple FPS probe on mount) and
  fall back to a static hero image + normal scrolling content if 3D can't
  run smoothly. Do not ship a broken or janky 3D experience to older phones.
- Canvas must lazy-load (don't block first paint/LCP on the 3D asset
  downloading).
- Provide a loading state for the 3D scene (skeleton or branded loader, not
  a blank white flash).

## Pricing plans via Wix Headless

The site (Wix site ID `eb31b268-571e-4711-a79e-b3aabdb44f2f`, name
"Freeflydriving" in the Wix account) already has Wix Pricing Plans installed
with 5 live, buyable plans. Pull these live via the Wix Pricing Plans v3 API
rather than hardcoding them, so future price/plan changes in the Wix
dashboard reflect on the new site automatically.

**Endpoint:** `POST https://www.wixapis.com/pricing-plans/v3/plans/query`
(Plans V3 — confirm current auth requirements against
https://dev.wix.com/docs/api-reference/business-solutions/pricing-plans/plans-v3/query-plans
before implementing, since this needs a Wix API key / site auth token, not
just a public read).

**Current live plans (for reference/fallback data — always prefer live API
data over hardcoding these):**

| Plan | Price (CAD) | Description | Perks |
|---|---|---|---|
| Individual Lesson | $90 | One lesson to examine mistakes and provide solutions | 90 minute lesson |
| Beginners Plan | $1,600 | For beginners with no prior driving experience | 30 hours (20 x 90min sessions); Burnaby, Vancouver, Coquitlam |
| Intermediate Plan | $1,200 | For drivers with basic skills refining technique | 21 hours (14 x 90min lessons); Burnaby, Vancouver, Coquitlam |
| Advanced Plan | $520 | For those preparing for Class 5 license | 9 hours practice (6 lessons) |
| Road Test Package | $180 | 60min warm-up class, car provided for test | 60min warm-up (pickup & drop-off included) |

**Design direction for this section: theme-specific, not photo-driven.**
All 5 plans currently share the exact same placeholder image in Wix (image
ID `e6f1d6_3c26a3066071457a80d225115e6034b4~mv2.jpg`) — one generic stock
photo reused across every plan, not real per-plan photography. Don't pull
or display this image, and don't design the section around per-plan
photos at all. Instead, differentiate the 5 plans visually through the
site's own design system: the Tesla/aurora color and type language,
distinct icons or motifs per plan tier (e.g. a road-test flag icon vs. a
multi-lesson bundle icon), and layout/hierarchy that reflects plan tier
(Individual Lesson reads as a lightweight single card; Beginners/
Intermediate/Advanced read as the core package tiers; Road Test Package
reads as a capstone/final-step card). This keeps the section from
depending on photography the client hasn't provided, and ties it more
tightly to this site's identity than a generic photo-card pricing grid
would anyway — see the No AI Slop checklist above on avoiding the default
three-card pricing pattern.

Build this as a dedicated pricing/plans component that fetches from the
Wix API at build time (static generation, since prices don't change
minute-to-minute) or client-side with caching — your call on which fits the
Vite/React setup better, but note the tradeoff (build-time = faster/simpler
but needs a rebuild on price changes; client-side = always fresh but needs
a loading state and API key exposed carefully, ideally proxied through a
Cloudflare Pages Function rather than called directly from the browser).

## Content (keep close to existing business facts, restructure freely)

Pull real business details from the current live site
(https://www.freeflydriving.ca) rather than inventing new claims — same
service (Tesla-only driving lessons, Class 5 & 7), same general service area
(Lower Mainland, BC), same contact info (phone +1 250-572-1808, email
freeflydriving@gmail.com, Instagram/Facebook/YouTube/TikTok @freeflydriving).
Do not fabricate pricing, testimonials, or instructor bios — use clearly
marked placeholder content for anything I haven't supplied yet, and flag it
in your output so I know what still needs real copy/photos from the client.

Sections to build:
1. Hero — Tesla scene intro, primary CTA (call/contact)
2. Why Tesla — regenerative braking, safety tech, autopilot familiarity as
   teaching advantages
3. Lessons/Pricing — the 5 real plans pulled live from Wix Pricing Plans
   (see "Pricing plans via Wix Headless" section above) — this is real
   data, not a placeholder
4. Instructors — placeholder section, clearly marked
5. Testimonials/reviews — placeholder section, clearly marked (do NOT
   invent fake reviews with names — use obvious "[Review placeholder]"
   markers)
6. Contact — phone, email, social links, simple contact form (form can be
   a static mailto fallback if no backend is wired up)
7. Footer — business name, contact, social icons, Sketchfab model
   attribution

## Design direction

- Typography-led design: one strong display typeface for headlines (check
  current variable fonts suited to automotive/tech feel — something with
  confident geometric character, not a generic Inter/Roboto default), paired
  with a clean readable body face
- Dark, cinematic base palette (Tesla brand context: black/white/red accent
  is expected territory, but push for something distinctive rather than
  literally copying Tesla.com's exact palette — this is a driving school,
  not Tesla Inc.)
- Motion should earn its place: use GSAP for scroll-triggered content reveals
  (fade/slide-up on section entry) in addition to the 3D camera work, but
  don't over-animate every element — restraint matters as much as flourish
- Fully responsive: on mobile, the 3D scene should either simplify (fewer
  scenes, shorter camera path) or fall back to static imagery if performance
  requires it — mobile users are a huge share of driving-school-age traffic

## Deliverables & process

1. Start by proposing the camera/scene keyframe structure and section list
   back to me in plain language before writing the full build, so I can
   sanity-check the sequence.
2. Build incrementally: get the 3D canvas + basic scroll timeline working
   and visible first, then layer in content sections, then polish
   typography/motion/responsive behavior last.
3. Flag any placeholder content clearly in a running list as you go (I'll
   swap in real copy/photos/pricing before launch).
4. Set up the project for Cloudflare Pages deployment (build command, output
   directory, any needed `_headers`/`_redirects` files).
5. Note total bundle size and 3D asset size at the end so I know what I'm
   shipping.

## Explicit non-goals

- No CMS integration, no backend, no auth — static site only for now
- No e-commerce/booking system — contact/CTA only
- Don't touch or reference the existing Wix site's code — this is a clean
  standalone rebuild
