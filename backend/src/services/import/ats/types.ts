/**
 * Shared types for the generic ATS connector factory.
 *
 * Each supported ATS (Greenhouse, Lever, Ashby, Workable, Recruitee, …) provides
 * an `AtsAdapter` that knows only how to (a) build the board URL for a token and
 * (b) parse the raw API response into a normalized `AtsJob[]`. All the shared
 * plumbing — fetching, student-role filtering, validation, dedup, DB upsert,
 * mark-stale — lives once in `ats-connector.ts`.
 */

/** A single job posting normalized out of an ATS API response. */
export interface AtsJob {
  externalId: string;       // stable per-board id → becomes part of sourceId
  title: string;            // raw title (company name is appended by the factory)
  url: string | null;       // apply/posting URL
  location: string;         // free-text location
  countryCode?: string;     // ISO-3166 alpha-2 if the API exposes it (else derived)
  isRemote?: boolean;       // if the API exposes it (else derived from location)
  description: string;      // plain-text description
  tags: string[];           // department / team / employment type, etc.
  postedAt?: Date | null;
}

/** Per-platform adapter consumed by `runAtsConnector`. */
export interface AtsAdapter {
  /** Matches `CompanyWatchlist.atsType` and the ImportLog `source`. e.g. 'greenhouse' */
  platform: string;
  /** Human label stored in `Opportunity.source`. e.g. 'Greenhouse' */
  sourceLabel: string;
  /** Build the board API URL for a given board token. */
  buildUrl(token: string): string;
  /** Parse the raw JSON response into normalized jobs. */
  parseJobs(raw: unknown, ctx: { token: string; companyName: string }): AtsJob[];
  /** Per-request timeout (defaults to 15s). */
  timeoutMs?: number;
  /**
   * Curated fallback board tokens (token → display name). Seeds the connector
   * before/independently of the DB registry; migrated into CompanyWatchlist by
   * `scripts/migrateAtsBoardsToRegistry.ts` so discovery can grow the list.
   */
  seedBoards?: Record<string, string>;
}
