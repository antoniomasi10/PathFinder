// Italian ↔ English aliases for city/country names commonly stored in English in the DB.
// When a user types an Italian name, we also search for its English form and vice versa.
const TERM_ALIASES: Record<string, string[]> = {
  // Italian cities → English
  'milano': ['milan'], 'roma': ['rome'], 'torino': ['turin'], 'napoli': ['naples'],
  'firenze': ['florence'], 'venezia': ['venice'], 'genova': ['genoa'],
  'padova': ['padua'], 'londra': ['london'], 'berlino': ['berlin'],
  'parigi': ['paris'], 'monaco': ['munich', 'münchen'], 'amburgo': ['hamburg'],
  'francoforte': ['frankfurt'], 'colonia': ['cologne'], 'barcellona': ['barcelona'],
  'siviglia': ['seville'], 'lisbona': ['lisbon'], 'varsavia': ['warsaw'],
  'cracovia': ['krakow'], 'praga': ['prague'], 'atene': ['athens'],
  'stoccolma': ['stockholm'], 'zurigo': ['zurich'], 'ginevra': ['geneva'],
  'losanna': ['lausanne'], 'pechino': ['beijing'], 'gerusalemme': ['jerusalem'],
  // English cities → Italian
  'milan': ['milano'], 'rome': ['roma'], 'turin': ['torino'], 'naples': ['napoli'],
  'florence': ['firenze'], 'venice': ['venezia'], 'genoa': ['genova'],
  'padua': ['padova'], 'london': ['londra'], 'berlin': ['berlino'],
  'paris': ['parigi'], 'munich': ['monaco', 'münchen'], 'hamburg': ['amburgo'],
  'frankfurt': ['francoforte'], 'cologne': ['colonia'], 'barcelona': ['barcellona'],
  'seville': ['siviglia'], 'lisbon': ['lisbona'], 'warsaw': ['varsavia'],
  'krakow': ['cracovia'], 'prague': ['praga'], 'athens': ['atene'],
  'stockholm': ['stoccolma'], 'zurich': ['zurigo'], 'geneva': ['ginevra'],
  'lausanne': ['losanna'], 'beijing': ['pechino'], 'jerusalem': ['gerusalemme'],
  // Country names Italian → English (for location strings stored in English)
  'italia': ['italy'], 'germania': ['germany'], 'francia': ['france'],
  'spagna': ['spain'], 'belgio': ['belgium'], 'svizzera': ['switzerland'],
  'olanda': ['netherlands'], 'paesi bassi': ['netherlands'],
  'danimarca': ['denmark'], 'norvegia': ['norway'], 'svezia': ['sweden'],
  'finlandia': ['finland'], 'portogallo': ['portugal'], 'irlanda': ['ireland'],
  'polonia': ['poland'], 'grecia': ['greece'], 'ungheria': ['hungary'],
  'romania': ['romania'], 'croazia': ['croatia'], 'slovacchia': ['slovakia'],
  'giappone': ['japan'], 'cina': ['china'], 'corea del sud': ['south korea'],
  'brasile': ['brazil'], 'messico': ['mexico'],
  // Country names English → Italian (less critical but symmetric)
  'italy': ['italia'], 'germany': ['germania'], 'france': ['francia'],
  'spain': ['spagna'], 'belgium': ['belgio'], 'switzerland': ['svizzera'],
  'netherlands': ['olanda'], 'denmark': ['danimarca'], 'norway': ['norvegia'],
  'sweden': ['svezia'], 'finland': ['finlandia'], 'portugal': ['portogallo'],
  'ireland': ['irlanda'], 'poland': ['polonia'], 'greece': ['grecia'],
  'hungary': ['ungheria'], 'croatia': ['croazia'], 'slovakia': ['slovacchia'],
  'japan': ['giappone'], 'china': ['cina'], 'brazil': ['brasile'],
  'mexico': ['messico'],
};

