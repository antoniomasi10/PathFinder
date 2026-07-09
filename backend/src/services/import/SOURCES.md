# COhA Import Sources — Legal Ledger

Single source of truth for every import source. Update this file before enabling,
disabling, or modifying any importer. Compliance checks (robots.txt + ToS) for
CompanyWatchlist entries are cached in the DB (`CompanyWatchlist` model); for
dedicated importers they are recorded here manually and re-verified quarterly.

**Column key**

| Column | Values |
|---|---|
| Access | `API` official/documented · `Feed` RSS/Atom · `Scrape` HTML scraping · `ATS` ATS embed/widget · `Open-Data` government/CC dataset |
| robots.txt | `✅ allowed` · `❌ blocked` · `—` N/A (API/open data) |
| ToS | `✅ allowed` · `❌ blocked` · `⚠️ unclear` · `—` N/A |
| License | SPDX identifier or description |
| Status | `ENABLED` · `DISABLED` (paused, not deleted) · `EXCLUDED` (ToS/robots block) |

---

## ENABLED sources

| Source | Importer file | Access | robots.txt | ToS | License | Cron | Notes |
|---|---|---|---|---|---|---|---|
| **Opportunity Desk** | `opportunity-desk.import.ts` | Feed | ✅ allowed | ✅ allowed | CC BY — attribution required (source shown in UI) | Mon/Wed/Fri 02:00 | Fellowship, competition, research, volunteering RSS feeds |
| **EU Youth / Eurodesk** | `eu-youth.import.ts` | Scrape | ✅ allowed | ✅ allowed | Public EU institutional data | Mon 03:30 | European youth programs and grants |
| **SmartRecruiters** | `smartrecruiters.import.ts` | API | — | ✅ allowed | Public widget API | Mon 04:00 | Enterprise/German industrial internships |
| **HackClub** | `hackclub.import.ts` | API | — | ✅ allowed | AGPL-3.0, public API | Mon 04:30 | Global student hackathons |
| **Arbeitnow** | `arbeitnow.import.ts` | API | — | ✅ allowed | Public JSON API | Tue 03:30 | European internships aggregator |
| **RemoteOK** | `remoteok.import.ts` | API | — | ✅ allowed | Public JSON API | Tue 04:00 | Remote internships |
| **Developers.events** | `developers-events.import.ts` | API | — | ✅ allowed | CC BY-NC 4.0 — non-commercial use, attribution required | Tue 04:30 | Italian tech conferences |
| **ConfsTech** | `confstech.import.ts` | API | — | ✅ allowed | MIT | Wed 03:00 | International tech conferences open dataset |
| **Stage4eu** | `stage4eu.import.ts` | Scrape | ✅ allowed | ✅ allowed | — | Wed 03:30 | EU internship portal; HTML scrape with delay |
| **Company Watchlist** | `company-watchlist.import.ts` | Scrape+LLM | Per-company in DB | Per-company in DB | — | Wed 05:30 | robots+ToS gate per company; Workday EXCLUDED (ToS) |
| **Greenhouse** | `greenhouse.import.ts` | ATS | — | ✅ allowed | Public embed API (boards-api.greenhouse.io) | Thu 03:30 | ~50 boards; official ATS |
| **Jobicy** | `jobicy.import.ts` | API | — | ✅ allowed | Public JSON API | Thu 04:00 | Remote internships |
| **TechConfit** | `techconfit.import.ts` | API | — | ✅ allowed | CC0 Public Domain | Thu 04:30 | Italian tech conferences |
| **Lever** | `lever.import.ts` | ATS | — | ✅ allowed | Public embed API | Fri 03:30 | Official ATS; no auth required for public boards |
| **FashionUnited** | `fashionunited.import.ts` | Scrape | ✅ allowed | ✅ allowed | — | Fri 04:00 | Fashion industry internships; HTML scrape |
| **Mobilizon Italy** | `mobilizon.import.ts` | API | — | ✅ allowed | AGPL-3.0 public GraphQL API | Fri 04:30 | Community events in Italy |
| **Ashby** | `ashby.import.ts` | ATS | — | ✅ allowed | Public embed API | Sat 03:30 | Official ATS |
| **Workable** | `workable.import.ts` | ATS | — | ✅ allowed | Public widget API | Sat 04:00 | Official ATS |
| **Personio** | `personio.import.ts` | ATS | — | ✅ allowed | Public XML feed | Sun 03:30 | Official ATS; DACH region focus |
| **Recruitee** | `ats/adapters/recruitee.ts` | ATS | — | ✅ allowed | Public offers API (`{token}.recruitee.com/api/offers/`) | Sat 04:30 | Factory ATS; DB-driven tokens (grown by discovery) |
| **MUR** | `mur.import.ts` | Open-Data | — | — | CC BY / Italian gov open data | Monthly 1st 02:00/02:30 | Official Italian universities + courses |
| **AlmaLaurea** | `almalaurea.import.ts` | Open-Data | — | — | Partnership / public stats | Quarterly Jan/Apr/Jul/Oct 04:00 | Italian graduate employment stats |
| **ANPAL** | `anpal.import.ts` | Open-Data | — | — | CC BY (Italian gov open data) | Monthly 1st 03:00 | Garanzia Giovani measures + Servizio Civile Universale bandi via dati.gov.it CKAN |
| **Devfolio** | `devfolio.import.ts` | Scrape (structured, 0 LLM) | ✅ allowed | ✅ allowed | — | Tue 04:45 | Hackathon listing; `__NEXT_DATA__` JSON parse, no LLM. Heavily India-centric — only `is_online` events are IT-relevant, expect single-digit yield |
| **MSCA** | `msca.import.ts` | API (SEDIA search API, official EU) | — | — | Public EU institutional data | Mon 05:00 | Marie Skłodowska-Curie Actions fellowships/doctoral networks via `api.tech.ec.europa.eu/search-api` (apiKey=SEDIA, public/unauthenticated). Replacement for EURAXESS (excluded). Scoped to `text=MSCA` keyword — not the full institutional-grants catalogue |

