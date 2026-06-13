/**
 * ANPAL — Garanzia Giovani + Servizio Civile Universale
 * Italian Government Open Data (CC BY)
 *
 * Sources:
 *   1. Garanzia Giovani (GG) — EU Youth Guarantee for NEETs aged 15-29
 *      Portal: https://www.garanziagiovani.gov.it
 *      Data:   https://www.dati.gov.it (CC BY, org: anpal)
 *      Produces: national program-level opportunities for the 4 student-facing measures
 *
 *   2. Servizio Civile Universale (SCU) — Civic Service for ages 18-28
 *      Portal:   https://www.serviziocivileuniversale.gov.it
 *      Data:     https://www.dati.gov.it CKAN API (CC BY, org: politiche-giovanili)
 *      Produces: individual project/bando entries as VOLUNTEERING opportunities
 *
 * Attribution: source field set to "ANPAL"; credited in About page.
 * Schedule: Monthly 1st at 03:00 — data refresh cadence matches government publication.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { validateOpportunity } from './validation';
import { batchUpsertOpportunities, markStaleOpportunities, OpportunityRecord } from './batch';
import { fetchWithRetry } from './utils';

const SOURCE_KEY = 'anpal';
const CKAN_SEARCH = 'https://www.dati.gov.it/api/3/action/package_search';

// ---------------------------------------------------------------------------
// Garanzia Giovani — hardcoded national measures (stable EU program, runs to 2027)
// ---------------------------------------------------------------------------

interface GGMeasure {
  id: string;
  title: string;
  description: string;
  type: 'FELLOWSHIP' | 'TIROCINIO' | 'EXCHANGE';
  tags: string[];
  url: string;
}

const GG_MEASURES: GGMeasure[] = [
  {
    id: 'gg-misura-f',
    title: 'Garanzia Giovani — Tirocinio Extra-curriculare (Misura F)',
    description:
      'Garanzia Giovani offre tirocini extra-curriculari retribuiti a giovani NEET tra i 15 e i 29 anni. ' +
      'La Misura F prevede un rimborso spese mensile (minimo €500) e supporto al placement lavorativo. ' +
      'Disponibile in tutte le 20 regioni italiane tramite i Centri per l\'Impiego e gli operatori accreditati. ' +
      'Durata: 6-12 mesi. Candidatura tramite la propria regione di residenza.',
    type: 'TIROCINIO',
    tags: ['garanzia giovani', 'tirocinio', 'anpal', 'governo', 'neet', 'giovani', 'occupazione'],
    url: 'https://www.garanziagiovani.gov.it/giovani/misura-f-i-tirocini',
  },
  {
    id: 'gg-misura-e',
    title: 'Garanzia Giovani — Apprendistato (Misura E)',
    description:
      'La Misura E di Garanzia Giovani promuove contratti di apprendistato per giovani NEET tra i 15 e i 29 anni. ' +
      'Combina lavoro in azienda e formazione professionale con incentivi alle imprese assuntrici. ' +
      'Tipologie: apprendistato per la qualifica, professionalizzante e di alta formazione e ricerca.',
    type: 'TIROCINIO',
    tags: ['garanzia giovani', 'apprendistato', 'anpal', 'governo', 'neet', 'giovani', 'contratto'],
    url: 'https://www.garanziagiovani.gov.it/giovani/misura-e-apprendistato',
  },
  {
    id: 'gg-misura-g',
    title: 'Garanzia Giovani — Sostegno all\'autoimprenditorialità (Misura G)',
    description:
      'La Misura G di Garanzia Giovani supporta i giovani NEET che vogliono avviare un\'impresa o attività autonoma. ' +
      'Prevede formazione imprenditoriale, mentoring, tutoraggio specialistico e supporto finanziario ' +
      '(voucher, micro-credito, incentivi). Rivolto a giovani tra i 18 e i 29 anni.',
    type: 'FELLOWSHIP',
    tags: ['garanzia giovani', 'autoimprenditorialità', 'startup', 'anpal', 'governo', 'neet', 'imprenditoria'],
    url: 'https://www.garanziagiovani.gov.it/giovani/misura-g-lautoimprenditorialita',
  },
  {
    id: 'gg-misura-h',
    title: 'Garanzia Giovani — Mobilità Professionale Transnazionale (Misura H)',
    description:
      'La Misura H di Garanzia Giovani finanzia esperienze di mobilità professionale all\'estero per giovani NEET. ' +
      'Include tirocini in altri Paesi europei con rimborso delle spese di vitto, alloggio e trasporto. ' +
      'Si integra con programmi EU come Erasmus+. Rivolto a giovani tra i 18 e i 29 anni residenti in Italia.',
    type: 'EXCHANGE',
    tags: ['garanzia giovani', 'mobilità', 'estero', 'anpal', 'governo', 'neet', 'giovani', 'internazionale', 'erasmus'],
    url: 'https://www.garanziagiovani.gov.it/giovani/misura-h-mobilita',
  },
];

// ---------------------------------------------------------------------------
// CKAN API helpers — dati.gov.it
// ---------------------------------------------------------------------------

interface CKANResource {
  id: string;
  url: string;
  format: string;
  name: string;
}

interface CKANDataset {
  id: string;
  name: string;
  title: string;
  resources: CKANResource[];
}

interface CKANSearchResponse {
  success: boolean;
  result: { count: number; results: CKANDataset[] };
}

async function findCKANResource(
  query: string,
  orgFilter?: string,
): Promise<{ url: string; datasetTitle: string } | null> {
  const params = new URLSearchParams({ q: query, rows: '5' });
  if (orgFilter) params.set('fq', `organization:${orgFilter}`);

  try {
    const res = await fetchWithRetry(`${CKAN_SEARCH}?${params}`, {
      timeoutMs: 15000,
      headers: { Accept: 'application/json' },
      logTag: '[ANPAL] CKAN search',
    });
    if (!res.ok) return null;

    const data = (await res.json()) as CKANSearchResponse;
    if (!data.success || !data.result.results.length) return null;

    for (const dataset of data.result.results) {
      for (const resource of dataset.resources) {
        const fmt = resource.format.toLowerCase();
        if ((fmt === 'csv' || fmt === 'json') && resource.url) {
          return { url: resource.url, datasetTitle: dataset.title };
        }
      }
    }
  } catch (err) {
    logger.warn(`[ANPAL] CKAN search failed: ${err}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// CSV parser — handles semicolon or comma separation, quoted fields, UTF-8/Latin-1
// ---------------------------------------------------------------------------

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const sep = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';

  const parseRow = (line: string): string[] => {
    const cols: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === sep && !inQuote) {
        cols.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = parseRow(firstLine).map(h =>
    h.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

// Italian government CSV headers for SCU bandi vary across years — check multiple aliases.
const SCU_ALIASES: Record<string, string[]> = {
  ente:     ['ente', 'nome_ente', 'denominazione_ente', 'operatore', 'denominazione'],
  progetto: ['titolo_progetto', 'progetto', 'nome_progetto', 'denominazione_progetto', 'titolo'],
  comune:   ['comune', 'comune_sede', 'sede_di_attuazione', 'localita'],
  regione:  ['regione', 'regione_sede', 'area_geografica'],
  posti:    ['posti', 'numero_posti', 'volontari', 'n_volontari', 'posti_disponibili', 'num_volontari'],
  settore:  ['settore', 'settore_intervento', 'ambito', 'area_di_intervento'],
  scadenza: ['data_scadenza', 'scadenza', 'data_chiusura', 'data_fine_bando', 'termine_presentazione_domanda'],
};

function col(row: Record<string, string>, field: keyof typeof SCU_ALIASES): string {
  for (const alias of SCU_ALIASES[field]) {
    if (row[alias] !== undefined && row[alias] !== '') return row[alias];
  }
  return '';
}

function parseItalianDate(s: string): Date | null {
  if (!s) return null;
  // DD/MM/YYYY → YYYY-MM-DD
  const iso = s.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1');
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// SCU bandi from dati.gov.it CKAN
// ---------------------------------------------------------------------------

async function importSCUBandi(now: Date): Promise<OpportunityRecord[]> {
  try {
    const resource = await findCKANResource('servizio civile bandi', 'politiche-giovanili');
    if (!resource) {
      // Try without org filter — dataset may be under a different org slug
      const fallback = await findCKANResource('servizio civile universale bandi aperti');
      if (!fallback) {
        logger.warn('[ANPAL-SCU] No CKAN resource found for SCU bandi — skipping');
        return [];
      }
      Object.assign(resource ?? {}, fallback);
    }

    // TypeScript narrowing: resource can be null after first findCKANResource
    const res2 = resource ?? await findCKANResource('servizio civile universale bandi aperti');
    if (!res2) return [];

    logger.info(`[ANPAL-SCU] Downloading dataset: "${res2.datasetTitle}"`);
    const res = await fetchWithRetry(res2.url, {
      timeoutMs: 30000,
      retries: 2,
      headers: { Accept: 'text/csv, application/json, */*' },
      logTag: '[ANPAL-SCU] resource',
    });
    if (!res.ok) {
      logger.warn(`[ANPAL-SCU] Resource download failed: HTTP ${res.status}`);
      return [];
    }

    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length === 0) {
      logger.warn('[ANPAL-SCU] CSV parsed to 0 rows');
      return [];
    }
    logger.info(`[ANPAL-SCU] Parsed ${rows.length} bandi rows`);

    const records: OpportunityRecord[] = [];
    for (const row of rows) {
      const ente     = col(row, 'ente');
      const progetto = col(row, 'progetto');
      const comune   = col(row, 'comune');
      const regione  = col(row, 'regione');
      const posti    = parseInt(col(row, 'posti'), 10) || null;
      const settore  = col(row, 'settore');
      const scadenza = col(row, 'scadenza');

      if (!progetto && !ente) continue;

      const title = progetto.length > 5 ? progetto.slice(0, 200) : `Servizio Civile — ${ente}`.slice(0, 200);
      const location = [comune, regione].filter(Boolean).join(', ') || 'Italia';
      const deadline = parseItalianDate(scadenza);
      if (deadline && deadline < now) continue; // already expired

      const description = [
        `Progetto di Servizio Civile Universale presso ${ente}.`,
        settore  ? `Ambito di intervento: ${settore}.`          : null,
        comune   ? `Sede di realizzazione: ${location}.`        : null,
        posti    ? `Posti disponibili: ${posti}.`               : null,
        'Durata 12 mesi. Rimborso mensile ~€439. Requisito: 18-28 anni, cittadinanza italiana o UE.',
        'Candidatura tramite il portale Servizio Civile Universale (serviziocivileuniversale.gov.it).',
      ].filter(Boolean).join(' ');

      const key = Buffer.from(`scu|${progetto}|${ente}|${comune}`).toString('base64').slice(0, 24);
      const sourceId = `anpal-scu-${key}`;

      records.push({
        id: sourceId,
        title,
        description,
        company: null,
        organizer: ente || 'Servizio Civile Universale',
        url: 'https://www.serviziocivileuniversale.gov.it/scu/home',
        location,
        isAbroad: false,
        isRemote: false,
        type: 'VOLUNTEERING',
        tags: [
          'servizio civile', 'volontariato', 'anpal', 'governo', 'giovani',
          ...(settore ? [settore.toLowerCase().slice(0, 50)] : []),
        ],
        postedAt: now,
        deadline,
        source: 'ANPAL',
        sourceId,
        lastSyncedAt: now,
        country: 'IT',
        region: regione || undefined,
        city: comune || undefined,
      });
    }

    return records;
  } catch (err) {
    logger.warn(`[ANPAL-SCU] Import error: ${err}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function importANPALOpportunities(): Promise<{
  imported: number;
  skipped: number;
  source: string;
}> {
  logger.info('[ANPAL] Starting import (Garanzia Giovani + Servizio Civile Universale)...');
  const now = new Date();

  const log = await prisma.importLog.create({
    data: { source: SOURCE_KEY, type: 'opportunities', status: 'running', startedAt: now },
  });

  try {
    const records: OpportunityRecord[] = [];

    // 1. Garanzia Giovani — 4 hardcoded national measures
    for (const measure of GG_MEASURES) {
      const sourceId = `anpal-gg-${measure.id}`;
      const validated = validateOpportunity(
        {
          title: measure.title,
          description: measure.description,
          company: null,
          url: measure.url,
          location: 'Italia',
          isAbroad: false,
          isRemote: false,
          expiresAt: null,
          deadline: null,
        },
        SOURCE_KEY,
      );
      if (!validated) continue;

      records.push({
        id: sourceId,
        title: validated.title,
        description: validated.description,
        company: null,
        organizer: 'ANPAL / Ministero del Lavoro e delle Politiche Sociali',
        url: measure.url,
        location: 'Italia',
        isAbroad: false,
        isRemote: false,
        type: measure.type,
        tags: measure.tags,
        postedAt: now,
        source: 'ANPAL',
        sourceId,
        lastSyncedAt: now,
        country: 'IT',
      });
    }

    // 2. SCU bandi from dati.gov.it CKAN
    const scuRecords = await importSCUBandi(now);
    records.push(...scuRecords);

    const seenIds = records.map(r => r.id);
    let skipped = 0;

    if (records.length > 0) {
      await batchUpsertOpportunities(records);
      // SCU is unscoped (national, no per-company scope) — use minSeenForStale guard
      await markStaleOpportunities('ANPAL', seenIds, { minSeenForStale: 1 });
    }

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        count: records.length,
        finishedAt: new Date(),
        metadata: { gg: GG_MEASURES.length, scu: scuRecords.length, skipped },
      },
    });

    logger.info(`[ANPAL] Done: gg=${GG_MEASURES.length}, scu=${scuRecords.length}, total=${records.length}`);
    return { imported: records.length, skipped, source: SOURCE_KEY };
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    logger.error(`[ANPAL] Import failed: ${err}`);
    return { imported: 0, skipped: 0, source: 'failed' };
  }
}