// Italian city → region (for proximity search).
// Includes both Italian and English city names so lookups work regardless of form.
const CITY_TO_REGION: Record<string, string> = {
  // Lombardia
  'milano': 'Lombardia', 'milan': 'Lombardia', 'bergamo': 'Lombardia', 'brescia': 'Lombardia',
  'como': 'Lombardia', 'pavia': 'Lombardia', 'varese': 'Lombardia', 'monza': 'Lombardia',
  'mantova': 'Lombardia', 'cremona': 'Lombardia', 'lecco': 'Lombardia', 'sondrio': 'Lombardia',
  'lodi': 'Lombardia',
  // Lazio
  'roma': 'Lazio', 'rome': 'Lazio', 'latina': 'Lazio', 'frosinone': 'Lazio',
  'rieti': 'Lazio', 'viterbo': 'Lazio',
  // Piemonte
  'torino': 'Piemonte', 'turin': 'Piemonte', 'novara': 'Piemonte', 'asti': 'Piemonte',
  'alessandria': 'Piemonte', 'cuneo': 'Piemonte', 'biella': 'Piemonte', 'vercelli': 'Piemonte',
  // Emilia-Romagna
  'bologna': 'Emilia-Romagna', 'modena': 'Emilia-Romagna', 'parma': 'Emilia-Romagna',
  'reggio emilia': 'Emilia-Romagna', 'rimini': 'Emilia-Romagna', 'ferrara': 'Emilia-Romagna',
  'forlì': 'Emilia-Romagna', 'forli': 'Emilia-Romagna', 'cesena': 'Emilia-Romagna',
  'piacenza': 'Emilia-Romagna', 'ravenna': 'Emilia-Romagna',
  // Campania
  'napoli': 'Campania', 'naples': 'Campania', 'salerno': 'Campania', 'caserta': 'Campania',
  'avellino': 'Campania', 'benevento': 'Campania',
  // Toscana
  'firenze': 'Toscana', 'florence': 'Toscana', 'pisa': 'Toscana', 'siena': 'Toscana',
  'lucca': 'Toscana', 'livorno': 'Toscana', 'arezzo': 'Toscana', 'pistoia': 'Toscana',
  'prato': 'Toscana', 'grosseto': 'Toscana', 'massa': 'Toscana', 'carrara': 'Toscana',
  // Puglia
  'bari': 'Puglia', 'lecce': 'Puglia', 'taranto': 'Puglia', 'foggia': 'Puglia',
  'brindisi': 'Puglia', 'andria': 'Puglia', 'barletta': 'Puglia', 'trani': 'Puglia',
  // Sicilia
  'palermo': 'Sicilia', 'catania': 'Sicilia', 'messina': 'Sicilia', 'siracusa': 'Sicilia',
  'ragusa': 'Sicilia', 'trapani': 'Sicilia', 'agrigento': 'Sicilia', 'caltanissetta': 'Sicilia',
  'enna': 'Sicilia',
  // Liguria
  'genova': 'Liguria', 'genoa': 'Liguria', 'la spezia': 'Liguria', 'savona': 'Liguria',
  'imperia': 'Liguria',
  // Veneto
  'venezia': 'Veneto', 'venice': 'Veneto', 'padova': 'Veneto', 'padua': 'Veneto',
  'verona': 'Veneto', 'vicenza': 'Veneto', 'treviso': 'Veneto', 'rovigo': 'Veneto',
  'belluno': 'Veneto',
  // Friuli-Venezia Giulia
  'trieste': 'Friuli-Venezia Giulia', 'udine': 'Friuli-Venezia Giulia',
  'pordenone': 'Friuli-Venezia Giulia', 'gorizia': 'Friuli-Venezia Giulia',
  // Trentino-Alto Adige
  'trento': 'Trentino-Alto Adige', 'bolzano': 'Trentino-Alto Adige',
  // Calabria
  'cosenza': 'Calabria', 'catanzaro': 'Calabria', 'reggio calabria': 'Calabria',
  'crotone': 'Calabria', 'vibo valentia': 'Calabria',
  // Sardegna
  'cagliari': 'Sardegna', 'sassari': 'Sardegna', 'nuoro': 'Sardegna',
  'oristano': 'Sardegna', 'olbia': 'Sardegna',
  // Marche
  'ancona': 'Marche', 'pesaro': 'Marche', 'macerata': 'Marche', 'fermo': 'Marche',
  'ascoli piceno': 'Marche',
  // Abruzzo
  "l'aquila": 'Abruzzo', 'laquila': 'Abruzzo', 'pescara': 'Abruzzo',
  'teramo': 'Abruzzo', 'chieti': 'Abruzzo',
  // Molise
  'campobasso': 'Molise', 'isernia': 'Molise',
  // Basilicata
  'potenza': 'Basilicata', 'matera': 'Basilicata',
  // Umbria
  'perugia': 'Umbria', 'terni': 'Umbria',
  // Valle d'Aosta
  "aosta": "Valle d'Aosta",
};

