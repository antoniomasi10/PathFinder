# Fase 2 — Backbone Binario 1 per categoria (PF-118) — Design

**Status:** Draft — C0 compliance verificata sul campo, scope rivisto rispetto all'outline originale
**Date:** 2026-07-04
**Branch:** PF-118
**Parent spec:** `2026-07-04-opportunity-expansion-10k-design.md` (§ Fase 2, outline)
**Author:** Marco (with Claude Code)

## Obiettivo

Dare un importer dedicato per le categorie ancora scarse (hackathon, fellowship, summer
school, eventi), ciascuno con gate C0 (robots.txt + ToS) verificato **prima** di `ENABLED`,
seguendo esattamente il contratto d'ingestione esistente (`OpportunityRecord[]` →
`batchUpsertOpportunities` → `markStaleOpportunities`). Nessuna pipeline nuova.

## Cosa è cambiato rispetto all'outline originale

L'outline in `2026-07-04-opportunity-expansion-10k-design.md` (§ Binario 1) elencava le
associazioni studentesche (ESN, AEGEE, ELSA, BEST, IAESTE, AIESEC) come prima fonte per
la categoria eventi, assumendo che ciascuna esponesse un feed/API centralizzato. **Verificato
sul campo (C0 + ricognizione tecnica), questo non regge per la maggior parte:**

- **ESN** (`esn.org/rss.xml`) e **AEGEE** (`aegee.org/feed/`) espongono solo il feed
  news/blog dell'organizzazione europea (comunicati, report, "AEGEE Day 2026"), non un
  calendario eventi strutturato. Gli eventi reali (scambi, workshop, feste culturali) vivono
  sui siti delle **sezioni locali** (decine di domini indipendenti per associazione, es.
  ESN Milano, ESN Bologna, ESN Torino…) — è un problema di **long-tail per categoria**,
  cioè esattamente il caso d'uso di Fase 3 (`HarvestTarget` + category-discovery), non un
  singolo importer Fase 2.
- **AIESEC**: nessuna pagina `/opportunities` o `/opportunity` all'apex domain (redirect a
  404); il vero marketplace opportunità vive probabilmente su un sotto-dominio/app dedicato,
  non ancora identificato. Richiede discovery aggiuntiva prima di poter scrivere un importer.
- **EURAXESS**: **ESCLUSA**. Il suo `robots.txt` disabilita esplicitamente `/jobs/*` (le
  liste fellowship/job) e `*/api/*` + `*/rest/*` (qualunque endpoint JSON:API/REST). Trovato
  verificando C0 con un parser di robots.txt che nella verifica si è rivelato **bacato** (vedi
  sotto) — con il fix, il blocco emerge chiaramente. Nessun'alternativa scraping legittima su
  questo dominio; l'unica via compliant sarebbe un dataset ufficiale open-data (es.
  data.europa.eu) se EURAXESS ne pubblica uno — da verificare separatamente, fuori scope qui.
- **MLH** (Major League Hacking): **ESCLUSA**. ToS analizzata dall'LLM: "Terms prohibit
  modification and exploitation of site content" — violazione esplicita.
- **SummerSchoolsInEurope.eu**: `robots.txt` consente il crawling generico ma **esclude
  esplicitamente i bot AI per nome** (`GPTBot`, `ChatGPT-User`, `Google-Extended`,
  `ClaudeBot`, `PerplexityBot`, `CCBot`). Il nostro bot usa uno user-agent proprio
  (`COhA-ImportBot`), quindi la regola non ci blocca tecnicamente, ma il segnale d'intento
  del sito ("non vogliamo essere usati per training/estrazione AI") va rispettato nello
  spirito: **niente estrazione via LLM su questa fonte**, solo parsing strutturato
  (HTML/microdata) se disponibile. ToS non verificabile in automatico (fetch diretto → 403,
  probabile bot-protection generico) — richiede verifica manuale prima di `ENABLED`.
