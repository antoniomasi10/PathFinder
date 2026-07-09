# Fase 5 — Company-first scale-up + Binario 3 — Implementation Plan

**Status:** Implementato (tutti gli slice)
**Date:** 2026-07-09
**Branch:** PF-118
**Design:** `2026-07-09-fase5-company-first-scaleup-design.md`

## Slice 1 — CompanyRegistry + ingestion framework + Registro Imprese

- `backend/prisma/schema.prisma`: modello `CompanyRegistry` + migrazione
  `20260709120253_company_registry`.
- `backend/src/services/import/company-registry/`: `types.ts`, `normalize.ts`
  (`normalizeCompanyName`, `extractApexDomain`), `priority.ts` (`computePriorityScore`),
  `ingest.ts` (`ingestRegistryEntities` — dedup batchato in 3 query, non N+1),
  `loaders/registro-imprese-startup.loader.ts` (richiede `--file`: nessun endpoint di bulk
  download stabile documentato su startup.registroimprese.it, verificato 2026-07-09).
- `backend/src/scripts/ingestCompanyRegistry.ts` — CLI (`--source`, `--file`, `--platform`).
- Route `POST /import/registry/ingest`, prima versione `GET /import/registry-funnel`.
- `SOURCES.md` — sezione "Company registry — pre-funnel staging".

## Slice 2 — Wikidata

- `loaders/wikidata.loader.ts` — SPARQL su `query.wikidata.org`, lista fissa di classi P31
  (business/enterprise/public company/bank/insurer) + `P17=Italy` + `P856` (sito web
  obbligatorio) + paginazione stabile via `ORDER BY ?company`. Copre Borsa Italiana via `P414`.
- `loaders/manual-list.loader.ts` — import curato one-time (`source: manual:<lista>`), per
  liste come Mediobanca "Le principali società italiane" — CSV preparato a mano, mai scrapato.
- GLEIF valutato e scartato (documentato in SOURCES.md, non re-introdurlo).

## Slice 3 — Discovery connector + refactor orchestrator + scheduling

- `discovery.orchestrator.ts`: `routeDomainCandidate` esportato (era privato);
  `runRegistryDiscovery({ limit?, validate? })` nuovo — stesso path di `runDiscovery`.
- `discovery/connectors/company-registry.connector.ts`: `claimRegistryBatch` (priority DESC,
  status come cursore resumabile), `reconcileRegistryBatch` (promoted/exhausted dopo
  `MAX_ATTEMPTS=2`).
- **Bug corretto durante la verifica E2E**: `reconcileRegistryBatch` leggeva `row.attempts` da
  prima dell'increment di `claimRegistryBatch` (snapshot stale) — un'azienda irrisolvibile
  impiegava 3 run invece di 2 per arrendersi. Fix: `claimRegistryBatch` ora restituisce le righe
  con `attempts` già incrementato in memoria.
- `discovery/queue.ts`: anti-join batchato (`findMany({in})` invece di un `findFirst` per riga)
  sia per `CompanyWatchlist` che `HarvestTarget`; env `SCRAPE_ENQUEUE_DAILY_LIMIT` (default 5000).
