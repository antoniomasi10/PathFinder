# RISKS — Matchmaking Engine

> Livello di confidenza: [HIGH] = confermato dal codice | [MED] = plausibile da pattern | [LOW] = speculativo

---

## RISK-01 · SQL Injection via interpolazione stringa per city/region [HIGH severity, HIGH confidence]

**File**: `matchingEngine.ts:810-816`
**Percorso affetto**: `getHybridMatchedOpportunitiesFull()` → blocco `userHasEmbedding = true`

```typescript
// PROBLEMA: interpolazione diretta in raw SQL, non parametrizzata
const safeCity = user.city.replace(/'/g, "''");
relocFilter = `AND (o."isRemote" = true OR lower(o."city") = lower('${safeCity}'))`;
```

La "sanificazione" via `replace(/'/g, "''")` è escape SQL manuale — insufficiente in PostgreSQL per payload Unicode o tecniche di bypass multi-byte. Il dato `user.city` viene da DB (quindi scritto dall'utente in fase di registrazione) e finisce direttamente nella query raw.

**Contrasto**: la funzione gemella `getRelatedOpportunities()` (linea 635-643) fa la stessa cosa ma usa `$N` parametrizzati — il pattern corretto esiste già nel codebase.

**Fix consigliato**: usare `extraParams` come fa `getRelatedOpportunities`:
```typescript
extraParams.push(user.city);
relocFilter = `AND (o."isRemote" = true OR lower(o."city") = lower($${extraParams.length + 1}))`;
```

---

## RISK-02 · Feedback boost sganciato dal tipo opportunità [HIGH severity, HIGH confidence]

**File**: `matchingEngine.ts:447-495` — `computeFeedbackBoost()`

Il commento interno ammette il problema:
> _"Since we don't have the type in the interaction, we use saved opportunity types from a pre-computed map passed externally, or approximate via targetId."_

In pratica: un utente che salva UN internship ottiene `positiveSignal = 3 × 1.0 = 3`, quindi `boost = min(4.5, 15) = +4.5` applicato a **tutte** le opportunità indiscriminatamente. Se salva tre volte ottiene il boost massimo (+15) su exchange, volunteering, research — tipo completamente diverso.

**Effetto**: il feedback non modella preferenze per tipo, ma per recency di utilizzo dell'app. Un utente attivo viene premiato indipendentemente da cosa ha fatto.

**Fix**: passare una mappa `oppId → oppType` e filtrare le interactions per tipo (`i.targetType === opportunity.type`).

---

## RISK-03 · Diversity bonus erroneo in computeFeedbackBoost [MED severity, HIGH confidence]

**File**: `matchingEngine.ts:477-481`

```typescript
if (interaction.action === 'view') {
  hasRecentTypeInteraction = true;
}
```
Poi:
```typescript
if (!hasRecentTypeInteraction) {
  boost += 5;
}
```

Il bonus "diversity" (+5) scatta quando l'utente NON ha mai eseguito `view` su nessuna opportunità nelle ultime 90 gg. Questo non misura la diversità del tipo ma la presenza/assenza di qualsiasi view. Un nuovo utente ottiene +5 su tutto. Un utente che ha visto 100 opportunità ma non ha mai salvato/cliccato non ottiene il bonus, mentre uno che non ha mai aperto l'app sì.

**Effetto**: il bonus premia l'inattività, non la novità del tipo. Impatto limitato (+5 su ~100 punti) ma logicamente errato.

---

## RISK-04 · Double penalty con effetto moltiplicativo estremo [MED severity, HIGH confidence]

**File**: `matchingEngine.ts:403-424`

Se entrambe le penalità 13 (field mismatch) e 14 (tag incoherence) scattano sullo stesso record:
```
score × 0.15 × 0.40 = score × 0.06
```
Uno score di 70 diventa 4.2. Casi reali:
- Utente con corso normalizzato a ENGINEERING
- Opportunità con `eligibleFields = ['COMPUTER_SCIENCE']` e ≥2 tag tecnici
- L'utente ha interesse definito (attiva la penalità 14)

Le opportunità così penalizzate di fatto spariscono dal feed (score ~4 su 100) anche se sono concettualmente rilevanti (problema di granularità del campo di studio).

**Nota**: il commento al tag `// 13.` spiega che la hard exclusion SQL era stata rimossa perché "AI-inferred fields don't perfectly match" — ma la soft penalty moltiplicativa può essere altrettanto drastica in practice.

---

## RISK-05 · getNewOpportunitiesFull carica tutto in memoria [MED severity, MED confidence]

**File**: `matchingEngine.ts:1076-1082`

```typescript
const allOppsRaw = await prisma.opportunity.findMany({
  where: Object.keys(where).length ? where : undefined,
  include: { university: true },
  orderBy: { postedAt: 'desc' },
});
const allOpps = allOppsRaw.filter((o) => !isSeniorRole(o.title));
```

Il filtro senior è applicato in JS dopo la fetch completa, invece che a livello SQL (come fa `getHybridMatchedOpportunitiesFull`). Con migliaia di opportunità, questa operazione carica tutti i record in memoria prima di scartare quelli senior.

**Contrasto**: `getHybridMatchedOpportunitiesFull` applica `seniorLeakFilter` nel WHERE della query raw.

**Fix**: aggiungere `isSeniorRole` come condizione Prisma o usare raw SQL come il percorso matched.

---

## RISK-06 · feedbackBoost non normalizzato in getRelatedOpportunities [LOW severity, HIGH confidence]

**File**: `matchingEngine.ts:716`

```typescript
matchScore = baseScore * 0.6 + contentSim * 100 * 0.4 + feedbackBoost;
// feedbackBoost ∈ [-10, +15], non normalizzato
```

Nel feed principale (linea 921):
```typescript
hybridScore = baseScore * 0.5 + (vectorSim * 100) * 0.3 + (feedbackBoost + 10) * (100 / 25) * 0.2;
// (boost + 10) × 4 × 0.2 → contributo [0, 20]
```

In `getRelatedOpportunities` il boost è sommato raw, non normalizzato. Significa che utenti con molte interazioni positive possono spostare il ranking related fino a +15 punti (vs max ~10 normalizzati nel feed principale). Inconsistenza minore ma può causare comportamenti inaspettati.

---

## RISK-07 · MMR O(n²) sull'intera lista [LOW severity, MED confidence]

**File**: `matchingEngine.ts:978`

```typescript
const ranked = diversifyMMR(adjusted, adjusted.length, 0.7, 5);
```

`windowSize = adjusted.length` significa che il re-ranking MMR itera sull'intera lista. La complessità è O(n² × recentMemory). Con 1000+ opportunità e recentMemory=5, ogni iterazione scorre ~1000 candidati. Per n=2000: ~4M operazioni per request (prima del cache hit).

Mitigato dalla cache Redis (5 min), ma il primo hit per ogni utente/filter combo esegue tutto il calcolo.

---

## RISK-08 · Cache invalidation parziale e best-effort [LOW severity, HIGH confidence]

**File**: `opportunity.routes.ts:304-308`

```typescript
function invalidateUserOppCache(userId: string): void {
  Promise.all([
    cacheDel(`cache:opps:matched:${userId}:*`),
    cacheDel(`cache:opps:new:${userId}:*`),
  ]).catch(() => {});
}
```

L'invalidazione è fire-and-forget (`.catch(() => {})`). Se Redis è down o il pattern glob non funziona, la cache stale rimane attiva. L'utente potrebbe vedere il proprio save non riflesso nel feed per fino a 5 minuti.

Ulteriore nota: la cache daily (`cache:opp:daily:{userId}:{date}`) NON viene invalidata da save/unsave — se l'utente salva la daily opportunity e ricarica la pagina, la daily rimarrà la stessa. Comportamento probabilmente intenzionale.

---

## RISK-09 · user.skills parsing ridondante [LOW severity, LOW confidence]

`parseUserSkills()` viene chiamata per ogni call a `getHybridMatchedOpportunitiesFull` e `getNewOpportunitiesFull` — una volta per sessione. Dentro lo scoring, `computeSkillMatchScore` fa poi una seconda normalizzazione. Nessun problema funzionale, ma il parsing JSON e la creazione di oggetti potrebbe essere ottimizzata se il profilo utente fosse memoizzato tra le chiamate.

---

## Riepilogo priorità

| ID | Titolo | Severity | Confidence | Fix complessità |
|----|--------|----------|------------|-----------------|
| RISK-01 | SQL Injection city/region | HIGH | HIGH | Bassa (già pattern corretto in codebase) |
| RISK-02 | Feedback boost sganciato da tipo | HIGH | HIGH | Media (richiede mappa oppId→type) |
| RISK-03 | Diversity bonus logicamente errato | MED | HIGH | Bassa (refactor condizione) |
| RISK-04 | Double penalty moltiplicativa estrema | MED | HIGH | Media (rivedere ordine/soglie) |
| RISK-05 | getNewOpportunitiesFull full-table in memoria | MED | MED | Bassa (aggiungere raw SQL filter) |
| RISK-06 | feedbackBoost non normalizzato in related | LOW | HIGH | Bassa (allineare formula) |
| RISK-07 | MMR O(n²) su intera lista | LOW | MED | Media (windowSize cap o cached diversification) |
| RISK-08 | Cache invalidation best-effort | LOW | HIGH | Bassa (logging + fallback) |
