import prisma from '../lib/prisma';
import { profileSimilarityScore } from './similarity.service';

interface CourseStats {
  employmentRate: number | null;
  avgSalaryAfterGraduation: number | null;
  internshipsAvailable: number | null;
  internationalOpportunities: boolean;
  programDuration: string | null;
  languageOfInstruction: string | null;
}

interface SocialProof {
  similarUsersConsidering: number;
  similarUsersSaved: number;
  similarUsersInteracting: number;
}

interface ComparisonEntry {
  courseId: string;
  courseName: string;
  universityName: string;
  city: string;
  type: string;
  field: string | null;
  stats: CourseStats;
  socialProof: SocialProof;
}

interface ComparisonResult {
  currentCourse: {
    id: string;
    courseName: string;
    universityName: string;
    city: string;
    type: string;
    field: string | null;
    stats: CourseStats;
  };
  comparisons: ComparisonEntry[];
}

function extractStats(course: any): CourseStats {
  return {
    employmentRate: course.employmentRate,
    avgSalaryAfterGraduation: course.avgSalaryAfterGraduation,
    internshipsAvailable: course.internshipsAvailable,
    internationalOpportunities: course.internationalOpportunities ?? false,
    programDuration: course.programDuration,
    languageOfInstruction: course.languageOfInstruction,
  };
}

/**
 * Score how comparable two courses are (higher = more comparable).
 * Considers field, type, tags, and location.
 */
function courseMatchScore(
  target: { field: string | null; type: string; tags: string[]; university: { city: string } },
  candidate: { field: string | null; type: string; tags: string[]; university: { city: string } },
): number {
  let score = 0;

  // Same field (40 pts)
  if (target.field && candidate.field) {
    if (target.field === candidate.field) {
      score += 40;
    } else if (target.field.toLowerCase().includes(candidate.field.toLowerCase()) ||
               candidate.field.toLowerCase().includes(target.field.toLowerCase())) {
      score += 25;
    }
  }

  // Same course type (20 pts)
  if (target.type === candidate.type) {
    score += 20;
  }

  // Shared tags (25 pts max)
  if (target.tags.length && candidate.tags.length) {
    const setA = new Set(target.tags.map((t) => t.toLowerCase()));
    const shared = candidate.tags.filter((t) => setA.has(t.toLowerCase())).length;
    const total = Math.max(target.tags.length, candidate.tags.length);
    if (total > 0) {
      score += Math.round((shared / total) * 25);
    }
  }

  // Same city (15 pts)
  if (target.university.city.toLowerCase() === candidate.university.city.toLowerCase()) {
    score += 15;
  }

  return score;
}

export async function getComparison(courseId: string, userId: string): Promise<ComparisonResult> {
  // 1. Fetch target course
  const targetCourse = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      university: true,
      savedBy: { select: { id: true } },
    },
  });

  if (!targetCourse) {
    throw new Error('Corso non trovato');
  }

  // 2. Fetch current user profile
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  // 3. Find candidate courses — two-stage: vector retrieval then re-ranking
  // Check if target course has embedding for vector candidate retrieval
  const hasEmbedding = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "Course" WHERE id = $1 AND embedding IS NOT NULL`,
    courseId,
  );
  const courseHasEmbedding = hasEmbedding[0]?.count > 0n;

  let candidateCourses: any[];

  if (courseHasEmbedding) {
    // Stage 1: Vector candidate retrieval (top 20 similar courses)
    const vectorCandidateIds = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT c2.id
       FROM "Course" c1, "Course" c2
       WHERE c1.id = $1 AND c2.id != $1 AND c2.embedding IS NOT NULL
       ORDER BY c2.embedding <=> c1.embedding
       LIMIT 20`,
      courseId,
    );
    const ids = vectorCandidateIds.map((c) => c.id);
    candidateCourses = ids.length > 0
      ? await prisma.course.findMany({
          where: { id: { in: ids } },
          include: { university: true, savedBy: { select: { id: true } } },
        })
      : [];
  } else {
    // Fallback: get all courses (original behavior)
    candidateCourses = await prisma.course.findMany({
      where: { id: { not: courseId } },
      include: { university: true, savedBy: { select: { id: true } } },
      take: 100,
    });
  }

  // Stage 2: Re-rank with detailed scoring
  const scoredCandidates = candidateCourses.map((c) => ({
    course: c,
    score: courseMatchScore(targetCourse, c),
  }));
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Take top 4 (or fewer if not enough courses)
  const topCandidates = scoredCandidates
    .filter((c) => c.score > 0)
    .slice(0, 4)
    .map((c) => c.course);

  // If not enough results from scoring, pad with remaining candidates
  if (topCandidates.length < 3) {
    const existingIds = new Set([courseId, ...topCandidates.map((c) => c.id)]);
    const fallbacks = candidateCourses.filter((c) => !existingIds.has(c.id));
    for (const fb of fallbacks) {
      if (topCandidates.length >= 4) break;
      topCandidates.push(fb);
    }
  }

  // 5. Compute social proof
  // Find users with similar profiles (similarity score >= 40)
  const allProfiles = currentUser?.profile
    ? await prisma.userProfile.findMany({
        where: { userId: { not: userId } },
        include: {
          user: {
            include: {
              savedCourses: { select: { id: true } },
            },
          },
        },
      })
    : [];

  const similarUserIds = new Set<string>();
  const similarUserSavedMap = new Map<string, Set<string>>(); // courseId -> set of similar userIds who saved it

  if (currentUser?.profile) {
    for (const p of allProfiles) {
      const sim = profileSimilarityScore(currentUser.profile, p);
      if (sim >= 40) {
        similarUserIds.add(p.userId);
        for (const sc of p.user.savedCourses) {
          if (!similarUserSavedMap.has(sc.id)) {
            similarUserSavedMap.set(sc.id, new Set());
          }
          similarUserSavedMap.get(sc.id)!.add(p.userId);
        }
      }
    }
  }

  const totalSimilar = Math.max(similarUserIds.size, 1); // avoid division by zero

  function computeSocialProof(cId: string): SocialProof {
    const savedSet = similarUserSavedMap.get(cId) || new Set();
    const savedCount = savedSet.size;
    // "considering" = saved or interacted; approximate as saved + a small factor
    const consideringCount = Math.min(savedCount + Math.floor(savedCount * 0.3), totalSimilar);
    return {
      similarUsersConsidering: Math.round((consideringCount / totalSimilar) * 100),
      similarUsersSaved: Math.round((savedCount / totalSimilar) * 100),
      similarUsersInteracting: savedCount,
    };
  }

  // 6. Build response
  const comparisons: ComparisonEntry[] = topCandidates.map((c) => ({
    courseId: c.id,
    courseName: c.name,
    universityName: c.university.name,
    city: c.university.city,
    type: c.type,
    field: c.field,
    stats: extractStats(c),
    socialProof: computeSocialProof(c.id),
  }));

  return {
    currentCourse: {
      id: targetCourse.id,
      courseName: targetCourse.name,
      universityName: targetCourse.university.name,
      city: targetCourse.university.city,
      type: targetCourse.type,
      field: targetCourse.field,
      stats: extractStats(targetCourse),
    },
    comparisons,
  };
}