// Country name → ISO-3166-1 alpha-2.
// Keep this list pragmatic: countries Italian students realistically apply to.
const COUNTRY_MAP: Record<string, string> = {
  // EU
  'italia': 'IT', 'italy': 'IT',
  'germania': 'DE', 'germany': 'DE', 'deutschland': 'DE',
  'francia': 'FR', 'france': 'FR',
  'spagna': 'ES', 'spain': 'ES', 'españa': 'ES',
  'belgio': 'BE', 'belgium': 'BE',
  'svizzera': 'CH', 'switzerland': 'CH',
  'regno unito': 'GB', 'uk': 'GB', 'united kingdom': 'GB', 'gran bretagna': 'GB', 'inghilterra': 'GB', 'england': 'GB',
  'svezia': 'SE', 'sweden': 'SE',
  'portogallo': 'PT', 'portugal': 'PT',
  'finlandia': 'FI', 'finland': 'FI',
  'austria': 'AT',
  'olanda': 'NL', 'paesi bassi': 'NL', 'netherlands': 'NL',
  'danimarca': 'DK', 'denmark': 'DK',
  'norvegia': 'NO', 'norway': 'NO',
  'irlanda': 'IE', 'ireland': 'IE',
  'polonia': 'PL', 'poland': 'PL',
  'grecia': 'GR', 'greece': 'GR',
  'repubblica ceca': 'CZ', 'czech republic': 'CZ', 'cechia': 'CZ',
  'ungheria': 'HU', 'hungary': 'HU',
  'romania': 'RO',
  'bulgaria': 'BG',
  'croazia': 'HR', 'croatia': 'HR',
  'slovenia': 'SI',
  'slovacchia': 'SK', 'slovakia': 'SK',
  'estonia': 'EE',
  'lettonia': 'LV', 'latvia': 'LV',
  'lituania': 'LT', 'lithuania': 'LT',
  'lussemburgo': 'LU', 'luxembourg': 'LU',
  'malta': 'MT',
  'cipro': 'CY', 'cyprus': 'CY',
  'islanda': 'IS', 'iceland': 'IS',
  // Anglosphere
  'stati uniti': 'US', 'usa': 'US', 'united states': 'US', 'america': 'US',
  'canada': 'CA',
  'australia': 'AU',
  'nuova zelanda': 'NZ', 'new zealand': 'NZ',
  // Asia
  'giappone': 'JP', 'japan': 'JP',
  'cina': 'CN', 'china': 'CN',
  'corea del sud': 'KR', 'south korea': 'KR', 'korea': 'KR',
  'india': 'IN',
  'singapore': 'SG',
  'hong kong': 'HK',
  // Middle East
  'israele': 'IL', 'israel': 'IL',
  'emirati arabi uniti': 'AE', 'uae': 'AE',
  'arabia saudita': 'SA', 'saudi arabia': 'SA',
  'turchia': 'TR', 'turkey': 'TR',
  // Americas
  'messico': 'MX', 'mexico': 'MX',
  'brasile': 'BR', 'brazil': 'BR',
  'argentina': 'AR',
  'cile': 'CL', 'chile': 'CL',
  // Africa
  'sud africa': 'ZA', 'south africa': 'ZA',
  'marocco': 'MA', 'morocco': 'MA',
  'egitto': 'EG', 'egypt': 'EG',
};

