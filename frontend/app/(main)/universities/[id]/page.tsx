'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';
import { isValidExternalUrl } from '@/lib/urlValidation';
import { GraduationCap, Users, Star, Briefcase, BookOpen } from '@/components/icons';

interface Course {
  id: string;
  name: string;
  type: string;
}

interface UniversityDetail {
  id: string;
  name: string;
  city: string;
  country: string;
  description?: string;
  websiteUrl?: string;
  alumniCount: number;
  avgRating: number;
  courses: Course[];
  _count: { opportunities: number; users: number };
}

function getCourseTypeLabels(t: ReturnType<typeof useLanguage>['t']): Record<string, string> {
  return {
    TRIENNALE: t.uni.courseTriennale,
    MAGISTRALE: t.uni.courseMagistrale,
    CICLO_UNICO: t.uni.courseCicloUnico,
  };
}

export default function UniversityDetailPage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const COURSE_TYPE_LABELS = getCourseTypeLabels(t);

  const { data: university, isLoading: loading } = useQuery<UniversityDetail>({
    queryKey: ['university', id],
    queryFn: async () => {
      const { data } = await api.get(`/universities/${id}`);
      return data;
    },
    enabled: !!id,
  });

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4 animate-pulse">
        <div className="h-48 bg-border rounded-2xl" />
        <div className="h-6 bg-border rounded w-3/4" />
        <div className="h-4 bg-border rounded w-1/2" />
        <div className="h-20 bg-border rounded" />
      </div>
    );
  }

  if (!university) {
    return (
      <div className="px-4 py-12 text-center text-text-muted">
        {t.uni.notFound}
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* Hero */}
      <div className="h-48 bg-gradient-to-br from-primary/30 to-secondary/30 rounded-2xl mb-4 flex items-center justify-center">
        <GraduationCap size={20} color="white" />
      </div>

      {/* Name & City */}
      <h2 className="text-2xl font-display font-bold mb-1">{university.name}</h2>
      <p className="text-text-secondary mb-4">{university.city}, {university.country}</p>

      {/* Description */}
      {university.description && (
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">{university.description}</p>
      )}

      {/* Recommendation box */}
      <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-6">
        <h3 className="font-display font-semibold text-primary mb-1">{t.uni.whyRecommended}</h3>
        <p className="text-sm text-text-secondary">
          {t.uni.recommendedDesc}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: t.uni.statAlumni, value: university.alumniCount.toLocaleString(), icon: <Users size={16} color="#4A9EFF" /> },
          { label: t.uni.statRating, value: `${university.avgRating.toFixed(1)}/5`, icon: <Star size={16} color="#F59E0B" filled /> },
          { label: t.uni.statOpportunities, value: university._count.opportunities.toString(), icon: <Briefcase size={16} color="#22C55E" /> },
          { label: t.uni.statActiveStudents, value: university._count.users.toString(), icon: <BookOpen size={16} color="#9C5AFF" /> },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <span className="mb-1 flex justify-center">{stat.icon}</span>
            <div className="text-lg font-bold text-text-primary">{stat.value}</div>
            <div className="text-xs text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Courses */}
      {university.courses.length > 0 && (
        <div className="mb-6">
          <h3 className="font-display font-semibold mb-3">{t.uni.availableCourses}</h3>
          <div className="flex flex-wrap gap-2">
            {university.courses.map((course) => (
              <span
                key={course.id}
                className="px-3 py-1.5 rounded-full text-xs bg-card border border-border text-text-secondary"
              >
                {course.name} · {COURSE_TYPE_LABELS[course.type]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Website link */}
      {university.websiteUrl && isValidExternalUrl(university.websiteUrl) && (
        <a
          href={university.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full text-center block"
        >
          {t.uni.visitSite}
        </a>
      )}
    </div>
  );
}
