# Related Opportunities via Embedding — Design Spec

**Date:** 2026-05-21  
**Branch context:** PF-97

---

## Problem

La sezione "Opportunità correlate" nella scheda informativa (`/opportunities/[id]`) mostra attualmente le stesse top-match generali dell'utente che appaiono nella home (`GET /opportunities?matched=true`). Non c'è nessuna relazione con l'opportunità specifica che l'utente sta guardando — né per tipo, settore, contenuto, né per tag. Il nome "correlate" è semanticamente sbagliato.

## Obiettivo

Mostrare opportunità semanticamente simili a quella corrente, re-rankate per match score dell'utente — così la sezione diventa davvero utile come discovery di alternative o opportunità affini.

---

## Soluzione

Nuovo endpoint dedicato `GET /api/opportunities/:id/related` che usa pgvector per trovare le opportunità con embedding più vicino a quello dell'opportunità corrente, poi le re-ranka col motore di matching esistente.

---

## Infrastruttura esistente (da riutilizzare)

Tutto ciò che serve è già presente:

| Componente | File | Funzione |
|---|---|---|
| Campo embedding su Opportunity | `backend/prisma/schema.prisma` (l.243) | `embedding Unsupported("vector(384)")?` |
| Conversione testo→embedding | `backend/src/services/embedding.service.ts` | `opportunityToText()`, `updateOpportunityEmbedding()` |
| Backfill al server startup | `backend/src/index.ts` (l.220-222) | `bulkGenerateEmbeddings()` |
| Scoring per utente | `backend/src/services/matchingEngine.ts` | `scoreOpportunity()` |
| Diversificazione MMR | `backend/src/services/matchingEngine.ts` | `diversifyMMR()` |
| Boost feedback | `backend/src/services/matchingEngine.ts` | `scoreOpportunityWithFeedback()` |
| Freshness penalty | `backend/src/services/matchingEngine.ts` | `applyFreshnessPenalty()` |

**Nota sugli indici:** Gli indici HNSW su `Opportunity.embedding` sono stati rimossi nella migrazione `20260402164342`. Le query vector funzionano comunque (sequential scan), ma per performance aggiungiamo un nuovo indice.

---

## Architettura

### Backend — nuova funzione `getRelatedOpportunities()`

**File:** `backend/src/services/matchingEngine.ts`

Pipeline:

1. **Fetch embedding opportunità corrente** — `SELECT embedding FROM "Opportunity" WHERE id = $opportunityId`
2. **Fallback** — se l'embedding è NULL, restituisce i top-match dell'utente (comportamento attuale)
3. **Candidate retrieval via pgvector** — trova le K opportunità più vicine per cosine similarity sull'embedding dell'opportunità (non utente-opportunità, ma opportunità-opportunità):
   ```sql
   SELECT o.*, 1 - (o.embedding <=> $refEmbedding::vector) AS "contentSimilarity"
   FROM "Opportunity" o
   WHERE o.id != $opportunityId
     AND (o."expiresAt" IS NULL OR o."expiresAt" > NOW())
     AND (o."deadline" IS NULL OR o."deadline" > NOW() OR o.type IN ('EVENT','CONFERENCE'))
     AND (o."urlStatus" IS NULL OR o."urlStatus" != 'BROKEN' OR o.source = 'curated')
   ORDER BY o.embedding <=> $refEmbedding::vector
   LIMIT 30
   ```
4. **Re-rank con `scoreOpportunity()`** — ogni candidato viene scorato rispetto al profilo dell'utente (0-100)
5. **Feedback boost** — `scoreOpportunityWithFeedback()` (interazioni ultime 90gg)
6. **Freshness penalty** — `applyFreshnessPenalty()` su già-viste/cliccate
7. **MMR diversification** — `diversifyMMR()` per varietà di tipo/cluster
8. **Return top N** (default: 5)

**Signature:**
```ts
export async function getRelatedOpportunities(
  userId: string,
  opportunityId: string,
  limit: number = 5
): Promise<RankedOpportunity[]>
```

### Backend — nuova migrazione

**File:** nuova migrazione Prisma

Ri-aggiunge l'indice HNSW sull'embedding delle opportunità:
```sql
CREATE INDEX IF NOT EXISTS "Opportunity_embedding_idx"
ON "Opportunity"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Backend — nuova route

**File:** `backend/src/routes/opportunity.routes.ts`

```
GET /api/opportunities/:id/related
```
- Richiede autenticazione (middleware auth)
- Query param opzionale: `?limit=5`
- Chiama `getRelatedOpportunities(req.user.id, req.params.id, limit)`
- Risposta: `{ data: Opportunity[], total: number }`

### Frontend — aggiornamento fetch

**File:** `frontend/app/(main)/opportunities/[id]/page.tsx` (righe 176-181)

Cambia la chiamata da:
```ts
api.get('/opportunities?matched=true&page=1&limit=6')
```
a:
```ts
api.get(`/opportunities/${id}/related?limit=5`)
```

Rimozione del filtro client-side `filter(o => o.id !== id)` (non più necessario perché il backend lo esclude già).

---

## Edge cases

| Caso | Comportamento |
|---|---|
| Opportunità senza embedding | Fallback a `getHybridMatchedOpportunitiesFull()` (comportamento attuale) |
| Utente senza embedding | Scoring solo con `scoreOpportunity()` senza componente vettoriale utente |
| Meno di 5 candidati simili | Ritorna quello che c'è (0-4 carte) |
| Tutti i candidati già visti | Freshness penalty li deprioritizza ma non li rimuove |

---

## File da modificare

1. `backend/src/services/matchingEngine.ts` — nuova funzione `getRelatedOpportunities()`
2. `backend/src/routes/opportunity.routes.ts` — nuova route `GET /:id/related`
3. `frontend/app/(main)/opportunities/[id]/page.tsx` — aggiornamento chiamata API
4. Nuova migrazione Prisma — indice HNSW su `Opportunity.embedding`

---

## Verifica end-to-end

1. `npm run db:up` + `npm run db:migrate`
2. `npm run dev` — il backfill embedding gira all'avvio
3. Aprire una scheda opportunità → verificare che le "correlate" siano semanticamente affini (stesso settore/tipo/contenuto)
4. Aprire una scheda di tipo diverso → verificare che le correlate cambino coerentemente
5. Testare con opportunità senza embedding → deve mostrare i top-match generali (fallback)
6. Verificare nei log che la query pgvector venga eseguita correttamente
