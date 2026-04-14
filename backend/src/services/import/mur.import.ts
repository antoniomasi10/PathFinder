/**
 * MUR (Ministero dell'Università e della Ricerca) Data Import
 * Source: https://dati-ustat.mur.gov.it/dataset/metadati
 *
 * Downloads public CSV datasets (Italian Open Data License v2.0).
 * - atenei.csv: list of all Italian universities
 * - corsidilaurea_2010-2024.csv: degree programmes (we only import the latest year)
 *
 * This avoids the CKAN /api/ endpoint which is blocked by robots.txt.
 * CSV download URLs are standard CKAN resource links — not API calls.
 *
 * Runs monthly on the 1st at 02:00 (universities) and 02:30 (courses).
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { CourseType } from '@prisma/client';
import { validateUniversity, validateCourse } from './validation';
import { parse } from 'csv-parse/sync';

// ---------------------------------------------------------------------------
// CSV download URLs (CKAN resource downloads, NOT API calls)
// ---------------------------------------------------------------------------

const ATENEI_CSV_URL =
  'https://dati-ustat.mur.gov.it/dataset/bed0c71e-9f86-4a0f-a266-963b6f7bbbd2/resource/820aefe6-0662-4656-84ec-d8859a2a3b7e/download/atenei.csv';

const CORSI_CSV_URL =
  'https://dati-ustat.mur.gov.it/dataset/bed0c71e-9f86-4a0f-a266-963b6f7bbbd2/resource/c0e63906-7190-4568-892b-0cf399f56071/download/corsidilaurea_2010-2024.csv';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapCourseType(desc: string): CourseType {
  const t = (desc || '').toLowerCase();
  if (t.includes('magistrale') && !t.includes('ciclo')) return 'MAGISTRALE';
  if (t.includes('ciclo unico') || t.includes('ciclo_unico')) return 'CICLO_UNICO';
  return 'TRIENNALE';
}

async function downloadCsv(url: string): Promise<any[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`CSV download failed: ${res.status}`);
  const text = await res.text();
  // Remove BOM if present
  const clean = text.replace(/^\uFEFF/, '');
  return parse(clean, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
}

async function logImport(source: string, type: string, fn: () => Promise<number>): Promise<number> {
  const log = await prisma.importLog.create({
    data: { source, type, status: 'running', startedAt: new Date() },
  });
  try {
    const count = await fn();
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'success', count, finishedAt: new Date() },
    });
    return count;
  } catch (err: any) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: { status: 'failed', error: String(err).slice(0, 500), finishedAt: new Date() },
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// University import
// ---------------------------------------------------------------------------

export async function importUniversities(): Promise<{ imported: number; source: string }> {
  logger.info('[MUR] University import starting (CSV download)...');
  const now = new Date();

  try {
    const count = await logImport('mur', 'universities', async () => {
      const records = await downloadCsv(ATENEI_CSV_URL);
      logger.info(`[MUR] Downloaded atenei.csv: ${records.length} rows`);

      let imported = 0;
      for (const r of records) {
        // Only import active universities (Status = A)
        if (r.Status !== 'A') continue;

        const name = r.NomeEsteso || '';
        const city = r.CITTA || '';
        const code = String(r.COD_Ateneo || '').padStart(5, '0');
        if (!name || code === '00000') continue;

        const validated = validateUniversity({
          name: name.trim(),
          city: city.trim(),
          websiteUrl: null,
        });
        if (!validated) continue;

        const sid = `mur-${code}`;
        await prisma.university.upsert({
          where: { id: sid },
          update: {
            name: validated.name,
            city: validated.city,
            isActive: true,
            sourceId: sid,
            lastSyncedAt: now,
          },
          create: {
            id: sid,
            name: validated.name,
            city: validated.city,
            country: 'Italia',
            sourceId: sid,
            lastSyncedAt: now,
          },
        });
        imported++;
      }
      return imported;
    });

    logger.info(`[MUR] Imported ${count} universities from CSV`);
    return { imported: count, source: 'csv-download' };
  } catch (err) {
    // CSV download failed — check if we have cached data
    const existing = await prisma.university.count({ where: { sourceId: { startsWith: 'mur-' } } });
    if (existing > 0) {
      logger.warn(`[MUR] CSV download failed but DB has ${existing} cached universities — skipping`);
      return { imported: 0, source: 'db-cache' };
    }

    logger.warn(`[MUR] CSV download failed and DB empty — using first-run seed`);
    const count = await importFirstRunUniversities(now);
    return { imported: count, source: 'first-run-seed' };
  }
}

// ---------------------------------------------------------------------------
// Course import
// ---------------------------------------------------------------------------

export async function importCourses(): Promise<{ imported: number; source: string }> {
  logger.info('[MUR] Course import starting (CSV download)...');
  const now = new Date();

  try {
    const count = await logImport('mur', 'courses', async () => {
      const records = await downloadCsv(CORSI_CSV_URL);
      logger.info(`[MUR] Downloaded corsi.csv: ${records.length} rows`);

      // Only import the latest year
      const years = [...new Set(records.map((r: any) => r.ANNO_VALIDITA))].sort();
      const latestYear = years[years.length - 1];
      const latest = records.filter((r: any) => r.ANNO_VALIDITA === latestYear);
      logger.info(`[MUR] Filtering to year ${latestYear}: ${latest.length} courses`);

      // Build university lookup
      const universities = await prisma.university.findMany({ where: { isActive: true } });
      const uniByName = new Map(universities.map(u => [u.name.toLowerCase(), u]));

      let imported = 0;
      for (const r of latest) {
        const courseName = r.NOME_CORSO || '';
        const uniShortName = r.NomeOperativo || '';
        if (!courseName || !uniShortName) continue;

        // Match university by short name (NomeOperativo maps to the uni's short name)
        const uni = universities.find(u =>
          u.name.toLowerCase().includes(uniShortName.trim().toLowerCase()) ||
          uniByName.has(uniShortName.trim().toLowerCase())
        );
        if (!uni) continue;

        const validated = validateCourse({
          name: courseName.trim(),
          field: r.Area || r.Gruppo_Nome?.trim() || null,
          languageOfInstruction: 'Italiano',
        });
        if (!validated) continue;

        const sid = `mur-c-${latestYear}-${r.NUMERO || ''}-${imported}`;
        await prisma.course.upsert({
          where: { id: sid },
          update: {
            name: validated.name,
            type: mapCourseType(r.DES || ''),
            field: validated.field,
            languageOfInstruction: validated.languageOfInstruction,
            isActive: true,
            sourceId: sid,
            lastSyncedAt: now,
          },
          create: {
            id: sid,
            universityId: uni.id,
            name: validated.name,
            type: mapCourseType(r.DES || ''),
            field: validated.field,
            languageOfInstruction: validated.languageOfInstruction,
            sourceId: sid,
            lastSyncedAt: now,
          },
        });
        imported++;
      }
      return imported;
    });

    logger.info(`[MUR] Imported ${count} courses from CSV`);
    return { imported: count, source: 'csv-download' };
  } catch (err) {
    const existing = await prisma.course.count({ where: { sourceId: { startsWith: 'mur-' } } });
    if (existing > 0) {
      logger.warn(`[MUR] Course CSV failed but DB has ${existing} cached — skipping`);
      return { imported: 0, source: 'db-cache' };
    }
    logger.warn(`[MUR] Course import failed: ${err}`);
    return { imported: 0, source: 'none' };
  }
}

// ---------------------------------------------------------------------------
// First-run seed (only when DB empty AND CSV download fails)
// ---------------------------------------------------------------------------

async function importFirstRunUniversities(now: Date): Promise<number> {
  const unis = [
    { code: '00101', name: 'Università degli studi di Torino', city: 'TORINO' },
    { code: '00102', name: 'Politecnico di Torino', city: 'TORINO' },
    { code: '01301', name: 'Università degli Studi di Milano', city: 'MILANO' },
    { code: '01401', name: 'Politecnico di Milano', city: 'MILANO' },
    { code: '05801', name: 'Università degli Studi di Roma "La Sapienza"', city: 'ROMA' },
    { code: '03701', name: 'Università di Bologna', city: 'BOLOGNA' },
    { code: '06301', name: 'Università Federico II', city: 'NAPOLI' },
    { code: '02801', name: 'Università degli Studi di Padova', city: 'PADOVA' },
    { code: '04801', name: 'Università degli Studi di Firenze', city: 'FIRENZE' },
    { code: '05001', name: 'Università di Pisa', city: 'PISA' },
  ];

  for (const u of unis) {
    const sid = `mur-${u.code}`;
    await prisma.university.upsert({
      where: { id: sid },
      update: { name: u.name, city: u.city, isActive: true, sourceId: sid, lastSyncedAt: now },
      create: { id: sid, name: u.name, city: u.city, country: 'Italia', sourceId: sid, lastSyncedAt: now },
    });
  }
  return unis.length;
}
