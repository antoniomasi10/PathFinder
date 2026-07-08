# Fase 3 — Motore long-tail (Binario 2) — Implementation Plan

**Date:** 2026-07-09
**Branch:** PF-118
**Spec:** `2026-07-09-fase3-long-tail-engine-design.md`

Scope di questo giro: costruire il motore completo (migration → parser → compliance →
estrazione → coda → discovery) e portarlo end-to-end con **un** connector/seed reale
(sezioni locali ESN italiane), non tutti i seed elencati nel design (student-orgs +
university-events + hackathon/summer-school-orgs) — gli altri seed sono un'estensione dati,
non infrastruttura, e possono essere aggiunti in un giro successivo senza toccare codice.

Stesso contratto invariato ovunque: `OpportunityRecord[]` → `batchUpsertOpportunities()` →
`markStaleOpportunities()`.

---

## Step 1 — Migration: `HarvestTarget` + `ScrapeJob.harvestTargetId`

**File:** `backend/prisma/schema.prisma`

Aggiungere il modello `HarvestTarget` esattamente come da design spec §1. Modificare
`ScrapeJob`:
```prisma
model ScrapeJob {
  id              String    @id @default(cuid())
  companyId       String?   // ora nullable
  harvestTargetId String?   // nuovo — nessun @relation, stesso stile di companyId
  tier            String
  status          String    @default("pending")
  priority        Int       @default(0)
  attempts        Int       @default(0)
  maxAttempts     Int       @default(3)
  runAfter        DateTime  @default(now())
  lockedAt        DateTime?
  lockedBy        String?
  error           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([status, runAfter, priority])
  @@index([companyId])
  @@index([harvestTargetId])
}
```
Comando: `npx prisma migrate dev --name harvest_target`. Verificare che la migration non
tocchi righe esistenti (`companyId` passa da required a nullable — nessun dato perso,
Postgres non richiede backfill per un allentamento di vincolo).

---

## Step 2 — Parser puri (0 LLM, 0 rete, 0 DB)

**File nuovi**, tutti in `backend/src/services/import/discovery/`:

### `feed-fingerprint.ts`
```ts
export interface FeedFingerprint {
  kind: 'jsonld' | 'ics' | 'rss' | 'html-static' | 'html-js';
  feedUrl?: string; // per ics/rss, l'URL assoluto del feed se diverso dalla pagina stessa
}
export function fingerprintFeed(html: string, pageUrl: string): FeedFingerprint
```
Ordine di rilevamento (design §3): JSON-LD (`<script type="application/ld+json">` con
`"@type":"Event"`, anche dentro `@graph`) → `<link rel="alternate" type="text/calendar">` o
href `.ics` → `<link rel="alternate" type="application/rss+xml">` → altrimenti
`classifyCustomTier(html)` (**riusata da `ats-fingerprint.ts`, non duplicata**) mappata a
`html-static`/`html-js`.

### `jsonld-parser.ts`
```ts
export interface JsonLdEvent {
  name: string; startDate?: string; endDate?: string; description?: string;
  url?: string; locationName?: string; organizerName?: string; offerPrice?: number;
}
export function extractJsonLdEvents(html: string): JsonLdEvent[]
```
Regex su tutti gli `<script type="application/ld+json">`, `JSON.parse` per blocco (try/catch
per blocco malformato, skip), appiattisce `@graph[]` se presente, filtra `@type` che include
`"Event"` (case-insensitive; a volte è un array `["Event","EducationEvent"]`).

### `ics-parser.ts`
```ts
export interface IcsEvent {
  summary: string; dtstart?: string; dtend?: string; location?: string;
  description?: string; url?: string;
}
export function parseIcs(text: string): IcsEvent[]
```
Split su `BEGIN:VEVENT`/`END:VEVENT`, dentro ogni blocco parse riga `CHIAVE[;PARAM]:valore`
(gestisce line-folding RFC5545 minimo: riga successiva che inizia con spazio = continuazione).
Solo i campi che mappiamo; il resto ignorato.

**Test:** `backend/src/tests/feed-fingerprint.test.ts`,
`backend/src/tests/jsonld-parser.test.ts`, `backend/src/tests/ics-parser.test.ts` — fixture
inline (stringhe HTML/ICS minime), nessuna rete.

---

## Step 3 — Compliance

