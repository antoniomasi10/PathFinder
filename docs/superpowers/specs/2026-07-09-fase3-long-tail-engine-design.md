# Fase 3 — Motore long-tail per categorie (Binario 2) — Design

**Status:** Draft — ricognizione tecnica completa sul codice esistente, pronto per
implementation plan
**Date:** 2026-07-09
**Branch:** PF-118
**Parent spec:** `2026-07-04-opportunity-expansion-10k-design.md` (§ Binario 2, outline)
**Precondizione:** Fase 2/Binario 1 chiusa (`2026-07-04-fase2-backbone-categories-design.md`,
§ round 4) — Devfolio e MSCA `ENABLED`, ogni altro candidato per-fonte verificato e scartato
(bloccato da anti-bot o resa troppo bassa).

## Obiettivo

Coprire il gap di categoria (eventi soprattutto, +hackathon/summer school/fellowship residui)
con un motore che harvesta **pagine-opportunità di organizzatori** (associazioni studentesche,
career-service atenei, organizzatori indipendenti) invece di *importer scritti a mano uno per
fonte*. È il punto d'arrivo esplicitamente previsto dal piano padre e dalla Fase 2: ogni volta
che una fonte candidata si è rivelata "tante sezioni frammentate senza feed centralizzato"
(ESN/AEGEE con le loro sezioni locali, ELSA, career-service dei singoli atenei) o "resa troppo
bassa per un importer dedicato" (Scholars4dev), la conclusione è stata "appartiene a Fase 3".

## Perché un motore e non altri importer dedicati

Un importer dedicato (come `devfolio.import.ts` o `msca.import.ts`) ha senso quando **una
fonte** copre **molte opportunità** con **un pattern di accesso stabile**. Il gap rimanente
non è così: sono centinaia di organizzatori (sezioni locali ESN, singoli atenei, organizzatori
indipendenti di hackathon/summer school) ciascuno con poche opportunità e un sito diverso.
Scrivere un importer per ciascuno non scala; serve lo stesso pattern già validato per i
tirocini — l'infrastruttura ATS/discovery esistente (`discovery/`, `ats/`) — applicato a
*pagine-opportunità* invece che a *careers page*.

## Principio guida: gemello parallelo del motore ATS, non una pipeline nuova

Tutto ciò che segue riusa `batchUpsertOpportunities()` → `markStaleOpportunities()` invariati
(stesso contratto di ogni importer esistente) e ricalca 1:1 pattern già in produzione:

| Motore ATS esistente (company-centrico) | Motore long-tail (Fase 3, organizer-centrico) |
|---|---|
| `CompanyWatchlist` (modello) | `HarvestTarget` (nuovo modello, stesse colonne rilevanti) |
| `discovery/careers-resolver.ts` (trova la careers page) | resolver opportunità (trova la pagina eventi/opportunità) |
| `discovery/ats-fingerprint.ts` (rileva piattaforma ATS) | fingerprint feed-kind (rileva JSON-LD/ICS/RSS/HTML) |
| `discovery/discovery.orchestrator.ts` + connettori | stessi connettori, nuovo target `HarvestTarget` |
| `compliance/gate.ts::checkCompliance()` | **stesso, riuso diretto** — già generalizzato (vedi sotto) |
| `discovery/queue.ts` + `ScrapeJob.companyId` | stessa tabella, `ScrapeJob.harvestTargetId` nullable |
| `discovery/scrapeWorker.ts` | stesso worker, branch per tipo di target |
| `extractOpportunitiesWithLLM(html, company)` | `extractOpportunitiesFromPage(html, ctx)` generalizzata |

**Cosa NON cambia:** il contratto d'ingestione (`OpportunityRecord[]` →
`batchUpsertOpportunities` → `markStaleOpportunities`), l'arricchimento AI post-record
(`parseOpportunityContent`/`classifyOpportunityCluster`/`extractOpportunitySkills` — già
girano dentro `batchUpsertOpportunities()` per **ogni** importer, HarvestTarget compreso,
senza bisogno di duplicarli), lo schema `Opportunity` (già completo per eventi/hackathon/
summer school/fellowship dalla Fase 2/design padre).

## Architettura

### 1. Modello dati — `HarvestTarget` (nuovo)

Stesse colonne rilevanti di `CompanyWatchlist`, adattate a un organizzatore invece che a
un'azienda:

