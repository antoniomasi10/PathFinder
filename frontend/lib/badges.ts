export type BadgeRarity = 'comune' | 'non_comune' | 'rara' | 'epica' | 'leggendaria';
export type BadgeCategory = 'esplorazione' | 'confronto' | 'simulazioni' | 'organizzazione' | 'ricerca' | 'decisione' | 'azione' | 'engagement';

export interface BadgeDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: BadgeRarity;
  category: BadgeCategory;
  target: number;
  trackingKey: string; // key in localStorage progress
}

export interface BadgeProgress {
  current: number;
  unlockedAt?: string; // ISO date string
}

const STORAGE_KEY = 'pf-badge-progress';

export const RARITY_COLORS: Record<BadgeRarity, { bg: string; border: string; glow: string }> = {
  comune:      { bg: 'linear-gradient(135deg, #3A3F5C, #4A4F6C)', border: '#5A5F7C', glow: 'none' },
  non_comune:  { bg: 'linear-gradient(135deg, #1E3A5F, #2A5A8F)', border: '#4A9EFF', glow: '0 0 12px rgba(74,158,255,0.3)' },
  rara:        { bg: 'linear-gradient(135deg, #4A1A6B, #7C3AED)', border: '#9C5AFF', glow: '0 0 12px rgba(124,58,237,0.4)' },
  epica:       { bg: 'linear-gradient(135deg, #7A3300, #FF6B00)', border: '#FF8C3A', glow: '0 0 16px rgba(255,107,0,0.4)' },
  leggendaria: { bg: 'linear-gradient(135deg, #8B6914, #FFD700)', border: '#FFE44D', glow: '0 0 20px rgba(255,215,0,0.5)' },
};

export const RARITY_LABELS: Record<BadgeRarity, string> = {
  comune: 'Comune',
  non_comune: 'Non comune',
  rara: 'Rara',
  epica: 'Epica',
  leggendaria: 'Leggendaria',
};

export const BADGES: BadgeDefinition[] = [
  // Esplorazione
  { id: 'primo_passo', name: 'Primo Passo', icon: '\u{1F463}', description: 'Hai iniziato il tuo percorso su PathFinder', rarity: 'comune', category: 'esplorazione', target: 1, trackingKey: 'courses_viewed' },
  { id: 'esploratore', name: 'Esploratore', icon: '\u{1F5FA}', description: 'Hai esplorato 10 corsi universitari', rarity: 'comune', category: 'esplorazione', target: 10, trackingKey: 'courses_viewed' },
  { id: 'viaggiatore', name: 'Viaggiatore', icon: '\u{1F30D}', description: 'Hai esplorato 50 corsi in tutta Italia', rarity: 'rara', category: 'esplorazione', target: 50, trackingKey: 'courses_viewed' },

  // Confronto
  { id: 'indeciso', name: 'Indeciso', icon: '\u{1F914}', description: 'Hai confrontato il tuo primo corso', rarity: 'comune', category: 'confronto', target: 1, trackingKey: 'courses_compared' },
  { id: 'analista', name: 'Analista', icon: '\u2696\uFE0F', description: 'Prendi decisioni informate', rarity: 'non_comune', category: 'confronto', target: 5, trackingKey: 'courses_compared' },

  // Simulazioni
  { id: 'primo_tentativo', name: 'Primo Tentativo', icon: '\u{1F3B2}', description: 'Hai simulato la tua prima ammissione', rarity: 'comune', category: 'simulazioni', target: 1, trackingKey: 'simulations_done' },
  { id: 'simulatore', name: 'Simulatore', icon: '\u{1F3AF}', description: 'Conosci bene le tue probabilita', rarity: 'non_comune', category: 'simulazioni', target: 5, trackingKey: 'simulations_done' },
  { id: 'stratega', name: 'Stratega', icon: '\u{1F9E0}', description: 'Pianifichi ogni mossa con attenzione', rarity: 'rara', category: 'simulazioni', target: 10, trackingKey: 'simulations_done' },

  // Organizzazione
  { id: 'pianificatore', name: 'Pianificatore', icon: '\u{1F4CC}', description: 'Non ti fai cogliere impreparato', rarity: 'comune', category: 'organizzazione', target: 1, trackingKey: 'deadlines_added' },
  { id: 'time_manager', name: 'Time Manager', icon: '\u23F0', description: 'Hai il controllo delle tue deadline', rarity: 'non_comune', category: 'organizzazione', target: 5, trackingKey: 'deadlines_added' },

  // Ricerca
  { id: 'curioso', name: 'Curioso', icon: '\u{1F50D}', description: 'Approfondisci prima di decidere', rarity: 'comune', category: 'ricerca', target: 1, trackingKey: 'requirements_viewed' },
  { id: 'researcher', name: 'Researcher', icon: '\u{1F4D6}', description: 'Fai sempre le tue ricerche', rarity: 'non_comune', category: 'ricerca', target: 5, trackingKey: 'requirements_viewed' },

  // Decisione
  { id: 'favorito', name: 'Favorito', icon: '\u2B50', description: 'Hai trovato qualcosa che ti piace', rarity: 'comune', category: 'decisione', target: 1, trackingKey: 'courses_saved' },
  { id: 'collector', name: 'Collector', icon: '\u{1F4BC}', description: 'Stai costruendo la tua wishlist', rarity: 'non_comune', category: 'decisione', target: 5, trackingKey: 'courses_saved' },
  { id: 'decisore', name: 'Decisore', icon: '\u{1F3AF}', description: 'Hai le idee chiare sulle tue opzioni', rarity: 'rara', category: 'decisione', target: 10, trackingKey: 'courses_saved' },

  // Azione
  { id: 'candidato', name: 'Candidato', icon: '\u{1F4DD}', description: 'Hai fatto il primo passo verso il futuro', rarity: 'non_comune', category: 'azione', target: 1, trackingKey: 'applications_clicked' },
  { id: 'go_getter', name: 'Go-Getter', icon: '\u{1F4AA}', description: 'Non ti fermi davanti a nulla', rarity: 'rara', category: 'azione', target: 3, trackingKey: 'applications_clicked' },
  { id: 'ambizioso', name: 'Ambizioso', icon: '\u{1F3C6}', description: 'Punti in alto e non ti accontenti', rarity: 'epica', category: 'azione', target: 5, trackingKey: 'applications_clicked' },

  // Engagement
  { id: 'fedele', name: 'Fedele', icon: '\u{1F49A}', description: 'Torni sempre su PathFinder', rarity: 'non_comune', category: 'engagement', target: 7, trackingKey: 'login_streak' },
  { id: 'dedicato', name: 'Dedicato', icon: '\u{1F393}', description: 'PathFinder e parte della tua routine', rarity: 'rara', category: 'engagement', target: 15, trackingKey: 'login_streak' },
];

