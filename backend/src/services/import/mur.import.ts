/**
 * MUR (Ministero dell'Università e della Ricerca) Data Import
 * Source: https://dati-ustat.mur.gov.it (CKAN API)
 *
 * Live API — universities & courses refresh monthly.
 * DB is the cache: if the API is down, existing data remains valid.
 * Records get `sourceId` + `lastSyncedAt` for freshness tracking.
 */
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { CourseType } from '@prisma/client';
import { validateUniversity, validateCourse } from './validation';

const CKAN_BASE = 'https://dati-ustat.mur.gov.it/api/3/action';

interface CkanResponse {
  success: boolean;
  result: { records: any[]; total: number };
}

async function ckanSearch(resourceId: string, limit = 5000, offset = 0): Promise<any[]> {
  const url = `${CKAN_BASE}/datastore_search?resource_id=${resourceId}&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`CKAN ${res.status}`);
  const data = await res.json() as CkanResponse;
  if (!data.success) throw new Error('CKAN success=false');
  return data.result.records;
}

async function ckanFetchAll(resourceId: string): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  while (true) {
    const page = await ckanSearch(resourceId, 5000, offset);
    all.push(...page);
    if (page.length < 5000) break;
    offset += 5000;
  }
  return all;
}

async function discoverDatasets(): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${CKAN_BASE}/package_search?q=*&rows=50`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return [];
  const data = await res.json() as any;
  if (!data.success) return [];
  const out: { id: string; name: string }[] = [];
  for (const pkg of data.result.results || []) {
    for (const r of pkg.resources || []) {
      if (r.format === 'CSV' || r.datastore_active) {
        out.push({ id: r.id, name: `${pkg.title} — ${r.name || r.description || ''}` });
      }
    }
  }
  return out;
}