---

## Binario 3 — job-aggregator APIs (Fase 5, parallel track)

Official aggregator APIs run alongside the company-first crawl to add Italy-relevant
volume immediately while the crawl scales. Both require a free API key (optional
sources — the importer logs and returns a no-op when unset, never errors) and both
require visible attribution, shown as a backlink in the opportunity detail page's
"Fonte" row (`frontend/app/(main)/opportunities/[id]/page.tsx`). Apply links
(`redirect_url` / `link`) are stored and used exactly as returned — never resolved
or rewritten, per each API's ToS.

| Source | Importer file | Access | robots.txt | ToS | License | Cron | Notes |
|---|---|---|---|---|---|---|---|
| **Adzuna** | `adzuna.import.ts` | API | — | ✅ allowed (attribution required) | Official API terms | Wed 04:00 | `api.adzuna.com/v1/api/jobs/it/search`; `what_or` keyword filter (stage/tirocinio/internship/trainee/graduate/junior/…), `max_days_old=45`; needs `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` |
| **Jooble** | `jooble.import.ts` | API | — | ✅ allowed (attribution required) | Official API terms | Thu 05:00 | `jooble.org/api/{key}` POST; `keywords`/`location=Italia` filter; needs `JOOBLE_API_KEY` |

Quality controls shared with the rest of the pipeline: `isSeniorRole` title filter,
`validateOpportunity`, cross-source `dedupKey` (an aggregator ad for a company we
also import via tier A collides and the earlier row wins — monitor via
`GET /dedup-audit`).

Admin: `POST /adzuna`, `POST /jooble`.

---

## Import expansion — data-driven ATS registry + discovery + scrape queue

To cover Italian companies at scale, ATS sources are **data-driven**: board tokens
live in `CompanyWatchlist` (`atsType` + `atsToken`, `scrapeTier = A`) instead of
hardcoded maps. The generic **ATS factory** (`ats/ats-connector.ts` + `ats/adapters/*`)
reads tokens from the DB, so *discovering a company = inserting a row* — no code per
company. Seed tokens were migrated in via `scripts/migrateAtsBoardsToRegistry.ts`.

