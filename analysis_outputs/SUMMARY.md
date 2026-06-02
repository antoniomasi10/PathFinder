# Analisi approfondita: Logica di Matchmaking Utente ↔ Opportunità

## Panoramica architetturale

Il sistema di matchmaking è una **pipeline di ranking ibrida multi-segnale** strutturata in 5 strati. Il file centrale è `backend/src/services/matchingEngine.ts`.

```
HTTP GET /api/opportunities?matched=true
         │
         ▼
[Route layer]  opportunity.routes.ts
  ├── Snapshot Redis cache (5 min per userId×filters×lang)
  └── getHybridMatchedOpportunitiesFull(userId, filters)
              │
              ▼
      [1] CANDIDATE RETRIEVAL (SQL)
          Hard filters: expiry, deadline, urlStatus, seniorLeak, relocation
          + pgvector cosine similarity (se user ha embedding)
              │
              ▼
      [2] scoreOpportunity()       ← SCORING DETERMINISTICO
          Per-type ScoringProfile (14 dimensioni)
              │
              ▼
      [3] computeFeedbackBoost()   ← SEGNALI COMPORTAMENTALI
          Time-decayed interactions (90 gg)
              │
              ▼
      [4] Hybrid blending
          Con embedding:    base×0.5 + vector×0.3 + feedback×0.2
          Senza embedding:  base×0.8 + feedback×0.2
              │
              ▼
      [5] applyFreshnessPenalty()  ← PENALITÀ CONTENUTO GIÀ VISTO
          viewed: -5  |  clicked: -10
              │
              ▼
      [6] diversifyMMR()           ← DIVERSIFICAZIONE FEED
          MMR su tutta la lista (lambda=0.7, memory=5)
              │
              ▼
      [7] applyOppFilters()        ← FILTRI UI (in-memory)
          search/company/location/type/format/deadline
```

---

## Le 3 modalità di feed

### `?matched=true` — "Per Te"
Funzione: `getHybridMatchedOpportunitiesFull()`
- Recupera tutti i candidati (o top-N via pgvector) con raw SQL
- Applica tutta la pipeline sopra
- Espone `matchScore` + `matchReason` per ogni card

### `?new=true` — "Nuove"
Funzione: `getNewOpportunitiesFull()`
- Formula di ranking (solo per ordinamento, non mostrato):
  ```
  rankingScore = (recency×0.30 + profileMatch×0.30 + novelty×0.40) × viewMultiplier
  ```
  - **RecencyScore**: `100 × e^(-0.07 × daysOld)` — dimezza circa ogni 10 giorni
  - **NoveltyBonus**: 100 se mai salvata/applicata, 0 altrimenti
  - **viewMultiplier**: 0.75 se già vista, 1.0 altrimenti
- `matchScore` sulla card = solo `scoreOpportunity()` (non il composite)
- Usa Prisma ORM (non raw SQL) + filtro senior in JS dopo la fetch

### Explore (no flag) — "Esplora"
- Raw SQL parametrizzato con WHERE dinamico
- Ordinamento: `postedAt DESC` (o proximity ORDER BY se città italiana)
- Nessuno scoring — puro catalogo

### `GET /daily` — "Opportunità del Giorno"
- Chiama `getHybridMatchedOpportunities(50)` poi ri-sorta per `matchScore`
- Esclude opps interagite negli ultimi 7 gg + storico daily recente
- Cached con TTL = secondi fino a mezzanotte (Europe/Rome)
- Deterministico dentro la stessa giornata per lo stesso utente

### `GET /:id/related` — "Simili"
- **Opp-to-opp similarity** (non user-to-opp): cosine distance su embedding dell'opp di riferimento
- Recupera top 30 per similarità, poi re-rank con:
  ```
  matchScore = baseScore×0.6 + contentSim×100×0.4 + feedbackBoost
  ```
- Fallback a `getHybridMatchedOpportunitiesFull` se l'opp di riferimento non ha embedding

---

## scoreOpportunity() — Algoritmo Core (0–100 pts)

### Profili di scoring per tipo opportunità

Ogni tipo ha un `ScoringProfile` che definisce il peso di ogni dimensione.
La somma dei pesi base + bonus = 100 per un match perfetto.

| Tipo | Interest | Cluster | GPA | English | Relocate | Year | FieldBonus | CostBonus | DeadBonus | LocBonus |
|------|----------|---------|-----|---------|----------|------|------------|-----------|-----------|----------|
| STAGE | 30 | 25 | 15 | 15 | 10 | 5 | 0 | 0 | 0 | 0 |
| INTERNSHIP | 30 | 25 | 15 | 15 | 10 | 5 | 0 | 0 | 0 | 0 |
| FELLOWSHIP | 20 | 20 | 20 | 20 | 10 | 5 | 0 | 0 | 5 | 0 |
| RESEARCH | 15 | 10 | 25 | 20 | 10 | 0 | 15 | 0 | 5 | 0 |
| HACKATHON | 15 | 10 | 0 | 10 | 5 | 0 | 20 | 15 | 15 | 10 |
| EXCHANGE | 10 | 15 | 10 | 25 | 15 | 10 | 5 | 0 | 10 | 0 |
| EVENT | 20 | 10 | 0 | 5 | 10 | 0 | 10 | 15 | 10 | 20 |
| VOLUNTEERING | 10 | 20 | 0 | 15 | 15 | 5 | 10 | 5 | 5 | 15 |

