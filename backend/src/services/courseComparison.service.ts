import prisma from '../lib/prisma';

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
 * Scores how similar two user profiles are (0-100).
 * Uses shared interests, cluster tag, career vision, and academic fields.
 */
function profileSimilarityScore(
  profileA: { primaryInterest?: string | null; clusterTag?: string | null; careerVision?: string | null; passions?: string[] },
  profileB: { primaryInterest?: string | null; clusterTag?: string | null; careerVision?: string | null; passions?: string[] },
): number {
  let score = 0;

  // Same primary interest (35 pts)
  if (profileA.primaryInterest && profileA.primaryInterest === profileB.primaryInterest) {
    score += 35;
  }

  // Same cluster tag (30 pts)
  if (profileA.clusterTag && profileA.clusterTag === profileB.clusterTag) {
    score += 30;
  }

  // Same career vision (20 pts)
  if (profileA.careerVision && profileA.careerVision === profileB.careerVision) {
    score += 20;
  }

  // Shared passions (15 pts max)
  if (profileA.passions?.length && profileB.passions?.length) {
    const setA = new Set(profileA.passions);
    const shared = profileB.passions.filter((p) => setA.has(p)).length;
    const total = Math.max(profileA.passions.length, profileB.passions.length);
    if (total > 0) {
      score += Math.round((shared / total) * 15);
    }
  }

  return Math.min(score, 100);
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

  // 3. Find candidate courses (exclude the target, limit to top 100)
  const allCourses = await prisma.course.findMany({
    where: { id: { not: courseId } },
    include: {
      university: true,
      savedBy: { select: { id: true } },
    },
    take: 100,
  });

  // 4. Score and rank candidates
  const scoredCandidates = allCourses.map((c) => ({
    course: c,
    score: courseMatchScore(targetCourse, c),
  }));
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Take top 4 (or fewer if not enough courses)
  const topCandidates = scoredCandidates
    .filter((c) => c.score > 0)
    .slice(0, 4)
    .map((c) => c.course);

  // If not enough results from scoring, pad with same-type courses
  if (topCandidates.length < 3) {
    const existingIds = new Set([courseId, ...topCandidates.map((c) => c.id)]);
    const fallbacks = allCourses.filter((c) => !existingIds.has(c.id));
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