- **IAESTE**: `robots.txt` disabilita esplicitamente `/internships/` — la sezione di valore
  per noi è bloccata. Altre sezioni (news) sarebbero permesse ma a basso valore. Skip.
- **BEST**: già `DISABLED` in `SOURCES.md` (serve contatto info@best.eu.org) — non ri-verificato qui.
- **ELSA**: robots.txt assente (404 → trattato come consentito), ToS pulita, ma nessun feed
  eventi trovato in questa ricognizione — da approfondire quando si arriva a implementarla
  (probabilmente stesso pattern ESN/AEGEE: eventi nelle sezioni nazionali/locali).

**Fonti pulite e con un pattern di accesso concreto, in ordine di prontezza:**

| Fonte | Categoria | Access | robots.txt | ToS | Note |
|---|---|---|---|---|---|
| **Devfolio** | Hackathon | Structured, 0 LLM — `__NEXT_DATA__` JSON embedded in `devfolio.co/hackathons` | ✅ allowed (`Disallow:` vuoto) | ✅ nessuna menzione scraping | Candidato pronto e verificato (vedi sotto): niente API da reverse-engineerare, i dati sono già nel payload SSR della pagina |
| **AIESEC** | Volontariato/Global Volunteer | da determinare | ✅ allowed | ⚠️ pagina ToS non trovata (verificare manualmente) | Serve discovery del vero marketplace opportunità |
| **SummerSchoolsInEurope** | Summer school | Scrape (no LLM) | ✅ allowed (ma opt-out bot AI espliciti) | ⚠️ 403 su fetch diretto, riverificare | Solo parsing strutturato, mai LLM extraction |
| ~~EURAXESS~~ | ~~Fellowship~~ | — | ❌ blocca `/jobs/*` e `/api/*` | — | **EXCLUDED** |
| ~~MLH~~ | ~~Hackathon~~ | — | ✅ | ❌ vieta modifica/sfruttamento contenuti | **EXCLUDED** |
| ~~ESN~~ / ~~AEGEE~~ | ~~Eventi~~ | — | ✅ | ✅ | Feed solo news, non eventi → rimandato a Fase 3 (long-tail per sezione locale) |

## Bug trovato durante la verifica C0 (già corretto, fuori da questo spec)

Il parser `isAllowedByRobots` in `compliance.ts` aveva due difetti che facevano risultare
"consentito" scraping in realtà vietato dal robots.txt reale:
1. I pattern con wildcard (`Disallow: /jobs/*`) erano trattati come stringa letterale
   (`path.startsWith(p)`), quindi non scattavano mai.
2. Le righe vuote **dentro** un blocco `User-agent: *` (spaziatura visiva comune nei
   robots.txt generati da CMS, come su `euraxess.ec.europa.eu`) venivano trattate come fine
   del blocco, scartando silenziosamente ogni regola successiva nel file.

Corretto con pattern-matching con wildcard/`$` + "longest match wins" (RFC 9309) e parsing
dei blocchi che non si chiude più su riga vuota. 9 test di regressione in
`robots-pattern.test.ts`. **Impatto:** questo bug riguardava il gate usato da *ogni* fonte
(CompanyWatchlist incluso), non solo EURAXESS — è quindi una correzione di correttezza
trasversale, non specifica a Fase 2.

## Fonti fuori scope per questo spec (serve altra ricognizione)

- **Fellowship**: con EURAXESS esclusa, la categoria resta scoperta. Il design originale
  elencava anche EU Funding & Tenders/Erasmus+ (open-data), Opportunity Desk (già `ENABLED`,
  aggiungere feed), DAAD, ProFellow/Scholars4dev — nessuno ancora verificato C0 in questa
  sessione. Prossimo passo naturale prima di implementare fellowship.
- **AIESEC**, **ELSA**: servono discovery aggiuntiva (endpoint/sotto-dominio reale) prima di
  poter scrivere un importer.

