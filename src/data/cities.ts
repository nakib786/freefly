/**
 * Service-area registry. One entry here becomes one static landing page.
 *
 * `scripts/build-seo.mjs` reads this file and emits, per city, a zero-JavaScript
 * HTML page at /driving-lessons-<slug>, a `text/markdown` twin at the same path
 * with a .md extension, a sitemap entry, an llms.txt line and a footer link.
 * Adding a city is a single object; nothing else needs editing.
 *
 * ── Why these pages are static HTML and not React routes ────────────────────
 *
 * The homepage is a client-rendered SPA behind a 3D scene. Googlebot renders
 * JavaScript, eventually; ClaudeBot, GPTBot, PerplexityBot and CCBot do not
 * render it at all, so to those crawlers a React route is a blank document.
 * Local-intent search ("driving lessons burnaby") is exactly the query an answer
 * engine fields, so these pages are plain server-served HTML with the content
 * in the markup. They carry no JS at all.
 *
 * ── The honesty rule, which matters more here than anywhere else ────────────
 *
 * Mass-produced city pages that differ only by a find-and-replace on the city
 * name are doorway pages, and Google demotes them by name in its spam policy.
 * They also read as spam to a human, which is worse. So every entry below has
 * to earn its page:
 *
 *   `tier`    decides what the page is allowed to CLAIM about availability.
 *             Only `core` cities are named in the client's own Wix plan perks;
 *             `base` is the city the business is registered in. Everything else
 *             is `extended` and its page says lessons are arranged on request,
 *             because that is the truthful version.
 *
 *   `roads`   is the part that makes the page worth reading: what is actually
 *             hard about driving there. This is observable geography (grades,
 *             arterials, interchanges, one-way grids), not invented local
 *             detail, and it is the reason each page differs in substance
 *             rather than in name only.
 *
 * Deliberately absent: ICBC driver licensing office addresses. They would be
 * the single most useful field on the page and they are not written here from
 * memory, because a wrong address sends a student to the wrong building on the
 * morning of their road test. `CITY_PLACEHOLDER` surfaces that gap in the
 * dev-only placeholder list until the client supplies them.
 */

/**
 * `base`     the registered address; standard package pricing applies.
 * `core`     named in the live Wix plan perks, which carry the travel price.
 * `extended` inside the Lower Mainland and reachable, but not a named area, so
 *            these pages promise a conversation rather than a booking.
 */
export type CityTier = 'base' | 'core' | 'extended';

export type City = {
  /** URL slug. The page is served at /driving-lessons-<slug>. */
  slug: string;
  name: string;
  tier: CityTier;
  /**
   * Real driving characteristics, used as the body of the page. Each string is
   * one paragraph. Keep them specific to the place: a sentence that would read
   * identically under another city's heading does not belong here.
   *
   * Driving conditions ONLY. No pricing and no availability copy: that is what
   * `tier` and TIER_AVAILABILITY are for, and mixing the two here has a real
   * cost. `roads[0]` is the page's hero lede and the answer to "what is
   * difficult about driving in X", which is the question an answer engine can
   * only satisfy from this page. An opening sentence about travel charges
   * wastes both.
   *
   * Order matters for the same reason: strongest first, cool-down last.
   */
  roads: readonly string[];
  /** Neighbourhoods and arterials, for the "areas covered" line. */
  areas: readonly string[];
  /** Drive time from the Surrey base, in minutes, off-peak. Approximate. */
  minutesFromBase: number;
};

/**
 * Order matters: it is the order of the sitemap, the footer links and llms.txt,
 * so it runs base first, then the cities the business actually names, then the
 * rest of the Lower Mainland roughly west to east.
 */
