# Opportunity Expansion → 10k live bilanciati (PF-118) — Design

**Status:** Approved design — ready for implementation planning
**Date:** 2026-07-04
**Branch:** PF-118
**Author:** Marco (with Claude Code)

## Obiettivo

Portare COhA da ~3.780 opportunità *live* a **10.000+ opportunità live, deduplicate e
rilevanti per studenti italiani**, diversificate oltre i tirocini: eventi, hackathon,
summer school, fellowship, competition. Ogni opportunità raccolta deve rispettare
ToS + robots.txt + ogni altro vincolo legale (regola dura, non negoziabile).

Target "onesto": il numero conta solo opportunità **live** (non scadute), **dedup**
(dedupKey unico) e **IT-relevant** — non righe grezze a DB.

## Baseline misurata (2026-07-04)

| Bucket | Count |
|---|---:|
| Totale a DB | 4.473 |
| Live (deadline/endDate futuri o null) | 3.781 |
| urlStatus ACTIVE | 2.716 |
| `country = 'IT'` | **116** |
| `isRemote = true` | 228 |

Per tipo (totale / live): `TIROCINIO` 2.972 / 2.954 · `EXTRACURRICULAR` 1.095 / 618 ·
`EVENT` 283 / 118 · `FELLOWSHIP` 42 / 32 · `HACKATHON` 23 / 7 · `VOLUNTEERING` 15 / 14 ·
`RESEARCH` 12 / 12 · `SUMMER_PROGRAM` 10 / 7 · `COMPETITION` 9 / 7 · `BOOTCAMP` 6 / 6 ·
`EXCHANGE` 6 / 6.

**Riframe critico:** dei ~3.780 live, solo ~116 sono `country=IT` e ~228 remote; il resto
sono in larga parte tirocini da aggregatori EU/DACH. La baseline *davvero* IT-relevant è di
qualche centinaio. Il target reale non è "+6.230 su 3.780" ma **costruire ~10k IT-relevant
partendo quasi da zero** — di qui la centralità delle sorgenti IT-native (associazioni
studentesche + career-service atenei).

## Vincoli e stato dell'esistente

Lo schema è **già pronto**: `OpportunityType` include `EVENT, FELLOWSHIP, SUMMER_PROGRAM,
HACKATHON, COMPETITION, EXCHANGE, VOLUNTEERING, BOOTCAMP, RESEARCH`, e `Opportunity` ha già
i campi evento (`startDate/endDate/durationDays`, `format`, `cost/stipend/hasScholarship`,
`city/country/region`). **Aggiungere categorie è un problema di dati, non di schema.**

Contratto d'ingestione unico già esistente (riusato invariato):
`OpportunityRecord[]` → `batchUpsertOpportunities()` (dedup + AI enrich + geo via
`extractCountryCode`/`mapItalianRegion`) → `markStaleOpportunities(source, ids, …)` (lifecycle).

Infra già costruita e riusata: ATS registry data-driven (`ats/`), discovery orchestrator
(`discovery/discovery.orchestrator.ts`), scrape queue + worker (`discovery/queue.ts`,
`scrapeWorker.ts`) con `FOR UPDATE SKIP LOCKED`, rate-limit per-dominio, backoff, change-
detection via `contentHash`, auto-disable a 5 fallimenti; compliance gate per-company
(`processCompanyCompliance`, cache 30d); ledger `SOURCES.md`.

## Principio guida

Non costruiamo una pipeline nuova. Tutto ciò che aggiungiamo sta **a monte** del contratto
d'ingestione esistente. La sola infra nuova è il motore long-tail per categorie (Binario 2),
progettato come *gemello parallelo* del motore ATS.

## Architettura — tre workstream

```
   Binario 1 (backbone)   importer API/open-data/feed dedicati per categoria      P1 + quota P2
   Binario 2 (long tail)  category-discovery + scrape/LLM queue (gate legale)     P2 + P4
   Trasversale            geo-enrichment pass (backfill + metrica IT-relevant)     P3

   tutti → batchUpsertOpportunities() → markStaleOpportunities()
```

