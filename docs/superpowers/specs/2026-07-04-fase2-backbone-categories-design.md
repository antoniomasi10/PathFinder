# Fase 2 — Backbone Binario 1 per categoria (PF-118) — Design

**Status:** Draft — C0 compliance verificata sul campo, scope rivisto rispetto all'outline
originale. Round 1: Devfolio (Slice A) implementato ed `ENABLED`. Round 2 (2026-07-08):
Slice B/C/D ricognite a fondo, nessuna pronta per implementazione — vedi § Ricognizione
round 2 per i blocchi specifici trovati.
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

---

## Ricognizione round 2 (2026-07-08) — Slice B/C/D

Dopo Devfolio (implementato, vedi implementation plan), ricognizione dedicata sulle tre
slice lasciate outline. Conclusione per tutte e tre: **nessuna pronta per un implementation
plan a step eseguibili in questo giro**, ma per motivi diversi e più concreti di "serve
altra ricognizione" — ognuna ha ora un blocco tecnico specifico e verificato.

### Slice B — AIESEC: endpoint trovato, ma protetto

Trovato il vero sistema dati dietro `aiesec.org` (Next.js App Router, non più il vecchio
sito): un sitemap dinamico pubblico, `aiesec.org/server-sitemap.xml`, elenca **2.987 URL**
opportunità nel pattern `/opportunity/{global-volunteer|global-talent|global-teacher}/{id}`
(1.160 / 1.363 / 464 rispettivamente) — nessun bisogno di un motore di ricerca o browser
headless per enumerare le opportunità esistenti. `robots.txt` è permissivo (`Allow: /`,
nessun blocco).

Il problema è a valle: le pagine di dettaglio (es. `/opportunity/global-volunteer/1337668`)
**non contengono dati strutturati nell'HTML iniziale** (niente JSON-LD, niente
`__NEXT_DATA__` — è React Server Components/RSC streaming). Il body reale è idratato lato
client con una chiamata autenticata a `gis-api.aiesec.org` (confermato: root risponde
`{"project":"gis"}`; `POST /v2/opportunities.json` risponde `{"error":"Unauthorized"}`,
HTTP 402 — richiede credenziali app che non abbiamo e nessuna chiave pubblica è esposta nei
bundle JS ispezionati). L'unico dato server-rendered (quindi scrapabile senza JS) sono i tag
SEO — `<title>` e `<meta name="description">`, cioè **solo titolo + descrizione libera**,
senza location/date/durata/formato — non abbastanza per un `OpportunityRecord` decente
(niente `startDate`/`endDate`, niente su cui basare `isAbroad`/`country`).

**Conclusione:** bloccata, ma non più per "serve trovare l'endpoint" (trovato) — per
mancanza di credenziali API o di un vero browser headless (assente in questo ambiente/
sessione) capace di leggere il DOM post-idratazione. Sblocco richiede una di due cose fuori
dallo scope di un giro di implementazione:
1. Richiesta di accesso API ufficiale ad AIESEC (azione di outreach, non tecnica).
2. Un headless browser reale (Playwright/Puppeteer) per leggere i dati come li vede un
   visitatore anonimo — da rivalutare se/quando questo strumento sarà disponibile.

### Slice C — SummerSchoolsInEurope: ToS pulita, ma WAF blocca il fetch semplice

Verificato via fetch reale (non solo lettura): homepage e pagine interne rispondono
**403 Cloudflare** a qualunque client HTTP semplice (curl, con o senza User-Agent da
browser) — è Cloudflare Bot Management (cookie `__cf_bm`, header `cf-ray`), non un blocco
mirato al nostro user-agent. Una fetch tramite un altro canale (rendering-capable) ha
invece letto il contenuto: pagina `/disclaimer/` **non menziona scraping/automated access**
(solo boilerplate "nessun diritto derivabile dal contenuto"), e una pagina corso
(`/course/project-management-from-theory-to-practice/`) mostra tutti i campi utili in HTML
semplice — titolo, date, città/paese, durata, costo, deadline, lingua, organizzatore — ma
**senza JSON-LD/microdata**: sarebbe comunque necessario un parser HTML su misura (pattern
già usato altrove nel repo, es. `stage4eu.import.ts`), non l'approccio "zero-touch" di
Devfolio.

