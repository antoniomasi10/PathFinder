/**
 * Seed list of Italian ESN (Erasmus Student Network) local section domains —
 * first Fase 3 harvest-discovery input, verified reachable (2026-07-09) against
 * the official national directory at https://esn.it/it/sezioni-esn (own site's
 * public JS/HTML, no scraping restrictions found; each domain also gets its own
 * per-target compliance check at discovery/scrape time — see
 * docs/superpowers/specs/2026-07-09-fase3-long-tail-engine-design.md).
 *
 * This is exactly the case flagged repeatedly in Fase 2 as "belongs to Fase 3":
 * ESN's national feed (esn.org/rss.xml) only carries organization-wide news, not
 * local events — the real event calendars live on each section's own site.
 *
 * Deliberately a mix of large university cities (high event volume) and smaller
 * sections, to exercise different feed kinds (JSON-LD/RSS calendar plugins vs
 * plain HTML) once discovery runs against them.
 */
export interface StudentOrgSeed {
  domain: string;
  name: string;
  region?: string;
}

export const ITALY_STUDENT_ORGS: StudentOrgSeed[] = [
  { domain: 'torino.esn.it', name: 'ESN Torino', region: 'Piemonte' },
  { domain: 'milano-bicocca.esn.it', name: 'ESN Milano Bicocca', region: 'Lombardia' },
  { domain: 'milanopolitecnico.esn.it', name: 'ESN Milano Politecnico', region: 'Lombardia' },
  { domain: 'milanostatale.esn.it', name: 'ESN Milano Statale', region: 'Lombardia' },
  { domain: 'milanobocconi.esn.it', name: 'ESN Milano Bocconi', region: 'Lombardia' },
  { domain: 'pavia.esn.it', name: 'ESN Pavia', region: 'Lombardia' },
  { domain: 'bergamo.esn.it', name: 'ESN Bergamo', region: 'Lombardia' },
  { domain: 'brescia.esn.it', name: 'ESN Brescia', region: 'Lombardia' },
  { domain: 'padova.esn.it', name: 'ESN Padova', region: 'Veneto' },
  { domain: 'venezia.esn.it', name: 'ESN Venezia', region: 'Veneto' },
  { domain: 'verona.esn.it', name: 'ESN Verona', region: 'Veneto' },
  { domain: 'trento.esn.it', name: 'ESN Trento', region: 'Trentino-Alto Adige' },
  { domain: 'trieste.esn.it', name: 'ESN Trieste', region: 'Friuli-Venezia Giulia' },
  { domain: 'udine.esn.it', name: 'ESN Udine', region: 'Friuli-Venezia Giulia' },
  { domain: 'genova.esn.it', name: 'ESN Genova', region: 'Liguria' },
  { domain: 'bologna.esn.it', name: 'ESN Bologna', region: 'Emilia-Romagna' },
  { domain: 'parma.esn.it', name: 'ESN Parma', region: 'Emilia-Romagna' },
  { domain: 'modena.esn.it', name: 'ESN Modena e Reggio Emilia', region: 'Emilia-Romagna' },
  { domain: 'ferrara.esn.it', name: 'ESN Ferrara', region: 'Emilia-Romagna' },
  { domain: 'firenze.esn.it', name: 'ESN Firenze', region: 'Toscana' },
  { domain: 'pisa.esn.it', name: 'ESN Pisa', region: 'Toscana' },
  { domain: 'siena.esn.it', name: 'ESN Siena', region: 'Toscana' },
  { domain: 'perugia.esn.it', name: 'ESN Perugia', region: 'Umbria' },
  { domain: 'romatre.esn.it', name: 'ESN Roma Tre', region: 'Lazio' },
  { domain: 'romaluiss.esn.it', name: 'ESN Roma LUISS', region: 'Lazio' },
  { domain: 'napoli.esn.it', name: 'ESN Napoli', region: 'Campania' },
  { domain: 'salerno.esn.it', name: 'ESN Salerno', region: 'Campania' },
  { domain: 'bari.esn.it', name: 'ESN Bari', region: 'Puglia' },
  { domain: 'lecce.esn.it', name: 'ESN Lecce', region: 'Puglia' },
  { domain: 'palermo.esn.it', name: 'ESN Palermo', region: 'Sicilia' },
  { domain: 'catania.esn.it', name: 'ESN Catania', region: 'Sicilia' },
  { domain: 'messina.esn.it', name: 'ESN Messina', region: 'Sicilia' },
  { domain: 'cagliari.esn.it', name: 'ESN Cagliari', region: 'Sardegna' },
];
