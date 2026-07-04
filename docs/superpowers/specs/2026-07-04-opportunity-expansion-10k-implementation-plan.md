# Opportunity Expansion → 10k live — Implementation Plan

**Date:** 2026-07-04
**Branch:** PF-118
**Spec:** `2026-07-04-opportunity-expansion-10k-design.md`

## Overview

Delivery in fasi. **Fase 0 e Fase 1 sono dettagliate a step eseguibili** (basso rischio,
alto valore, quasi solo dati + piccole modifiche mirate). **Fasi 2–4 sono outline**: vanno
dettagliate in un piano proprio quando ci si arriva (ogni fase = spec→plan→impl secondo la
convenzione del repo).

Principio invariato: tutto sta **a monte** del contratto d'ingestione esistente
(`batchUpsertOpportunities` → `markStaleOpportunities`). L'unica migration è in Fase 3
(`HarvestTarget` + `ScrapeJob.harvestTargetId`).

Ogni fase termina con una **misura**: query di coverage `live AND dedup AND IT_relevant`
per categoria (endpoint introdotto in Fase 0).

---

## Fase 0 — Fondamenta & misura

Obiettivo: sapere da che numero IT-relevant si parte davvero, chiudere i buchi di lifecycle
e dedup, e predisporre il gate generalizzato. Nessuna sorgente nuova.

### Step 0.1 — `dedupKey` event-aware

**File:** `backend/src/services/import/utils.ts` (`buildDedupKey`, riga ~315)

Aggiungere un terzo argomento opzionale `startDate`; quando presente (tipi datati:
EVENT/HACKATHON/SUMMER_PROGRAM/COMPETITION), includerlo nella chiave così istanze con date
diverse non collassano.

```ts
export function buildDedupKey(
  title: string,
  companyOrOrganizer: string | null | undefined,
  startDate?: Date | null,          // NEW
): string | null {
  // ...norm invariato...
  const t = norm(title);
  const c = norm(company || '');
  if (t.length < 3 || c.length < 2) return null;
  const d = startDate ? `|${startDate.toISOString().slice(0, 10)}` : '';   // NEW (YYYY-MM-DD)
  return `${t}|${c}${d}`;
}
```

### Step 0.2 — Passare `startDate` al dedupKey nel batch

**File:** `backend/src/services/import/batch.ts`

Nel punto in cui si calcola `dedupKey` per ogni `OpportunityRecord`, passare `record.startDate`
solo per i tipi datati (usare un set locale `DATED_TYPES`). Nessuna modifica alla firma di
`batchUpsertOpportunities`.

```ts
const DATED_TYPES = new Set<OpportunityType>([
  OpportunityType.EVENT, OpportunityType.HACKATHON,
  OpportunityType.SUMMER_PROGRAM, OpportunityType.COMPETITION,
]);
// ...
const dedupKey = buildDedupKey(
  r.title, r.organizer ?? r.company,
  DATED_TYPES.has(r.type) ? r.startDate ?? null : null,
);
```

### Step 0.3 — Lifecycle: expiry su `endDate`/`deadline` + dedup date-aware in cleanup

**File:** `backend/src/services/import/cleanup.service.ts` (`runCleanup`)

(a) **Fix del dedup raw** (step 0 attuale): oggi `GROUP BY LOWER(title), LOWER(company)`
fonde eventi con date diverse. Renderlo date-aware:

```sql
SELECT array_agg(id ORDER BY "postedAt" DESC) AS ids
FROM "Opportunity"
GROUP BY LOWER(title), LOWER(company), COALESCE("startDate", '1900-01-01'::timestamp)
HAVING COUNT(*) > 1
```

(b) **Nuovo step di expiry** prima della delete: marcare `expiresAt = now` per gli scaduti
per data, così la delete esistente li rimuove al ciclo dopo.

```ts
// N. Expire by date: finished events / closed deadlines
await prisma.opportunity.updateMany({
  where: {
    sourceId: { not: null },
    expiresAt: null,
    OR: [
      { endDate: { not: null, lt: now } },
      { deadline: { not: null, lt: now } },
    ],
  },
  data: { expiresAt: now },
});
```

### Step 0.4 — Geo-backfill una-tantum (script)

**File nuovo:** `backend/scripts/backfillOpportunityGeo.ts`

Itera sugli `Opportunity` con `country IS NULL`, rideriva `country/region/city` con
`extractCountryCode` + `mapItalianRegion` (già in `utils`/`geo-italy`). Per i residui ambigui,
fallback LLM batch (riusare il parser AI esistente, batch piccoli). Idempotente, eseguibile
via `ts-node`. Logga quanti passano a `country=IT`.

Run: `npx ts-node backend/scripts/backfillOpportunityGeo.ts`

### Step 0.5 — Endpoint metrica coverage

**File:** `backend/src/routes/import.routes.ts` (+ eventuale helper in un service import)

`GET /api/import/coverage` (admin) → per categoria: `total`, `live`, `dedup`, `it_relevant`.
`it_relevant` = `country='IT' OR isRemote OR (isAbroad AND type IN (SUMMER_PROGRAM,FELLOWSHIP,
EXCHANGE,EVENT))`. Una `$queryRaw` con `GROUP BY type` + i filtri. Questo è il cruscotto che
useremo per verificare ogni milestone.

### Step 0.6 — Gate compliance generalizzato (scaffolding)