export const CITIES: readonly City[] = [
  {
    slug: 'surrey',
    name: 'Surrey',
    tier: 'base',
    minutesFromBase: 0,
    areas: ['Whalley', 'Guildford', 'Newton', 'Fleetwood', 'Cloverdale', 'South Surrey'],
    roads: [
      'Surrey is the most useful place in the Lower Mainland to learn, because almost every road type a road test can throw at you exists inside the city limits: fast signalled arterials, quiet residential grids, industrial routes and semi-rural roads, all within a few minutes of each other.',
      'The arterials are the thing to get right. King George Boulevard, Fraser Highway and 104 Avenue are wide, fast and signal-heavy, with long gaps between lights that tempt you into speeds an examiner will mark you down for. Lane discipline through the 152 Street and 88 Avenue corridors is the other recurring theme: multiple through-lanes, frequent bus pull-outs and turn bays that appear late.',
      'South Surrey adds the opposite problem. Quiet residential grids with uncontrolled intersections are where most students stop scanning, and uncontrolled intersections are a standard examiner check.',
    ],
  },
  {
    slug: 'burnaby',
    name: 'Burnaby',
    tier: 'core',
    minutesFromBase: 30,
    areas: ['Metrotown', 'Brentwood', 'Edmonds', 'Lougheed', 'Burnaby Heights', 'SFU'],
    roads: [
      'Kingsway and Lougheed Highway are the two roads that decide how a Burnaby lesson goes. Both are multi-lane arterials with closely spaced signals, heavy transit traffic and left-turn bays that fill quickly, which makes lane selection something you have to plan a block ahead rather than react to.',
      'Metrotown is the congestion test: dense pedestrian crossings, buses pulling out, and parkade entrances that appear mid-block. The SFU approach up Burnaby Mountain is the opposite kind of test, a sustained grade with tight switchbacks where hill starts and controlled downhill speed actually matter, and where regenerative braking in the Model 3 does most of the work for you once you learn to read the descent early.',
      'The Trans-Canada interchanges at Willingdon and Gaglardi are where Burnaby stops being city driving. Both put you into fast-moving through traffic from a short ramp, and the Gaglardi approach adds a grade to the merge. North of the highway, Hastings through Burnaby Heights returns to slow retail street work with angled parking and constant pedestrian movement, so a single lesson can cover both extremes without leaving the city.',
    ],
  },
  {
    slug: 'vancouver',
    name: 'Vancouver',
    tier: 'core',
    minutesFromBase: 40,
    areas: ['Downtown', 'Kitsilano', 'Mount Pleasant', 'East Vancouver', 'Dunbar', 'Marpole'],
    roads: [
      'Downtown Vancouver is the densest driving environment in the province and it is unlike anywhere else in the Lower Mainland: a one-way grid, separated bike lanes that cross your turning path, bus-only lanes, and pedestrian volumes that make a right turn on red a genuine judgement call rather than a formality. Getting comfortable with the shoulder check into a separated bike lane is the single most valuable habit a Vancouver lesson builds.',
      'The west side is a different exercise again. Dunbar and the streets above 16th Avenue carry real gradients, and the arterial crossings at Broadway, 41st and Granville are wide, fast and busy. Marpole and the approach to the Arthur Laing and Oak Street bridges add merging under time pressure, which is where most nervous drivers hesitate at exactly the wrong moment.',
      'Parking is its own skill here and it is worth booking lesson time for. Parallel parking on a busy Kitsilano or Mount Pleasant street, with a cyclist lane beside you and traffic waiting behind, is a genuinely harder manoeuvre than the version an examiner sets up on a quiet road, and it is the one most Vancouver drivers do badly for years.',
    ],
  },
  {
    slug: 'coquitlam',
    name: 'Coquitlam',
    tier: 'core',
    minutesFromBase: 35,
    areas: ['Town Centre', 'Maillardville', 'Burquitlam', 'Westwood Plateau', 'Austin Heights'],
    roads: [
        'Coquitlam splits cleanly into two driving problems. Down at Lougheed Highway and the Barnet corridor you get high-speed multi-lane traffic with heavy truck volume and merges that give you very little runway, which is the closest thing to highway driving most learners meet before their test.',
      'Up on Westwood Plateau it is all sustained grades, blind crests and curved residential streets with limited sightlines, plus winter conditions that arrive earlier and stay longer than they do at sea level. Snow and standing water reach the plateau while the rest of the city is merely wet, so it is the most useful place nearby to learn what reduced grip actually feels like before you meet it unplanned.',
      'Coquitlam Town Centre in between is ordinary urban work, and useful precisely because it is unremarkable: multi-lane intersections, mall entrances, a transit exchange that puts buses across your path constantly, and enough parking structures to practise low-speed manoeuvring without holding up a public road.',
    ],
  },
  {
    slug: 'new-westminster',
    name: 'New Westminster',
    tier: 'extended',
    minutesFromBase: 25,
    areas: ['Uptown', 'Downtown New West', 'Sapperton', 'Queensborough', 'West End'],
    roads: [
      'New Westminster is the best hill-start practice in the region and one of the hardest places to drive well. The city is built on a slope down to the Fraser, so the north–south streets off Columbia and Carnarvon are steep, narrow, lined with parked cars on both sides, and frequently require you to hold the car on a grade with someone close behind you.',
      'Add the bridge approaches and it gets harder still. The Pattullo, the Queensborough and the Brunette interchange all funnel traffic through a small street grid, so backups reach a long way onto ordinary residential roads and merges happen at low speed in tight gaps.',
      'The older street layout is genuinely unforgiving: short blocks, offset intersections, and lane widths from a century before the cars using them. A student who is comfortable in New Westminster is comfortable anywhere in the Lower Mainland.',
    ],
  },
  {
    slug: 'richmond',
    name: 'Richmond',
    tier: 'extended',
    minutesFromBase: 35,
    areas: ['City Centre', 'Steveston', 'Brighouse', 'Bridgeport', 'East Richmond'],
    roads: [
      'Richmond is flat, and its numbered-road grid is the most legible layout in the Lower Mainland, which makes it a genuinely good place to build early confidence before moving on to harder cities.',
      'The difficulty is elsewhere. No. 3 Road runs alongside the Canada Line with frequent signals and a great deal of turning traffic, and City Centre carries pedestrian and cyclist volumes that catch drivers who have only practised in quiet suburbs. The Knight Street, Oak Street and Highway 99 approaches are where the real work is: high-speed merging, short weaves and the tunnel, none of which forgive hesitation.',
      'The dyke roads and the agricultural east side add narrow shoulders, slow farm traffic and unlit stretches, which is the closest thing to rural driving inside Metro Vancouver.',
    ],
  },
  {
    slug: 'delta',
    name: 'Delta',
    tier: 'extended',
    minutesFromBase: 25,
    areas: ['North Delta', 'Ladner', 'Tsawwassen', 'Sunbury', 'Annacis Island'],
    roads: [
      'Delta covers three areas that barely resemble each other. North Delta borders the school and is ordinary suburban arterial driving on Scott Road and Nordel Way, with the Alex Fraser Bridge approach as the notable pressure point.',
      'Ladner and Tsawwassen are quiet, low-volume and flat, which makes them useful for early lessons but poor preparation on their own. Highway 17 and the run to the ferry terminal are the counterweight: sustained highway speed, long merges and heavy commercial traffic.',
      'The George Massey Tunnel deserves its own mention. Lane changes are prohibited through it, the lighting transition at both portals is abrupt, and counterflow timing changes which lanes are available, all of which reward a driver who has planned the route before entering rather than deciding inside.',
    ],
  },
  {
    slug: 'port-coquitlam',
    name: 'Port Coquitlam',
    tier: 'extended',
    minutesFromBase: 40,
    areas: ['Downtown PoCo', 'Birchland Manor', 'Riverwood', 'Mary Hill', 'Citadel Heights'],
    roads: [
      'Port Coquitlam is a compact city with a disproportionate amount of freight traffic, because the Mary Hill Bypass and the rail crossings put commercial vehicles onto roads that are otherwise residential in character.',
      'Level crossings are the local specific. There are several active rail crossings in and around the city and they close for long periods, so a student learns queue discipline and stopping distance behind heavy vehicles as a matter of routine rather than as a set piece.',
      'Lougheed Highway through the city is fast multi-lane arterial with mall and industrial entrances, while the streets north toward Riverwood and Citadel are curved suburban roads with limited sightlines. The two together make a reasonable road-test rehearsal.',
    ],
  },
  {
    slug: 'port-moody',
    name: 'Port Moody',
    tier: 'extended',
    minutesFromBase: 40,
    areas: ['Moody Centre', 'Newport Village', 'Klahanie', 'Heritage Mountain', 'Ioco'],
    roads: [
      'Port Moody is small, and almost all of its driving difficulty is concentrated in two places: the Barnet Highway and the climb up Heritage Mountain.',
      'Barnet is a fast, curved, multi-lane road with a steep drop on one side, limited shoulders and merge points that arrive quickly. It is one of the few roads in the region where a learner meets sustained highway-adjacent speed with real consequences for a lane-change error, and it is worth several lessons on its own.',
      'Heritage Mountain and the Ioco road are the grade work: long climbs, tight descending curves and residential intersections placed on slopes. Moody Centre at the bottom is ordinary low-speed town driving with angled parking, which makes a natural cooldown at the end of a lesson.',
    ],
  },
  {
    slug: 'langley',
    name: 'Langley',
    tier: 'extended',
    minutesFromBase: 30,
    areas: ['Willowbrook', 'Walnut Grove', 'Murrayville', 'Aldergrove', 'Fort Langley'],
    roads: [
      'Langley is the best highway practice available to a Lower Mainland learner. Highway 1 runs through it with several interchanges, and the on-ramps at 200th Street and 232nd Street give you enough length to actually learn merging properly instead of surviving it.',
      'The 200th Street corridor itself is heavy multi-lane arterial with retail entrances at close intervals, and Fraser Highway through Murrayville and Aldergrove mixes town speed limits with rural stretches in a way that catches drivers who set their speed once and stop reading signs.',
      'Beyond the built-up areas the roads turn genuinely rural: no lighting, no shoulders, farm equipment, and wildlife at dawn and dusk. Those are conditions most urban learners never see before they are licensed, and they are worth deliberate practice.',
    ],
  },
  {
    slug: 'white-rock',
    name: 'White Rock',
    tier: 'extended',
    minutesFromBase: 20,
    areas: ['Uptown White Rock', 'East Beach', 'West Beach', 'Marine Drive', 'Five Corners'],
    roads: [
      'White Rock is steep. The streets running down to the waterfront carry some of the sharpest sustained grades in the region, and doing them properly is a real skill: controlled descent without riding the brakes, and hill starts on a slope with a car behind you.',
      'Marine Drive along the promenade is the other half. It is slow, heavily parked on both sides, and busy with pedestrians for most of the year, so it is constant low-speed hazard perception, parallel parking on a grade, and patience.',
      'Five Corners and the North Bluff Road arterial bring it back to ordinary signalled intersections, which makes a sensible warm-up and cool-down around the harder waterfront work.',
    ],
  },
  {
    slug: 'maple-ridge',
    name: 'Maple Ridge',
    tier: 'extended',
    minutesFromBase: 45,
    areas: ['Haney', 'Albion', 'Silver Valley', 'Hammond', 'Websters Corners'],
    roads: [
      'Maple Ridge is where Metro Vancouver stops being suburban. Lougheed Highway through the city is a fast arterial with long gaps between signals, and east of town it becomes a genuinely rural highway with limited passing opportunities and slow-moving vehicles.',
      'The Golden Ears Bridge approach is a useful set piece: a sustained climb onto a high, exposed crossing with crosswinds and a toll-free but fast-moving traffic stream. Merging onto it and leaving it at speed is exactly the manoeuvre that a road test route in the area is built around.',
      'North toward Silver Valley the roads climb, narrow and curve, with gravel shoulders and deer. Combined with the flat Hammond and Haney grid near the river, the city gives you rural and residential conditions inside one lesson, which very few places in the region do.',
    ],
  },
] as const;