```prisma
model HarvestTarget {
  id           String  @id @default(cuid())
  name         String  // "ESN Milano", "Politecnico di Torino — Career Service"
  url          String  @unique // pagina eventi/opportunità risolta
  sourceLabel  String  // "esn-locale", "university-careers", "hackathon-org" — per markStaleOpportunities scoping e log

  categoryHint OpportunityType? // bias per l'estrattore (vedi §5)
  feedKind     String  // "jsonld" | "ics" | "rss" | "html-static" | "html-js"
  scrapeTier   String? // "B" | "C" — solo per feedKind html-*; jsonld/ics/rss non passano dalla coda (0 LLM, fetch diretto)

  discoverySource String? // "seed:it-student-orgs", "seed:it-university-careers", "manual"
  domain          String?
  country         String? @default("IT")
  region          String?

  // Change-detection — stessa logica di CompanyWatchlist.contentHash
  contentHash   String?
  contentHashAt DateTime?

  // Health / auto-disable — stessa logica di CompanyWatchlist
  lastScrapeStatus    String?
  consecutiveFailures Int     @default(0)

  // Compliance — stesse colonne di CompanyWatchlist, stesso gate (checkCompliance)
  robotsAllowed   Boolean?
  robotsCheckedAt DateTime?
  tosAllowed      Boolean?
  tosAnalyzedAt   DateTime?
  tosNotes        String?
  tosPageNotFound Boolean   @default(false)

  lastSyncedAt DateTime?
  isActive     Boolean   @default(true)
  addedBy      String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive])
  @@index([feedKind])
  @@index([sourceLabel])
}
```

**Perché due colonne timestamp compliance separate (`robotsCheckedAt`/`tosAnalyzedAt`) invece
del `complianceCheckedAt` unico usato da `checkCompliance()`:** stessa scelta già fatta per
`CompanyWatchlist` — retrocompatibilità/leggibilità del dato grezzo per audit manuale; il gate
resta comunque source-agnostico, un thin wrapper (`processTargetCompliance`, gemello di
`processCompanyCompliance` in `company-watchlist.import.ts:538`) fa da adattatore esattamente
come già documentato nel docstring di quella funzione ("shared with the upcoming HarvestTarget
harvester").

### 2. `ScrapeJob` esteso (non un nuovo modello)

```prisma
model ScrapeJob {
  // ... campi esistenti invariati ...
  companyId       String?  // ora nullable — CompanyWatchlist.id, join applicativo (nessun @relation, stesso stile già in uso)
  harvestTargetId String?  // nuovo, nullable — HarvestTarget.id, stesso stile: campo semplice, non FK Prisma

  @@index([harvestTargetId])
}
```

`companyId` oggi è già un campo stringa semplice (nessun `@relation` Prisma, nessun
back-reference su `CompanyWatchlist`) — il join è fatto a mano nel codice (es.
`scrapeWorker.ts`'s `processJob`: `prisma.companyWatchlist.findUnique({ where: { id:
job.companyId } })`). `harvestTargetId` segue esattamente lo stesso stile, non introduce
relazioni Prisma formali dove prima non c'erano.

Vincolo applicativo (non a livello DB, stesso stile già usato altrove nel codebase per vincoli
"esattamente uno tra due FK opzionali"): ogni riga ha **esattamente uno** tra `companyId` e
`harvestTargetId` valorizzato. `discovery/queue.ts` (`claimNextJob`, `enqueueScrapeJobs`,
`completeJob`, `failJob`, `getQueueStats`) viene esteso, non riscritto:
- `claimNextJob`: la query raw SQL (`discovery/queue.ts:72`) ritorna anche `harvestTargetId`;
  il resto (locking `FOR UPDATE SKIP LOCKED`, priorità, backoff) è invariato.
- `enqueueScrapeJobs`: aggiunge una seconda query gemella su `HarvestTarget` (stessi filtri:
  `isActive`, `scrapeTier IN (B,C)`, `consecutiveFailures < AUTO_DISABLE_THRESHOLD`, compliance
  non esplicitamente `false`, refresh dovuto) — **solo per `feedKind IN (html-static, html-js)`**;
  i target `jsonld`/`ics`/`rss` **non passano dalla coda**, vengono fetchati direttamente in un
  loop batch settimanale (fetch a basso costo, nessun LLM, nessun bisogno di rate-limit
  aggressivo/backoff sofisticato — stesso motivo per cui `parseRSSFeed` oggi non passa da
  nessuna coda).
- `discovery/scrapeWorker.ts::processJob`: branch iniziale su quale FK è valorizzata →
  dispatcha a `scrapeCompany` (invariato) o a un nuovo `scrapeHarvestTarget` (stessa forma:
  compliance check → fetch (headless per tier C) → change-detection via `contentHash` →
  estrazione → `batchUpsertOpportunities` → `markStaleOpportunities` → aggiorna health).

### 3. Fingerprint feed-kind (nuovo modulo, gemello di `ats-fingerprint.ts`)

Rileva il tipo di feed dalla pagina candidata (HTML + `<head>` link tags), non la piattaforma
ATS. Ordine di preferenza (dal più economico/affidabile al più costoso), stesso principio
del piano padre ("Fingerprint = leva di costo"):

```
1. JSON-LD schema.org/Event  <script type="application/ld+json"> contenente "@type":"Event"
2. link .ics                 <link rel="alternate" type="text/calendar"> o href che finisce .ics
3. RSS/Atom                  <link rel="alternate" type="application/rss+xml"> (parseRSSFeed già esiste)
4. HTML con segnali evento    → tier B (fetch statico + LLM)
5. Nessun segnale / SPA vuota → tier C (headless + LLM), stessa euristica già in
                                 `classifyCustomTier` (`ats-fingerprint.ts:47`) — root mount
                                 point + body quasi vuoto → SPA