**File:** `backend/src/services/import/discovery/harvest-compliance.ts`
```ts
export async function processTargetCompliance(target: HarvestTarget, now: Date): Promise<boolean>
```
Copia 1:1 di `processCompanyCompliance` (`company-watchlist.import.ts:538`), stesso uso di
`checkCompliance()` da `compliance/gate.ts` (invariato), legge/scrive le colonne di
`HarvestTarget` invece di `CompanyWatchlist`. `cachedAt` derivato come il minimo fra
`robotsCheckedAt`/`tosAnalyzedAt`, stessa logica.

**Test:** `backend/src/tests/harvest-compliance.test.ts`, stesso pattern di mock di
`compliance-gate.test.ts` (mock `checkRobotsTxt`/`findAndAnalyzeTos`).

---

## Step 4 — Estrazione generalizzata

**File:** `backend/src/services/import/discovery/extraction.ts`
```ts
export interface ExtractionContext {
  sourceLabel: string; organizer: string; url: string; categoryHint?: OpportunityType;
}
interface RawExtractedOpportunity {
  title?: string; url?: string; type?: string; startDate?: string; endDate?: string;
  location?: string; format?: string; cost?: number; deadline?: string; description?: string;
}
export async function extractOpportunitiesFromPage(html: string, ctx: ExtractionContext): Promise<RawExtractedOpportunity[]>
```
Stesso client OpenAI/pattern di `extractOpportunitiesWithLLM` (`gpt-4o-mini`,
`response_format: json_object`, `MAX_HTML_CHARS`, `htmlLinksToText` **riusata** da
`company-watchlist.import.ts` — va esportata da lì, non duplicata). Prompt generalizzato
(schema esteso rispetto al job-only esistente — vedi design §5), con
`categoryHint` iniettato nel messaggio utente quando presente ("Bias verso la categoria: X").

```ts
export function buildHarvestRecords(target: HarvestTarget, raw: RawExtractedOpportunity[], now: Date): { records: OpportunityRecord[]; skipped: number }
```
Gemello di `buildWatchlistRecords`: valida via `validateOpportunity`, popola `organizer:
target.name` (non `company`), `type` da `raw.type` con fallback `target.categoryHint` con
fallback `'EVENT'`, campi evento (`startDate/endDate/format`) quando presenti, `sourceId =
harvest-${target.id}-${hash(title+url)}` (stesso schema di hashing di
`buildWatchlistRecords:395`), `source: 'HarvestTarget'`, `verified: false`.

**Test:** `backend/src/tests/harvest-extraction.test.ts` — `buildHarvestRecords` con input
sintetici (puro); `extractOpportunitiesFromPage` con client OpenAI mockato (verifica prompt
include categoryHint, mapping tipo).

---

## Step 5 — Coda + `batch.ts`

**`batch.ts`**: nuova opzione `scopeOrganizers?: string[]` in `markStaleOpportunities`
(design §7) — `where.organizer = { in: options.scopeOrganizers }`, stesso identico pattern di
`scopeCompanies`.

**`discovery/queue.ts`**:
- `enqueueScrapeJobs`: dopo il loop esistente su `CompanyWatchlist`, loop gemello su
  `HarvestTarget` con `scrapeTier: { in: ['B','C'] }` (i target `jsonld`/`ics`/`rss` **non**
  passano da qui — vedi sotto), stessi filtri di compliance/health/refresh-dovuto, crea
  `ScrapeJob` con `harvestTargetId` invece di `companyId`.
- `claimNextJob`: la query raw SQL ritorna anche `harvestTargetId`; `ClaimedJob` interface
  aggiunge `companyId: string | null; harvestTargetId: string | null` (uno dei due).

**`discovery/scrapeWorker.ts`**:
- `processJob` fa branch: se `job.harvestTargetId` → nuova `scrapeHarvestTarget(target, tier,
  now)` (stessa forma di `scrapeCompany`: `processTargetCompliance` → fetch (headless per
  tier C, `fetchWithHeadlessBrowser` riusata invariata) → change-detection via `contentHash`
  → `extractOpportunitiesFromPage` → `buildHarvestRecords` → `batchUpsertOpportunities` →
  `markStaleOpportunities('HarvestTarget', ids, { scopeOrganizers: [target.name],
  minSeenForStale: 1 })`); altrimenti `scrapeCompany` (invariato).

**Nuovo:** `discovery/harvest-feed-runner.ts` — loop batch settimanale **separato dalla
coda** per i target `jsonld`/`ics`/`rss` (fetch diretto, 0 LLM, nessun bisogno di backoff
sofisticato — motivazione in design §2): per ogni `HarvestTarget` attivo con quel
`feedKind`, `processTargetCompliance` → fetch → parse (il parser giusto in base a
`feedKind`) → mappa a `OpportunityRecord[]` (bypassa `extractOpportunitiesFromPage`, i dati
sono già strutturati) → `batchUpsertOpportunities` → `markStaleOpportunities` scoped.