## Scope implementabile ora

Solo **Devfolio (hackathon)** ha oggi: gate C0 verde, categoria chiaramente scoperta (7 live
su target ~800), e un pattern di accesso concreto e già verificato — `devfolio.co/hackathons`
è una pagina Next.js SSR che incorpora l'intero risultato in un `<script id="__NEXT_DATA__">`:
`props.pageProps.dehydratedState.queries[0].state.data` contiene `open_hackathons` (18 al
momento della verifica), `upcoming_hackathons` (2), `past_hackathons`, `featured_hackathons`,
ciascuno con `uuid, slug, name, type, starts_at, ends_at, is_online, timezone,
participants_count, themes[], settings.site (URL esterno), settings.reg_starts_at/reg_ends_at`.
Nessun'API da reverse-engineerare, zero LLM: un semplice fetch + regex/JSON.parse sul tag
script, esattamente come già fa `parseRSSFeed()` per i feed XML.

**Resa attesa onesta:** Devfolio è fortemente India-centrico (quasi tutti timezone
`Asia/Calcutta`/`Asia/Kolkata`, eventi in presenza). Sugli hackathon verificati, solo
**~5 su 20 sono `is_online: true`** (remote) — gli altri, essendo in presenza fuori Italia/UE
e HACKATHON non essendo nel carve-out `isAbroad` (SUMMER_PROGRAM/FELLOWSHIP/EXCHANGE/EVENT),
**non sono IT-relevant** per la nostra definizione. Devfolio contribuisce quindi con un
piccolo numero di hackathon remoti (stima realistica: +5/+10 IT-relevant, non centinaia).
Va comunque importato — è gratis in termini di rischio/costo — ma il grosso del target
hackathon (~800) resta scoperto e richiede altre fonti europee non ancora verificate
(DoraHacks nell'outline originale, non controllata in questa sessione).

È l'unico pezzo di Fase 2 dettagliato a step eseguibili in questo giro (vedi implementation
plan). Il resto (AIESEC, SummerSchoolsInEurope, fellowship, altre fonti hackathon) resta
outline — richiede un altro round di ricognizione/endpoint-discovery prima di un piano
dettagliato, stessa convenzione già usata per Fase 0/1 vs Fase 2-4 nel piano padre.

## Testing

- **Integration:** importer Devfolio contro fixture registrata (nessuna rete in CI) →
  asserisce shape `OpportunityRecord`, `type: HACKATHON`, `country` derivato.
- **Compliance:** nessun cambiamento — riusa `checkRobotsTxt`/`findAndAnalyzeTos` già testati.
- **Manuale:** run singolo contro l'endpoint reale, verificare conteggio > 0 e `GET
  /import/coverage` per HACKATHON in crescita.

## Rischi e mitigazioni

- **Endpoint Devfolio non documentato ufficialmente** → può cambiare senza preavviso.
  Mitigazione: wrappare in try/catch con log esplicito, auto-disable dopo N fallimenti
  consecutivi (stesso pattern già usato per CompanyWatchlist), non bloccare l'import
  complessivo se questa sorgente fallisce.
- **SummerSchoolsInEurope: intento anti-AI del sito** → nessuna estrazione LLM su questa
  fonte anche se robots.txt tecnicamente lo permetterebbe; solo parsing strutturato. Se il
  sito non espone abbastanza struttura (no JSON-LD/microdata), la fonte resta rimandata.
- **Fellowship scoperta**: nessuna azione in questo spec; segnalato come gap noto, non
  nascosto dietro un numero di "10k" gonfiato.

## Fuori scope (YAGNI)

Nessun importer per ESN/AEGEE/MLH/EURAXESS/IAESTE/BEST in questo giro (esclusi o rimandati
per i motivi sopra). Nessuna modifica allo schema. Nessuna nuova infra — riuso del contratto
`batchUpsertOpportunities`/`markStaleOpportunities` esistente.
