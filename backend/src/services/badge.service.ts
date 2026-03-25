import prisma from '../lib/prisma';

interface BadgeDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: string;
  category: string;
  target: number;
  trackingKey: string;
}

const BADGES: BadgeDefinition[] = [
  { id: 'esploratore', name: 'Esploratore', icon: '🗺️', description: 'Hai visitato 5 corsi universitari', rarity: 'comune', category: 'esplorazione', target: 5, trackingKey: 'courses_viewed' },
  { id: 'viaggiatore', name: 'Viaggiatore', icon: '🌍', description: 'Hai esplorato 20 corsi diversi', rarity: 'rara', category: 'esplorazione', target: 20, trackingKey: 'courses_viewed' },
  { id: 'scopritore', name: 'Scopritore', icon: '🚀', description: 'Hai visitato corsi in 5 citta diverse', rarity: 'epica', category: 'esplorazione', target: 5, trackingKey: 'cities_viewed' },
  { id: 'preferito', name: 'Preferito', icon: '⭐', description: 'Hai salvato il tuo primo corso', rarity: 'comune', category: 'decisione', target: 1, trackingKey: 'courses_saved' },
  { id: 'selettore', name: 'Selettore', icon: '💼', description: 'Hai salvato 5 corsi nei preferiti', rarity: 'non_comune', category: 'decisione', target: 5, trackingKey: 'courses_saved' },
  { id: 'decisore', name: 'Decisore', icon: '🎯', description: 'Hai confrontato 3 corsi diversi', rarity: 'rara', category: 'decisione', target: 3, trackingKey: 'courses_compared' },
  { id: 'simulatore', name: 'Simulatore', icon: '🎲', description: 'Hai completato la prima simulazione', rarity: 'comune', category: 'preparazione', target: 1, trackingKey: 'simulations_done' },
  { id: 'stratega', name: 'Stratega', icon: '🧠', description: 'Hai completato 5 simulazioni', rarity: 'non_comune', category: 'preparazione', target: 5, trackingKey: 'simulations_done' },
  { id: 'researcher', name: 'Researcher', icon: '📚', description: 'Hai consultato i requisiti di 5 corsi', rarity: 'non_comune', category: 'preparazione', target: 5, trackingKey: 'requirements_viewed' },
  { id: 'pianificatore', name: 'Pianificatore', icon: '📅', description: 'Hai aggiunto 3 scadenze al calendario', rarity: 'comune', category: 'azione', target: 3, trackingKey: 'deadlines_added' },
  { id: 'candidato', name: 'Candidato', icon: '🚀', description: 'Hai cliccato Candidati ora per la prima volta', rarity: 'rara', category: 'azione', target: 1, trackingKey: 'applications_clicked' },
  { id: 'ambizioso', name: 'Ambizioso', icon: '💪', description: 'Hai avviato candidature per 3 corsi diversi', rarity: 'epica', category: 'azione', target: 3, trackingKey: 'applications_clicked' },
  { id: 'fedele', name: 'Fedele', icon: '💚', description: 'Hai usato PathFinder per 5 giorni consecutivi', rarity: 'non_comune', category: 'engagement', target: 5, trackingKey: 'login_streak' },
  { id: 'dedicato', name: 'Dedicato', icon: '🔥', description: 'Hai usato PathFinder per 15 giorni consecutivi', rarity: 'rara', category: 'engagement', target: 15, trackingKey: 'login_streak' },
  { id: 'completista', name: 'Completista', icon: '🏆', description: 'Hai sbloccato tutti gli altri 14 badge!', rarity: 'leggendaria', category: 'engagement', target: 14, trackingKey: 'total_badges' },
];

export { BADGES };

export async function trackAction(userId: string, key: string, increment = 1) {
  // Upsert tracking value
  const tracking = await prisma.userTracking.upsert({
    where: { userId_key: { userId, key } },
    update: { value: { increment } },
    create: { userId, key, value: increment },
  });

  // Check badges related to this tracking key
  const relevant = BADGES.filter((b) => b.trackingKey === key);
  const newlyUnlocked: BadgeDefinition[] = [];

  for (const badge of relevant) {
    const existing = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });

    if (existing?.unlockedAt) {
      // Already unlocked, just update progress
      await prisma.userBadge.update({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        data: { progress: tracking.value },
      });
      continue;
    }

    const unlocked = tracking.value >= badge.target;
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
      update: {
        progress: tracking.value,
        unlockedAt: unlocked ? new Date() : null,
      },
      create: {
        userId,
        badgeId: badge.id,
        progress: tracking.value,
        unlockedAt: unlocked ? new Date() : null,
      },
    });

    if (unlocked) {
      newlyUnlocked.push(badge);
    }
  }

  // Check completista
  if (newlyUnlocked.length > 0) {
    const completistaUnlocked = await checkCompletista(userId);
    if (completistaUnlocked) {
      newlyUnlocked.push(BADGES.find((b) => b.id === 'completista')!);
    }
  }

  return { tracking, newlyUnlocked };
}

