/**
 * Seed list of Italian university apex domains (Fase 1, Step 1.3 — PF-118).
 *
 * University career-service pages (placement/tirocini offices, event calendars)
 * are IT-native by construction — a real fix for the "country=IT" scarcity
 * documented in the design spec. They enter through the same fingerprint-based
 * discovery as companies: resolve the domain's careers-like page, fingerprint
 * it, and route to tier A (rare, universities don't run commercial ATS) or
 * tier B/C custom scrape targets.
 *
 * The MUR import (`mur.import.ts`) only carries name/city — no websiteUrl — so
 * domains here are curated manually rather than read from the University table.
 * Expandable: append more atenei and the next discovery run picks them up.
 */
export interface UniversityDomainSeed {
  domain: string;
  name: string;
}

export const ITALY_UNIVERSITY_DOMAINS: UniversityDomainSeed[] = [
  { domain: 'polimi.it', name: 'Politecnico di Milano' },
  { domain: 'polito.it', name: 'Politecnico di Torino' },
  { domain: 'unimi.it', name: 'Università degli Studi di Milano' },
  { domain: 'unibocconi.it', name: 'Università Bocconi' },
  { domain: 'unicatt.it', name: 'Università Cattolica del Sacro Cuore' },
  { domain: 'unibo.it', name: 'Università di Bologna' },
  { domain: 'uniroma1.it', name: 'Sapienza Università di Roma' },
  { domain: 'uniroma2.it', name: 'Università di Roma Tor Vergata' },
  { domain: 'uniroma3.it', name: 'Università Roma Tre' },
  { domain: 'luiss.it', name: 'LUISS Guido Carli' },
  { domain: 'unina.it', name: 'Università degli Studi di Napoli Federico II' },
  { domain: 'unipd.it', name: 'Università degli Studi di Padova' },
  { domain: 'unifi.it', name: 'Università degli Studi di Firenze' },
  { domain: 'unipi.it', name: 'Università di Pisa' },
  { domain: 'sns.it', name: 'Scuola Normale Superiore' },
  { domain: 'santannapisa.it', name: 'Scuola Superiore Sant\'Anna' },
  { domain: 'unito.it', name: 'Università degli Studi di Torino' },
  { domain: 'unimib.it', name: 'Università degli Studi di Milano-Bicocca' },
  { domain: 'unige.it', name: 'Università di Genova' },
  { domain: 'unica.it', name: 'Università degli Studi di Cagliari' },
  { domain: 'unipa.it', name: 'Università degli Studi di Palermo' },
  { domain: 'unict.it', name: 'Università di Catania' },
  { domain: 'uniba.it', name: 'Università degli Studi di Bari Aldo Moro' },
  { domain: 'unisalento.it', name: 'Università del Salento' },
  { domain: 'unisi.it', name: 'Università di Siena' },
  { domain: 'unitn.it', name: 'Università degli Studi di Trento' },
  { domain: 'univr.it', name: 'Università di Verona' },
  { domain: 'unipv.it', name: 'Università di Pavia' },
  { domain: 'unibs.it', name: 'Università degli Studi di Brescia' },
  { domain: 'unimore.it', name: 'Università di Modena e Reggio Emilia' },
  { domain: 'uniud.it', name: 'Università degli Studi di Udine' },
  { domain: 'units.it', name: 'Università degli Studi di Trieste' },
  { domain: 'unipr.it', name: 'Università degli Studi di Parma' },
  { domain: 'unife.it', name: 'Università degli Studi di Ferrara' },
  { domain: 'univpm.it', name: 'Università Politecnica delle Marche' },
  { domain: 'unipg.it', name: 'Università degli Studi di Perugia' },
  { domain: 'unistrapg.it', name: 'Università per Stranieri di Perugia' },
  { domain: 'unicam.it', name: 'Università degli Studi di Camerino' },
  { domain: 'unimc.it', name: 'Università degli Studi di Macerata' },
  { domain: 'uniurb.it', name: 'Università degli Studi di Urbino Carlo Bo' },
  { domain: 'uniss.it', name: 'Università degli Studi di Sassari' },
  { domain: 'unich.it', name: 'Università degli Studi "G. d\'Annunzio" Chieti-Pescara' },
  { domain: 'unimol.it', name: 'Università degli Studi del Molise' },
  { domain: 'unical.it', name: 'Università della Calabria' },
  { domain: 'unirc.it', name: 'Università Mediterranea di Reggio Calabria' },
  { domain: 'unibas.it', name: 'Università degli Studi della Basilicata' },
  { domain: 'univaq.it', name: 'Università degli Studi dell\'Aquila' },
  { domain: 'iuav.it', name: 'Università Iuav di Venezia' },
  { domain: 'unive.it', name: 'Università Ca\' Foscari Venezia' },
  { domain: 'uniupo.it', name: 'Università del Piemonte Orientale' },
  { domain: 'uninsubria.it', name: 'Università degli Studi dell\'Insubria' },
  { domain: 'unibz.it', name: 'Libera Università di Bolzano' },
  { domain: 'iulm.it', name: 'IULM' },
  { domain: 'unisr.it', name: 'Università Vita-Salute San Raffaele' },
  { domain: 'unicampus.it', name: 'Università Campus Bio-Medico di Roma' },
  { domain: 'lumsa.it', name: 'LUMSA' },
  { domain: 'unimarconi.it', name: 'Università degli Studi Guglielmo Marconi' },
  { domain: 'unipegaso.it', name: 'Università Telematica Pegaso' },
  { domain: 'uniecampus.it', name: 'Università Telematica e-Campus' },
  { domain: 'unicusano.it', name: 'Università Niccolò Cusano' },
  { domain: 'unifg.it', name: 'Università degli Studi di Foggia' },
  { domain: 'unicz.it', name: 'Università Magna Graecia di Catanzaro' },
  { domain: 'unior.it', name: 'Università degli Studi di Napoli L\'Orientale' },
  { domain: 'uniparthenope.it', name: 'Università degli Studi di Napoli Parthenope' },
  { domain: 'unicampania.it', name: 'Università della Campania Luigi Vanvitelli' },
  { domain: 'sissa.it', name: 'SISSA' },
];
