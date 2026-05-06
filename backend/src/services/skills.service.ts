import prisma from '../lib/prisma';
import { updateUserEmbedding } from './embedding.service';

// ─── Types ──────────────────────────────────────────────────────────

export interface SkillEntry {
  id: string;
  name: string;
  addedAt: string; // ISO string
}

export interface UserSkills {
  core: SkillEntry[] | null;
  side: SkillEntry[];
  promptShownAt: string | null;
  promptDismissedAt: string | null;
  definedAt: string | null;
  lastUpdatedAt: string | null;
}

const DEFAULT_SKILLS: UserSkills = {
  core: null,
  side: [],
  promptShownAt: null,
  promptDismissedAt: null,
  definedAt: null,
  lastUpdatedAt: null,
};

// ─── Helpers ────────────────────────────────────────────────────────

function parseSkills(raw: unknown): UserSkills {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SKILLS };
  const obj = raw as Record<string, unknown>;
  return {
    core: Array.isArray(obj.core) ? obj.core : null,
    side: Array.isArray(obj.side) ? obj.side : [],
    promptShownAt: (obj.promptShownAt as string) || null,
    promptDismissedAt: (obj.promptDismissedAt as string) || null,
    definedAt: (obj.definedAt as string) || null,
    lastUpdatedAt: (obj.lastUpdatedAt as string) || null,
  };
}

function daysBetween(dateStr: string, now: number): number {
  return (now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

// ─── Read ───────────────────────────────────────────────────────────

export async function getUserSkills(userId: string): Promise<UserSkills> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { skills: true },
  });
  if (!user) throw new Error('Utente non trovato');
  return parseSkills(user.skills);
}

// ─── Core Skills ────────────────────────────────────────────────────

export async function setCoreSkills(
  userId: string,
  coreSkills: { id: string; name: string }[],
): Promise<UserSkills> {
  if (coreSkills.length !== 3) {
    throw new Error('Le core skills devono essere esattamente 3');
  }

  const skills = await getUserSkills(userId);

  // Check no overlap with side
  const coreIds = new Set(coreSkills.map((s) => s.id));
  const overlap = skills.side.some((s) => coreIds.has(s.id));
  if (overlap) {
    throw new Error('Una skill non può essere sia core che side');
  }

  const now = new Date().toISOString();
  const entries: SkillEntry[] = coreSkills.map((s) => ({
    id: s.id,
    name: s.name,
    addedAt: now,
  }));

  const isFirstTime = skills.core === null;
  const updated: UserSkills = {
    ...skills,
    core: entries,
    definedAt: isFirstTime ? now : skills.definedAt,
    lastUpdatedAt: now,
  };

  await prisma.user.update({
    where: { id: userId },
    data: { skills: updated as any },
  });

  // Regenerate embedding in background
  updateUserEmbedding(userId).catch(() => {});

  return updated;
}

export async function updateCoreSkills(
  userId: string,
  coreSkills: { id: string; name: string }[],
): Promise<UserSkills> {
  if (coreSkills.length !== 3) {
    throw new Error('Le core skills devono essere esattamente 3');
  }

  const skills = await getUserSkills(userId);

  if (skills.core === null) {
    throw new Error('Le core skills non sono ancora state definite. Usa POST per crearle.');
  }

  // Check no overlap with side
  const coreIds = new Set(coreSkills.map((s) => s.id));
  const overlap = skills.side.some((s) => coreIds.has(s.id));
  if (overlap) {
    throw new Error('Una skill non può essere sia core che side');
  }

  const now = new Date().toISOString();
  const entries: SkillEntry[] = coreSkills.map((s) => ({
    id: s.id,
    name: s.name,
    addedAt: now,
  }));

  const updated: UserSkills = {
    ...skills,
    core: entries,
    lastUpdatedAt: now,
  };

  await prisma.user.update({
    where: { id: userId },
    data: { skills: updated as any },
  });

  updateUserEmbedding(userId).catch(() => {});

  return updated;
}

// ─── Side Skills ────────────────────────────────────────────────────

export async function addSideSkill(
  userId: string,
  skillId: string,
  name: string,
): Promise<UserSkills> {
  const skills = await getUserSkills(userId);

  if (skills.side.length >= 5) {
    throw new Error('Massimo 5 side skills consentite');
  }

  // Check not already in side
  if (skills.side.some((s) => s.id === skillId)) {
    throw new Error('Questa side skill è già presente');
  }

  // Check not in core
  if (skills.core?.some((s) => s.id === skillId)) {
    throw new Error('Una skill non può essere sia core che side');
  }

  const now = new Date().toISOString();
  const updated: UserSkills = {
    ...skills,
    side: [...skills.side, { id: skillId, name, addedAt: now }],
    lastUpdatedAt: now,
  };

  await prisma.user.update({
    where: { id: userId },
    data: { skills: updated as any },
  });

  updateUserEmbedding(userId).catch(() => {});

  return updated;
}

export async function removeSideSkill(
  userId: string,
  skillId: string,
): Promise<UserSkills> {
  const skills = await getUserSkills(userId);

  const filtered = skills.side.filter((s) => s.id !== skillId);
  if (filtered.length === skills.side.length) {
    throw new Error('Side skill non trovata');
  }

  const now = new Date().toISOString();
  const updated: UserSkills = {
    ...skills,
    side: filtered,
    lastUpdatedAt: now,
  };

  await prisma.user.update({
    where: { id: userId },
    data: { skills: updated as any },
  });

  updateUserEmbedding(userId).catch(() => {});

  return updated;
}

// ─── Prompt Logic ───────────────────────────────────────────────────

export async function updatePromptStatus(
  userId: string,
  action: 'shown' | 'dismissed',
): Promise<UserSkills> {
  const skills = await getUserSkills(userId);
  const now = new Date().toISOString();

  const updated: UserSkills = {
    ...skills,
    promptShownAt: action === 'shown' ? now : skills.promptShownAt,
    promptDismissedAt: action === 'dismissed' ? now : skills.promptDismissedAt,
  };

  await prisma.user.update({
    where: { id: userId },
    data: { skills: updated as any },
  });

  return updated;
}

export async function shouldPrompt(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      skills: true,
      createdAt: true,
      interactions: {
        where: { targetType: 'opportunity' },
        select: { id: true },
      },
      savedOpportunities: {
        select: { id: true },
      },
    },
  });

  if (!user) return false;

  const skills = parseSkills(user.skills);
  const now = Date.now();

  // Block: core already defined
  if (skills.core !== null) return false;

  // Block: recently dismissed
  if (skills.promptDismissedAt) {
    const daysActive = daysBetween(user.createdAt.toISOString(), now);
    const cooldown = daysActive > 30 ? 3 : 7;
    const daysSinceDismiss = daysBetween(skills.promptDismissedAt, now);
    if (daysSinceDismiss < cooldown) return false;
  }

  // Positive conditions — all three required
  const daysActive = daysBetween(user.createdAt.toISOString(), now);
  const hasExplored = user.interactions.length >= 10;
  const hasSaved = user.savedOpportunities.length >= 2;

  return daysActive >= 7 && hasExplored && hasSaved;
}
