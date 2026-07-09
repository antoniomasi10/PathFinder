/**
 * Curated one-time imports (e.g. Mediobanca "Le principali società italiane") —
 * a hand-prepared CSV, never scraped automatically (their site/PDF ToS is not
 * reviewed). Minimal expected columns: name, websiteUrl[, sector, region].
 */
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { logger } from '../../../../utils/logger';
import { RegistryEntity, RegistryLoader } from '../types';

export function manualListLoader(source: string): RegistryLoader {
  return {
    source,
    async load(opts?: { filePath?: string }): Promise<RegistryEntity[]> {
      if (!opts?.filePath) {
        throw new Error(`[ManualList] --file <path> is required for source "${source}"`);
      }
      const raw = readFileSync(opts.filePath, 'utf8');
      const rows: Record<string, string>[] = parse(raw, {
        columns: true,
        delimiter: raw.includes(';') ? ';' : ',',
        skip_empty_lines: true,
        trim: true,
      });

      const entities: RegistryEntity[] = rows
        .filter(r => r.name?.trim())
        .map(r => ({
          name: r.name.trim(),
          websiteUrl: r.websiteUrl?.trim() || null,
          sourceRef: r.name.trim(),
          sector: r.sector?.trim() || null,
          region: r.region?.trim() || null,
        }));

      logger.info(`[ManualList] ${source}: parsed ${entities.length}/${rows.length} rows from ${opts.filePath}`);
      return entities;
    },
  };
}