**Conclusione:** il punto non è più legale/strutturale (ToS pulita, campi ricavabili via
regex) ma **infrastrutturale**: il nostro `fetchWithRetry` (fetch Node.js semplice, stesso
meccanismo usato in produzione da ogni importer) riceverebbe lo stesso 403 che ho ricevuto
da curl — non arriverebbe mai ai dati. Costruire un importer contro una fonte che sappiamo
già irraggiungibile dal nostro stack non ha senso. Resta rimandata, non per policy ma per
un blocco tecnico verificato; da rivalutare solo se cambia il meccanismo di fetch usato in
produzione (es. proxy/rendering service dedicato in Fase 3).

### Slice D — Fellowship: trovata un'API ufficiale pubblica, serve un altro giro di filtri

L'EU Funding & Tenders Portal (sostituto candidato di EURAXESS) espone una search API
pubblica reale e **senza autenticazione**: `POST
https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA` (la "SEDIA" API,
documentata in giro come componente ufficiale del portale — `apiKey=SEDIA` è una costante
pubblica, non un segreto). Verificata con una chiamata reale: risponde con JSON strutturato
reale (milioni di risultati indicizzati — FAQ, eventi, "topic"/call, documenti — ciascuno
con metadata ricchi: programma, date, deadline, lingua, tipo contenuto).

Non ancora risolto: il portale copre **tutto** il funding EU (soprattutto bandi
istituzionali per organizzazioni/università/aziende), non solo fellowship individuali per
studenti. Le query di prova hanno restituito prevalentemente FAQ (`DATASOURCE: SEDIA_FAQ`)
invece delle call vere per problemi di ranking/filtro, non ancora isolato il filtro
`type`/`status`/`DATASOURCE` corretto per isolare solo i "topic" di tipo call-for-proposals
individuali (es. Marie Skłodowska-Curie Postdoctoral Fellowships, che sono aperte a singoli
ricercatori/dottorandi, a differenza della maggioranza dei bandi del portale).

**Conclusione:** candidato più promettente delle tre — API ufficiale, pubblica, C0 verde,
in linea con "open-data prima di scrape+gate" — ma **non pronto per un implementation plan**
finché non si isola la combinazione di filtri che restituisce solo le call individuali
rilevanti (prossimo passo naturale, reconnaissance pura, nessun rischio compliance). DAAD e
ProFellow/Scholars4dev non ulteriormente esplorati in questo giro — deprioritizzati rispetto
a SEDIA che è già un'API ufficiale funzionante.

### Riepilogo stato dopo round 2

| Slice | Blocco | Tipo di blocco | Prossimo passo (fuori scope qui) |
|---|---|---|---|
| B — AIESEC | Dati dietro API autenticata (`gis-api.aiesec.org`) | Mancanza credenziali / no headless browser | Outreach API ufficiale, o headless browser quando disponibile |
| C — SummerSchoolsInEurope | WAF Cloudflare blocca fetch semplice | Infrastrutturale (non legale) | Rivalutare solo con meccanismo di fetch diverso (Fase 3?) |
| D — Fellowship (SEDIA API) | Filtro corretto per call individuali non ancora isolato | Reconnaissance incompleta, nessun rischio compliance | Altro giro di query di prova sulla search API per isolare `type`/`DATASOURCE` dei topic MSCA-style |

Nessuna delle tre è quindi implementabile a step eseguibili in questo giro. La più vicina è
D (SEDIA API) — un ulteriore giro di ricognizione pura (query API, zero scraping, zero
rischio) potrebbe sbloccarla per un implementation plan dedicato.
