# Fase 4 — Hardening — Design

**Status:** Draft — ricognizione completa sullo stato reale (non l'outline del piano padre)
**Date:** 2026-07-09
**Branch:** PF-118
**Parent spec:** `2026-07-04-opportunity-expansion-10k-design.md` (§ Fase 4, outline:
"tuning auto-disable, monitoraggio costo LLM, audit qualità dedup, dashboard coverage per
categoria")
**Precondizione:** Fase 2 (Binario 1) e Fase 3 (Binario 2/long-tail engine) implementate.

## Cosa ho trovato ricognendo (non l'outline — lo stato reale del codice)

L'outline padre elenca quattro voci genericamente. Verificando il codice, la situazione è
molto più sbilanciata di quanto suggerisse l'outline:

1. **"Dashboard coverage per categoria"**: **già costruita**, non un gap. Esistono già
   quattro funzioni+route admin: `getImportCoverage()` (`GET /import/coverage` — live/dedup/
   IT-relevant per `OpportunityType`, usata per tutto PF-118), `getSourceHealthStats()`
   (`GET /import/health` — ultimo run/successo/errore/success-rate 30gg **per source**),
   `getDataFreshnessStats()`, `getOpportunityDistribution()` (tipo/paese/regione/tag). Non
   serve costruire nulla di nuovo qui.

2. **Bug reale trovato in quella dashboard**: `getSourceHealthStats()` legge da una lista
   statica `ALL_SOURCES` (`cleanup.service.ts:257`, ~22 entry con `key`+`prefix`+`schedule`)
   mantenuta a mano. **Non è stata aggiornata quando ho aggiunto Devfolio, MSCA e il motore
   harvest Fase 3 in questa stessa sessione** — quei tre importer girano (schedulati, con
   `ImportLog` propri) ma sono **invisibili** a `GET /import/health`: nessun modo di sapere
   se stanno fallendo silenziosamente. Fix immediato, non un "progetto" — 4 righe aggiunte
   alla lista.

3. **"Monitoraggio costo LLM"**: **gap reale e più grande del previsto**. Zero tracking di
   token/costo ovunque nel codebase (verificato: nessun riferimento a `usage`,
   `prompt_tokens`, `total_tokens` in tutto `services/import/` e `services/ai/`). Non è un
   solo punto di chiamata da strumentare — sono **almeno 9 call site OpenAI separati**:
   `opportunityParser.ts` (6: parse contenuto, parse data, skill extraction, lingue, skill
   contestualizzate, traduzione IT), `clusterClassifier.ts` (1), `company-watchlist.import.ts`
   (1, job listing extraction), `discovery/extraction.ts` (1, la nuova estrazione generica
   Fase 3). Cinque di questi (`opportunityParser.ts` + `clusterClassifier.ts`) girano
   **automaticamente per ogni singola riga** dentro `batchUpsertOpportunities()`
   (`batch.ts:203-222`) — cioè il vero costo dominante non sono gli importer con estrazione
   LLM esplicita, è l'arricchimento post-record che gira su **ogni** opportunità di **ogni**
   fonte, comprese quelle 0-LLM come Devfolio/MSCA/RSS. Nessuno lo misura oggi.

4. **"Audit qualità dedup"**: **gap reale**. `getImportCoverage()` misura solo la
   *quantità* di dedup (quante righe live collassano su `dedupKey` distinti) — nessuno
   strumento verifica la *qualità*: falsi negativi (due righe che sono lo stesso posting
   reale ma con `dedupKey` diversi — es. stessa opportunità scritta diversamente da due
   fonti — quindi contate due volte) o falsi positivi (due posting reali diversi collassati
   sullo stesso `dedupKey` — improbabile con lo schema attuale `title+organizer[+startDate]`,
   ma non verificato). Trovato uno strumento già pronto per questo, non sfruttato:
   `Opportunity.embedding` (pgvector, colonna già esistente) è popolato su **4.535/4.798**
   righe (94.5%) — l'estensione `vector` è già installata, il pattern di query
   (`embedding <=> embedding`, cosine distance) è già in produzione altrove
   (`similarity.service.ts::getVectorSimilarUsers`, usato per friend suggestions). Nessuno
   lo applica agli `Opportunity` per trovare coppie semanticamente identiche con `dedupKey`
   diversi.

5. **"Tuning auto-disable"**: **non azionabile ora, onestamente**. `AUTO_DISABLE_THRESHOLD =
   5` (`queue.ts:15`). Verificato lo stato reale: `consecutiveFailures = 0` su **tutte** le
   493 righe `CompanyWatchlist` e tutte le 33 `HarvestTarget` — zero storico di fallimenti
   da cui inferire se la soglia è giusta. "Tuning" richiede dati operativi che non esistono
   ancora. Inventare un numero diverso senza evidenza violerebbe il principio di questa
   sessione di non gonfiare/inventare — resta com'è, rivisitare quando c'è storico reale.

## Scope di questo giro

Tre pezzi concreti (1, 3, 4 sopra), niente per il 2 (già fatto) e il 5 (non azionabile):

### A. Fix immediato: `ALL_SOURCES` mancante di Devfolio/MSCA/Harvest

`cleanup.service.ts` — aggiungere:
```ts
{ key: 'devfolio', prefix: 'devfolio-', schedule: 'Tue 04:45' },
{ key: 'msca', prefix: 'msca-', schedule: 'Mon 05:00' },
{ key: 'harvest-discovery', prefix: '__none__', schedule: 'Mon 03:00' }, // HarvestTarget rows, non Opportunity — vedi nota
{ key: 'harvest-feeds', prefix: 'harvest-', schedule: 'Tue 05:00' },
```
Nota: `harvest-discovery` non produce `Opportunity` (produce righe `HarvestTarget`) — il
`recordCount` via `prefix` non ha senso per questa entry. `getSourceHealthStats()` va
leggermente esteso per supportare un'entry "no record count" (source con `ImportLog` ma
senza corrispondenza diretta in `Opportunity.sourceId`) invece di forzare un prefix fittizio
che darebbe sempre 0 — piccola correzione di correttezza, non un redesign.

### B. Tracking costo LLM

**Passo 1 — consolidare i client OpenAI duplicati.** Oggi `opportunityParser.ts`,
`clusterClassifier.ts`, e `company-watchlist.import.ts` (esportata, riusata da
`discovery/extraction.ts`) hanno **ciascuno la propria** funzione `getClient()` con la stessa
identica implementazione (singleton lazy su `OPENAI_API_KEY`). Prima di strumentare, va
consolidato in un unico `services/ai/openai-client.ts` — non solo pulizia: senza un punto
unico non c'è un posto sensato dove agganciare il tracking senza toccare 9 call site a mano.

**Passo 2 — wrapper di tracking.** Ogni risposta OpenAI include già `response.usage`
(`prompt_tokens`, `completion_tokens`, `total_tokens`) senza bisogno di calcolarli — il
client consolidato espone una funzione `trackedCompletion(params, ctx: { source: string;
purpose: string })` che chiama `client.chat.completions.create(params)` e logga l'uso.
Ogni call site esistente cambia da `client.chat.completions.create(...)` a
`trackedCompletion({...}, { source: 'msca'|'company-watchlist'|..., purpose:
'extraction'|'enrichment'|'translation'|... })` — un cambio meccanico a 9 punti, non un
redesign della logica di prompt/parsing di ciascuno.

**Passo 3 — dove va il dato.** Nuova tabella `LlmUsageLog` (append-only, leggera):
```prisma
model LlmUsageLog {
  id               String   @id @default(cuid())
  source           String   // 'msca' | 'company-watchlist' | 'opportunity-enrichment' | ...
  purpose          String   // 'extraction' | 'cluster-classify' | 'skill-extract' | ...
  model            String   // 'gpt-4o-mini'
  promptTokens     Int
  completionTokens Int
  totalTokens      Int
  createdAt        DateTime @default(now())

  @@index([source, createdAt])
  @@index([createdAt])
}
```
Scelta deliberata: **non** calcolare/salvare un importo in €/$ nella riga (i prezzi per
token cambiano, hardcodarli in ogni riga li rende stale silenziosamente) — si salvano solo i
token grezzi; il costo si deriva a lettura (endpoint/query) moltiplicando per il prezzo
corrente del modello, in un'unica costante facile da aggiornare
(`OPENAI_PRICING: Record<string, {promptPer1M: number; completionPer1M: number}>`).

**Passo 4 — endpoint.** `GET /import/llm-cost` (nuovo, stesso stile admin di
`/import/coverage`): totali per `source`/`purpose` su finestra 24h/7g/30g, stima € corrente
via `OPENAI_PRICING`. Nessuna nuova infra di billing — è un rollup SQL su `LlmUsageLog`.

### C. Audit qualità dedup — near-duplicate via embedding

Nuova funzione `findDedupCandidates()` (`cleanup.service.ts`, accanto a
`getImportCoverage()`): per le righe **live** con `embedding IS NOT NULL` e `dedupKey`
diverso, trova coppie con cosine similarity sopra soglia (es. 0.93 — punto di partenza da
calibrare sui risultati reali del primo giro, non un numero definitivo) usando lo stesso
idioma già in produzione in `similarity.service.ts`:
```sql
SELECT a.id, b.id, a.title, b.title, a.source, b.source,
       1 - (a.embedding <=> b.embedding) AS similarity
FROM "Opportunity" a, "Opportunity" b
WHERE a.id < b.id
  AND a."dedupKey" IS DISTINCT FROM b."dedupKey"
  AND a."expiresAt" IS NULL AND b."expiresAt" IS NULL
  AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
  AND 1 - (a.embedding <=> b.embedding) > 0.93
ORDER BY similarity DESC
LIMIT 200
```
**Read-only per questo giro** — l'output è una lista di coppie sospette per revisione
manuale/log, **non** un merge automatico (due opportunità semanticamente simili non sono
necessariamente lo stesso posting — es. due tirocini marketing entry-level a due aziende
diverse avranno embedding vicini senza essere duplicati; serve giudizio umano o una soglia
più raffinata prima di automatizzare qualunque azione). Esposto via
`GET /import/dedup-audit` (admin), non schedulato — su richiesta.

**Costo:** query O(n²) sulle righe live con embedding (~4.500 oggi) — un self-join filtrato
è pesante ma non impossibile a questa scala; se il tempo di risposta risulta un problema in
pratica, la mitigazione naturale è un indice `ivfflat`/`hnsw` su `embedding` (pgvector lo
supporta) per una ANN-search invece del self-join completo — **non costruirlo preventivamente
senza sapere se serve** (YAGNI), misurare prima sul volume reale.

## Fuori scope (YAGNI)

- Nessun merge automatico dei duplicati trovati — solo audit/log, decisione umana.
- Nessun calcolo di costo in tempo reale/alert automatico sul budget LLM — solo un endpoint
  di rollup su richiesta; un kill-switch/budget cap resta possibile in futuro ma richiede
  prima di vedere numeri reali di spesa.
- Nessun tuning di `AUTO_DISABLE_THRESHOLD` — nessun dato per farlo onestamente.
- Nessun indice ANN (`ivfflat`/`hnsw`) su `embedding` finché non si misura che il self-join
  è davvero un problema di performance in pratica.

## Testing

- **Unit:** `findDedupCandidates()` con prisma mockato (verifica shape query, soglia
  applicata); pricing lookup di `OPENAI_PRICING` (fallback per modelli sconosciuti).
- **Unit:** `trackedCompletion()` — verifica che logghi `LlmUsageLog` con i token della
  risposta mockata, propaghi errori invariati (nessun cambio di comportamento sul fallimento
  della chiamata OpenAI stessa).
- **Integration:** `getSourceHealthStats()` con le nuove entry `ALL_SOURCES` — verifica che
  `harvest-discovery` (senza prefix valido) non esploda e ritorni comunque una riga sensata.
- **Manuale:** `GET /import/llm-cost` dopo un run reale (es. MSCA) → verificare righe
  `LlmUsageLog` popolate; `GET /import/dedup-audit` contro il DB dev → ispezionare le coppie
  restituite a mano per giudicare se la soglia 0.93 è ragionevole.

## Modifiche allo schema

- **Nuovo modello** `LlmUsageLog` (§B, passo 3). Nessuna modifica a `Opportunity`/altri
  modelli esistenti — `embedding` è già lì.
