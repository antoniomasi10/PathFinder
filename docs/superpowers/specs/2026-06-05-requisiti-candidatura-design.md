# Requisiti di Candidatura — Redesign

## Context

La sezione "Requisiti di candidatura" sulla pagina dettaglio opportunità mostra attualmente una lista piatta di skill names secchi (es. "Python", "SQL", "Market research") che non danno all'utente informazioni concrete su cosa è davvero richiesto e in quale contesto. Inoltre la sezione appare su tutti i tipi di opportunità, inclusi eventi, summer school e fellowship dove non ha senso.

L'obiettivo è: (1) ristrutturare la sezione in tre gruppi semantici chiari (Competenze, Accademico, Lingue), (2) far generare all'AI frasi contestualizzate per le competenze invece di nomi secchi, (3) nascondere la sezione per tutto ciò che non è STAGE o INTERNSHIP.

---

## Scope

Tipi che mostrano i requisiti: `STAGE`, `INTERNSHIP`

Tipi che non mostrano nulla: `EVENT`, `FELLOWSHIP`, `SUMMER_PROGRAM`, `HACKATHON`, `COMPETITION`, `EXCHANGE`, `VOLUNTEERING`, `BOOTCAMP`, `EXTRACURRICULAR`, `RESEARCH`

---

## Design

### 1 — Nuovo campo DB: `contextualizedSkills`

Aggiungere alla model `Opportunity` nel Prisma schema:

```prisma
contextualizedSkills String[] @default([])
```

Migration Prisma necessaria. Il campo è `[]` di default — indica "non ancora processato o nessuna skill trovata".

### 2 — Nuova funzione AI: `extractContextualizedSkills`

**File:** `backend/src/services/ai/opportunityParser.ts`

Stessa struttura delle funzioni esistenti (`extractOpportunitySkills`, `extractRequiredLanguages`). Prende in input title, description, about e le `extractedSkills` già estratte, e restituisce 3–5 frasi brevi in italiano che descrivono ogni competenza nel contesto specifico dell'opportunità.

**Output target** (JSON): `{ "skills": ["Padronanza di Python per l'analisi di dataset energetici", ...] }`

**Regole del prompt:**
- Massimo 5 frasi, minimo 1
- Ogni frase deve iniziare con sostantivo (es. "Padronanza di", "Capacità di", "Familiarità con", "Conoscenza di")
- Massimo 12 parole per frase
- Lingua: sempre italiano
- Basarsi sulle `extractedSkills` esistenti come riferimento, ma contestualizzarle usando il contenuto del description
- Se `extractedSkills` è vuoto ma il testo contiene competenze implicite, estrarre comunque
- Se nessuna skill identificabile: array vuoto

**Chiamata:** `gpt-4o-mini`, `max_tokens: 200`, `temperature: 0.2`, `response_format: json_object`

### 3 — Boot-time backfill: `backfillContextualizedSkillsBoot`

**File:** `backend/src/services/ai/opportunityParser.ts`

Stesso pattern di `backfillExtractedSkillsBoot` e `backfillRequiredLanguagesBoot`:

- Filtra opportunità con `type IN [STAGE, INTERNSHIP]` AND `contextualizedSkills: { isEmpty: true }`
- Limit: 200, concurrency: 5
- Chiamata: `extractContextualizedSkills` → update DB
- Registrata in `backend/src/index.ts` insieme alle altre backfill boot

### 4 — Integrazione nel flusso di import

**File:** `backend/src/services/import/batch.ts` (riga ~184 — dove già vengono chiamati `extractOpportunitySkills` e `extractRequiredLanguages` in parallelo)

Aggiungere `extractContextualizedSkills` alla `Promise.all` esistente e salvare il risultato su `contextualizedSkills` nell'`updateData`, stesso pattern degli altri campi AI.

### 5 — Frontend: interfaccia e mapRaw

**File:** `frontend/app/(main)/opportunities/[id]/page.tsx`