I 4 pezzi del problema:
- **P1 — Volume tirocini** (+~1.930 live): scalare il discovery ATS esistente (solo dati).
- **P2 — Categorie nuove** (+~4.300 live): il vero buco (eventi/hackathon/summer/fellowship).
- **P3 — Rilevanza IT**: `country` popolato su 116/4.473 → renderla reale e misurabile.
- **P4 — Freschezza**: eventi/hackathon scadono in fretta → serve inflow ricorrente.

## Matematica del target (live, dedup, IT-relevant)

| Categoria | Live oggi | Target | Gap | Binario primario |
|---|---:|---:|---:|---|
| Tirocini + Extracurricular | ~3.570 | ~5.500 | +1.930 | Discovery ATS (scala seed) |
| Eventi | 118 | ~2.000 | +1.880 | B2 + B1 feed |
| Hackathon | 7 | ~800 | +793 | B1 + B2 |
| Summer/School | 7 | ~700 | +693 | B1 + B2 |
| Fellowship/Grant | 32 | ~600 | +568 | B1 + B2 |
| Competition/altro | ~35 | ~400 | +365 | B1 + B2 |
| **Totale live** | **~3.780** | **~10.000** | **+6.230** | |

**Definizione operativa `IT_relevant`** (per il target e per la metrica di dashboard):
```
IT_relevant = country = 'IT'
           OR isRemote = true
           OR (isAbroad = true AND type IN (SUMMER_PROGRAM, FELLOWSHIP, EXCHANGE, EVENT) con scope EU)
```
Il gate di qualità del target è una query/vista `live AND dedup AND IT_relevant`, esposta su
un endpoint di coverage: "10k" deve essere verificabile con una query.

## Binario 1 — sorgenti backbone per categoria

Regola: **nessuna sorgente `ENABLED` finché robots.txt + ToS non sono verificati e
registrati in `SOURCES.md`** (gate C0). Ogni riga è una *candidata*; le rese sono stime.

**Hackathon** (+~793): MLH season list (dataset pubblico — verificare licenza) · Devfolio (API —
verificare ToS) · DoraHacks (API — verificare ToS) · HackClub (già ENABLED, espandere) ·
Devpost = **EXCLUDED** (solo via B2 se esposto altrove).

**Fellowship/Grant** (+~568): EURAXESS (open-data/API, probabile CC — verificare) · EU Funding &
Tenders / Erasmus+ (open-data) · Opportunity Desk (già ENABLED, aggiungere feed) · DAAD
(scrape+gate) · ProFellow / Scholars4dev (scrape+gate, ToS da verificare).

**Summer school** (+~693): SummerSchoolsInEurope.eu (scrape+gate, core della categoria) ·
Erasmus+/EU programmes (open-data) · pagine summer school atenei IT (via B2).

**Eventi** (+~1.880, grosso da B2): associazioni studentesche IT/EU (ESN, AEGEE, ELSA, BEST,
IAESTE, AIESEC — feed/API/scrape+gate, **alta rilevanza IT**) · career-service atenei (RSS/ICS) ·
developers.events/confstech/techconfit/mobilizon (già ENABLED, ampliare) · Meetup/Eventbrite/
Lu.ma = **da evitare/EXCLUDED**.

**Tirocini (P1)**: nessun importer nuovo. Allungare i seed
`discovery/seeds/italy-ats-seed.ts` e `italy-company-domains.ts` con più aziende/atenei IT;
aggiungere i career-board degli atenei come target B2. Il resto lo fa la macchina esistente.

**Razionale:** associazioni studentesche e career-service atenei sono legalmente puliti
(feed pubblici o consenso facile), IT-native (risolvono P3 di default) e coprono
trasversalmente eventi/summer/hackathon/workshop.

## Binario 2 — motore long-tail per categorie (infra nuova)

Gemello parallelo del motore ATS: harvesta *pagine-opportunità di organizzatori* invece di
*careers page di aziende*. Stessi pattern (queue, gate, change-detection, backoff).

