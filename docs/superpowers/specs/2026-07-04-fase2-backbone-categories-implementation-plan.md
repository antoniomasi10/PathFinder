# Fase 2 — Backbone Binario 1 per categoria — Implementation Plan

**Date:** 2026-07-04
**Branch:** PF-118
**Spec:** `2026-07-04-fase2-backbone-categories-design.md`

## Overview

Solo lo slice **Devfolio (hackathon)** è dettagliato a step eseguibili — è l'unica fonte
verificata con gate C0 verde e un pattern di accesso concreto in questo giro (vedi spec §
Scope implementabile ora). AIESEC, SummerSchoolsInEurope, fellowship restano outline: vanno
dettagliate in un piano proprio quando si chiude la loro ricognizione (endpoint AIESEC,
riverifica ToS SummerSchoolsInEurope, fonte fellowship alternativa a EURAXESS).

Stesso contratto invariato: `OpportunityRecord[]` → `batchUpsertOpportunities()` →
`markStaleOpportunities(source, ids, …)`. Nessuna migration, nessuna modifica a `Opportunity`.

---

## Slice A — Devfolio hackathon importer (dettagliato)

### Step A.1 — Nuovo importer `devfolio.import.ts`

**File nuovo:** `backend/src/services/import/devfolio.import.ts`

Ricalca esattamente `hackclub.import.ts` (stesso importer già in produzione per la stessa
categoria HACKATHON): fetch HTML della pagina, estrazione del blob `__NEXT_DATA__`, mapping
a `OpportunityRecord[]`. Zero LLM — è JSON già strutturato lato server, non serve
`extractOpportunitiesWithLLM`.