Aggiungere all'interfaccia `Opportunity`:
```ts
contextualizedSkills: string[];
minGpa?: string;           // GpaRange enum string
minYearOfStudy?: number;
maxYearOfStudy?: number;
eligibleFields?: string[]; // FieldOfStudy enum strings
requiredLanguages?: Array<{ lang: string; level: string | null }>;
```

Aggiornare `mapRaw` per mappare i campi dal raw dell'API.

### 6 — Frontend: nuovo componente UI

**File:** `frontend/app/(main)/opportunities/[id]/page.tsx`

Sostituire il blocco attuale "Requisiti di candidatura" con la nuova versione che:

**Condizione di rendering:** mostra solo se `opportunity.type === 'STAGE' || opportunity.type === 'INTERNSHIP'`

**Tre gruppi:**

1. **Competenze** (icona 🛠) — da `contextualizedSkills`. Se vuoto, non mostrare questo gruppo.
2. **Requisiti accademici** (icona 🎓) — derivati da:
   - Anno: `minYearOfStudy`/`maxYearOfStudy` → "2°–4° anno di corso" (o solo "Dal 2° anno" se solo min)
   - GPA: mappatura `GpaRange` → "Media voti ≥ 25/30" (vedi tabella sotto)
   - Campi: `eligibleFields` → nomi italiani (vedi tabella sotto), omesso se vuoto o `[ANY]`
   - Se nessun dato accademico presente, non mostrare questo gruppo.
3. **Lingue** (icona 🌐) — da:
   - `requiredEnglishLevel` → "Inglese B2 o superiore" (vedi mappatura sotto)
   - `requiredLanguages` → es. "Tedesco B2"
   - Se nessuna lingua presente, non mostrare questo gruppo.

Se tutti e tre i gruppi sono vuoti, non renderizzare il blocco.

**Separatori:** `<hr>` stilizzato con `bg-[#dde1ff]` tra i gruppi presenti.

**Stile invariato:** mantiene il card con `bg-[#f3f2ff] border border-[#dde1ff] rounded-[16px]`.

---

## Mappature

### GpaRange → label italiano
| Enum | Label |
|------|-------|
| GPA_18_20 | Media voti 18–20 |
| GPA_21_24 | Media voti 21–24 |
| GPA_25_27 | Media voti 25–27 |
| GPA_28_30 | Media voti 28–30 |

### EnglishLevel → label italiano
| Enum | Label |
|------|-------|
| A2 | Inglese A2 |
| B1_B2 | Inglese B1–B2 |
| C1 | Inglese C1 |
| C2_PLUS | Inglese C2 o madrelingua |

### FieldOfStudy → label italiano (solo quelli più comuni)
| Enum | Label |
|------|-------|
| COMPUTER_SCIENCE | Informatica |
| ENGINEERING | Ingegneria |
| MEDICINE | Medicina |
| ECONOMICS | Economia |
| BUSINESS | Business / Management |
| LAW | Giurisprudenza |
| POLITICAL_SCIENCE | Scienze Politiche |
| DESIGN | Design |
| MATHEMATICS | Matematica |
| HUMANITIES | Lettere / Scienze Umanistiche |
| LIFE_SCIENCES | Scienze della Vita |
| PHYSICAL_SCIENCES | Fisica |
| ARCHITECTURE | Architettura |
| PSYCHOLOGY | Psicologia |
| EDUCATION | Scienze dell'Educazione |
| ANY | (non mostrare) |

---

## Verifica

1. Eseguire `npm run db:migrate` dopo aver aggiunto il campo Prisma
2. Avviare il backend: la backfill boot deve loggare `[SkillsContextBackfill] Processing N opportunities`
3. Aprire una pagina di tipo STAGE o INTERNSHIP: la sezione deve mostrare i tre gruppi
4. Aprire una pagina di tipo EVENT o SUMMER_SCHOOL: la sezione non deve apparire
5. Aprire una pagina STAGE con `contextualizedSkills: []` e nessun dato accademico né lingue: la sezione non deve apparire
6. Verificare che il gruppo Lingue mostri sia l'inglese (da `requiredEnglishLevel`) che eventuali lingue aggiuntive (da `requiredLanguages`)
