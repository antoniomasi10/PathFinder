'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';

interface University {
  id: string;
  name: string;
  city: string;
  avgRating: number;
  alumniCount: number;
  description?: string;
  _count: { opportunities: number; users: number };
}

export default function UniversitiesPage() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    api.get('/universities')
      .then(({ data }) => setUniversities(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4">
        <h2 className="text-2xl font-display font-bold">{t.uni.title}</h2>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-32 bg-border rounded-xl mb-3" />
            <div className="h-4 bg-border rounded w-3/4 mb-2" />
            <div className="h-3 bg-border rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <h2 className="text-2xl font-display font-bold mb-4">Università</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {universities.map((uni) => (
          <Link key={uni.id} href={`/universities/${uni.id}`}>
            <div className="card hover:bg-card-hover transition-all cursor-pointer">
              <div className="h-28 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl mb-3 flex items-center justify-center">
                <span className="text-4xl">🎓</span>
              </div>
              <h3 className="font-display font-semibold text-text-primary mb-1">{uni.name}</h3>
              <p className="text-sm text-text-secondary mb-2">{uni.city}</p>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span className="flex items-center gap-1">
                  ⭐ {uni.avgRating.toFixed(1)}
                </span>
                <span>{uni._count.opportunities} {t.uni.opportunities}</span>
                <span>{uni.alumniCount.toLocaleString()} alumni</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