// City → ISO country. Top European/global cities students target.
const CITY_TO_COUNTRY: Record<string, string> = {
  // Italy
  'roma': 'IT', 'rome': 'IT',
  'milano': 'IT', 'milan': 'IT',
  'torino': 'IT', 'turin': 'IT',
  'napoli': 'IT', 'naples': 'IT',
  'bologna': 'IT', 'firenze': 'IT', 'florence': 'IT',
  'venezia': 'IT', 'venice': 'IT',
  'bari': 'IT', 'palermo': 'IT', 'catania': 'IT', 'genova': 'IT', 'genoa': 'IT',
  // UK / Ireland
  'london': 'GB', 'londra': 'GB',
  'manchester': 'GB', 'edinburgh': 'GB', 'oxford': 'GB', 'cambridge': 'GB',
  'dublin': 'IE', 'dublino': 'IE',
  // France
  'paris': 'FR', 'parigi': 'FR',
  'lyon': 'FR', 'marseille': 'FR', 'toulouse': 'FR',
  // Germany
  'berlin': 'DE', 'berlino': 'DE',
  'munich': 'DE', 'münchen': 'DE',
  'hamburg': 'DE', 'amburgo': 'DE',
  'frankfurt': 'DE', 'francoforte': 'DE',
  'cologne': 'DE', 'colonia': 'DE',
  // Spain
  'madrid': 'ES', 'barcelona': 'ES', 'barcellona': 'ES', 'valencia': 'ES', 'seville': 'ES', 'siviglia': 'ES',
  // Netherlands
  'amsterdam': 'NL', 'rotterdam': 'NL', 'eindhoven': 'NL', 'utrecht': 'NL',
  // Belgium
  'brussels': 'BE', 'bruxelles': 'BE', 'antwerp': 'BE',
  // Switzerland
  'zurich': 'CH', 'zurigo': 'CH', 'geneva': 'CH', 'ginevra': 'CH', 'basel': 'CH', 'lausanne': 'CH', 'losanna': 'CH',
  // Nordics
  'stockholm': 'SE', 'stoccolma': 'SE',
  'copenhagen': 'DK',
  'oslo': 'NO',
  'helsinki': 'FI',
  // Other EU
  'lisbon': 'PT', 'lisbona': 'PT', 'porto': 'PT',
  'vienna': 'AT', 'salzburg': 'AT',
  'prague': 'CZ', 'praga': 'CZ',
  'warsaw': 'PL', 'varsavia': 'PL', 'krakow': 'PL', 'cracovia': 'PL',
  'athens': 'GR', 'atene': 'GR',
  'budapest': 'HU',
  // North America
  'new york': 'US', 'boston': 'US', 'san francisco': 'US', 'los angeles': 'US', 'chicago': 'US', 'seattle': 'US', 'washington': 'US',
  'toronto': 'CA', 'montreal': 'CA', 'vancouver': 'CA',
  // Asia / Pacific
  'tokyo': 'JP', 'osaka': 'JP', 'kyoto': 'JP',
  'beijing': 'CN', 'pechino': 'CN', 'shanghai': 'CN', 'shenzhen': 'CN',
  'seoul': 'KR',
  'sydney': 'AU', 'melbourne': 'AU',
  // Middle East
  'tel aviv': 'IL', 'jerusalem': 'IL', 'gerusalemme': 'IL',
  'dubai': 'AE', 'abu dhabi': 'AE',
  // Americas
  'mexico city': 'MX',
  'sao paulo': 'BR', 'são paulo': 'BR', 'rio de janeiro': 'BR',
};

export interface LocationResolution {
  iso: string | null;
  term: string;
  aliases: string[];
  region: string | null;
}

/**
 * Resolve a full search input into one or more {iso, term, aliases, region} tokens.
 * Tries the full input first (handles multi-word entries like "regno unito",
 * "new york"), then tokenizes by comma/whitespace and looks up each piece.
 * aliases: alternative spellings (e.g. "milano" → ["milan"]) for DB ILIKE matching.
 * region: Italian region if the term is a known Italian city, for proximity search.
 */
export function resolveLocationTokens(input: string): LocationResolution[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const out: LocationResolution[] = [];

  const full = trimmed.toLowerCase();
  const fullIso = COUNTRY_MAP[full] ?? CITY_TO_COUNTRY[full] ?? null;
  if (fullIso) {
    out.push({
      iso: fullIso,
      term: trimmed,
      aliases: TERM_ALIASES[full] ?? [],
      region: CITY_TO_REGION[full] ?? null,
    });
  }

  const parts = trimmed.split(/[,;]|\s+/).map(p => p.trim()).filter(Boolean);
  for (const p of parts) {
    const norm = p.toLowerCase();
    const iso = COUNTRY_MAP[norm] ?? CITY_TO_COUNTRY[norm] ?? null;
    if (out.some(o => o.term.toLowerCase() === norm)) continue;
    out.push({
      iso,
      term: p,
      aliases: TERM_ALIASES[norm] ?? [],
      region: CITY_TO_REGION[norm] ?? null,
    });
  }
  return out;
}

/** Returns the Italian region for a city name (Italian or English), or null. */
export function getCityRegion(city: string): string | null {
  return CITY_TO_REGION[city.trim().toLowerCase()] ?? null;
}

/** Back-compat single resolver — picks the first ISO match, else first token. */
export function resolveLocationFilter(input: string): { iso: string | null; term: string } {
  const tokens = resolveLocationTokens(input);
  const first = tokens.find(t => t.iso) ?? tokens[0];
  return first ?? { iso: null, term: input.trim() };
}