**Discovery** (`discovery/discovery.orchestrator.ts`, Mon 02:30) runs pluggable
`DiscoveryConnector`s. Fase 1 ships the ATS-index seed connector for Italian companies
(`discovery/connectors/ats-seed.connector.ts` + `discovery/seeds/italy-ats-seed.ts`, ~71
candidate tokens); each candidate is **validated against the live ATS API before
registering**, so wrong/dead tokens never pollute the registry. ATS public APIs are
covered by the rows above (no per-company robots/ToS needed). The company-domain
connector (`discovery/connectors/company-domain.connector.ts` +
`discovery/seeds/italy-company-domains.ts`, ~244 apex domains across energy, industrial/
automotive, finance, fashion, food, telecom/tech, pharma, and retail/logistics) resolves
each domain's careers page and fingerprints it — this feeds the long tail (resolver +
fingerprint, below). The university-careers connector
(`discovery/connectors/university-careers.connector.ts` +
`discovery/seeds/italy-university-careers.ts`, ~66 Italian university apex domains)
routes career-service pages through the same resolve→fingerprint→route path — these
are IT-native by construction (PF-118 P3: fixes the country=IT scarcity). All three
seed lists are meant to keep growing; append entries and the next discovery run picks
them up.

**Scrape queue** (`discovery/queue.ts` + `discovery/scrapeWorker.ts`) handles the tier
B/C long tail (custom / JS career sites) at scale: `ScrapeJob` table claimed with
`FOR UPDATE SKIP LOCKED`, per-domain rate limiting, exponential backoff, `contentHash`
change-detection (skips the LLM when a page is unchanged), and auto-disable after 5
consecutive failures. Compliance for tier B/C reuses the per-company robots.txt + ToS
gate (cached 30d). Enqueue daily 01:00; worker every 2h.

Admin: `POST /ats/:platform`, `POST /discovery/run`, `POST /queue/enqueue`,
`POST /queue/drain`, `GET /queue/stats`, `GET /registry/stats`.

---

## Company registry — pre-funnel staging (Fase 5, company-first scale-up)

The hand-curated seeds (~71 ATS tokens, ~245 domains, ~66 universities) saturated
around 551/10k Italy-relevant opportunities. Fase 5 grows the input at scale from
**free open data only**, staged in `CompanyRegistry` (pre-resolution — most raw
rows never get a careers page) before promotion into `CompanyWatchlist` via the
existing `registerAtsBoard`/`registerScrapeTarget`. See
`docs/superpowers/specs/2026-07-09-fase5-company-first-scaleup-design.md`.

| Source | Loader file | Access | robots.txt | ToS | License | Notes |
|---|---|---|---|---|---|---|
| **Registro Imprese — startup/PMI innovative** | `company-registry/loaders/registro-imprese-startup.loader.ts` | Open-Data (manual CSV export) | — | — | CC-BY 4.0 (Infocamere) | No documented stable bulk-download URL (verified 2026-07-09) — requires manually downloading the CSV from startup.registroimprese.it and passing `--file`. ~15k startups/PMI with declared website |
| **Wikidata** | `company-registry/loaders/wikidata.loader.ts` | API (SPARQL) | — | — | CC0 | `query.wikidata.org/sparql`, fixed `P31` class list (business/enterprise/public company/bank/insurer) + `P17=Italy` + `P856` (official website required). Also covers Borsa Italiana listed companies via `P414` |
| **Manual curated lists** (e.g. Mediobanca "Le principali società italiane") | `company-registry/loaders/manual-list.loader.ts` (`source: manual:<list-name>`) | Manual | — | — | — | One-time hand-prepared CSV import; never scraped automatically (source ToS not reviewed for automated access) |
| **Common Crawl ATS-token index** | `company-registry/loaders/commoncrawl-ats.loader.ts` | Open-Data (public web archive index) | — | — | CC BY 4.0 (index); underlying job data always fetched live from the permitted ATS API, never from the archive | Queries `index.commoncrawl.org` CDX API for URLs already hosted on `boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`, `apply.workable.com`, `*.recruitee.com` — every hit is a tier-A candidate by construction, 0 careers-page resolution needed. Deliberately does NOT scan `*.it` for careers pages (needs the columnar/parquet index, out of scope). Each token is probed against the live ATS API and kept only if it has ≥1 Italy/EU-remote role, gating out global boards. Prohibited ATS (Workday/SuccessFactors/Taleo/iCIMS) are never queried — not in the platform list |

**GLEIF (Global LEI): evaluated and dropped** — the LEI golden copy has no website
field, and name→domain guessing at this scale produces too many wrong matches; not
worth the false-positive risk. Documented here so it isn't re-proposed.

