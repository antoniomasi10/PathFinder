# Piano di implementazione — Related Opportunities via Embedding

**Spec:** `docs/superpowers/specs/2026-05-21-related-opportunities-embedding-design.md`  
**Branch:** PF-97

---

## Overview

4 step in ordine. Nessuna dipendenza esterna da risolvere — l'infrastruttura (embedding, pgvector, scoring) è già presente.

---

## Step 1 — Migrazione Prisma: ri-aggiungere indice HNSW su Opportunity.embedding

**Perché:** L'indice HNSW era stato rimosso nella migrazione `20260402164342`. La colonna esiste, i dati ci sono, ma senza indice la vector search fa sequential scan su tutta la tabella.

**File da creare:** `backend/prisma/migrations/20260521000000_add_opportunity_embedding_index/migration.sql`

```sql
CREATE INDEX IF NOT EXISTS "Opportunity_embedding_idx"
ON "Opportunity"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

Poi aggiornare `migration_lock.toml` eseguendo `npx prisma migrate deploy` (o equivalente).

**Nota:** HNSW richiede che pgvector >= 0.5.0 sia già installato (lo è — usato nella migrazione `20260325120000`).

---

## Step 2 — Backend: `getRelatedOpportunities()` in matchingEngine.ts

**File:** `backend/src/services/matchingEngine.ts`

Aggiungere dopo `getHybridMatchedOpportunities()` (riga ~588), prima di `getHybridMatchedOpportunitiesFull()`.

### Logica

```ts
export async function getRelatedOpportunities(
  userId: string,
  opportunityId: string,
  limit: number = 5,
): Promise<any[]>
```

**Pipeline:**

1. Fetch user + profile (con `include: { profile: true }`)
2. Fetch embedding dell'opportunità corrente:
   ```sql
   SELECT embedding FROM "Opportunity" WHERE id = $1
   ```
   — se `embedding IS NULL` → fallback: chiama `getHybridMatchedOpportunitiesFull(userId, {})` e ritorna `.slice(0, limit)`

3. Calcola relocation filter + senior leak filter (stesso codice di `getHybridMatchedOpportunitiesFull`, estrarre in helper privato `buildLocationFilter` + `SENIOR_LEAK_FILTER` costante)

4. Query candidati via pgvector (top 30 per contenuto):
   ```sql
   SELECT o."id", o."title", o."description", o."titleIt", o."descriptionIt", o."about",
          o."url", o."type", o."universityId", o."company", o."organizer", o."location",
          o."isRemote", o."isAbroad", o."requiredEnglishLevel", o."minGpa", o."tags",
          o."deadline", o."postedAt", o."expiresAt", o."source", o."sourceId",
          o."eligibleFields", o."country", o."city", o."region", o."format",
          o."clusterScores", o."clusterPrimary", o."minYearOfStudy", o."maxYearOfStudy",
          o."cost", o."hasScholarship",
          u."name" as "universityName", u."city" as "universityCity",
          u."id" as "uniId", u."logoUrl" as "universityLogoUrl",
          1 - (o.embedding <=> $1::vector) AS "contentSimilarity"
   FROM "Opportunity" o
   LEFT JOIN "University" u ON o."universityId" = u."id"
   WHERE o.id != $2
     AND o.embedding IS NOT NULL
     AND (o."expiresAt" IS NULL OR o."expiresAt" > NOW())
     AND (o.type IN ('EVENT','CONFERENCE') OR o.deadline IS NULL OR o.deadline > NOW())
     AND (o.type NOT IN ('EVENT','CONFERENCE') OR o."endDate" IS NULL OR o."endDate" >= CURRENT_DATE)
     AND (o."urlStatus" IS NULL OR o."urlStatus" != 'BROKEN' OR o.source = 'curated')
     ${relocFilter}
     ${seniorLeakFilter}
   ORDER BY o.embedding <=> $1::vector
   LIMIT 30
   ```
   Params: `[embeddingValue, opportunityId]`

5. Get interazioni utente ultime 90gg (stesso pattern di `getHybridMatchedOpportunitiesFull`)

6. Re-rank: per ogni candidato calcola `scoreOpportunity` + `computeFeedbackBoost`, costruisci `hybridScore`:
   - Se user ha profilo: `score × 0.6 + contentSimilarity×100 × 0.4`
   - Se user senza profilo: ritorna ordinato per `contentSimilarity` desc

7. `applyFreshnessPenalty(scored, viewedIds, clickedIds)`

8. Sort per `matchScore` desc, tie-break su `id`

9. `diversifyMMR(adjusted, limit * 2, 0.7, 3)` — finestra più piccola (5 items)

10. Ritorna `.slice(0, limit)`

**Export da aggiungere** nella riga 4 di `opportunity.routes.ts`:
```ts
import { ..., getRelatedOpportunities } from '../services/matchingEngine';
```

---

## Step 3 — Backend: nuova route `GET /:id/related`

**File:** `backend/src/routes/opportunity.routes.ts`

Inserire **prima** di `router.get('/:id', ...)` (riga 257) per evitare che `:id` catturi `related`.

```ts
// Get opportunities semantically related to a specific opportunity
router.get('/:id/related', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
    const related = await getRelatedOpportunities(req.user!.userId, req.params.id, limit);
    res.json({ data: related, total: related.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

**Attenzione all'ordine delle route:** Express matcha in ordine, quindi `/:id/related` DEVE stare sopra `/:id`, altrimenti `related` viene interpretato come un ID.

---

## Step 4 — Frontend: aggiornare la chiamata API

**File:** `frontend/app/(main)/opportunities/[id]/page.tsx` (righe 176-181)

**Prima:**
```ts
api.get('/opportunities?matched=true&page=1&limit=6')
  .then(({ data }) => {
    const items = Array.isArray(data.data || data) ? (data.data || data) : [];
    setRelatedOpps(items.filter((o: any) => String(o.id) !== String(id)).slice(0, 5).map((o: any) => mapRaw(o, useIt)));
  })
  .catch(() => {});
```

**Dopo:**
```ts
api.get(`/opportunities/${id}/related?limit=5`)
  .then(({ data }) => {
    const items = Array.isArray(data.data || data) ? (data.data || data) : [];
    setRelatedOpps(items.map((o: any) => mapRaw(o, useIt)));
  })
  .catch(() => {});
```

Cambiamenti:
- URL punta al nuovo endpoint
- Rimosso il `filter(o => o.id !== id)` — il backend lo esclude già
- Rimosso `.slice(0, 5)` — il backend restituisce già `limit` items

---

## Verifica end-to-end

```bash
# 1. Applica la migrazione
cd backend && npx prisma migrate deploy

# 2. Avvia il server (il backfill embedding gira in background al startup)
npm run dev

# 3. Controlla i log: deve apparire "Embedding backfill completed" o simile

# 4. Apri una scheda opportunità tech/internship → le correlate devono essere
#    altre opportunità tech/internship semanticamente simili

# 5. Apri una scheda per un evento/conferenza → le correlate devono cambiare
#    in modo coerente col contenuto

# 6. Testa l'endpoint direttamente:
curl -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/opportunities/<id>/related

# 7. Verifica fallback: trova un'opportunità senza embedding nel DB,
#    accedi alla sua scheda → deve mostrare comunque le correlate (top-match generali)
```

---

## Ordine di esecuzione

1. Migrazione → 2. `getRelatedOpportunities()` → 3. Route → 4. Frontend  
Ogni step è verificabile indipendentemente prima di procedere al successivo.
