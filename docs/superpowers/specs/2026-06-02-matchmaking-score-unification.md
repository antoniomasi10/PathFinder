# Spec A: Matchmaking Score Unification + MMR Retuning + Abroad Penalty

**Data**: 2026-06-02  
**Stato**: Approvato  
**Branch target**: develop

---

## Problema

Tre difetti distinti nella pipeline di matchmaking degradano la percezione di qualità:

1. **Score incoerente**: la stessa opportunità mostra percentuali diverse a seconda del contesto. Il tab "Per Te" espone l'hybrid score (`base×0.5 + vector×0.3 + feedback×0.2`), il tab "Nuove" espone il profile score puro. Risultato: Bocconi Summer School appare al 64% in "Per Te" e al 95% in "Nuove". Il filtro affinità 88-100% restituisce 0 risultati perché usa l'endpoint matched con hybrid scores che non superano 88 per utenti senza embedding maturo.

2. **MMR troppo aggressivo**: lambda=0.7 significa 30% varietà. Opportunità al 95% vengono scalzate da quelle al 70% per pura diversificazione di tipo. Gli utenti percepiscono il feed come non ordinato per affinità.

3. **Penalità abroad assente per livelli bassi di inglese**: un utente con inglese A2 può ricevere score alto su internship a Berlino perché l'opportunità non ha `requiredEnglishLevel` impostato. L'assenza di requisito esplicito viene trattata come "nessuna barriera", ignorando la realtà pratica che lavorare all'estero richiede almeno B1_B2.

---

## Soluzione

### Fix 1 — Score coerente: profilo puro sulla card, ibrido per il rank

**File**: `backend/src/services/matchingEngine.ts` — `getHybridMatchedOpportunitiesFull()`

Il campo `matchScore` esposto nel JSON di risposta diventa sempre `scoreOpportunity()` puro. L'`hybridScore` continua ad essere calcolato internamente per ordinare la lista (il ranking beneficia ancora della similarità vettoriale e del feedback comportamentale), ma non viene mai restituito al client.

```typescript
// Calcolo interno per ordinamento (invariato)
let hybridScore: number;
if (userHasEmbedding && vectorSim > 0) {
  hybridScore = baseScore * 0.5 + (vectorSim * 100) * 0.3 + (feedbackBoost + 10) * (100 / 25) * 0.2;
} else {
  hybridScore = baseScore * 0.8 + (feedbackBoost + 10) * (100 / 25) * 0.2;
}

return {
  // ...
  matchScore: Math.max(0, Math.min(100, Math.round(baseScore))), // ← profilo puro
  _hybridScore: hybridScore, // usato solo per sort, rimosso prima del return finale
};
```

Il sort avviene su `_hybridScore`, poi il campo viene rimosso prima di restituire i dati. Il `matchReason` rimane calcolato su `baseScore` (già così).

**Impatto**:
- Il filtro affinità (minScore/maxScore) torna coerente con i numeri visibili
- La daily card mostra lo stesso % del feed
- `GET /:id` (singola opportunità) già usa `scoreOpportunity()` puro — nessuna modifica necessaria

---

### Fix 2 — MMR lambda da 0.7 a 0.9

**File**: `backend/src/services/matchingEngine.ts`

Due chiamate a `diversifyMMR` da aggiornare:

```typescript
// In getHybridMatchedOpportunitiesFull()
const ranked = diversifyMMR(adjusted, Math.min(adjusted.length, 300), 0.9, 5);

// In getRelatedOpportunities()
const ranked = diversifyMMR(adjusted, adjusted.length, 0.9, 3);
```

Lambda=0.9: 90% peso allo score, 10% varietà. Il feed mantiene sufficiente diversità per non sembrare ripetitivo (due INTERNSHIP consecutivi sono ancora possibili se entrambi ad alta affinità) ma l'ordine per affinità è chiaramente percepibile.

---

### Fix 3 — Penalità implicita abroad per A2/B1_B2

**File**: `backend/src/services/matchingEngine.ts` — `scoreOpportunity()`

Aggiungere una nuova dimensione di penalità **dopo** i 14 step esistenti, prima del `return Math.min(score, 100)`:

```typescript
// 15. Abroad language barrier — implicit penalty when no requiredEnglishLevel is set
// and the opportunity is abroad (in-person). Remote opps are exempt.
// Applied only when requiredEnglishLevel is null to avoid double-penalizing opps
// that already have an explicit requirement handled by step 4.
const isInPersonAbroad =
  !opportunity.isRemote &&
  (opportunity as any).format !== 'ONLINE' &&
  ((opportunity as any).country !== null &&
    (opportunity as any).country !== 'IT' ||
    opportunity.isAbroad);

if (isInPersonAbroad && !opportunity.requiredEnglishLevel) {
  if (user.englishLevel === 'A2') {
    score = Math.round(score * 0.60);
  } else if (user.englishLevel === 'B1_B2') {
    score = Math.round(score * 0.85);
  }
}
```

**Logica**:
- Si attiva solo per opportunità fisicamente all'estero (`isAbroad=true` o `country≠IT`), non per remote
- Si attiva solo se `requiredEnglishLevel` è null (se è esplicito, lo step 4 già gestisce la penalità)
- A2 → ×0.60 (penalità significativa: lavorare in contesto straniero con A2 è realisticamente difficile)
- B1_B2 → ×0.85 (penalità lieve: B1_B2 all'estero è borderline ma possibile)
- C1/C2/null → nessuna penalità

---

## File modificati

| File | Modifica |
|------|----------|
| `backend/src/services/matchingEngine.ts` | Fix 1 (matchScore esposto), Fix 2 (lambda 0.9), Fix 3 (abroad penalty) |

Nessuna migrazione DB. Nessuna modifica frontend.

---

## Cosa NON cambia

- La formula di ranking interno (`hybridScore`) rimane invariata — beneficia ancora della similarità vettoriale
- Il tab "Nuove" non cambia — usa già `scoreOpportunity()` puro
- `scoreOpportunityWithFeedback()` (export pubblico) non cambia firma
- Il `matchReason` non cambia — già basato su `scoreOpportunity()`

---

## Verifica

1. **Fix 1**: Chiamare `GET /api/opportunities?matched=true` per Alessandro. Il campo `matchScore` della Bocconi Summer School deve essere ≥90 (non 64). Confrontare con `GET /api/opportunities/7b7ed31e-5f90-4075-8fbb-1f576b78056a` — devono coincidere.

2. **Fix 2**: Caricare il tab "Per Te" con Alessandro. Le prime 5 card devono essere in ordine decrescente di `matchScore` con rarissime eccezioni di diversificazione.

3. **Fix 3**: Verificare che l'internship PALU a Münster (remoteok-1130969) scenda significativamente nella classifica per Alessandro (A2). `scoreOpportunity()` deve applicare ×0.60. Verificare che opp remote non vengano penalizzate.

4. **Cache**: Dopo deploy, svuotare Redis per Alessandro: `DEL cache:opps:matched:6bcf82f8*` e `cache:opps:new:6bcf82f8*`.

---

## Spec B (futura)

La gestione strutturata delle lingue richieste (campo `requiredLanguages` JSON su Opportunity, AI classifier per opp `isAbroad=true`, campo `languages[]` nel profilo utente) è documentata in una spec separata.