**File:** estrarre da `backend/src/services/import/company-watchlist.import.ts`
(`processCompanyCompliance`) una funzione generica in un nuovo modulo
`backend/src/services/import/compliance/gate.ts`:

```ts
export async function checkCompliance(url: string, cache: {
  robotsAllowed: boolean|null; tosAllowed: boolean|null; complianceCheckedAt: Date|null;
}): Promise<{ allowed: boolean; robotsAllowed: boolean; tosAllowed: boolean; notes?: string }>
```

`processCompanyCompliance` diventa un thin wrapper attorno a `checkCompliance` (nessun cambio
di comportamento per CompanyWatchlist). Serve pronto per `HarvestTarget` in Fase 3.

### Test Fase 0
- Unit: `buildDedupKey` con/senza `startDate`; expiry rule (record con `endDate` passato →
  `expiresAt` settato; futuro → intatto).
- Unit: `checkCompliance` blocca robots/ToS negati (fixture).
- Manuale: `GET /import/coverage` restituisce i bucket; eseguire geo-backfill e rileggere
  coverage → **baseline IT-relevant reale nota**.

### Milestone Fase 0
Baseline IT-relevant reale misurata; lifecycle e dedup corretti; gate pronto per il riuso.

---

## Fase 1 — Scala tirocini (P1, solo dati)

Nessun codice di pipeline nuovo: si allungano i seed e si lascia lavorare il discovery ATS.

### Step 1.1 — Espandere i seed ATS
**File:** `backend/src/services/import/discovery/seeds/italy-ats-seed.ts`
Aggiungere token board ATS di aziende IT note (greenhouse/lever/ashby/workable/recruitee).
Ogni candidato è validato live dall'orchestrator prima di entrare (token morti scartati).

### Step 1.2 — Espandere i domini aziendali
**File:** `backend/src/services/import/discovery/seeds/italy-company-domains.ts`
Aggiungere apex domain di altre aziende/scaleup IT (oltre i 214 attuali). Resolver +
fingerprint li instradano a tier A/B/C automaticamente.

### Step 1.3 — Career-board atenei come target
Aggiungere i domini dei career-service dei ~90 atenei (già in DB da MUR) alla discovery.
In Fase 1 possono entrare come domini custom (tier B/C) via il flusso esistente; in Fase 3
diventeranno `HarvestTarget` con feed-detection. (Prep-work condiviso con Fase 3.)

### Step 1.4 — Run + misura
`POST /discovery/run`, poi `POST /queue/enqueue` + `POST /queue/drain`. Rileggere
`/import/coverage`.

### Milestone Fase 1
Tirocini + extracurricular ~5.500 live.

---

## Fase 2 — Backbone Binario 1 (outline)

Per **ogni** sorgente candidata (Sez. B dello spec): 
1. **C0 compliance** — verificare robots.txt + ToS; registrare in `SOURCES.md`. Se negato →
   EXCLUDED, stop.
2. Scrivere l'importer `*.import.ts` che emette `OpportunityRecord[]` (riuso `parseRSSFeed`,
   `fetchWithRetry`, `mapOpportunityType`, `extractCountryCode`) → `batchUpsertOpportunities`
   → `markStaleOpportunities(source, …)`.
3. Test d'integrazione su fixture registrata.
4. Cron nello `scheduler.ts`; `ENABLED = true`; aggiornare `SOURCES.md`.

Ordine consigliato per resa/rilevanza: associazioni studentesche (eventi, IT-native) →
EURAXESS (fellowship) → SummerSchoolsInEurope (summer) → MLH/Devfolio (hackathon).

**Milestone:** hackathon ~300, fellowship ~300, summer ~300, eventi ~800.

---

## Fase 3 — Motore long-tail Binario 2 (outline)

1. **Migration Prisma:** modello `HarvestTarget` (spec §Binario 2.1) + `ScrapeJob.harvestTargetId
   String?`. `npm run db:migrate`.
2. **Fingerprint feed:** `discovery/feed-fingerprint.ts` → `jsonld|ics|rss|html-static|html-js`.
3. **Estrazione generalizzata:** estrarre `extractOpportunitiesWithLLM` →
   `extractOpportunitiesFromPage(html, ctx)` (rimuovere il coupling con `CompanyWatchlist`).
4. **Parser strutturati (0 LLM):** JSON-LD `Event`, ICS, RSS → `OpportunityRecord[]`.
5. **Coda estesa:** `enqueueHarvestJobs()` (gemello di `enqueueScrapeJobs`) + branch nel
   `scrapeWorker` che dispatcha per `companyId` vs `harvestTargetId`; gate via `checkCompliance`
   (Step 0.6).
6. **Connettori category-discovery** + seed (`it-student-orgs`, `it-university-careers`,
   `hackathon-orgs`, `summer-school-orgs`); registrarli in `DISCOVERY_CONNECTORS`.
7. **Wiring scheduler:** enqueue harvest 01:00, worker ogni 2h (estendere l'esistente).
8. **Budget cap / kill-switch** sul worker LLM.

**Milestone:** ~10k IT-relevant live e sostenuti.

---

## Fase 4 — Hardening (outline)

Tuning auto-disable, monitoraggio costo LLM, audit qualità dedup, dashboard coverage per
categoria, allarme su trend `live` calante.

---

## Ordine di esecuzione consigliato

Fase 0 → Fase 1 (valore misurabile subito, rischio minimo) → poi decidere se Fase 2 o Fase 3
per prima in base a dove serve più volume secondo la coverage misurata.
