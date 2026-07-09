/**
 * Registro Imprese — startup innovative + PMI innovative open dataset.
 *
 * The startup.registroimprese.it / Punto Impresa Digitale portal (Infocamere,
 * CC-BY 4.0) offers a CSV/PDF export of the full register, but the download is
 * behind an interactive form on `startup.registroimprese.it/isin/...` — there is
 * no documented stable bulk-download URL to hit programmatically (verified
 * 2026-07-09; see SOURCES.md). This loader therefore reads a LOCAL CSV file
 * downloaded manually from that portal, rather than fetching it live. If a
 * stable endpoint is identified later, add a fetch path here and keep the
 * `--file` fallback for when it changes again.
 *
 * Expected columns (Italian export headers vary by download batch — matched
 * case-insensitively against multiple known aliases per field):
 *   denominazione | ragione sociale     → name
 *   sito web | sito internet | website  → websiteUrl
 *   codice fiscale | cf                 → legalId + sourceRef
 *   regione                             → region
 *   settore | natura                    → sector
 *   classe addetti | classe di addetti  → employeeBand (mapped to our bands)
 */
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { logger } from '../../../../utils/logger';
import { RegistryEntity, RegistryLoader } from '../types';

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['denominazione', 'ragione sociale', 'denominazione impresa'],
  websiteUrl: ['sito web', 'sito internet', 'website', 'url', 'sito'],
  legalId: ['codice fiscale', 'cf', 'codicefiscale'],
  region: ['regione'],
  sector: ['settore', 'natura', 'settore prevalente', 'descrizione ateco'],
  employeeBand: ['classe addetti', 'classe di addetti', 'classe dipendenti'],
};

function pick(row: Record<string, string>, field: keyof typeof COLUMN_ALIASES): string | undefined {
  const keys = Object.keys(row);
  for (const alias of COLUMN_ALIASES[field]) {
    const key = keys.find(k => k.trim().toLowerCase() === alias);
    if (key && row[key]?.trim()) return row[key].trim();
  }
  return undefined;
}

/** Maps free-text "classe addetti" ranges to our coarse employeeBand values. */
function normalizeEmployeeBand(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.match(/\d+/g)?.map(Number) ?? [];
  const max = digits.length ? Math.max(...digits) : null;
  if (max === null) return null;
  if (max >= 250) return '250+';
  if (max >= 50) return '50-249';
  if (max >= 10) return '10-49';
  return '0-9';
}

export const registroImpreseStartupLoader: RegistryLoader = {
  source: 'registro-imprese-startup',
  async load(opts?: { filePath?: string }): Promise<RegistryEntity[]> {
    if (!opts?.filePath) {
      throw new Error(
        '[RegistroImprese] --file <path> is required: startup.registroimprese.it has no documented ' +
        'stable bulk-download URL (verified 2026-07-09). Download the CSV export manually from the ' +
        'portal and pass its path.',
      );
    }

    const raw = readFileSync(opts.filePath, 'latin1');
    const rows: Record<string, string>[] = parse(raw, {
      columns: true,
      delimiter: raw.includes(';') ? ';' : ',',
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const entities: RegistryEntity[] = [];
    for (const row of rows) {
      const name = pick(row, 'name');
      if (!name) continue;
      const legalId = pick(row, 'legalId') ?? null;
      entities.push({
        name,
        websiteUrl: pick(row, 'websiteUrl') ?? null,
        legalId,
        sourceRef: legalId ?? name,
        sector: pick(row, 'sector') ?? null,
        employeeBand: normalizeEmployeeBand(pick(row, 'employeeBand')),
        region: pick(row, 'region') ?? null,
      });
    }

    logger.info(`[RegistroImprese] Parsed ${entities.length}/${rows.length} rows from ${opts.filePath}`);
    return entities;
  },
};