### Le 14 dimensioni di scoring

#### 1. Primary Interest → Opportunity Type (peso: p.interest)
```
INTEREST_TYPE_MAP[user.primaryInterest] → lista ordinata di OpportunityType
  - preferredTypes[0] === opp.type → +p.interest       (top match)
  - opp.type in lista ma non primo  → +round(p.interest × 0.65)
  - non in lista                   → 0
```

Mappa principale: `tech→INTERNSHIP,STAGE,HACKATHON,BOOTCAMP,RESEARCH` | `business→FELLOWSHIP,INTERNSHIP,...` | `ai_ml→RESEARCH,HACKATHON,INTERNSHIP,BOOTCAMP` | ecc.

#### 2. Cluster Tag — Schwartz Personality (peso: p.cluster)
**Percorso nuovo (preferito)**: usa `opp.clusterScores` (JSON con score 0-1 per cluster)
```
score += round(p.cluster × clusterScores[userCluster])  // continuo, 0-100%
```
**Percorso legacy** (opp senza clusterScores): lookup in `CLUSTER_TYPE_MAP`
```
clusterTypes[0] === opp.type  → +p.cluster
opp.type in lista             → +round(p.cluster × 0.60)
```

I 6 cluster: **Analista** (dati/ricerca), **Creativo** (design/arte), **Leader** (management), **Imprenditore** (startup/business), **Sociale** (volontariato/community), **Explorer** (scambi/internazionale)

#### 3. GPA (peso: p.gpa)
```
Ordine: GPA_18_20=1, GPA_21_24=2, GPA_25_27=3, GPA_28_30=4
  - opp.minGpa null   → +p.gpa     (nessun requisito)
  - user.gpa >= min   → +p.gpa
  - user.gpa == min-1 → +round(p.gpa × 0.5)  (un tier sotto)
  - user.gpa < min-1  → 0
```

#### 4. English Level (peso: p.english) — stessa logica del GPA
```
Ordine: A2=1, B1_B2=2, C1=3, C2_PLUS=4
  full / 50% (un livello sotto) / 0
```

#### 5. Relocation Willingness (peso: p.relocate) — gerarchia strutturata
```
isRemote → +p.relocate sempre
cityLock  → +p.relocate solo se opp.city == user.city (case-insensitive)
regionLock → +p.relocate solo se opp.region == user.region
NO         → +p.relocate se Italy (country='IT' o isAbroad=false) o remote
YES        → +p.relocate sempre
MAYBE      → +round(p.relocate × 0.5)
```

#### 6. Year of Study (peso: p.year)
```
In range [minYearOfStudy, maxYearOfStudy] → +p.year
Fuori range → +round(p.year × 0.3)
```

#### 7. Field of Study Bonus (peso: p.fieldMatchBonus)
```
eligibleFields vuoto → +p.fieldMatchBonus (nessuna restrizione)
user.courseOfStudy presente:
  normalizeFieldToEnum(user.courseOfStudy) in eligibleFields → +p.fieldMatchBonus
```

#### 8. Cost/Scholarship Bonus (peso: p.costBonus)
```
opp.cost == null || opp.cost === 0 || opp.hasScholarship → +p.costBonus
```

#### 9. Deadline Urgency Bonus (peso: p.deadlineUrgencyBonus)
```
0 < daysUntilDeadline <= 14 → +p.deadlineUrgencyBonus
```

#### 10. Location Match Bonus — riservato V2, sempre 0

#### 11. Tag-Passion Alignment — bonus additivo max +20
```
computeTagScore():
  userTagSet = PASSION_TAG_MAP[ogni passion] (fallback: INTEREST_TAG_MAP[primaryInterest])
  matches = oppTags ∩ userTagSet
  score = min(20, matches × 7)
```
Ogni tag che matcha vale 7 punti — bastano 3 tag per il massimo.

#### 12. Skill Match — bonus additivo max +10
```
computeSkillMatchScore():
  core skill in requiredSkills  → +4
  core skill in recommendedSkills → +2
  side skill in requiredSkills  → +2
  side skill in recommendedSkills → +1
  max(score, 10)
```

#### 13. Field Mismatch Penalty (moltiplicativo)
```
eligibleFields non vuoto AND user.field NOT IN eligibleFields:
  userField noto    → score × 0.15   (penalità drastica)
  userField ignoto  → score × 0.50
```

#### 14. Tag-Incoherence Penalty (moltiplicativo)
```
tagScore === 0 AND oppTags.length >= 2 AND user ha interesse definito:
  → score × 0.40
```

