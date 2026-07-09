# Fase 5 — Company-first scale-up + Binario 3 — Design

**Status:** Implementato
**Date:** 2026-07-09
**Branch:** PF-118
**Parent spec:** `2026-07-04-opportunity-expansion-10k-design.md` (target: 10k opportunità
Italy-relevant; baseline misurato all'inizio di questa fase: ~551 IT-relevant su ~4.8k righe)
**Precondizione:** Fase 1-4 implementate (ATS registry data-driven, harvest engine long-tail,
LLM cost tracking, dedup audit).

## Perché

I seed curati a mano (72 board ATS, 245 domini aziendali, 67 università, 34 org studentesche
in `discovery/seeds/`) sono saturi: aggiungerne altri a mano non scala oltre qualche centinaio
di entry/settimana. Tutta la pipeline a valle — compliance gate, careers-page resolution, ATS
fingerprinting/tiering, estrazione, enrichment (`batchUpsertOpportunities`), matching/display —
**esiste già e funziona**. Il collo di bottiglia è solo l'input: serve una lista aziende a scala
(decine di migliaia, non centinaia) da fonti **gratuite**, più un track parallelo di aggregatori
ufficiali per volume immediato mentre il crawling aziendale scala nel tempo.

## Decisioni

1. **Scope lista aziende: ~20-50k mirate, non tutte le ~6M imprese italiane.** Filtrate per
   probabilità reale di avere una career page (dimensione dichiarata, presenza sito web,
   settore). Fonti: Registro Imprese (startup/PMI innovative, CC-BY 4.0), Wikidata (SPARQL,
   CC0, copre anche Borsa Italiana via la proprietà "quotata in"), Common Crawl (indice
   pubblico, per scoprire token ATS già hostati), più liste curate manualmente una tantum.
   **GLEIF scartato**: nessun sito web nel dataset, il name→domain guessing a questa scala
   produce troppi falsi positivi.
2. **Nuovo modello `CompanyRegistry`, non estensione di `CompanyWatchlist`.**
   `CompanyWatchlist` è post-resolution (keyed su `careersUrl`, non-null); la maggior parte
   delle righe grezze da open data non risolverà mai una careers page. Tenerle separate evita
   di sporcare le query operative esistenti su `CompanyWatchlist` con decine di migliaia di
   righe "forse mai promosse". Stesso pattern già usato per `HarvestTarget` vs `CompanyWatchlist`.
3. **Discovery riusa il path esistente, non lo duplica.** `routeDomainCandidate` (resolve →
   fingerprint → route) è stato esportato da `discovery.orchestrator.ts` e riusato tale e quale
   da `runRegistryDiscovery()` — zero logica di compliance/tiering duplicata.
4. **Binario 3 (Adzuna + Jooble) come track parallelo**, non alternativo: API ufficiali,
   licenza chiara, richiedono solo attribuzione visibile (già presente un rigo "Fonte" nella
   pagina di dettaglio, esteso con backlink). Copre volume immediato mentre il crawling
   aziendale (che compone nel tempo) scala.
5. **Pacing deliberatamente lento e politeness-first.** `REGISTRY_DISCOVERY_DAILY_LIMIT=400`/
   giorno di default: 15k righe ≈ 6 settimane, 50k ≈ 4 mesi. Non è un collo di bottiglia
   accidentale — è la stessa filosofia "polite scraping" già applicata al resto della pipeline
   (rate limit per dominio, backoff, `contentHash` change-detection).

## Architettura

```
Loaders (registro-imprese / wikidata / commoncrawl-ats / manual)
        │  RegistryEntity[]
        ▼
ingestRegistryEntities()  ── dedup (source,sourceRef) → domain → normalizedName
        │
        ▼
CompanyRegistry (staging: pending|queued|promoted|unresolved|no-domain|duplicate)
        │  claimRegistryBatch (priority DESC, batched by REGISTRY_DISCOVERY_DAILY_LIMIT)
        ▼
runRegistryDiscovery() ── STESSO path di runDiscovery(): routeDomainCandidate
        │                 (resolve careers page → fingerprint ATS → route)
        ▼
CompanyWatchlist (tier A/B/C, compliance robots+ToS, discoverySource='registry:<source>')
        │  reconcileRegistryBatch → promoted | unresolved (dopo 2 tentativi) | pending (retry)
        ▼
ScrapeJob queue (B/C) / ATS factory (A)  →  batchUpsertOpportunities (enrichment, clustering)
        │
        ▼
Opportunity (matching engine, home feed)
```

Common Crawl è un caso speciale: interroga solo l'indice CDX pubblico per URL già hostati sugli
ATS supportati (`boards.greenhouse.io/*`, `jobs.lever.co/*`, ecc.) — ogni hit è per costruzione
un candidato tier A, zero careers-page resolution necessaria. Ogni token viene poi probato
contro la **API live** dell'ATS (mai contro l'archivio) e tenuto solo se ha ≥1 ruolo Italia/
remote-EU — questo è il gate che impedisce a migliaia di board globali di inondare il registry.
Deliberatamente **non** scansiona `*.it` per path careers (richiederebbe l'indice columnar/
parquet, decine di GB — fuori misura per questo codebase).