```

Non è la stessa funzione di `fingerprintAts` (cerca pattern di piattaforma ATS via regex su
`ATS_POLICY`) — è un modulo nuovo (`discovery/feed-fingerprint.ts`) con la stessa forma
(`Fingerprint | null` di ritorno, stesso stile di scansione testo).

### 4. Parser strutturati — 0 LLM dove possibile

- **RSS/Atom**: `parseRSSFeed()` già esiste (`utils.ts:480`), riusato invariato.
- **JSON-LD**: nuovo parser (`discovery/jsonld-parser.ts`). Stesso pattern già usato per
  `__NEXT_DATA__` in `devfolio.import.ts`: regex su `<script type="application/ld+json">`,
  `JSON.parse`, filtra per `"@type": "Event"` (anche dentro `@graph[]`, pattern comune),
  mappa i campi schema.org standard (`name`, `startDate`, `endDate`, `location.address`,
  `organizer.name`, `description`, `url`, `offers.price` per il costo) a `OpportunityRecord`.
  Nessuna libreria nuova — stesso principio "regex + JSON.parse basta" già validato.
- **ICS**: nuovo parser minimale (`discovery/ics-parser.ts`). Formato `VEVENT` è
  riga-per-riga (`SUMMARY:`, `DTSTART:`, `DTEND:`, `LOCATION:`, `DESCRIPTION:`, `URL:`) —
  un parser a regex/line-split è sufficiente per il sottoinsieme che ci serve, coerente con
  la scelta già fatta per RSS (niente `node-ical`/libreria esterna per un formato semplice
  riga=chiave:valore). Gestisce solo i campi che mappiamo; VEVENT malformati vengono skippati
  (stesso pattern try/catch per-record già usato in ogni importer).

### 5. Estrazione generalizzata: `extractOpportunitiesFromPage(html, ctx)`

`extractOpportunitiesWithLLM(html, company: CompanyWatchlist)`
(`company-watchlist.import.ts:319`) oggi è accoppiata a `CompanyWatchlist` in due modi: (a) il
tipo del secondo parametro, (b) il prompt (`EXTRACT_SYSTEM_PROMPT`, riga 289) che parla solo
di *job listing* ("internship, stage, tirocinio, trainee... Exclude: senior, manager...").
Per pagine-opportunità di organizzatori il target di estrazione è diverso: non ruoli di
lavoro, ma eventi/hackathon/summer school/fellowship con date, formato, location, costo.

**Design:** nuova funzione `extractOpportunitiesFromPage(html: string, ctx: ExtractionContext)`
in un modulo condiviso (`discovery/extraction.ts`), con:

```ts
interface ExtractionContext {
  sourceLabel: string;         // per i log e come 'organizer' di fallback
  organizer: string;           // HarvestTarget.name
  url: string;                 // per risolvere URL relativi, come CompanyWatchlist.careersUrl oggi
  categoryHint?: OpportunityType; // bias del prompt verso una categoria
}
```

Un **prompt unico generalizzato** (non uno per categoria — YAGNI, il piano padre già copre
11 `OpportunityType` con un solo schema `Opportunity`) che estrae eventi/opportunità con
schema di output esteso rispetto a quello job-only attuale: `title, url, type (uno degli
OpportunityType, con bias verso categoryHint se fornito), startDate, endDate, location,
format (ONLINE/IN_PERSON/HYBRID), cost, deadline, description`. Stesso modello (`gpt-4o-mini`),
stesso `response_format: json_object`, stesso `htmlLinksToText` per preservare gli URL prima
dello strip HTML (`company-watchlist.import.ts:305` — riusato invariato, è già source-agnostico).

`extractOpportunitiesWithLLM` **non viene rimossa** — resta la funzione job-listing-specifica
per `CompanyWatchlist`/lo scrape worker esistente (tier B/C aziende); `HarvestTarget` usa la
nuova funzione. Le due condividono `htmlLinksToText` e la logica di scoping `<main>`.

`buildWatchlistRecords(company, rawOpportunities, now)` (righe 380-440) ha un gemello
`buildHarvestRecords(target: HarvestTarget, rawOpportunities, now)` con la stessa forma
(mappa i raw record allo shape `OpportunityRecord`, valida via `validateOpportunity`, genera
`sourceId` stabile) ma popolando `organizer` (non `company` — un evento non ha un'azienda) e i
campi evento (`startDate`/`endDate`/`format`) invece dei soli campi job.

### 6. Compliance — riuso diretto, nessuna modifica

`checkCompliance()` (`compliance/gate.ts`) è **già** source-agnostico (prende `url` + una
cache generica `{robotsAllowed, tosAllowed, complianceCheckedAt}`) — il refactor fatto in
Fase 2 (`94e5f62`) anticipava esplicitamente questo uso. Serve solo un thin wrapper
`processTargetCompliance(target: HarvestTarget, now: Date)` — copia 1:1 di
`processCompanyCompliance` (righe 538-578) che legge/scrive le colonne di `HarvestTarget`
invece di quelle di `CompanyWatchlist`. Nessuna modifica al gate stesso.

### 7. `markStaleOpportunities` — nuova opzione `scopeOrganizers`

`scopeCompanies` (`batch.ts:326,339-341`) filtra `where.company = { in: ... }` — funziona per
`CompanyWatchlist` perché ogni record valorizza `company`. I record da `HarvestTarget`
valorizzano `organizer`, non `company` (un evento non ha un'azienda) — `scopeCompanies` non
li scoperebbe correttamente. **Modifica minima e additiva**: nuova opzione
`scopeOrganizers?: string[]` che filtra `where.organizer = { in: options.scopeOrganizers }`,
stesso pattern esatto di `scopeCompanies`, usata da `scrapeHarvestTarget`/dal batch loop
settimanale al posto di `scopeCompanies`. Nessuna modifica al comportamento esistente per gli
altri importer.

### 8. Connettori discovery + seed iniziali

Stessa forma di `DiscoveryConnector` (`discovery/types.ts:23`) — ma un nuovo tipo di
candidato (`HarvestCandidate`, gemello di `CompanyCandidate`) con `name, url, categoryHint,
country, region, sourceLabel` invece di `atsType/atsToken/domain`. Nuovo orchestratore
(`discovery/harvest.orchestrator.ts`, non lo stesso `runDiscovery()` — target diversi,
registro diverso) che per ogni candidato: risolve la pagina opportunità (nuovo resolver,
analogo a `resolveCareersUrl` ma cerca `/events`, `/eventi`, `/opportunities`, `/opportunita`,
link RSS/ICS nell'head) → fingerprint feed-kind → registra `HarvestTarget`.

Seed iniziali (stesso stile di `discovery/seeds/italy-*.ts`, liste curate a mano):
- `seeds/it-student-orgs.ts` — sezioni locali ESN/AEGEE/ELSA italiane (il problema esatto
  rimandato più volte in Fase 2: niente feed centralizzato, ma ogni sezione locale è un
  target valido singolarmente)
- `seeds/it-university-careers.ts` — pagine eventi (non career, già coperte da
  `italy-university-careers.ts` di Fase 1) dei ~90 atenei MUR già in DB
- `seeds/hackathon-orgs.ts` / `seeds/summer-school-orgs.ts` — organizzatori indipendenti,
  incluse le fonti scartate come importer dedicato ma non come target singolo (es. singole
  pagine di summer school invece del portale aggregatore SummerSchoolsInEurope bloccato da
  WAF — il sito dell'organizzatore stesso potrebbe non avere lo stesso blocco)

## Fasi di implementazione (per l'implementation plan)

Ordine consigliato, ciascuno testabile in isolamento:
1. Migration `HarvestTarget` + `ScrapeJob.harvestTargetId` (nessun impatto su dati esistenti)
2. `feed-fingerprint.ts` + `jsonld-parser.ts` + `ics-parser.ts` (puri, testabili senza DB/rete)
3. `processTargetCompliance` (thin wrapper, stesso test pattern di `compliance-gate.test.ts`)
4. `extractOpportunitiesFromPage` + `buildHarvestRecords` (estrazione generalizzata)
5. Estensione coda (`queue.ts`, `scrapeWorker.ts`) + `scopeOrganizers` in `batch.ts`
6. Resolver + orchestratore discovery + un solo connettore/seed (es. student-orgs) end-to-end
7. Seed rimanenti, wiring scheduler

## Testing

- **Unit puri** (nessuna rete/DB): `feed-fingerprint.ts` (JSON-LD/ICS/RSS/HTML-static/
  HTML-JS su fixture HTML), `jsonld-parser.ts`/`ics-parser.ts` (fixture registrate, incluso
  `@graph[]` e VEVENT malformati), `scopeOrganizers` in `markStaleOpportunities`.
- **Compliance**: `processTargetCompliance` — stesso pattern di `compliance-gate.test.ts`
  (mock di `checkRobotsTxt`/`findAndAnalyzeTos`), verifica che legga/scriva le colonne giuste
  di `HarvestTarget`.
- **Integration**: `extractOpportunitiesFromPage` con OpenAI client mockato (stesso pattern
  già eventualmente usato per `extractOpportunitiesWithLLM`, se testato) → verifica mapping
  categoryHint → type, `startDate`/`format` popolati.
- **Coda**: `claimNextJob` ritorna `harvestTargetId` quando presente; `enqueueScrapeJobs`
  non enqueue target `jsonld`/`ics`/`rss` (bypassano la coda).
- **Manuale**: un seed reale (es. 3-5 sezioni ESN locali) attraverso l'intero pipeline
  discovery → queue → worker → `GET /import/coverage`, verificare crescita EVENT.

## Rischi e mitigazioni

- **Costo LLM a scala** (centinaia di `HarvestTarget` tier B/C): stesso principio già in
  produzione per `CompanyWatchlist` — `contentHash` salta l'LLM se la pagina non è cambiata;
  `AUTO_DISABLE_THRESHOLD` disattiva le fonti che falliscono cronicamente. JSON-LD/ICS/RSS
  (0 LLM) sono preferiti per costruzione dal fingerprint — solo la coda residua HTML paga
  il costo LLM.
- **Prompt generalizzato meno preciso di uno per-categoria**: mitigato dal `categoryHint`
  (bias esplicito) + dalla validazione esistente (`validateOpportunity`) che scarta record
  incompleti; se in pratica la precisione risulta insufficiente per una categoria specifica,
  si può introdurre un prompt dedicato in un secondo momento senza rompere il contratto.
  YAGNI: non progettarlo ora senza dati reali che lo giustifichino.
  **Nota:** `WAF/anti-bot come DoraHacks/ProFellow/SummerSchoolsInEurope` restano bloccati
  anche come `HarvestTarget` — il motore non risolve i blocchi infrastrutturali già trovati
  in Fase 2, li eredita. Il gate C0 verificato **prima** di registrare un target resta valido
  qui.
- **Qualità/rumore dalla long tail**: stesso approccio già previsto nel piano padre — flag
  `verified: false` di default sui record da `HarvestTarget` (già un campo opzionale su
  `OpportunityRecord`), arricchimento AI centralizzato invariato, `consecutiveFailures` +
  auto-disable per fonti morte/rotte.
- **Duplicazione con Binario 1**: `dedupKey` cross-source (già esistente in
  `batchUpsertOpportunities`) previene doppioni se un organizzatore già coperto da un
  importer dedicato (es. un ateneo il cui career service è già in `CompanyWatchlist` via
  discovery Fase 1) pubblica lo stesso evento anche sulla sua pagina eventi — vince il primo
  che scrive, comportamento già esistente, nessuna modifica necessaria.

## Fuori scope (YAGNI)

- Nessun prompt LLM per-categoria in questo giro (vedi rischi sopra).
- Nessuna nuova libreria esterna per JSON-LD/ICS — regex/parsing manuale basta per il
  sottoinsieme di campi che usiamo, coerente con ogni altro importer del repo.
- Nessun cambiamento allo schema `Opportunity` — già completo.
- Nessuna riscrittura di `discovery.orchestrator.ts`/`ats-*` esistenti — solo aggiunta di
  moduli paralleli (`harvest.orchestrator.ts`, `feed-fingerprint.ts`, resolver dedicato).

## Modifiche allo schema

- **Nuovo modello** `HarvestTarget` (§1).
- **`ScrapeJob`**: `companyId` diventa nullable, nuovo `harvestTargetId String?` (nessun
  `@relation` Prisma, stesso stile di `companyId` oggi), vincolo applicativo "esattamente uno
  tra i due valorizzato" (non a livello DB — stesso approccio già usato altrove nel repo per
  invarianti non esprimibili in Prisma).
- Nessun'altra modifica: `Opportunity` resta invariato.