```ts
/**
 * Devfolio Hackathon Import
 * Source: https://devfolio.co/hackathons (public listing page)
 *
 * No documented public API — the page is Next.js SSR and embeds the full result
 * set (open/upcoming/past/featured hackathons) as JSON in a <script id="__NEXT_DATA__">
 * tag. We parse that JSON directly; zero LLM, zero extra requests per hackathon.
 *
 * Legal basis: robots.txt fully permits (`Disallow:` empty); ToS makes no mention
 * of scraping/automated access (verified via findAndAnalyzeTos, 2026-07-04).
 *
 * Yield note: Devfolio is heavily India-centric (in-person events outside IT/EU).
 * Only `is_online: true` hackathons are IT-relevant under our definition (HACKATHON
 * is not in the isAbroad carve-out) — expect a small remote-only subset, not the
 * bulk of the category.
 *
 * Runs weekly (day/time TBD in scheduler.ts — see Step A.4), Tue 04:45 suggested
 * (adjacent to the existing developers-events/confstech slots).
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { fetchWithRetry } from './utils';

const LISTING_URL = 'https://devfolio.co/hackathons';
const SOURCE_KEY = 'devfolio';

interface DevfolioHackathon {
  uuid: string;
  slug: string;
  name: string;
  starts_at: string;
  ends_at: string;
  is_online: boolean;
  timezone: string;
  settings?: { site?: string | null; reg_starts_at?: string | null; reg_ends_at?: string | null };
}

function extractNextData(html: string): any | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function collectHackathons(nextData: any): DevfolioHackathon[] {
  const queries = nextData?.props?.pageProps?.dehydratedState?.queries ?? [];
  const seen = new Map<string, DevfolioHackathon>();
  for (const q of queries) {
    const data = q?.state?.data;
    if (!data || typeof data !== 'object') continue;
    for (const key of ['open_hackathons', 'upcoming_hackathons', 'featured_hackathons']) {
      const arr = data[key];
      if (Array.isArray(arr)) for (const h of arr) if (h?.uuid) seen.set(h.uuid, h);
    }
  }
  return [...seen.values()];
}

export async function importDevfolioOpportunities(): Promise<{
  imported: number; skipped: number; source: string;
}> {
  logger.info('[Devfolio] Starting hackathon import...');
  const now = new Date();
  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    const res = await fetchWithRetry(LISTING_URL, {
      timeoutMs: 20000,
      headers: { Accept: 'text/html' },
      logTag: '[Devfolio]',
    });
    if (!res.ok) throw new Error(`Listing fetch failed: HTTP ${res.status}`);

    const html = await res.text();
    const nextData = extractNextData(html);
    if (!nextData) throw new Error('__NEXT_DATA__ not found — page structure may have changed');

    const hackathons = collectHackathons(nextData);
    logger.info(`[Devfolio] Found ${hackathons.length} hackathons in listing`);

    let skipped = 0;
    const records: OpportunityRecord[] = [];

    for (const h of hackathons) {
      try {
        const startDate = new Date(h.starts_at);
        const endDate = new Date(h.ends_at);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { skipped++; continue; }

        const durationMs = endDate.getTime() - startDate.getTime();
        const durationDays = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)));
        const isRemote = !!h.is_online;
        // No structured country field from Devfolio — timezone is the only geo signal.
        // Do not guess a specific country from an IANA zone name (many share one zone);
        // leave country null and let the geo-backfill pass (utils.extractCountryCode)
        // resolve it later from location/organizer text if present.
        const url = h.settings?.site || `https://devfolio.co/hackathons/${h.slug}`;
        const sid = `devfolio-${h.uuid}`;
        const title = h.name.slice(0, 250);
        const description = [
          `Hackathon${isRemote ? ' online' : ' in presenza'} organizzato tramite Devfolio.`,
          h.settings?.reg_ends_at ? `Iscrizioni entro: ${h.settings.reg_ends_at}.` : null,
          `Maggiori informazioni: ${url}`,
        ].filter(Boolean).join(' ');

        const v = validateOpportunity({
          title,
          description,
          company: null,
          organizer: 'Devfolio',
          url,
          location: isRemote ? 'Online' : null,
          isAbroad: !isRemote, // in-person Devfolio hackathons are ~always outside IT
          isRemote,
          expiresAt: endDate,
          startDate,
          endDate,
          durationDays,
          format: isRemote ? 'ONLINE' : 'IN_PERSON',
          cost: 0,
          hasScholarship: false,
          eligibleFields: [],
        }, SOURCE_KEY);
        if (!v) { skipped++; continue; }

        records.push({
          id: sid,
          title,
          description,
          company: null,
          organizer: 'Devfolio',
          url,
          location: isRemote ? 'Online' : null,
          isAbroad: !isRemote,
          isRemote,
          type: 'HACKATHON',
          tags: ['hackathon', 'devfolio', ...(isRemote ? ['online'] : [])],
          postedAt: startDate,
          expiresAt: endDate,
          source: SOURCE_KEY,
          sourceId: sid,
          lastSyncedAt: now,
          startDate,
          endDate,
          durationDays,
          format: isRemote ? 'ONLINE' : 'IN_PERSON',
          cost: 0,
          hasScholarship: false,
          eligibleFields: [],
        });
      } catch (err) {
        logger.warn(`[Devfolio] Error processing "${h.name?.slice(0, 50)}": ${err}`);
        skipped++;
      }
    }

    await batchUpsertOpportunities(records);
    await markStaleOpportunities(SOURCE_KEY, records.map(r => r.id), { minSeenForStale: 3 });

    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'success', count: records.length, finishedAt: new Date(), metadata: { skipped, totalFetched: hackathons.length } },
    });
    logger.info(`[Devfolio] Imported ${records.length}, skipped ${skipped}`);
    return { imported: records.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[Devfolio] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
```

Nota su `minSeenForStale: 3`: la pagina lista tipicamente 15-20 hackathon insieme (open +
upcoming + featured); soglia bassa (analoga a HackClub) evita mass-expiry su un fetch parziale
temporaneo, ma non è così permissiva da non accorgersi mai di un cambio struttura pagina.

### Step A.2 — Route admin

**File:** `backend/src/routes/import.routes.ts`

Aggiungere accanto a `POST /hackclub` (riga ~154):
```ts
import { importDevfolioOpportunities } from '../services/import/devfolio.import';
// ...
router.post('/devfolio', ...adminAuth, async (_req: Request, res: Response) => {
  try { res.json(await importDevfolioOpportunities()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});
```

### Step A.3 — Includere in `POST /import/all` (opzionale)

Non obbligatorio al primo giro (HackClub/ConfsTech non sono tutti in `/all` oggi) — lasciare
fuori finché non ha girato in produzione per qualche settimana senza errori, poi aggiungerlo
insieme alla registrazione cron (Step A.4).

### Step A.4 — Wiring scheduler

**File:** `backend/src/services/import/scheduler.ts`

Aggiungere un cron settimanale nella fascia già usata per developers-events/confstech (Tue
notte), import + export:
```ts
import { importDevfolioOpportunities } from './devfolio.import';
// ...
cron.schedule('45 4 * * 2', () => {
  runWithAlert('Devfolio', 'devfolio', 'opportunities', () => importDevfolioOpportunities());
});
```

### Step A.5 — `SOURCES.md`

Aggiungere riga alla tabella `ENABLED sources`:
```
| **Devfolio** | `devfolio.import.ts` | Scrape (structured, 0 LLM) | ✅ allowed | ✅ allowed | — | Tue 04:45 | Hackathon listing; __NEXT_DATA__ JSON parse, no LLM |
```
E una riga nel "Compliance check log" con data odierna (2026-07-04) e verificatore.

### Test Slice A
- **Unit:** `extractNextData`/`collectHackathons` contro una fixture HTML registrata
  (salvare uno snapshot minimale della pagina, non l'HTML live) → verifica dedup per `uuid`
  tra `open_hackathons`/`upcoming_hackathons`/`featured_hackathons`.
- **Unit:** mapping `is_online` → `isRemote`/`isAbroad`/`format` corretto nei due casi.
- **Integration:** `importDevfolioOpportunities()` con `fetchWithRetry` mockato su fixture →
  asserisce `type: 'HACKATHON'`, count coerente, nessun duplicato per `uuid`.
- **Manuale:** `POST /api/import/devfolio`, poi `GET /import/coverage` → HACKATHON `live`/
  `itRelevant` in leggero aumento (atteso: singole unità, non centinaia — vedi nota resa).

### Milestone Slice A
Devfolio `ENABLED`, contratto invariato, zero costo LLM. Contributo realistico: qualche unità
di hackathon remoti IT-relevant — non chiude da solo il gap ~800, ma è un mattone pulito e a
costo zero mentre si cerca la prossima fonte europea per hackathon.

---

## Slice B — AIESEC (outline, non pronto)

Serve identificare il vero marketplace opportunità (probabile sotto-dominio/app dedicato,
`aiesec.org/opportunities` e `/opportunity` risultano 404). Prossimo passo: ispezionare il
traffico di rete della pagina "Global Volunteer" (richiede browser headless, non solo curl)
per trovare l'endpoint reale. Solo dopo, C0 + importer.

## Slice C — SummerSchoolsInEurope (outline, non pronto)

robots.txt permette il crawling generico ma esclude esplicitamente i bot AI per nome — politica
del progetto: **solo parsing strutturato, mai estrazione via LLM su questa fonte** anche se
tecnicamente permesso. ToS non verificabile in automatico (403 su fetch diretto — verificare
manualmente in browser prima di procedere). Prossimo passo: verificare se la pagina eventi
espone JSON-LD/microdata (in linea con l'approccio "0 LLM" già usato per Devfolio); se sì,
importer analogo; se no, la fonte resta rimandata a Fase 3 (motore long-tail con parser
strutturati JSON-LD/ICS/RSS).

## Slice D — Fellowship (outline, non pronto)

EURAXESS **esclusa** (§ design spec). Nessuna fonte alternativa ancora verificata C0 in
questa sessione. Prossimo passo: C0 su EU Funding & Tenders/Erasmus+ (open-data), DAAD,
ProFellow/Scholars4dev — nell'ordine di rischio crescente indicato nell'outline originale
(open-data prima di scrape+gate).

---

## Ordine di esecuzione consigliato

Slice A (Devfolio) è pronta e a rischio pressoché zero — implementarla subito. Le altre tre
slice restano bloccate su ricognizione aggiuntiva (endpoint AIESEC, verifica manuale ToS
SummerSchoolsInEurope, fonte fellowship alternativa) prima di poter scrivere un piano
altrettanto dettagliato.