**Nota**: le penalità 13 e 14 sono applicate sequenzialmente. Se entrambe scattano:
`score × 0.15 × 0.40 = score × 0.06` — penalità estrema.

---

## computeFeedbackBoost() — Strato comportamentale [-10, +15]

```
Finestra temporale: ultimi 90 giorni
Pesi azioni: view=1, click=2, save=3, apply=5, unsave=-2

Per ogni interaction in targetType='opportunity':
  decay = timeDecay(interaction.createdAt)
    - ≤7 gg: 1.0
    - ≥30 gg: 0.3
    - tra 7 e 30 gg: lineare 1.0→0.3

positiveSignal = Σ(weight × decay) per save/apply/click
negativeSignal = Σ(|weight| × decay) per unsave

boost = min(positiveSignal × 1.5, 15) - min(negativeSignal × 2, 10)

diversity bonus: se NESSUNA azione 'view' tra le interactions → +5

result = clamp(boost, -10, +15)
```

---

## Pipeline Embedding (pgvector)

**Modello**: `Xenova/all-MiniLM-L6-v2` — 384 dimensioni, mean pooling, normalizzato
**Libreria**: `@xenova/transformers` (runs in-process, lazy-loaded)

### User embedding text
```
"Studente presso <università>. Corso: <corso>. Anno <N>.
Interesse principale: <primaryInterest>. Profilo: <clusterTag>.
Visione: <careerVision>. Obiettivo: <professionalGoal>.
Passioni: <p1, p2>. GPA: <GPA>. Inglese: <level>.
Trasferimento: <YES/NO/MAYBE>.
Competenze principali: <core skills>.
Competenze secondarie: <side skills>."
```

### Opportunity embedding text
```
"<title>. Azienda: <company>. Tipo: <type>.
<description[:300]>. Luogo: <location>. Remoto.
Tag: <tags>. GPA minimo: <minGpa>. Inglese richiesto: <level>."
```

### Blending con vector similarity
Formula con embedding:
```
hybridScore = baseScore × 0.5 + (vectorSim × 100) × 0.3 + (feedbackBoost + 10) × (100/25) × 0.2
```
- `vectorSim` è cosine similarity (1 - cosine distance), range [0, 1]
- Il termine feedback è normalizzato: `(boost + 10) × 4 × 0.2` → max 20 punti

---

## Cluster Classification (AI)

**Modello**: GPT-4o-mini con `response_format: json_object`, temperature=0
**Input**: titolo, tipo, tags, eligibleFields, descrizione[:1500]
**Output**: scores continui 0-1 per i 6 cluster + primary cluster

Il server ignora il `primary` restituito dal modello e lo ri-calcola lato server come argmax.

**Fallback deterministico** (senza OPENAI_API_KEY):
- Inizializza tutti i cluster a 0.5
- Override per tipo (es. EXCHANGE/SUMMER_PROGRAM → Explorer=0.95)
- Boost keyword per design/startup/data/leadership/social/travel (+0.2 ciascuno, cap a 1.0)

---

## Hard Filters SQL (pre-scoring)

Applicati prima del ranking per ridurre i candidati:

| Filtro | Logica |
|--------|--------|
| Scaduto | `expiresAt IS NULL OR expiresAt > NOW()` |
| Deadline | `deadline IS NULL OR deadline > NOW()` (non per EVENT) |
| Event endDate | `endDate IS NULL OR endDate >= CURRENT_DATE` (solo EVENT) |
| URL rotto | `urlStatus != 'BROKEN' OR source = 'curated'` |
| Senior leak | regex su title: esclude senior/director/lead/vp/ceo... a meno che non contengano intern/trainee/junior/... |
| Relocation | city/region/country filter SQL se cityLock/regionLock/NO |

---

## Caching

| Chiave Redis | TTL | Invalidazione |
|---|---|---|
| `cache:opps:matched:{userId}:{filters}:{lang}` | 5 min | save/unsave (async, best-effort) |
| `cache:opps:new:{userId}:{filters}:{lang}` | 5 min | save/unsave (async, best-effort) |
| `cache:opp:daily:{userId}:{date}` | fino a mezzanotte Rome | mai (fixed per giornata) |
| `cache:opp:daily:history:{userId}` | 8 giorni | append on new daily |

**Design chiave**: la paginazione è uno slice su uno snapshot immutabile. Un'opportunità non può apparire su due pagine diverse nella stessa sessione di 5 minuti. Le interazioni view/click non invalidano lo snapshot (per evitare riordini mid-pagination).

---

## getMatchReason() — Generazione testo motivazione

Priorità (1 = più alta):
1. Core skills matchate in requiredSkills
2. Side skills matchate / field match / scholarship / cost=0 / scade presto
3. Tipo-specifico (es. "Ottimo per il tuo profilo tecnico" per HACKATHON)
4. Interest/cluster generico
5. Remote (per utenti NO relocation)

Restituisce max 2 ragioni concatenate con ` · `.
