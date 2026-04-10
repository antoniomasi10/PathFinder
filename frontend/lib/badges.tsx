import React from 'react';
import {
  MapWorld, Globe, Rocket, Star, Briefcase, Target,
  Dice, Brain, BookOpen, CalendarIcon, Award, Muscle,
  Heart, Flame, Trophy,
} from '@/components/icons';

export type BadgeRarity = 'comune' | 'non_comune' | 'rara' | 'epica' | 'leggendaria';
export type BadgeCategory = 'esplorazione' | 'decisione' | 'preparazione' | 'azione' | 'engagement';

export interface BadgeDefinition {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  rarity: BadgeRarity;
  category: BadgeCategory;
  target: number;
  trackingKey: string;
}

export interface BadgeProgress {
  current: number;
  unlockedAt?: string;
}

const STORAGE_KEY = 'pf-badge-progress';

export const RARITY_COLORS: Record<BadgeRarity, { bg: string; border: string; glow: string }> = {
  comune:      { bg: 'linear-gradient(135deg, #1E3A5F, #2A5A8F)', border: '#4A9EFF', glow: '0 0 12px rgba(74,158,255,0.3)' },
  non_comune:  { bg: 'linear-gradient(135deg, #4A1A6B, #7C3AED)', border: '#9C5AFF', glow: '0 0 12px rgba(124,58,237,0.4)' },
  rara:        { bg: 'linear-gradient(135deg, #7A3300, #FF6B00)', border: '#FF8C3A', glow: '0 0 16px rgba(255,107,0,0.4)' },
  epica:       { bg: 'linear-gradient(135deg, #8B6914, #FFD700)', border: '#FFE44D', glow: '0 0 20px rgba(255,215,0,0.5)' },
  leggendaria: { bg: 'linear-gradient(135deg, #FFD700, #FF6B00, #7C3AED, #4A9EFF)', border: '#FFE44D', glow: '0 0 24px rgba(255,215,0,0.6)' },
};

export const RARITY_LABELS: Record<BadgeRarity, string> = {
  comune: 'Comune',
  non_comune: 'Non comune',
  rara: 'Rara',
  epica: 'Epica',
  leggendaria: 'Leggendaria',
};

export const BADGES: BadgeDefinition[] = [
  // --- ESPLORAZIONE ---
  { id: 'esploratore', name: 'Esploratore', icon: <MapWorld size={20} color="#4A9EFF" />, description: 'Hai visitato 5 corsi universitari', rarity: 'comune', category: 'esplorazione', target: 5, trackingKey: 'courses_viewed' },
  { id: 'viaggiatore', name: 'Viaggiatore', icon: <Globe size={20} color="#4A9EFF" />, description: 'Hai esplorato 20 corsi diversi', rarity: 'rara', category: 'esplorazione', target: 20, trackingKey: 'courses_viewed' },
  { id: 'scopritore', name: 'Scopritore', icon: <Rocket size={20} color="#FFD700" />, description: 'Hai visitato corsi in 5 citta diverse', rarity: 'epica', category: 'esplorazione', target: 5, trackingKey: 'cities_viewed' },

  // --- DECISIONE ---
  { id: 'preferito', name: 'Preferito', icon: <Star size={20} color="#F59E0B" filled />, description: 'Hai salvato il tuo primo corso', rarity: 'comune', category: 'decisione', target: 1, trackingKey: 'courses_saved' },
  { id: 'selettore', name: 'Selettore', icon: <Briefcase size={20} color="#9C5AFF" />, description: 'Hai salvato 5 corsi nei preferiti', rarity: 'non_comune', category: 'decisione', target: 5, trackingKey: 'courses_saved' },
  { id: 'decisore', name: 'Decisore', icon: <Target size={20} color="#FF8C3A" />, description: 'Hai confrontato 3 corsi diversi', rarity: 'rara', category: 'decisione', target: 3, trackingKey: 'courses_compared' },

  // --- PREPARAZIONE ---
  { id: 'simulatore', name: 'Simulatore', icon: <Dice size={20} color="#4A9EFF" />, description: 'Hai completato la prima simulazione', rarity: 'comune', category: 'preparazione', target: 1, trackingKey: 'simulations_done' },
  { id: 'stratega', name: 'Stratega', icon: <Brain size={20} color="#9C5AFF" />, description: 'Hai completato 5 simulazioni', rarity: 'non_comune', category: 'preparazione', target: 5, trackingKey: 'simulations_done' },
  { id: 'researcher', name: 'Researcher', icon: <BookOpen size={20} color="#9C5AFF" />, description: 'Hai consultato i requisiti di 5 corsi', rarity: 'non_comune', category: 'preparazione', target: 5, trackingKey: 'requirements_viewed' },

  // --- AZIONE ---
  { id: 'pianificatore', name: 'Pianificatore', icon: <CalendarIcon size={20} color="#4A9EFF" />, description: 'Hai aggiunto 3 scadenze al calendario', rarity: 'comune', category: 'azione', target: 3, trackingKey: 'deadlines_added' },
  { id: 'candidato', name: 'Candidato', icon: <Rocket size={20} color="#FF8C3A" />, description: 'Hai cliccato Candidati ora per la prima volta', rarity: 'rara', category: 'azione', target: 1, trackingKey: 'applications_clicked' },
  { id: 'ambizioso', name: 'Ambizioso', icon: <Muscle size={20} color="#FFD700" />, description: 'Hai avviato candidature per 3 corsi diversi', rarity: 'epica', category: 'azione', target: 3, trackingKey: 'applications_clicked' },

  // --- ENGAGEMENT ---
  { id: 'fedele', name: 'Fedele', icon: <Heart size={20} color="#22C55E" filled />, description: 'Hai usato PathFinder per 5 giorni consecutivi', rarity: 'non_comune', category: 'engagement', target: 5, trackingKey: 'login_streak' },
  { id: 'dedicato', name: 'Dedicato', icon: <Flame size={20} color="#FF8C3A" />, description: 'Hai usato PathFinder per 15 giorni consecutivi', rarity: 'rara', category: 'engagement', target: 15, trackingKey: 'login_streak' },
  { id: 'completista', name: 'Completista', icon: <Trophy size={20} color="#FFD700" />, description: 'Hai sbloccato tutti gli altri 14 badge!', rarity: 'leggendaria', category: 'engagement', target: 14, trackingKey: 'total_badges' },
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
 * Also auto-checks completista badge.
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

  // Check completista after saving
  if (newlyUnlocked.length > 0) {
    const completista = checkCompletista(progress);
    if (completista) newlyUnlocked.push(completista);
  }

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

  if (newlyUnlocked.length > 0) {
    const completista = checkCompletista(progress);
    if (completista) newlyUnlocked.push(completista);
  }

  return newlyUnlocked;
}

function checkCompletista(progress: Record<string, BadgeProgress>): BadgeDefinition | null {
  const completista = BADGES.find((b) => b.id === 'completista')!;
  const prev = progress[completista.id] || { current: 0 };
  if (prev.current >= completista.target) return null; // already unlocked

  const otherBadges = BADGES.filter((b) => b.id !== 'completista');
  const unlockedCount = otherBadges.filter((b) => (progress[b.id]?.current || 0) >= b.target).length;

  if (unlockedCount >= completista.target) {
    progress[completista.id] = { current: unlockedCount, unlockedAt: new Date().toISOString() };
    saveAllProgress(progress);
    return completista;
  }

  // Update progress even if not unlocked
  progress[completista.id] = { ...prev, current: unlockedCount };
  saveAllProgress(progress);
  return null;
}
