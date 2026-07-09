/**
 * Registry ingest — normalizes + dedups RegistryEntity rows from a single loader
 * and upserts them into CompanyRegistry. Batched lookups (not per-row round
 * trips) so a 15k+ row source ingests in a handful of queries, mirroring the
 * dedup approach in ../batch.ts.
 *
 * Dedup order: (source, sourceRef) upsert (idempotent re-ingest) → cross-source
 * by domain (unique) → cross-source by normalizedName when no domain is known.
 * A hit at any stage after the first is recorded as a duplicate and NOT
 * persisted — the existing (richer, already-routed) row wins.
 */
import prisma from '../../../lib/prisma';
import { logger } from '../../../utils/logger';
import { RegistryEntity } from './types';
import { normalizeCompanyName, extractApexDomain } from './normalize';
import { computePriorityScore } from './priority';

export interface IngestResult {
  created: number;
  updated: number;
  duplicates: number;
  noDomain: number;
}

interface PreparedEntity {
  entity: RegistryEntity;
  normalizedName: string;
  domain: string | null;
  priorityScore: number;
}

export async function ingestRegistryEntities(source: string, entities: RegistryEntity[]): Promise<IngestResult> {
  const result: IngestResult = { created: 0, updated: 0, duplicates: 0, noDomain: 0 };
  if (entities.length === 0) return result;

  const prepared: PreparedEntity[] = entities.map(e => {
    const domain = e.websiteUrl ? extractApexDomain(e.websiteUrl) : null;
    return {
      entity: e,
      normalizedName: normalizeCompanyName(e.name),
      domain,
      priorityScore: computePriorityScore(source, { ...e, domain }),
    };
  });

  // Bulk-fetch everything we might need to dedup against, in 3 queries total.
  const sourceRefs = prepared.filter(p => p.entity.sourceRef).map(p => p.entity.sourceRef as string);
  const domains = prepared.filter(p => p.domain).map(p => p.domain as string);
  const names = prepared.filter(p => !p.domain).map(p => p.normalizedName);

  const [bySourceRefRows, byDomainRows, byNameRows] = await Promise.all([
    sourceRefs.length > 0
      ? prisma.companyRegistry.findMany({ where: { source, sourceRef: { in: sourceRefs } } })
      : Promise.resolve([]),
    domains.length > 0
      ? prisma.companyRegistry.findMany({ where: { domain: { in: domains } } })
      : Promise.resolve([]),
    names.length > 0
      ? prisma.companyRegistry.findMany({ where: { normalizedName: { in: names }, domain: { not: null } } })
      : Promise.resolve([]),
  ]);

  const bySourceRef = new Map(bySourceRefRows.map(r => [r.sourceRef as string, r]));
  const byDomain = new Map(byDomainRows.map(r => [r.domain as string, r]));
  const byName = new Map(byNameRows.map(r => [r.normalizedName, r]));

  for (const p of prepared) {
    const { entity: e, normalizedName, domain, priorityScore } = p;
    if (!domain) result.noDomain++;

    const existingBySourceRef = e.sourceRef ? bySourceRef.get(e.sourceRef) : undefined;
    if (existingBySourceRef) {
      await prisma.companyRegistry.update({
        where: { id: existingBySourceRef.id },
        data: {
          name: e.name,
          normalizedName,
          domain: domain ?? existingBySourceRef.domain,
          websiteUrl: e.websiteUrl ?? existingBySourceRef.websiteUrl,
          legalId: e.legalId ?? existingBySourceRef.legalId,
          sector: e.sector ?? existingBySourceRef.sector,
          employeeBand: e.employeeBand ?? existingBySourceRef.employeeBand,
          region: e.region ?? existingBySourceRef.region,
          atsType: e.atsType ?? existingBySourceRef.atsType,
          atsToken: e.atsToken ?? existingBySourceRef.atsToken,
          priorityScore,
        },
      });
      result.updated++;
      continue;
    }

    const existingByDomain = domain ? byDomain.get(domain) : undefined;
    if (existingByDomain) {
      if (existingByDomain.source !== source) {
        result.duplicates++;
        continue;
      }
      // Same source re-ingested without a stable sourceRef (e.g. manual list) — refresh in place.
      await prisma.companyRegistry.update({
        where: { id: existingByDomain.id },
        data: { name: e.name, normalizedName, priorityScore },
      });
      result.updated++;
      continue;
    }

    if (!domain && byName.has(normalizedName)) {
      result.duplicates++;
      continue;
    }

    try {
      const created = await prisma.companyRegistry.create({
        data: {
          name: e.name,
          normalizedName,
          domain,
          websiteUrl: e.websiteUrl ?? null,
          legalId: e.legalId ?? null,
          source,
          sourceRef: e.sourceRef ?? null,
          sector: e.sector ?? null,
          employeeBand: e.employeeBand ?? null,
          region: e.region ?? null,
          atsType: e.atsType ?? null,
          atsToken: e.atsToken ?? null,
          priorityScore,
          // A domain isn't the only actionable signal — commoncrawl-ats rows
          // carry atsType+atsToken instead and skip domain resolution entirely
          // (see claimRegistryBatch's fast path). Only mark 'no-domain' when
          // there's truly nothing to act on.
          status: (domain || (e.atsType && e.atsToken)) ? 'pending' : 'no-domain',
        },
      });
      result.created++;
      if (domain) byDomain.set(domain, created);
      else byName.set(normalizedName, created);
    } catch (err) {
      // Unique-constraint race (concurrent ingest of the same domain/sourceRef) — treat as duplicate.
      logger.debug(`[CompanyRegistry] ingest race skipped (${source}): ${err}`);
      result.duplicates++;
    }
  }

  logger.info(`[CompanyRegistry] Ingested ${source}: +${result.created} created, ${result.updated} updated, ${result.duplicates} duplicates, ${result.noDomain} without domain`);
  return result;
}
