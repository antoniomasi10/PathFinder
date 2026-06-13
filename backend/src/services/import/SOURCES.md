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
| **MUR** | `mur.import.ts` | Open-Data | — | — | CC BY / Italian gov open data | Monthly 1st 02:00/02:30 | Official Italian universities + courses |
| **AlmaLaurea** | `almalaurea.import.ts` | Open-Data | — | — | Partnership / public stats | Quarterly Jan/Apr/Jul/Oct 04:00 | Italian graduate employment stats |
| **ANPAL** | `anpal.import.ts` | Open-Data | — | — | CC BY (Italian gov open data) | Monthly 1st 03:00 | Garanzia Giovani measures + Servizio Civile Universale bandi via dati.gov.it CKAN |

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

---

## Attribution requirements

Sources that require attribution to be shown in the UI or stored in records:

| Source | License | Attribution requirement |
|---|---|---|
| Opportunity Desk | CC BY | `source` field set to `"OpportunityDesk"`; shown in UI opportunity card |
| Developers.events | CC BY-NC 4.0 | `source` field set to `"DevelopersEvents"`; non-commercial use only |
| MUR | Italian gov open data (CC BY) | `source` field set to `"MUR"`; ministry credited in About page |
| AlmaLaurea | Partnership | Stats credited to AlmaLaurea in data displays |

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

*Last updated: 2026-06-14. Update whenever a source is added, removed, or its compliance status changes.*