export async function setTrackingValue(userId: string, key: string, value: number) {
  const tracking = await prisma.userTracking.upsert({
    where: { userId_key: { userId, key } },
    update: { value },
    create: { userId, key, value },
  });

  const relevant = BADGES.filter((b) => b.trackingKey === key);
  const newlyUnlocked: BadgeDefinition[] = [];

  for (const badge of relevant) {
    const existing = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });

    if (existing?.unlockedAt) {
      await prisma.userBadge.update({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        data: { progress: value },
      });
      continue;
    }

    const unlocked = value >= badge.target;
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
      update: { progress: value, unlockedAt: unlocked ? new Date() : null },
      create: { userId, badgeId: badge.id, progress: value, unlockedAt: unlocked ? new Date() : null },
    });

    if (unlocked) newlyUnlocked.push(badge);
  }

  if (newlyUnlocked.length > 0) {
    const completistaUnlocked = await checkCompletista(userId);
    if (completistaUnlocked) {
      newlyUnlocked.push(BADGES.find((b) => b.id === 'completista')!);
    }
  }

  return { tracking, newlyUnlocked };
}

async function checkCompletista(userId: string): Promise<boolean> {
  const completista = BADGES.find((b) => b.id === 'completista')!;
  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: 'completista' } },
  });
  if (existing?.unlockedAt) return false;

  const unlockedCount = await prisma.userBadge.count({
    where: { userId, unlockedAt: { not: null }, badgeId: { not: 'completista' } },
  });

  await prisma.userBadge.upsert({
    where: { userId_badgeId: { userId, badgeId: 'completista' } },
    update: { progress: unlockedCount, unlockedAt: unlockedCount >= completista.target ? new Date() : null },
    create: { userId, badgeId: 'completista', progress: unlockedCount, unlockedAt: unlockedCount >= completista.target ? new Date() : null },
  });

  return unlockedCount >= completista.target;
}

export async function getUserBadges(userId: string) {
  const userBadges = await prisma.userBadge.findMany({
    where: { userId },
  });

  const tracking = await prisma.userTracking.findMany({
    where: { userId },
  });

  const trackingMap = Object.fromEntries(tracking.map((t) => [t.key, t.value]));
  const badgeMap = Object.fromEntries(userBadges.map((b) => [b.badgeId, b]));

  return BADGES.map((badge) => ({
    ...badge,
    progress: badgeMap[badge.id]?.progress ?? trackingMap[badge.trackingKey] ?? 0,
    unlockedAt: badgeMap[badge.id]?.unlockedAt?.toISOString() ?? null,
    unlocked: !!badgeMap[badge.id]?.unlockedAt,
  }));
}

export async function getTrackingValues(userId: string) {
  const tracking = await prisma.userTracking.findMany({ where: { userId } });
  return Object.fromEntries(tracking.map((t) => [t.key, t.value]));
}

export async function trackLoginStreak(userId: string) {
  const tracking = await prisma.userTracking.findUnique({
    where: { userId_key: { userId, key: 'login_streak' } },
  });

  const lastLogin = await prisma.userTracking.findUnique({
    where: { userId_key: { userId, key: 'last_login_date' } },
  });

  const today = Math.floor(Date.now() / 86400000); // days since epoch
  const lastDay = lastLogin?.value ?? 0;

  // Save today's date
  await prisma.userTracking.upsert({
    where: { userId_key: { userId, key: 'last_login_date' } },
    update: { value: today },
    create: { userId, key: 'last_login_date', value: today },
  });

  if (today === lastDay) {
    // Already logged in today, no streak change
    return { newlyUnlocked: [] };
  }

  if (today - lastDay === 1) {
    // Consecutive day — increment streak
    return trackAction(userId, 'login_streak', 1);
  }

  // Streak broken — reset to 1
  return setTrackingValue(userId, 'login_streak', 1);
}