**Discovery**: `runRegistryDiscovery()` (`discovery/discovery.orchestrator.ts`, daily
02:00) claims a priority-ordered batch of pending `CompanyRegistry` rows
(`discovery/connectors/company-registry.connector.ts::claimRegistryBatch`, default
`REGISTRY_DISCOVERY_DAILY_LIMIT=400`/day — polite, resumable via the `status` column
itself), routes each through the exact same resolve→fingerprint→route path as the
seed connectors (`routeDomainCandidate`, exported for reuse), then reconciles against
`CompanyWatchlist` to mark rows promoted/unresolved/pending-retry
(`reconcileRegistryBatch`). Rows that already carry a known ATS token (Common Crawl
fast path, Fase 5 slice below) skip straight to board validation. Kill switch:
`REGISTRY_DISCOVERY_ENABLED=false`.

Admin: `POST /registry/ingest { source, filePath? }`, `POST /registry/discovery-run
{ limit?, validate? }`, `GET /registry-funnel`.

---

## Harvest targets — long-tail engine (Fase 3, data-driven)

Twin of the ATS registry above, for *organizer opportunity pages* (student associations,
university event calendars, hackathon/summer-school orgs) instead of company careers
pages — see `docs/superpowers/specs/2026-07-09-fase3-long-tail-engine-design.md`. Targets
live in `HarvestTarget` (compliance columns identical in shape to `CompanyWatchlist`,
checked per-target via the same `checkCompliance()` gate — **not listed row-by-row here**,
impractical at the target scale this is meant to reach; audit via
`SELECT name, url, robotsAllowed, tosAllowed FROM "HarvestTarget"`).

**Feed-kind fingerprint** (`discovery/feed-fingerprint.ts`) routes each resolved
opportunity page by access pattern, cheapest first: `jsonld` (schema.org `Event` in
`<script type="application/ld+json">`) → `ics` (calendar feed link) → `rss` (feed link,
reuses `parseRSSFeed()`) → `html-static`/`html-js` (LLM extraction via
`extractOpportunitiesFromPage()`, tier B/C).

- **Structured feeds** (`jsonld`/`ics`/`rss`, 0 LLM): fetched directly by
  `discovery/harvest-feed-runner.ts`, weekly Tue 05:00 — bypass the scrape queue entirely.
- **HTML** (`html-static`/`html-js`): queued through the same `ScrapeJob` table as
  CompanyWatchlist (`harvestTargetId` instead of `companyId`), drained by the same
  `scrapeWorker.ts` every 2h.

**Discovery** (`discovery/harvest.orchestrator.ts`, Mon 03:00) runs pluggable
`HarvestConnector`s, resolves each candidate's opportunity page
(`discovery/opportunity-page-resolver.ts`), fingerprints it, and registers a
`HarvestTarget`. First connector: `discovery/connectors/student-orgs.connector.ts` +
`discovery/seeds/italy-student-orgs.ts` — 32 ESN Italy local section domains, verified
reachable against the official national directory (`esn.it/it/sezioni-esn`) on
2026-07-09. This is the case flagged repeatedly in Fase 2 as "belongs to Fase 3": ESN's
national feed only carries org-wide news, not local events.

Admin: `POST /harvest-discovery`, `POST /harvest-feeds` (structured feeds only — HTML
targets ride the existing `POST /queue/enqueue` + `POST /queue/drain`).

---

## DISABLED sources (paused — data kept in DB as static cache)

| Source | Importer file | Reason | Re-enable condition |
|---|---|---|---|
| **EURES** | `eures.import.ts` | No public API available; Playwright scrape too fragile after 2024 site redesign | Official API key or stable scrape endpoint |
| **Devpost** | `devpost.import.ts` | ToS prohibits automated access; contact support@devpost.com for API access | Official API grant |
| **BEST Courses** | `best-courses.import.ts` | ToS unclear; 403 on all legal/terms pages; contact info@best.eu.org | ToS clarification + robots.txt green |
| **F6S** | `f6s.import.ts` | C0 verification pending — robots.txt and ToS not yet checked | Check f6s.com/robots.txt + review ToS at f6s.com/terms; update SOURCES.md; set `ENABLED = true` in importer |
| **JobTeaser** | — | Partnership API — requires university agreement and API key | Contact api@jobteaser.com for university partnership; importer can then be built against documented REST API |

---

## EXCLUDED sources (permanent — ToS or robots.txt violation confirmed)