## Modello dati

```prisma
model CompanyRegistry {
  id, name, normalizedName, domain (unique), websiteUrl, legalId
  source, sourceRef (unique insieme a source)
  sector, employeeBand, region
  atsType, atsToken        // fast path Common Crawl
  priorityScore, status, attempts, lastAttemptAt, watchlistId
}
```
Vedi `backend/prisma/schema.prisma` — migrazione `20260709120253_company_registry`.

## Hardening necessario per la scala

- **Anti-join batchato** in `enqueueScrapeJobs` (`discovery/queue.ts`): un `findFirst` per riga
  non regge a decine di migliaia di candidati — sostituito con un `findMany({in: [...]})` unico.
- **Budget gate LLM** nello scrape worker (`getSpendUsd(24)` da `LlmUsageLog`, già esistente
  dalla Fase 4): se la spesa 24h supera `LLM_DAILY_BUDGET_USD` (default $5), il worker si ferma
  fra un batch e l'altro — i job non ancora reclamati restano `pending`, nessuna perdita.
- **`GET /import/registry-funnel`**: vista unica registry → watchlist → coda → opportunità → LLM
  spend, per giudicare se la scale-up sta davvero muovendo l'ago.

## Fuori scope (YAGNI)

- Nessuna scansione `*.it` generica per careers page (Common Crawl columnar index).
- Nessun ANN index sul registry (il volume attuale non lo giustifica; stessa logica già
  applicata a `Opportunity.embedding` in Fase 4).
- Nessun name→domain guessing euristico oltre l'estrazione diretta da URL fornito dalla fonte
  (per questo GLEIF è stato scartato, non "risolto con euristica").
- Nessun merge automatico dei duplicati nel registry — solo skip alla ingest, stessa filosofia
  del dedup-audit di Fase 4 (read-only, giudizio umano).

## Testing

- Unit: `normalizeCompanyName`/`extractApexDomain` (blocklist social/webmail/page-builder),
  `computePriorityScore`, dedup a 3 livelli di `ingestRegistryEntities` (prisma mockato).
- Unit: `extractAtsToken` (tutti i 5 pattern ATS + subdomain generici rifiutati).
- Unit: `isItalyLocation` (mapper Adzuna) + riuso di `isSeniorRole`/`mapOpportunityType`.
- E2E manuale: ingest di una CSV fixture → `runRegistryDiscovery` → verificato il ciclo
  pending→queued→(unresolved dopo 2 tentativi | promoted), incluso un bug reale trovato e
  corretto in corsa (`reconcileRegistryBatch` leggeva `attempts` non aggiornato, dando un
  off-by-one sul numero di retry prima di arrendersi).
