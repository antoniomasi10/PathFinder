/**
 * Company-registry ingestion types (Fase 5 company-first scale-up).
 *
 * A RegistryLoader reads one open-data source and emits RegistryEntity rows.
 * Loaders never touch the DB directly — ingestRegistryEntities() owns dedup +
 * normalization + persistence so every source shares the same rules.
 */
export interface RegistryEntity {
  name: string;
  websiteUrl?: string | null;
  legalId?: string | null;
  /** Stable per-source id (codice fiscale, Wikidata QID, "<platform>|<token>") — enables idempotent re-ingest. */
  sourceRef?: string | null;
  sector?: string | null;
  employeeBand?: string | null;
  region?: string | null;
  /** Set only when the source already resolved an ATS board (Common Crawl fast path). */
  atsType?: string | null;
  atsToken?: string | null;
}

export interface RegistryLoader {
  source: string;
  /** `platform` narrows commoncrawl-ats to a single ATS platform (greenhouse|lever|...); ignored by other loaders. */
  load(opts?: { filePath?: string; platform?: string }): Promise<RegistryEntity[]>;
}