### 1. Modello dati — `HarvestTarget` (nuovo, generico)
`CompanyWatchlist` è company-centrico; introduciamo un modello gemello con le stesse
colonne rilevanti all'harvest:
```
HarvestTarget {
  id, name, url, sourceLabel          // "ESN Italia", "Politecnico Career"
  categoryHint  OpportunityType?       // bias per l'estrattore
  feedKind      String                 // jsonld | ics | rss | html-static | html-js
  scrapeTier    String?                // B/C solo per html-*
  country, region                      // rilevanza IT nota a priori dal seed
  robotsAllowed, tosAllowed, tosNotes, complianceCheckedAt   // gate riusato, cache 30d
  contentHash, contentHashAt, lastSyncedAt, lastScrapeStatus // change-detection + health
  consecutiveFailures, isActive
}
```

### 2. Fingerprint = leva di costo
Rileviamo il **tipo di feed** e instradiamo:
```
JSON-LD schema.org/Event  → estrazione STRUTTURATA  (0 LLM)   ← preferito
link .ics (calendario)    → parse ICS               (0 LLM)
RSS/Atom                  → parseRSSFeed() (già esiste)(0 LLM)
HTML statico              → tier B → LLM extraction
HTML JS-heavy             → tier C → Chromium + LLM
```
La maggior parte di associazioni/atenei espone JSON-LD o ICS → volume alto a costo LLM
quasi nullo. L'LLM resta solo per la coda non strutturata.

### 3. Connettori category-discovery
Gemelli di `company-domain.connector`: seed di domini organizzatori → risolvono la pagina
eventi/opportunità → fingerprint feed → registrano un `HarvestTarget`. Seed iniziali:
`seeds/it-student-orgs.ts`, `seeds/it-university-careers.ts` (dai ~90 atenei MUR già in DB),
`seeds/hackathon-orgs.ts`, `seeds/summer-school-orgs.ts`. Append e il run successivo li
raccoglie.

### 4. Estrazione generalizzata
Estrarre `extractOpportunitiesWithLLM` dal coupling con `CompanyWatchlist` in
`extractOpportunitiesFromPage(html, ctx)` con `ctx = { sourceLabel, categoryHint, organizer }`.
Output → **lo stesso** `batchUpsertOpportunities()` + `markStaleOpportunities(sourceLabel, …)`.

### 5. Gate legale su ogni fetch
Generalizzare `processCompanyCompliance` → `processTargetCompliance(target)` (robots.txt +
ToS, cache 30d). Nessun record senza gate verde.

### 6. Riuso della coda
`ScrapeJob` prende un `harvestTargetId` nullable accanto a `companyId` (esattamente uno
valorizzato). `claimNextJob`/`failJob`/backoff/`getQueueStats` **invariati**. Si aggiunge
`enqueueHarvestJobs()` (gemello di `enqueueScrapeJobs`) e un branch nel worker che dispatcha
per tipo di target. Scheduler esistente (enqueue 01:00, worker ogni 2h) esteso, non riscritto.

## Trasversale — geo-enrichment (P3), freschezza (P4), gate

### P3 — Geo-enrichment
- **Backfill una-tantum** sui ~4.473 esistenti: rideriva `country/region/city` da
  `location`/`organizer`/`company` con `extractCountryCode` + `mapItalianRegion`; per gli
  ambigui, **fallback LLM batch** solo su chi resta null. Rivela il numero *vero* di IT-relevant.
- **A regime:** i seed B2 (student org + atenei) portano `country/region` noti a priori →
  nascono IT-relevant senza inferenza.
- **Metrica:** query/vista `live AND dedup AND IT_relevant` esposta su endpoint di coverage
  (es. `GET /import/coverage`), per categoria.

### P4 — Freschezza / lifecycle
- **Nuova regola di expiry** nella cleanup: `expiresAt := now` quando `endDate < now`
  (eventi/hackathon finiti) o `deadline < now` (candidature chiuse). Oggi la cleanup cancella
  solo se `expiresAt < now`, quindi un evento con `endDate` passato ma ancora listato resta
  "live" — questo buco va chiuso.
- **`markStaleOpportunities` scoped per `sourceLabel`** su ogni run B2: ciò che sparisce dalla
  sorgente scade entro una settimana (cleanup settimanale già esistente).
- **Inflow > churn:** i feed strutturati (ICS/RSS/JSON-LD) rigirano quotidianamente a costo
  ~zero, mantenendo i ~2k eventi live rimpiazzando i scaduti.