function mapCourseType(tipo: string): CourseType {
  const t = (tipo || '').toLowerCase();
  if (t.includes('magistrale') && !t.includes('ciclo')) return 'MAGISTRALE';
  if (t.includes('ciclo unico') || t.includes('ciclo_unico')) return 'CICLO_UNICO';
  return 'TRIENNALE';
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

export async function importUniversities(): Promise<{ imported: number; source: string }> {
  logger.info('[MUR] University import starting...');
  const now = new Date();
  let source = 'ckan-api';

  try {
    const count = await logImport('mur', 'universities', async () => {
      let records: any[] = [];

      // 1. Try dynamic dataset discovery
      const datasets = await discoverDatasets();
      const match = datasets.find(d => d.name.toLowerCase().includes('atene'));
      if (match) {
        records = await ckanFetchAll(match.id);
        logger.info(`[MUR] Dataset "${match.name}": ${records.length} records`);
      }

      // 2. Fallback known resource ID
      if (records.length === 0) {
        try { records = await ckanSearch('a0e25055-f444-41e0-bab8-1e4cdcbbe659'); } catch { /* */ }
      }

      if (records.length === 0) throw new Error('No university data from CKAN');

      let imported = 0;
      for (const r of records) {
        const name = r.NOME_ATENEO || r.nome_ateneo || r.Nome || '';
        const city = r.COMUNE || r.comune || r.Comune || '';
        const code = String(r.COD_ATENEO || r.cod_ateneo || '').padStart(5, '0');
        if (!name || code === '00000') continue;

        const validated = validateUniversity({ name: name.trim(), city: city.trim(), websiteUrl: r.URL_SITO || null });
        if (!validated) continue;

        const sid = `mur-${code}`;
        await prisma.university.upsert({
          where: { id: sid },
          update: { name: validated.name, city: validated.city, websiteUrl: validated.websiteUrl, isActive: true, sourceId: sid, lastSyncedAt: now },
          create: { id: sid, name: validated.name, city: validated.city, country: 'Italia', websiteUrl: validated.websiteUrl, sourceId: sid, lastSyncedAt: now },
        });
        imported++;
      }
      return imported;
    });

    logger.info(`[MUR] Imported ${count} universities from API`);
    return { imported: count, source };
  } catch (err) {
    // API failed — check if we have recent data in DB
    const existing = await prisma.university.count({ where: { sourceId: { startsWith: 'mur-' } } });
    if (existing > 0) {
      logger.warn(`[MUR] API failed but DB has ${existing} cached universities — skipping`);
      return { imported: 0, source: 'db-cache' };
    }

    // DB empty + API down → first-run fallback only
    logger.warn('[MUR] API failed and DB empty — using first-run seed');
    source = 'first-run-seed';
    const count = await importFirstRunUniversities(now);
    return { imported: count, source };
  }
}

export async function importCourses(): Promise<{ imported: number; source: string }> {
  logger.info('[MUR] Course import starting...');
  const now = new Date();

  try {
    const count = await logImport('mur', 'courses', async () => {
      let records: any[] = [];

      const datasets = await discoverDatasets();
      const match = datasets.find(d => d.name.toLowerCase().includes('offerta') || d.name.toLowerCase().includes('cors'));
      if (match) {
        records = await ckanFetchAll(match.id);
      }
      if (records.length === 0) {
        try { records = await ckanSearch('6f0b7666-1f5e-434c-a40a-6560e1a9a57f', 10000); } catch { /* */ }
      }
      if (records.length === 0) throw new Error('No course data from CKAN');

      const universities = await prisma.university.findMany({ where: { isActive: true } });
      const uniLookup = new Map(universities.map(u => [u.name.toLowerCase(), u]));

      let imported = 0;
      for (const r of records) {
        const courseName = r.NOME_CORSO || r.nome_corso || '';
        const uniName = r.NOME_ATENEO || r.nome_ateneo || '';
        if (!courseName || !uniName) continue;

        const uni = uniLookup.get(uniName.trim().toLowerCase()) ||
          universities.find(u => u.name.toLowerCase().includes(uniName.trim().toLowerCase().slice(0, 20)));
        if (!uni) continue;

        const validated = validateCourse({
          name: courseName.trim(),
          field: r.AREA_SCIENTIFICA || null,
          languageOfInstruction: r.LINGUA || 'Italiano',
        });
        if (!validated) continue;

        const sid = `mur-c-${r._id || imported}`;
        await prisma.course.upsert({
          where: { id: sid },
          update: {
            name: validated.name, type: mapCourseType(r.TIPO_CORSO || ''),
            field: validated.field, languageOfInstruction: validated.languageOfInstruction,
            isActive: true, sourceId: sid, lastSyncedAt: now,
          },
          create: {
            id: sid, universityId: uni.id, name: validated.name,
            type: mapCourseType(r.TIPO_CORSO || ''), field: validated.field,
            languageOfInstruction: validated.languageOfInstruction, sourceId: sid, lastSyncedAt: now,
          },
        });
        imported++;
      }
      return imported;
    });

    return { imported: count, source: 'ckan-api' };
  } catch (err) {
    const existing = await prisma.course.count({ where: { sourceId: { startsWith: 'mur-' } } });
    if (existing > 0) {
      logger.warn(`[MUR] Course API failed but DB has ${existing} cached — skipping`);
      return { imported: 0, source: 'db-cache' };
    }
    logger.warn(`[MUR] Course import failed: ${err}`);
    return { imported: 0, source: 'none' };
  }
}

// Only used when DB is completely empty AND API is down (first startup)
async function importFirstRunUniversities(now: Date): Promise<number> {
  const unis = [
    { code: '00001', name: 'Politecnico di Milano', city: 'Milano', url: 'https://www.polimi.it' },
    { code: '00002', name: 'Politecnico di Torino', city: 'Torino', url: 'https://www.polito.it' },
    { code: '00003', name: 'Università degli Studi di Milano', city: 'Milano', url: 'https://www.unimi.it' },
    { code: '00004', name: 'Università degli Studi di Roma "La Sapienza"', city: 'Roma', url: 'https://www.uniroma1.it' },
    { code: '00005', name: 'Università di Bologna', city: 'Bologna', url: 'https://www.unibo.it' },
    { code: '00006', name: 'Università Federico II', city: 'Napoli', url: 'https://www.unina.it' },
    { code: '00007', name: 'Università degli Studi di Padova', city: 'Padova', url: 'https://www.unipd.it' },
    { code: '00008', name: 'Università degli Studi di Firenze', city: 'Firenze', url: 'https://www.unifi.it' },
    { code: '00009', name: 'Università degli Studi di Torino', city: 'Torino', url: 'https://www.unito.it' },
    { code: '00010', name: 'Università di Pisa', city: 'Pisa', url: 'https://www.unipi.it' },
  ];

  for (const u of unis) {
    const sid = `mur-${u.code}`;
    await prisma.university.upsert({
      where: { id: sid },
      update: { name: u.name, city: u.city, websiteUrl: u.url, isActive: true, sourceId: sid, lastSyncedAt: now },
      create: { id: sid, name: u.name, city: u.city, country: 'Italia', websiteUrl: u.url, sourceId: sid, lastSyncedAt: now },
    });
  }
  return unis.length;
}
