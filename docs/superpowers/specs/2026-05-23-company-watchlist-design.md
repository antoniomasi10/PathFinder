# Company Watchlist Importer — Design Spec

**Data:** 2026-05-23  
**Obiettivo:** Colmare i buchi nel catalogo opportunità aggiungendo aziende italiane medio-grandi che non usano i 6 ATS già supportati, tramite scraping LLM-assisted delle loro pagine careers con verifica automatica di robots.txt e ToS.

---

## Contesto

Il sistema di import attuale ha 24 fonti attive. Le fonti ATS (Greenhouse, Lever, Ashby, Workable, Personio, SmartRecruiters) funzionano con una lista curata di aziende. Aziende come Barilla usano Workday o siti careers custom — non vengono mai importate. Il gap è sistematico: nessun meccanismo per monitorare aziende fuori dai 6 ATS supportati.

**Workday è escluso** per ToS (come già Devpost, Bundesagentur, ecc.).

---

## Architettura

### Nuovo modello DB: `CompanyWatchlist`

```prisma
model CompanyWatchlist {
  id                String    @id @default(cuid())
  name              String
  careersUrl        String    @unique
  sector            String
  tier              String    // "large" | "medium"

  robotsAllowed     Boolean?
  robotsCheckedAt   DateTime?

  tosAllowed        Boolean?
  tosAnalyzedAt     DateTime?
  tosNotes          String?
  tosPageNotFound   Boolean   @default(false)

  lastSyncedAt      DateTime?
  isActive          Boolean   @default(true)
  addedBy           String?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

### Nuovo file: `backend/src/services/import/company-watchlist.import.ts`

Funzioni principali:

**`checkRobotsTxt(careersUrl: string): Promise<boolean>`**
- Fetch `<origin>/robots.txt`
- Parsea regole `User-agent: *` e `User-agent: Googlebot` (proxy per permissività)
- Controlla se `Disallow: /` o il path careers è vietato
- Se robots.txt non raggiungibile → `true` (benefit of the doubt, log warning)

**`findAndAnalyzeTos(careersUrl: string): Promise<{ allowed: boolean|null, notes: string, pageNotFound: boolean }>`**
- Fetch homepage del dominio
- Cerca link ToS con pattern: `/terms`, `/legal`, `/tos`, `/privacy-policy`, `/termini`
- Fetch pagina ToS (strip HTML, max 8k token)
- Chiama OpenAI con prompt dedicato → `{ allowed: boolean, confidence: "high"|"medium"|"low", reason: string }`
- Se pagina non trovata: `{ allowed: null, pageNotFound: true }`

**`extractOpportunitiesWithLLM(html: string, company: CompanyWatchlist): Promise<RawOpportunity[]>`**
- Strip HTML a testo leggibile (rimuove script, style, nav, footer)
- Se > 12k token: estrae solo `<main>` o `<body>` principale
- Chiama OpenAI con prompt di estrazione
- Filtra per keyword studentesche (stesso set degli altri importer)
- Output: array `{ title, url, location, type, deadline? }`

**`importCompanyWatchlistOpportunities(): Promise<void>`**
- Per ogni azienda `isActive: true`:
  - Re-check robots+ToS se `checkedAt > 30 giorni fa`
  - Skip se `robotsAllowed: false` o `tosAllowed: false`
  - Skip se `tosAllowed: null` (pending review)
  - Fetch careers page HTML
  - `extractOpportunitiesWithLLM()`
  - `validateOpportunity()` (Zod, schema esistente)
  - `batchUpsertOpportunities()` (funzione esistente)
  - Aggiorna `lastSyncedAt`

### Prompt LLM

**Prompt ToS:**
```
You are a legal compliance assistant. Read the following Terms of Service text and determine 
whether automated/programmatic access, web scraping, or crawling of this website is 
explicitly prohibited.

Answer with JSON only: { "allowed": true|false, "confidence": "high"|"medium"|"low", "reason": "..." }

- "allowed: false" only if there is EXPLICIT prohibition of scraping/crawling/automated access
- "allowed: true" if silent or permissive
- Keep "reason" under 100 characters