### Gate legale unificato
Un solo gate `processTargetCompliance` (robots.txt + ToS, cache 30d) davanti a ogni fetch
(CompanyWatchlist e HarvestTarget). `SOURCES.md` aggiornato come pre-condizione di ogni
`ENABLED`. Blocklist EXCLUDED estesa alle event platform (Eventbrite/Lu.ma/Meetup/Bevy/GDG…).
Attribution propagata nel campo `source` per licenze CC BY / CC BY-NC.

## Fasi e milestone

- **Fase 0 — Fondamenta & misura**: geo-backfill + endpoint metrica `IT_relevant`; regola di
  expiry `endDate/deadline` nella cleanup; gate generalizzato `processTargetCompliance`.
  → *Milestone: baseline IT-relevant reale nota + dashboard coverage live.*
- **Fase 1 — Scala tirocini (P1)**: allunga i seed ATS + career-board atenei come target
  (solo dati). → *Milestone: tirocini/extracurricular ~5.500 live.*
- **Fase 2 — Backbone Binario 1**: importer per categoria, ciascuno C0→`SOURCES.md`→`ENABLED`.
  → *Milestone: hackathon ~300, fellowship ~300, summer ~300, eventi ~800.*
- **Fase 3 — Motore long-tail Binario 2**: modello `HarvestTarget` + migration; estrazione/gate
  generalizzati; `ScrapeJob`/worker estesi; connettori + seed; wiring scheduler.
  → *Milestone: ~10k IT-relevant live e sostenuti.*
- **Fase 4 — Hardening**: tuning auto-disable, monitoraggio costo LLM, audit qualità dedup,
  dashboard coverage per categoria.

## Testing

- **Unit:** rilevamento fingerprint (JSON-LD/ICS/RSS/html), record builder, geo-derivation,
  regola di expiry (`endDate`/`deadline`).
- **Integration:** ogni importer contro **fixture registrate** (niente rete in CI) → asserisce
  shape `OpportunityRecord`, `type`, `country`.
- **Compliance:** il gate blocca sorgenti robots/ToS negate (test dedicato).
- **Dedup:** collisioni `dedupKey` cross-source, incluso il caso event-aware.
- **Smoke E2E (staging/manuale):** discovery + worker su 2-3 sorgenti live → conteggi > 0 e
  crescita metrica coverage.

## Rischi e mitigazioni

- **Costo LLM sulla coda B/C** → feed-strutturati-first, change-detection (hash), auto-disable
  a 5 fail, **budget cap / kill-switch** sul worker.
- **`dedupKey` sbaglia sugli eventi ricorrenti** (correttezza): oggi è
  `title + company/organizer`; un evento con più date collasserebbe istanze distinte. →
  **dedupKey event-aware = `title + organizer + startDate`** per i tipi datati.
- **Compliance/legale** → gate duro + ledger + blocklist EXCLUDED estesa.
- **Spam/qualità dalla long tail** → flag `verified`, arricchimento AI centralizzato (cluster/
  skill/lingue), soglia di fiducia per sorgente.
- **Churn eventi** → feed strutturati quotidiani; allarme se il trend `live` scende.
- **Scala/perf** → `batchUpsertOpportunities` già ~10x; sorvegliare throughput
  dell'arricchimento AI/embedding a 10k righe.

## Fuori scope (YAGNI)

Nessun real-time, nessuna sorgente EXCLUDED, nessun marketplace di plugin generico. Solo
batch, sopra il contratto d'ingestione esistente. Nessuna modifica allo schema `Opportunity`
(già completo); l'unica migration è il nuovo modello `HarvestTarget` + colonna
`ScrapeJob.harvestTargetId`.

## Modifiche allo schema

- **Nuovo modello** `HarvestTarget` (vedi Binario 2 §1).
- **`ScrapeJob`**: aggiungere `harvestTargetId String?` (FK a `HarvestTarget`), con vincolo
  applicativo "esattamente uno tra `companyId` e `harvestTargetId` valorizzato".
- Nessun'altra modifica: `Opportunity` è già completo.
