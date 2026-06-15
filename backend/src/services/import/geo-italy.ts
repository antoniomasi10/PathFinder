/**
 * Italian geo utilities for opportunity importers.
 *
 * Maps free-text location strings (EN or IT) to Italian region + province using
 * a static dictionary of all 20 regions, all 107 provincial capitals, and key
 * university / startup hub cities.
 *
 * Only applied when country === 'IT' (callers must verify this first).
 * See batch.ts for the integration point.
 */

export interface ItalianGeoResult {
  region: string;
  province: string;
  canonicalCity: string;
}

/** Lowercase + strip accents + collapse non-alphanumeric runs to single space. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Each entry: [normalized key, region, province code, canonical Italian city name]
// Multi-word entries MUST come before shorter overlapping entries so that
// "reggio calabria" is tested before "reggio emilia" etc. (sorted by length desc
// at module init — see SORTED_ENTRIES below).
type Entry = [string, string, string, string];

const ENTRIES: Entry[] = [
  // --- Valle d'Aosta ---
  ["valle d aosta", "Valle d'Aosta", 'AO', 'Aosta'],
  ['aosta',         "Valle d'Aosta", 'AO', 'Aosta'],

  // --- Piemonte ---
  ['torino',     'Piemonte', 'TO', 'Torino'],
  ['turin',      'Piemonte', 'TO', 'Torino'],
  ['alessandria','Piemonte', 'AL', 'Alessandria'],
  ['asti',       'Piemonte', 'AT', 'Asti'],
  ['biella',     'Piemonte', 'BI', 'Biella'],
  ['cuneo',      'Piemonte', 'CN', 'Cuneo'],
  ['novara',     'Piemonte', 'NO', 'Novara'],
  ['verbania',   'Piemonte', 'VB', 'Verbania'],
  ['vercelli',   'Piemonte', 'VC', 'Vercelli'],
  ['piemonte',   'Piemonte', 'TO', 'Torino'],
  ['piedmont',   'Piemonte', 'TO', 'Torino'],

  // --- Liguria ---
  ['genova',    'Liguria', 'GE', 'Genova'],
  ['genoa',     'Liguria', 'GE', 'Genova'],
  ['imperia',   'Liguria', 'IM', 'Imperia'],
  ['la spezia', 'Liguria', 'SP', 'La Spezia'],
  ['savona',    'Liguria', 'SV', 'Savona'],
  ['liguria',   'Liguria', 'GE', 'Genova'],

  // --- Lombardia ---
  ['bergamo',    'Lombardia', 'BG', 'Bergamo'],
  ['brescia',    'Lombardia', 'BS', 'Brescia'],
  ['cremona',    'Lombardia', 'CR', 'Cremona'],
  ['lecco',      'Lombardia', 'LC', 'Lecco'],
  ['mantova',    'Lombardia', 'MN', 'Mantova'],
  ['mantua',     'Lombardia', 'MN', 'Mantova'],
  ['milano',     'Lombardia', 'MI', 'Milano'],
  ['milan',      'Lombardia', 'MI', 'Milano'],
  ['monza',      'Lombardia', 'MB', 'Monza'],
  ['pavia',      'Lombardia', 'PV', 'Pavia'],
  ['sondrio',    'Lombardia', 'SO', 'Sondrio'],
  ['varese',     'Lombardia', 'VA', 'Varese'],
  ['lodi',       'Lombardia', 'LO', 'Lodi'],
  ['como',       'Lombardia', 'CO', 'Como'],
  ['lombardia',  'Lombardia', 'MI', 'Milano'],
  ['lombardy',   'Lombardia', 'MI', 'Milano'],

  // --- Trentino-Alto Adige ---
  ['friuli venezia giulia', 'Friuli-Venezia Giulia', 'UD', 'Udine'], // must precede 'friuli'
  ['alto adige',            'Trentino-Alto Adige',   'BZ', 'Bolzano'],
  ['south tyrol',           'Trentino-Alto Adige',   'BZ', 'Bolzano'],
  ['sudtirol',              'Trentino-Alto Adige',   'BZ', 'Bolzano'],
  ['trentino',              'Trentino-Alto Adige',   'TN', 'Trento'],
  ['bolzano',               'Trentino-Alto Adige',   'BZ', 'Bolzano'],
  ['bozen',                 'Trentino-Alto Adige',   'BZ', 'Bolzano'],
  ['trento',                'Trentino-Alto Adige',   'TN', 'Trento'],
  ['trent',                 'Trentino-Alto Adige',   'TN', 'Trento'],

  // --- Veneto ---
  ['venezia', 'Veneto', 'VE', 'Venezia'],
  ['venice',  'Veneto', 'VE', 'Venezia'],
  ['belluno', 'Veneto', 'BL', 'Belluno'],
  ['padova',  'Veneto', 'PD', 'Padova'],
  ['padua',   'Veneto', 'PD', 'Padova'],
  ['rovigo',  'Veneto', 'RO', 'Rovigo'],
  ['treviso', 'Veneto', 'TV', 'Treviso'],
  ['verona',  'Veneto', 'VR', 'Verona'],
  ['vicenza', 'Veneto', 'VI', 'Vicenza'],
  ['veneto',  'Veneto', 'VE', 'Venezia'],

  // --- Friuli-Venezia Giulia ---
  ['trieste',   'Friuli-Venezia Giulia', 'TS', 'Trieste'],
  ['gorizia',   'Friuli-Venezia Giulia', 'GO', 'Gorizia'],
  ['pordenone', 'Friuli-Venezia Giulia', 'PN', 'Pordenone'],
  ['udine',     'Friuli-Venezia Giulia', 'UD', 'Udine'],
  ['friuli',    'Friuli-Venezia Giulia', 'UD', 'Udine'],

  // --- Emilia-Romagna ---
  ['reggio nell emilia', 'Emilia-Romagna', 'RE', 'Reggio Emilia'], // must precede 'reggio emilia'
  ['reggio emilia',      'Emilia-Romagna', 'RE', 'Reggio Emilia'],
  ['emilia romagna',     'Emilia-Romagna', 'BO', 'Bologna'],
  ['bologna',   'Emilia-Romagna', 'BO', 'Bologna'],
  ['ferrara',   'Emilia-Romagna', 'FE', 'Ferrara'],
  ['forli',     'Emilia-Romagna', 'FC', 'Forlì'],
  ['cesena',    'Emilia-Romagna', 'FC', 'Cesena'],
  ['modena',    'Emilia-Romagna', 'MO', 'Modena'],
  ['parma',     'Emilia-Romagna', 'PR', 'Parma'],
  ['piacenza',  'Emilia-Romagna', 'PC', 'Piacenza'],
  ['ravenna',   'Emilia-Romagna', 'RA', 'Ravenna'],
  ['rimini',    'Emilia-Romagna', 'RN', 'Rimini'],

  // --- Toscana ---
  ['firenze',  'Toscana', 'FI', 'Firenze'],
  ['florence', 'Toscana', 'FI', 'Firenze'],
  ['arezzo',   'Toscana', 'AR', 'Arezzo'],
  ['grosseto', 'Toscana', 'GR', 'Grosseto'],
  ['livorno',  'Toscana', 'LI', 'Livorno'],
  ['lucca',    'Toscana', 'LU', 'Lucca'],
  ['carrara',  'Toscana', 'MS', 'Carrara'],
  ['massa',    'Toscana', 'MS', 'Massa'],
  ['pisa',     'Toscana', 'PI', 'Pisa'],
  ['pistoia',  'Toscana', 'PT', 'Pistoia'],
  ['prato',    'Toscana', 'PO', 'Prato'],
  ['siena',    'Toscana', 'SI', 'Siena'],
  ['toscana',  'Toscana', 'FI', 'Firenze'],
  ['tuscany',  'Toscana', 'FI', 'Firenze'],

  // --- Umbria ---
  ['perugia', 'Umbria', 'PG', 'Perugia'],
  ['terni',   'Umbria', 'TR', 'Terni'],
  ['umbria',  'Umbria', 'PG', 'Perugia'],

  // --- Marche ---
  ['ascoli piceno', 'Marche', 'AP', 'Ascoli Piceno'],
  ['ancona',   'Marche', 'AN', 'Ancona'],
  ['camerino', 'Marche', 'MC', 'Camerino'],
  ['fermo',    'Marche', 'FM', 'Fermo'],
  ['macerata', 'Marche', 'MC', 'Macerata'],
  ['pesaro',   'Marche', 'PU', 'Pesaro'],
  ['urbino',   'Marche', 'PU', 'Urbino'],
  ['marche',   'Marche', 'AN', 'Ancona'],

  // --- Lazio ---
  ['roma',      'Lazio', 'RM', 'Roma'],
  ['rome',      'Lazio', 'RM', 'Roma'],
  ['frosinone', 'Lazio', 'FR', 'Frosinone'],
  ['latina',    'Lazio', 'LT', 'Latina'],
  ['rieti',     'Lazio', 'RI', 'Rieti'],
  ['viterbo',   'Lazio', 'VT', 'Viterbo'],
  ['lazio',     'Lazio', 'RM', 'Roma'],

  // --- Abruzzo ---
  ['l aquila', 'Abruzzo', 'AQ', "L'Aquila"],
  ['chieti',   'Abruzzo', 'CH', 'Chieti'],
  ['pescara',  'Abruzzo', 'PE', 'Pescara'],
  ['teramo',   'Abruzzo', 'TE', 'Teramo'],
  ['abruzzo',  'Abruzzo', 'AQ', "L'Aquila"],

  // --- Molise ---
  ['campobasso', 'Molise', 'CB', 'Campobasso'],
  ['isernia',    'Molise', 'IS', 'Isernia'],
  ['molise',     'Molise', 'CB', 'Campobasso'],

  // --- Campania ---
  ['napoli',    'Campania', 'NA', 'Napoli'],
  ['naples',    'Campania', 'NA', 'Napoli'],
  ['avellino',  'Campania', 'AV', 'Avellino'],
  ['benevento', 'Campania', 'BN', 'Benevento'],
  ['caserta',   'Campania', 'CE', 'Caserta'],
  ['salerno',   'Campania', 'SA', 'Salerno'],
  ['campania',  'Campania', 'NA', 'Napoli'],

  // --- Puglia ---
  ['vibo valentia',  'Calabria', 'VV', 'Vibo Valentia'], // see Calabria block — placed here for length sort
  ['reggio calabria','Calabria', 'RC', 'Reggio Calabria'],
  ['barletta',  'Puglia', 'BT', 'Barletta'],
  ['andria',    'Puglia', 'BT', 'Andria'],
  ['brindisi',  'Puglia', 'BR', 'Brindisi'],
  ['foggia',    'Puglia', 'FG', 'Foggia'],
  ['taranto',   'Puglia', 'TA', 'Taranto'],
  ['trani',     'Puglia', 'BT', 'Trani'],
  ['lecce',     'Puglia', 'LE', 'Lecce'],
  ['bari',      'Puglia', 'BA', 'Bari'],
  ['puglia',    'Puglia', 'BA', 'Bari'],
  ['apulia',    'Puglia', 'BA', 'Bari'],

  // --- Basilicata ---
  ['potenza',    'Basilicata', 'PZ', 'Potenza'],
  ['matera',     'Basilicata', 'MT', 'Matera'],
  ['basilicata', 'Basilicata', 'PZ', 'Potenza'],

  // --- Calabria ---
  ['catanzaro', 'Calabria', 'CZ', 'Catanzaro'],
  ['cosenza',   'Calabria', 'CS', 'Cosenza'],
  ['crotone',   'Calabria', 'KR', 'Crotone'],
  ['calabria',  'Calabria', 'CZ', 'Catanzaro'],

  // --- Sicilia ---
  ['caltanissetta', 'Sicilia', 'CL', 'Caltanissetta'],
  ['agrigento',     'Sicilia', 'AG', 'Agrigento'],
  ['catania',       'Sicilia', 'CT', 'Catania'],
  ['messina',       'Sicilia', 'ME', 'Messina'],
  ['palermo',       'Sicilia', 'PA', 'Palermo'],
  ['ragusa',        'Sicilia', 'RG', 'Ragusa'],
  ['siracusa',      'Sicilia', 'SR', 'Siracusa'],
  ['syracuse',      'Sicilia', 'SR', 'Siracusa'],
  ['trapani',       'Sicilia', 'TP', 'Trapani'],
  ['enna',          'Sicilia', 'EN', 'Enna'],
  ['sicilia',       'Sicilia', 'PA', 'Palermo'],
  ['sicily',        'Sicilia', 'PA', 'Palermo'],

  // --- Sardegna ---
  ['cagliari',  'Sardegna', 'CA', 'Cagliari'],
  ['nuoro',     'Sardegna', 'NU', 'Nuoro'],
  ['oristano',  'Sardegna', 'OR', 'Oristano'],
  ['sassari',   'Sardegna', 'SS', 'Sassari'],
  ['sardegna',  'Sardegna', 'CA', 'Cagliari'],
  ['sardinia',  'Sardegna', 'CA', 'Cagliari'],
];

// Deduplicate and sort longest-first so specific multi-word entries win.
const _seen = new Set<string>();
const SORTED_ENTRIES: Array<[string, ItalianGeoResult]> = ENTRIES
  .filter(([key]) => {
    if (_seen.has(key)) return false;
    _seen.add(key);
    return true;
  })
  .sort((a, b) => b[0].length - a[0].length)
  .map(([key, region, province, canonicalCity]) => [key, { region, province, canonicalCity }]);

/**
 * Identifies an Italian region from a free-text location string (IT or EN).
 * Uses word-boundary matching to avoid false positives (e.g. "asti" in
 * "plastic"). Returns null if no match found.
 *
 * Typical inputs: "Milano, IT", "rome", "Puglia", "Reggio Calabria", "Venice"
 */
export function mapItalianRegion(location: string | null | undefined): ItalianGeoResult | null {
  if (!location) return null;
  const padded = ` ${norm(location)} `;
  if (padded.length <= 2) return null;

  for (const [key, result] of SORTED_ENTRIES) {
    if (padded.includes(` ${key} `)) return result;
  }
  return null;
}