Terms of Service:
{tosText}
```

**Prompt estrazione opportunità:**
```
You are a job listing extractor. Extract all student-relevant positions from this careers page HTML.
Only include: internship, stage, tirocinio, trainee, apprenticeship, graduate program, junior roles.

Return JSON array only: [{ "title": "...", "url": "...", "location": "...", "type": "INTERNSHIP|STAGE|FELLOWSHIP|EXTRACURRICULAR", "deadline": "YYYY-MM-DD or null" }]

If no relevant positions found, return empty array [].
Company: {companyName}

HTML:
{html}
```

### Admin endpoints (aggiunto a `import.routes.ts`)

```
GET    /api/import/watchlist          — lista aziende con stato compliance
POST   /api/import/watchlist          — aggiunge azienda + triggera check robots+ToS
PATCH  /api/import/watchlist/:id      — update (override manuale tosAllowed, isActive)
DELETE /api/import/watchlist/:id      — rimuove azienda
POST   /api/import/watchlist/run      — trigger manuale import (admin only)
```

### Scheduler

```typescript
// Mercoledì 05:30 — non sovrapposto agli altri importer
cron.schedule('30 5 * * 3', () => runWithAlert('company-watchlist', importCompanyWatchlistOpportunities))
```

---

## Seed: 185 aziende italiane

### Moda & Lusso (25)
| Nome | Tier | URL careers |
|---|---|---|
| Gucci | large | https://www.gucci.com/it/en/st/careers-landing |
| Prada Group | large | https://www.pradagroup.com/en/careers.html |
| Giorgio Armani | large | https://www.armani.com/en/careers |
| Versace | large | https://www.versace.com/en-us/careers/ |
| Valentino | large | https://www.valentino.com/en/careers |
| Fendi | large | https://www.fendi.com/en/careers |
| Moncler | large | https://www.monclergroup.com/en/careers |
| Bulgari | large | https://www.bulgari.com/en-it/careers.html |
| Salvatore Ferragamo | medium | https://www.ferragamo.com/en-it/careers |
| Ermenegildo Zegna | medium | https://www.zegnagroup.com/en/careers/ |
| Tod's Group | medium | https://www.todsgroup.com/en/careers |
| OTB Group | medium | https://careers.otbgroup.com/ |
| Calzedonia Group | medium | https://careers.calzedoniagroup.com/ |
| Max Mara | medium | https://www.maxmara.com/en/careers |
| Furla | medium | https://www.furla.com/it/en/careers |
| Pinko | medium | https://www.pinko.com/careers |
| Liu Jo | medium | https://www.liujo.com/en/careers |
| Golden Goose | medium | https://careers.goldengoose.com/ |
| Brunello Cucinelli | medium | https://www.brunellocucinelli.com/en/careers |
| Etro | medium | https://www.etro.com/en/careers |
| Marni | medium | https://www.marni.com/en-it/careers |
| Replay | medium | https://www.fashionbox.com/careers |
| Patrizia Pepe | medium | https://www.patriziapepe.com/en/careers |
| Kiton | medium | https://www.kiton.com/en/careers |
| Stefanel | medium | https://www.stefanel.com/en/careers |

### Food & Beverage (20)
| Nome | Tier | URL careers |
|---|---|---|
| Barilla Group | large | https://jobs.barillagroup.com/ |
| Ferrero | large | https://www.ferrerocareers.com/ |
| Lavazza | large | https://careers.lavazza.com/ |
| Campari Group | large | https://careers.camparigroup.com/ |
| Cremonini Group | large | https://www.cremonini.com/lavora-con-noi/ |
| Giovanni Rana | medium | https://www.giovannirana.com/lavora-con-noi |
| Mutti | medium | https://www.mutti-parma.com/it/lavora-con-noi |
| Illy Caffè | medium | https://www.illy.com/it-it/careers |
| De Cecco | medium | https://www.dececco.com/careers |
| Surgital | medium | https://www.surgital.it/lavora-con-noi |
| Amadori | medium | https://www.amadori.it/careers |
| Granarolo | medium | https://www.granarolo.it/careers |
| Fratelli Beretta | medium | https://www.fratelliберetта.com/careers |
| Caffè Borbone | medium | https://www.caffeborbone.com/lavora-con-noi |
| Sanpellegrino | medium | https://www.sanpellegrino.com/careers |
| Acetum | medium | https://www.acetum.it/lavora-con-noi |
| Conserve Italia | medium | https://www.conserveitalia.it/careers |
| Eataly | medium | https://www.eataly.com/careers |
| Sammontana | medium | https://www.sammontana.it/careers |
| Zuegg | medium | https://www.zuegg.com/careers |

### Tech & Consulting (25)
| Nome | Tier | URL careers |
|---|---|---|
| Reply | large | https://www.reply.com/en/careers |
| Engineering Group | large | https://careers.eng.it/ |
| Accenture Italy | large | https://www.accenture.com/it-it/careers |
| NTT Data Italy | large | https://it.nttdata.com/careers |
| Capgemini Italy | large | https://www.capgemini.com/it-it/careers/ |
| Deloitte Italy | large | https://www2.deloitte.com/it/it/careers.html |
| EY Italy | large | https://www.ey.com/it_it/careers |
| KPMG Italy | large | https://home.kpmg/it/it/home/careers.html |
| PwC Italy | large | https://www.pwc.com/it/it/careers.html |
| IBM Italy | large | https://www.ibm.com/it-it/employment/ |
| Bending Spoons | medium | https://bendingspoons.com/careers.html |
| Satispay | medium | https://jobs.satispay.com/ |
| Scalapay | medium | https://www.scalapay.com/en/careers |
| Musixmatch | medium | https://musixmatch.com/careers |
| Prima Assicurazioni | medium | https://careers.prima.it/ |
| Facile.it | medium | https://careers.facile.it/ |
| Talent Garden | medium | https://talentgarden.com/careers |
| Jakala | medium | https://jakala.com/careers |
| Almaviva | medium | https://www.almaviva.it/careers |
| Lutech | medium | https://www.lutech.group/careers |
| Var Group | medium | https://www.vargroup.com/careers |
| TeamSystem | medium | https://www.teamsystem.com/careers |
| Exprivia | medium | https://www.exprivia.com/careers |
| InfoCert | medium | https://www.infocert.it/careers |
| Relatech | medium | https://www.relatech.com/careers |

### Energia & Utilities (15)
| Nome | Tier | URL careers |
|---|---|---|
| ENI | large | https://eni.com/en-IT/careers.html |
| Enel | large | https://corporate.enel.it/en/careers |
| Edison | large | https://www.edison.it/en/careers |
| Snam | large | https://careers.snam.com/ |
| Terna | large | https://careers.terna.it/ |
| A2A | medium | https://careers.a2a.eu/ |
| Hera Group | medium | https://careers.gruppohera.it/ |
| Iren | medium | https://careers.gruppoiren.it/ |
| ERG | medium | https://www.erg.eu/careers |
| Italgas | medium | https://careers.italgas.it/ |
| ACEA | medium | https://careers.acea.it/ |
| Saras | medium | https://www.saras.it/careers |
| Falck Renewables | medium | https://www.falckrenewables.eu/careers |
| Alperia | medium | https://www.alperia.eu/careers |
| Dolomiti Energia | medium | https://www.dolomiti.it/careers |

### Banking, Finance & Assicurazioni (20)
| Nome | Tier | URL careers |
|---|---|---|
| Intesa Sanpaolo | large | https://careers.intesasanpaolo.com/ |
| UniCredit | large | https://careers.unicredit.eu/ |
| Generali | large | https://www.generali.com/careers |
| Poste Italiane | large | https://www.posteitaliane.it/careers |
| Mediobanca | large | https://www.mediobanca.com/careers |
| FinecoBank | medium | https://careers.fineco.com/ |
| BNL | medium | https://careers.bnl.it/ |
| Banco BPM | medium | https://careers.bancobpm.it/ |
| Nexi | medium | https://careers.nexigroup.com/ |
| Azimut | medium | https://careers.azimut.it/ |
| Banca Mediolanum | medium | https://careers.bancamediolanum.it/ |
| Unipol | medium | https://careers.unipol.it/ |
| Allianz Italy | medium | https://careers.allianz.com/it/ |
| AXA Italy | medium | https://careers.axa.it/ |
| Zurich Italy | medium | https://careers.zurich.com/it/ |
| Credem | medium | https://careers.credem.it/ |
| Banca Sella | medium | https://careers.sella.it/ |
| doValue | medium | https://careers.dovalue.com/ |
| Cattolica Assicurazioni | medium | https://careers.cattolica.it/ |
| Cassa Depositi e Prestiti | large | https://careers.cdp.it/ |

### Pharma & Healthcare (15)
| Nome | Tier | URL careers |
|---|---|---|
| Menarini Group | large | https://careers.menarini.com/ |
| Recordati | large | https://careers.recordati.com/ |
| Chiesi Farmaceutici | large | https://careers.chiesi.com/ |
| Angelini Pharma | large | https://careers.angelinipharma.com/ |
| Bracco | medium | https://careers.bracco.com/ |
| Dompé | medium | https://careers.dompe.com/ |
| Zambon | medium | https://careers.zambon.com/ |
| Alfasigma | medium | https://careers.alfasigma.com/ |
| Italfarmaco | medium | https://www.italfarmaco.com/careers |
| Sifi | medium | https://www.sifi.it/careers |
| Biofarma | medium | https://www.biofarma.it/careers |
| Kedrion | medium | https://careers.kedrion.com/ |
| Nerviano Medical Sciences | medium | https://careers.nervianoms.com/ |
| Polifarma | medium | https://www.polifarma.it/careers |
| GVM Care & Research | medium | https://careers.gvmnet.it/ |

### Automotive & Manifatturiero (15)
| Nome | Tier | URL careers |
|---|---|---|
| Ferrari | large | https://careers.ferrari.com/ |
| Lamborghini | large | https://careers.lamborghini.com/ |
| Ducati | large | https://careers.ducati.com/ |
| Brembo | large | https://careers.brembo.com/ |
| Fincantieri | large | https://careers.fincantieri.com/ |
| Pirelli | large | https://careers.pirelli.com/ |
| Saipem | large | https://careers.saipem.com/ |
| Webuild | large | https://careers.webuild.com/ |
| Pininfarina | medium | https://careers.pininfarina.com/ |
| Interpump Group | medium | https://careers.interpump.it/ |
| IMA Group | medium | https://careers.ima.it/ |
| Datalogic | medium | https://careers.datalogic.com/ |
| SCM Group | medium | https://careers.scmgroup.com/ |
| Ariston Group | medium | https://careers.aristongroup.com/ |
| De'Longhi Group | medium | https://careers.delonghigroup.com/ |

### Retail & Ecommerce (15)
| Nome | Tier | URL careers |
|---|---|---|
| Esselunga | large | https://careers.esselunga.it/ |
| YOOX Net-A-Porter | large | https://careers.ynap.com/ |
| Autogrill | large | https://careers.autogrill.com/ |
| Amplifon | large | https://careers.amplifon.com/ |
| Subito.it | medium | https://careers.subito.it/ |
| Idealista Italy | medium | https://careers.idealista.it/ |
| Immobiliare.it | medium | https://careers.immobiliare.it/ |
| Doctolib Italy | medium | https://careers.doctolib.fr/it/ |
| Leroy Merlin Italy | medium | https://careers.leroymerlin.it/ |
| Decathlon Italy | medium | https://careers.decathlon.com/it/ |
| OVS | medium | https://careers.ovs.it/ |
| Unieuro | medium | https://careers.unieuro.it/ |
| Pittarosso | medium | https://careers.pittarosso.it/ |
| Euronics Italy | medium | https://careers.euronics.it/ |
| Tigotà | medium | https://careers.tigota.it/ |

### Media & Sport (15)
| Nome | Tier | URL careers |
|---|---|---|
| RAI | large | https://www.rai.it/lavora-con-noi/ |
| Mediaset | large | https://careers.mediaset.it/ |
| Sky Italia | large | https://careers.sky.it/ |
| Mondadori | large | https://careers.mondadori.com/ |
| RCS MediaGroup | large | https://careers.rcsmediagroup.it/ |
| GEDI | medium | https://careers.gedi.it/ |
| Il Sole 24 Ore | medium | https://careers.ilsole24ore.com/ |
| Juventus | medium | https://careers.juventus.com/ |
| FC Internazionale | medium | https://careers.inter.it/ |
| AC Milan | medium | https://careers.acmilan.com/ |
| AS Roma | medium | https://careers.asroma.it/ |
| Condé Nast Italy | medium | https://careers.condenast.com/it/ |
| Hearst Italy | medium | https://careers.hearst.it/ |
| Discovery Italy | medium | https://careers.discovery.com/it/ |
| Cairo Communication | medium | https://careers.cairo.it/ |

### Infrastrutture, Difesa & Altro (15)
| Nome | Tier | URL careers |
|---|---|---|
| Leonardo | large | https://careers.leonardo.com/ |
| TIM | large | https://careers.tim.it/ |
| Ferrovie dello Stato | large | https://careers.fsgrouppeople.com/ |
| Autostrade per l'Italia | large | https://careers.autostrade.it/ |
| Stellantis Italy | large | https://careers.stellantis.com/it/ |
| Prysmian | large | https://careers.prysmiangroup.com/ |
| ITA Airways | medium | https://careers.ita-airways.com/ |
| Italo-NTV | medium | https://careers.italotreno.it/ |
| Costa Crociere | medium | https://careers.costacruises.com/ |
| MSC Crociere | medium | https://careers.msc.com/ |
| Fiera Milano | medium | https://careers.fieramilano.it/ |
| Maire Tecnimont | medium | https://careers.mairetecnimont.com/ |
| Danieli | medium | https://careers.danieli.com/ |
| Tenaris | medium | https://careers.tenaris.com/ |
| Alpitour | medium | https://careers.alpitourworld.com/ |

---

## Gestione errori

| Scenario | Comportamento |
|---|---|
| robots.txt irraggiungibile | `robotsAllowed: true` + log warning, riprova al prossimo ciclo |
| robots.txt vieta scraping | `robotsAllowed: false`, azienda saltata silenziosamente |
| Pagina ToS non trovata | `tosAllowed: null, tosPageNotFound: true`, pending manual review |
| ToS vieta scraping | `tosAllowed: false`, azienda saltata silenziosamente |
| OpenAI errore/timeout | Retry 1 volta, poi `alertImportFailure()` (sistema esistente) |
| 0 opportunità trovate | Normale, nessun alert |
| Errore fetch careers page | Log error, skip azienda, continua con le altre |

Ogni azienda fallisce in isolamento. Re-check robots+ToS ogni 30 giorni.

---

## File da creare/modificare

| File | Azione |
|---|---|
| `backend/prisma/schema.prisma` | Aggiunge modello `CompanyWatchlist` |
| `backend/prisma/migrations/` | Nuova migration |
| `backend/src/services/import/company-watchlist.import.ts` | Nuovo importer |
| `backend/prisma/seeds/company-watchlist.ts` | Seed 185 aziende |
| `backend/src/services/import/scheduler.ts` | Aggiunge cron mercoledì 05:30 |
| `backend/src/routes/import.routes.ts` | Aggiunge 5 endpoint watchlist |

---

## Verifica end-to-end

1. `npm run db:migrate` — verifica migration pulita
2. `npx ts-node prisma/seeds/company-watchlist.ts` — verifica seed (185 record)
3. `POST /api/import/watchlist` con una singola azienda test → verifica robots+ToS check
4. `POST /api/import/watchlist/run` con override azienda singola → verifica estrazione LLM
5. Controlla DB: opportunità create con `source='company-watchlist'`
6. `tsc --noEmit` — zero errori TypeScript