/** Slug lookup, used by the generator and the footer link list. */
export const CITY_BY_SLUG: ReadonlyMap<string, City> = new Map(CITIES.map((c) => [c.slug, c]));

/** Cities the client's own plan perks name, i.e. where we quote a firm price. */
export const NAMED_CITIES: readonly City[] = CITIES.filter(
  (c) => c.tier === 'core' || c.tier === 'base',
);

/** URL path for a city page. One definition, used by page, sitemap and links. */
export const cityPath = (city: City): string => `/driving-lessons-${city.slug}`;

/**
 * What each tier is allowed to say about booking. Kept next to the tier
 * definition so a new city cannot accidentally inherit a promise the business
 * has not made.
 */
export const TIER_AVAILABILITY: Record<CityTier, string> = {
  base: 'Standard package pricing. This is where the school is based, so there is no travel charge.',
  core: 'A named area in our lesson packages, booked at the travel-area price shown on the plan.',
  extended:
    'Inside our Lower Mainland service area. Lessons here are arranged by request, so call or message to confirm availability and pickup before booking.',
};

/**
 * Surfaced through the dev-only placeholder list in business.ts. This is a real
 * gap, not a nice-to-have: the ICBC office a student reports to is the most
 * searched-for fact on a page like this.
 */
export const CITY_PLACEHOLDER =
  'City pages: no ICBC driver licensing office is named on any of them, because the addresses were not supplied and are not being written from memory. Ask the client which offices their students actually test at, add an `icbc` field to src/data/cities.ts, and the pages and their schema pick it up automatically.';
