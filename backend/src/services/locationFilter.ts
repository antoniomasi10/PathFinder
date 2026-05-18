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
}

/**
 * Resolve a full search input into one or more {iso, term} tokens.
 * Tries the full input first (handles multi-word entries like "regno unito",
 * "new york"), then tokenizes by comma/whitespace and looks up each piece.
 */
export function resolveLocationTokens(input: string): LocationResolution[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const out: LocationResolution[] = [];

  const full = trimmed.toLowerCase();
  const fullIso = COUNTRY_MAP[full] ?? CITY_TO_COUNTRY[full] ?? null;
  if (fullIso) out.push({ iso: fullIso, term: trimmed });

  const parts = trimmed.split(/[,;]|\s+/).map(p => p.trim()).filter(Boolean);
  for (const p of parts) {
    const norm = p.toLowerCase();
    const iso = COUNTRY_MAP[norm] ?? CITY_TO_COUNTRY[norm] ?? null;
    if (out.some(o => o.term.toLowerCase() === norm)) continue;
    out.push({ iso, term: p });
  }
  return out;
}

/** Back-compat single resolver — picks the first ISO match, else first token. */
export function resolveLocationFilter(input: string): { iso: string | null; term: string } {
  const tokens = resolveLocationTokens(input);
  const first = tokens.find(t => t.iso) ?? tokens[0];
  return first ?? { iso: null, term: input.trim() };
}