**Test:** `backend/src/tests/scope-organizers.test.ts` (puro, su `markStaleOpportunities`);
aggiornare/estendere eventuali test di `queue.ts` se esistenti (verificare prima).

---

## Step 6 — Resolver + orchestratore + primo connector/seed

**File:** `backend/src/services/import/discovery/opportunity-page-resolver.ts`
```ts
export interface ResolvedOpportunityPage { url: string; html: string }
export async function resolveOpportunityPage(domain: string): Promise<ResolvedOpportunityPage | null>
```
Gemello di `resolveCareersUrl` (`careers-resolver.ts`): fetch homepage → segue link con testo
tipo "eventi/events/opportunità/opportunities/calendario" → prova path comuni (`/events`,
`/eventi`, `/opportunities`, `/opportunita`, `/calendar`, `/calendario`). Stessa strategia
fail-fast su homepage irraggiungibile.

**File:** `backend/src/services/import/discovery/harvest-registry.ts`
```ts
export interface RegisterHarvestTargetInput {
  name: string; url: string; sourceLabel: string; discoverySource: string;
  categoryHint?: OpportunityType; feedKind: string; scrapeTier?: string | null;
  domain?: string | null; country?: string | null; region?: string | null;
}
export async function registerHarvestTarget(input: RegisterHarvestTargetInput): Promise<{ created: boolean }>
```
Idempotente su `url` (unique), stesso pattern di `registerAtsBoard`/`registerScrapeTarget`.

**File:** `backend/src/services/import/discovery/harvest.orchestrator.ts`
```ts
export interface HarvestCandidate {
  name: string; domain: string; categoryHint?: OpportunityType;
  country?: string; region?: string; sourceLabel: string; source: string;
}
export interface HarvestConnector { name: string; discover(): Promise<HarvestCandidate[]> }
export const HARVEST_CONNECTORS: HarvestConnector[] = [studentOrgsConnector];
export async function runHarvestDiscovery(): Promise<{...}>
```
Per candidato: `resolveOpportunityPage(domain)` → `fingerprintFeed(html, url)` →
`registerHarvestTarget`. Stesso `ImportLog` (`source: 'harvest-discovery'`) e
`runWithConcurrency` di `discovery.orchestrator.ts`.

**File:** `backend/src/services/import/discovery/connectors/student-orgs.connector.ts` +
`backend/src/services/import/discovery/seeds/italy-student-orgs.ts` — seed iniziale: 15-20
sezioni locali ESN italiane verificate a mano (dominio + nome + regione), stesso stile di
`italy-university-careers.ts`. **Nessuna verifica C0 per-dominio qui** — il gate compliance
gira per-target al momento dello scrape, non alla discovery (stesso comportamento già in uso
per `CompanyWatchlist`).

**Test:** `backend/src/tests/harvest-registry.test.ts` (idempotenza registrazione, mock
prisma); `backend/src/tests/harvest-orchestrator.test.ts` (routing feedKind → categoryHint/
scrapeTier corretti, con resolver/fingerprint mockati).

---

## Step 7 — Scheduler + `SOURCES.md` + verifica

**`scheduler.ts`**: tre nuovi cron, stesso stile di quelli ATS esistenti:
- `runHarvestDiscovery()` — settimanale, slot libero
- `enqueueScrapeJobs` esteso copre già HarvestTarget (nessun cron nuovo, stesso di oggi)
- `runScrapeWorker` esteso copre già HarvestTarget (nessun cron nuovo, stesso di oggi)
- nuovo: harvest feed runner (`jsonld`/`ics`/`rss`) — settimanale, slot libero

**`SOURCES.md`**: nuova sezione "Harvest targets (Fase 3, data-driven)" — stesso stile della
sezione "Import expansion" già esistente per il registro ATS, spiega che il gate compliance è
per-target in DB, non elencato riga per riga (impraticabile a decine/centinaia di target).

**Verifica finale:** typecheck + build + suite test completa; poi manuale: `POST
/api/import/harvest-discovery` (nuova route admin) → verificare righe `HarvestTarget` create
→ `POST /api/import/harvest-worker` (o attesa cron) → `GET /import/coverage` → EVENT in
crescita.
