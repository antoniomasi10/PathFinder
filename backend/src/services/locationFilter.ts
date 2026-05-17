const COUNTRY_MAP: Record<string, string> = {
  'italia': 'IT', 'italy': 'IT',
  'germania': 'DE', 'germany': 'DE',
  'francia': 'FR', 'france': 'FR',
  'spagna': 'ES', 'spain': 'ES',
  'belgio': 'BE', 'belgium': 'BE',
  'svizzera': 'CH', 'switzerland': 'CH',
  'regno unito': 'GB', 'uk': 'GB', 'united kingdom': 'GB',
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
  'stati uniti': 'US', 'usa': 'US', 'united states': 'US',
};

export function resolveLocationFilter(input: string): { iso: string | null; term: string } {
  const normalized = input.trim().toLowerCase();
  const iso = COUNTRY_MAP[normalized] ?? null;
  return { iso, term: input.trim() };
}