// --- Progress helpers (localStorage) ---

function getAllProgress(): Record<string, BadgeProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveAllProgress(progress: Record<string, BadgeProgress>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function getBadgeProgress(badgeId: string): BadgeProgress {
  return getAllProgress()[badgeId] || { current: 0 };
}

export function getAllBadgeStates(): { badge: BadgeDefinition; progress: BadgeProgress; unlocked: boolean }[] {
  const all = getAllProgress();
  return BADGES.map((badge) => {
    const progress = all[badge.id] || { current: 0 };
    return { badge, progress, unlocked: progress.current >= badge.target };
  });
}

export function getUnlockedCount(): number {
  const all = getAllProgress();
  return BADGES.filter((b) => (all[b.id]?.current || 0) >= b.target).length;
}

/**
 * Increment a tracking key and return any newly-unlocked badges.
 */
export function trackAction(trackingKey: string, increment = 1): BadgeDefinition[] {
  const progress = getAllProgress();
  const newlyUnlocked: BadgeDefinition[] = [];

  const relevant = BADGES.filter((b) => b.trackingKey === trackingKey);
  for (const badge of relevant) {
    const prev = progress[badge.id] || { current: 0 };
    const wasUnlocked = prev.current >= badge.target;
    const newCurrent = prev.current + increment;
    progress[badge.id] = {
      current: newCurrent,
      unlockedAt: !wasUnlocked && newCurrent >= badge.target
        ? new Date().toISOString()
        : prev.unlockedAt,
    };
    if (!wasUnlocked && newCurrent >= badge.target) {
      newlyUnlocked.push(badge);
    }
  }

  saveAllProgress(progress);
  return newlyUnlocked;
}

/**
 * Set a tracking key to an absolute value (useful for streaks / saved counts).
 */
export function setTrackingValue(trackingKey: string, value: number): BadgeDefinition[] {
  const progress = getAllProgress();
  const newlyUnlocked: BadgeDefinition[] = [];

  const relevant = BADGES.filter((b) => b.trackingKey === trackingKey);
  for (const badge of relevant) {
    const prev = progress[badge.id] || { current: 0 };
    const wasUnlocked = prev.current >= badge.target;
    progress[badge.id] = {
      current: value,
      unlockedAt: !wasUnlocked && value >= badge.target
        ? new Date().toISOString()
        : prev.unlockedAt,
    };
    if (!wasUnlocked && value >= badge.target) {
      newlyUnlocked.push(badge);
    }
  }

  saveAllProgress(progress);
  return newlyUnlocked;
}