- `scheduler.ts`: `RegistryDiscovery` daily 01:30 (prima dell'enqueue 01:00 del giorno dopo).
- Route `POST /import/registry/discovery-run`.
- Env: `REGISTRY_DISCOVERY_ENABLED` (kill switch), `REGISTRY_DISCOVERY_DAILY_LIMIT` (default 400).

## Slice 4 — Common Crawl ATS-token harvester

- `loaders/commoncrawl-ats.loader.ts`: `extractAtsToken()` (5 pattern ATS + blocklist
  subdomain generici per Recruitee), query CDX index (`index.commoncrawl.org`) per pattern,
  paginata, con cap `MAX_TOKENS_PROBED_PER_RUN`. Gate Italy-relevance: probe contro l'API ATS
  live, tenuto solo se ≥1 ruolo Italia/remote. Skip dei token già in `CompanyWatchlist`
  (`getRegistryBoards`, riuso esistente).
- `types.ts` esteso con `platform?` opzionale nel `load()` (non un tunnel via `filePath`).
- `SOURCES.md` — entry dedicata, incluso perché NON si scansiona `*.it` genericamente.

## Slice 5 — Hardening throughput & costi

- `services/ai/usage-report.ts`: `getSpendUsd(sinceHours)` (riusa `reportForWindow`/
  `OPENAI_PRICING` esistenti, `null` = "non confermabile sotto budget", mai sotto-stimare).
- `discovery/scrapeWorker.ts`: gate `budgetExceeded()` prima del run e ogni ~20 job (4 batch da
  5) — se superato, i job non reclamati restano `pending`; alert admin via `alertImportFailure`.
- `company-registry/funnel.ts`: `getRegistryFunnel()` completo — registry (by source/status),
  watchlist (by tier, compliance blocked, auto-disabled, scoping su `discoverySource LIKE
  'registry:%'`), coda (`getQueueStats`), opportunità (`getImportCoverage`), spesa LLM 24h/budget.

## Slice 6 — Binario 3: Adzuna + Jooble

- `adzuna.import.ts` — `api.adzuna.com/v1/api/jobs/it/search`, filtro `what_or` su keyword
  studentesche, `max_days_old=45`, `isSeniorRole` + `validateOpportunity`. Skip silenzioso
  (no-op) se `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` non settati. `redirect_url` usato as-is.
- `jooble.import.ts` — `jooble.org/api/{key}` POST, stesso pattern skip-if-unset
  (`JOOBLE_API_KEY`). `link` usato as-is.
- Frontend: `frontend/app/(main)/opportunities/[id]/page.tsx` — riga "Fonte" esistente estesa
  con backlink per `source === 'adzuna' | 'jooble'` (non creato un componente nuovo — la riga
  di attribuzione già esisteva).
- `scheduler.ts`: Adzuna Wed 04:00, Jooble Thu 05:00 (slot liberi, verificati contro l'intero
  schedule esistente per evitare collisioni). Route `POST /adzuna`, `POST /jooble`.
- `SOURCES.md` — sezione "Binario 3" + entry nella tabella attribuzioni.

## Slice 7 — Test + verifica

- `src/tests/company-registry.test.ts` (18 test): normalizzazione, apex-domain/blocklist,
  priority scoring, dedup a 3 livelli con prisma mockato.
- `src/tests/commoncrawl-token.test.ts` (9 test): `extractAtsToken` su tutti i pattern +
  subdomain generici rifiutati + ATS proibiti mai matchati.
- `src/tests/adzuna-mapper.test.ts` (8 test): `isItalyLocation` + riuso `isSeniorRole`/
  `mapOpportunityType`.
- **Verifica E2E reale** (non solo unit): CSV fixture (2 aziende) → `ingestCompanyRegistry.ts`
  (create → idempotente su re-run) → query diretta su Postgres (priorityScore verificato a
  mano) → `runRegistryDiscovery` due volte contro domini fittizi (DNS fallisce, come atteso) →
  confermato il ciclo esatto pending(attempts=0)→pending(attempts=1)→unresolved(attempts=2,
  exhausted=2) DOPO il fix del bug sopra. Dati di verifica ripuliti dal DB al termine.
- `npx tsc --noEmit` pulito su backend e frontend. `npx vitest run`: 201/202 pass — l'unico
  fallimento (`age-verification.test.ts`, pre-esistente, non toccato in questa sessione) è
  scollegato da questo lavoro.

## Rollout / kill switch

- `REGISTRY_DISCOVERY_ENABLED=false` ferma l'intake del registry.
- Unset `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` o `JOOBLE_API_KEY` ferma il Binario 3 (no-op, non errore).
- Rollback per coorte: `UPDATE "CompanyWatchlist" SET "isActive"=false WHERE "discoverySource"
  LIKE 'registry:%'`.
- `LLM_DAILY_BUDGET_USD` (default 5) — budget gate sullo scrape worker.
