/**
 * Wikidata SPARQL loader — Italian companies with an official website (P856).
 * Also picks up Borsa Italiana / large caps for free via the "public company"
 * class + the stock-exchange property, so no separate Mediobanca-style scrape
 * is needed for listed companies.
 *
 * Fixed P31 class list (NOT `wdt:P31/wdt:P279*`, which times out at this scale)
 * + `ORDER BY ?company` for stable pagination + a descriptive User-Agent and
 * inter-page delay, per WDQS's request for polite bulk use. CC0 data/endpoint.
 */
import { logger } from '../../../../utils/logger';
import { fetchWithRetry } from '../../utils';
import { RegistryEntity, RegistryLoader } from '../types';

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'COhA-CompanyRegistry/1.0 (https://github.com/coha/coha; university student platform, non-commercial research use)';
const PAGE_SIZE = 3000;
const MAX_PAGES = 10; // ~30k rows ceiling per run — bounded, polite, resumable via re-run
const PAGE_DELAY_MS = 2000;

// Business/organization classes only — avoids P279* transitive-closure timeouts.
const COMPANY_CLASSES = [
  'Q4830453', // business
  'Q6881511', // enterprise
  'Q891723',  // public company
  'Q22687',   // bank
  'Q1668024', // insurance company
];

interface SparqlBinding {
  company: { value: string };
  companyLabel?: { value: string };
  website?: { value: string };
  employees?: { value: string };
  industryLabel?: { value: string };
  exchange?: { value: string };
}

function buildQuery(offset: number): string {
  const values = COMPANY_CLASSES.map(q => `wd:${q}`).join(' ');
  return `
SELECT ?company ?companyLabel ?website ?employees ?industryLabel ?exchange WHERE {
  VALUES ?class { ${values} }
  ?company wdt:P31 ?class;
           wdt:P17 wd:Q38;
           wdt:P856 ?website.
  OPTIONAL { ?company wdt:P1128 ?employees. }
  OPTIONAL { ?company wdt:P452 ?industry. }
  OPTIONAL { ?company wdt:P414 ?exchange. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
}
ORDER BY ?company
LIMIT ${PAGE_SIZE}
OFFSET ${offset}
`.trim();
}

function qidFromUri(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

function employeeBandFromCount(n: number | null, isListed: boolean): string | null {
  if (n !== null) {
    if (n >= 250) return '250+';
    if (n >= 50) return '50-249';
    if (n >= 10) return '10-49';
    return '0-9';
  }
  // No reported headcount, but publicly listed → safe to assume large-cap.
  return isListed ? '250+' : null;
}

async function fetchPage(offset: number): Promise<SparqlBinding[]> {
  const res = await fetchWithRetry(SPARQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/sparql-results+json',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({ query: buildQuery(offset) }).toString(),
    timeoutMs: 60000, // WDQS OFFSET pagination gets slower at higher offsets for this query shape
    retries: 1,        // don't burn minutes retrying a query that's genuinely just slow at this offset
    logTag: `[Wikidata] offset ${offset}`,
  });
  if (!res.ok) {
    logger.warn(`[Wikidata] page at offset ${offset} returned ${res.status}`);
    return [];
  }
  const body = await res.json() as { results: { bindings: SparqlBinding[] } };
  return body.results.bindings;
}

export const wikidataLoader: RegistryLoader = {
  source: 'wikidata',
  async load(): Promise<RegistryEntity[]> {
    const byQid = new Map<string, RegistryEntity>();

    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE_SIZE;
      let bindings: SparqlBinding[];
      try {
        bindings = await fetchPage(offset);
      } catch (err) {
        // WDQS OFFSET pagination gets slow/times out at higher offsets for this
        // query shape — stop here rather than losing everything collected so
        // far (a re-run resolves from page 0 again; still net-positive since
        // dedup on QID makes re-ingest idempotent).
        logger.warn(`[Wikidata] page at offset ${offset} failed, stopping pagination: ${err}`);
        break;
      }
      if (bindings.length === 0) break;

      for (const b of bindings) {
        const qid = qidFromUri(b.company.value);
        const employees = b.employees?.value ? parseInt(b.employees.value, 10) : null;
        const isListed = !!b.exchange?.value;
        const existing = byQid.get(qid);
        byQid.set(qid, {
          name: b.companyLabel?.value ?? existing?.name ?? qid,
          websiteUrl: b.website?.value ?? existing?.websiteUrl ?? null,
          sourceRef: qid,
          sector: b.industryLabel?.value ?? existing?.sector ?? null,
          employeeBand: employeeBandFromCount(employees, isListed) ?? existing?.employeeBand ?? null,
        });
      }

      logger.info(`[Wikidata] page ${page + 1}: ${bindings.length} bindings (${byQid.size} unique companies so far)`);
      if (bindings.length < PAGE_SIZE) break; // last page
      await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
    }

    return [...byQid.values()];
  },
};
