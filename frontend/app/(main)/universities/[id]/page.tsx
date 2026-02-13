'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

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

const COURSE_TYPE_LABELS: Record<string, string> = {
  TRIENNALE: 'Triennale',
  MAGISTRALE: 'Magistrale',
  CICLO_UNICO: 'Ciclo Unico',
};

export default function UniversityDetailPage() {
  const { id } = useParams();
  const [university, setUniversity] = useState<UniversityDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/universities/${id}`)
      .then(({ data }) => setUniversity(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

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
        Università non trovata
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* Hero */}
      <div className="h-48 bg-gradient-to-br from-primary/30 to-secondary/30 rounded-2xl mb-4 flex items-center justify-center">
        <span className="text-6xl">🎓</span>
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
        <h3 className="font-display font-semibold text-primary mb-1">Perché è consigliata per te</h3>
        <p className="text-sm text-text-secondary">
          In base al tuo profilo e ai tuoi interessi, questa università offre opportunità in linea con il tuo percorso.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Alumni', value: university.alumniCount.toLocaleString(), icon: '👥' },
          { label: 'Rating', value: `${university.avgRating.toFixed(1)}/5`, icon: '⭐' },
          { label: 'Opportunità', value: university._count.opportunities.toString(), icon: '💼' },
          { label: 'Studenti attivi', value: university._count.users.toString(), icon: '📚' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <span className="text-2xl mb-1 block">{stat.icon}</span>
            <div className="text-lg font-bold text-text-primary">{stat.value}</div>
            <div className="text-xs text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Courses */}
      {university.courses.length > 0 && (
        <div className="mb-6">
          <h3 className="font-display font-semibold mb-3">Corsi disponibili</h3>
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
      {university.websiteUrl && (
        <a
          href={university.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full text-center block"
        >
          Visita il sito ufficiale
        </a>
      )}
    </div>
  );
}