| Source | Access attempted | Violation | Date confirmed |
|---|---|---|---|
| **Bundesagentur für Arbeit** | Unofficial reverse-engineered API | BA explicitly opposed automated access | 2024 |
| **The Muse** | JSON API | ToS Section 3.3 prohibits replicating services | 2024 |
| **Eventbrite** | API / scrape | §13.1 bans scraping and data extraction | — |
| **EventItalia** | Scrape | Redistribution of listing data banned in ToS | — |
| **Lu.ma** | API | "publicly supported interfaces" clause ambiguous; conservative exclusion | — |
| **Bevy / Startup Grind / GDG** | Scrape | Explicit scraping prohibition in ToS | — |
| **Workday** | Scrape | ToS prohibits automated access; used by many CompanyWatchlist entries — auto-skipped | — |
| **SuccessFactors / Taleo / iCIMS** | Scrape | ToS prohibit automated access | — |

**Prohibited-ATS blocklist (enforced in code):** `discovery/ats-policy.ts` marks
Workday, SuccessFactors, Taleo, iCIMS as `prohibited`. Discovery uses them only as a
company *signal*: when a resolved careers page fingerprints to one of these, the company
is registered `no-harvest` (`lastScrapeStatus = 'no-harvest'`, `scrapeTier = null`) and is
never scraped. It is harvested only if it also exposes a non-ATS page of its own.

---

## Compliance check log (dedicated importers)

For sources using the CompanyWatchlist DB model, compliance is stored per-company in
`CompanyWatchlist.robotsAllowed`, `.tosAllowed`, `.tosNotes`, cached 30 days.

For dedicated importers (this section), compliance is manually verified and recorded here.

| Source | robots.txt verified | ToS verified | Next re-check | Verifier |
|---|---|---|---|---|
| Opportunity Desk | 2025-01 | 2025-01 | 2026-01 | Marco |
| EU Youth | 2025-01 | 2025-01 | 2026-01 | Marco |
| Developers.events | 2025-01 | 2025-01 | 2026-01 | Marco |
| ConfsTech | 2025-01 | 2025-01 | 2026-01 | Marco |
| Stage4eu | 2025-01 | 2025-01 | 2026-01 | Marco |
| Mobilizon Italy | 2025-01 | 2025-01 | 2026-01 | Marco |
| FashionUnited | 2025-01 | 2025-01 | 2026-01 | Marco |
| Arbeitnow | 2025-01 | 2025-01 | 2026-01 | Marco |
| HackClub | 2025-01 | 2025-01 | 2026-01 | Marco |
| Devfolio | 2026-07-04 | 2026-07-04 | 2026-10 | Marco |
| MSCA (SEDIA API) | — (official EU API, no robots.txt applicable) | — (official EU Commission API, public apiKey) | 2026-10 | Marco |

---

## Attribution requirements

Sources that require attribution to be shown in the UI or stored in records:

| Source | License | Attribution requirement |
|---|---|---|
| Opportunity Desk | CC BY | `source` field set to `"OpportunityDesk"`; shown in UI opportunity card |
| Developers.events | CC BY-NC 4.0 | `source` field set to `"DevelopersEvents"`; non-commercial use only |
| MUR | Italian gov open data (CC BY) | `source` field set to `"MUR"`; ministry credited in About page |
| AlmaLaurea | Partnership | Stats credited to AlmaLaurea in data displays |
| Adzuna | Official API terms | `source` set to `"Adzuna"`; detail page renders a backlink to adzuna.it; apply URL used as-is |
| Jooble | Official API terms | `source` set to `"Jooble"`; detail page renders a backlink to jooble.org; apply URL used as-is |

---

---

## VC Portfolio monitoring notes

Italian VC portfolio companies are added directly to the **CompanyWatchlist** table (not a separate importer).
The existing per-company compliance gate (robots.txt + ToS) applies automatically.

Key portfolios covered via seed B4 (+25 companies):
- **CDP Venture Capital** portfolio (Italy's largest public VC)
- **Cariplo Factory / H-Farm / PoliHub / I3P** incubator alumni
- Key VC-backed Italian scaleups (Satispay, Musixmatch, Bending Spoons, Prima Assicurazioni, Scalapay, …)

A portfolio discovery script could automate adding new portfolio companies by scraping each VC's portfolio page.
Candidate VCs for future automation: Indaco, P101, LVenture, Club degli Investitori.

---

*Last updated: 2026-07-04. Update whenever a source is added, removed, or its compliance status changes.*
