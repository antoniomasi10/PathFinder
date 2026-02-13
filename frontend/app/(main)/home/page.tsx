'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';

interface Opportunity {
  id: string;
  title: string;
  description: string;
  type: string;
  company?: string;
  location?: string;
  isRemote: boolean;
  tags: string[];
  deadline?: string;
  matchScore?: number;
  matchReason?: string;
  university?: { name: string } | null;
}

const TYPE_LABELS: Record<string, string> = {
  INTERNSHIP: 'Internship',
  STAGE: 'Stage',
  EXTRACURRICULAR: 'Extracurriculare',
  EVENT: 'Evento',
  FELLOWSHIP: 'Fellowship',
};

const TYPE_COLORS: Record<string, string> = {
  INTERNSHIP: 'bg-primary/20 text-primary',
  STAGE: 'bg-secondary/20 text-secondary',
  EXTRACURRICULAR: 'bg-accent/20 text-accent',
  EVENT: 'bg-warning/20 text-warning',
  FELLOWSHIP: 'bg-success/20 text-success',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-warning';
  return 'text-text-muted';
}

export default function HomePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'per-te' | 'esplora'>('per-te');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadOpportunities();
    loadSaved();
  }, [tab]);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const matched = tab === 'per-te' ? 'true' : 'false';
      const { data } = await api.get(`/opportunities?matched=${matched}`);
      setOpportunities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSaved = async () => {
    try {
      const { data } = await api.get('/opportunities/saved');
      setSavedIds(new Set(data.map((o: any) => o.id)));
    } catch {}
  };

  const toggleSave = async (id: string) => {
    try {
      const { data } = await api.post(`/opportunities/${id}/save`);
      setSavedIds((prev) => {
        const next = new Set(prev);
        data.saved ? next.add(id) : next.delete(id);
        return next;
      });
    } catch {}
  };

  const filtered = opportunities.filter((opp) => {
    if (search && !opp.title.toLowerCase().includes(search.toLowerCase()) && !opp.company?.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && opp.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold">
          Ciao {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-text-secondary text-sm mt-1">Scopri le opportunità migliori per te</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-card rounded-xl p-1 mb-4">
        <button
          onClick={() => setTab('per-te')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'per-te' ? 'bg-primary text-white' : 'text-text-secondary'
          }`}
        >
          Per te
        </button>
        <button
          onClick={() => setTab('esplora')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'esplora' ? 'bg-primary text-white' : 'text-text-secondary'
          }`}
        >
          Esplora
        </button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca opportunità..."
          className="input-field"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setTypeFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
              !typeFilter ? 'bg-primary text-white' : 'bg-card text-text-secondary border border-border'
            }`}
          >
            Tutti
          </button>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(typeFilter === key ? '' : key)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                typeFilter === key ? 'bg-primary text-white' : 'bg-card text-text-secondary border border-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-border rounded w-3/4 mb-3" />
              <div className="h-3 bg-border rounded w-1/2 mb-2" />
              <div className="h-3 bg-border rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Opportunity Cards */}
      {!loading && (
        <div className={tab === 'esplora' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-4'}>
          {filtered.map((opp) => (
            <div key={opp.id} className="card hover:bg-card-hover transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${TYPE_COLORS[opp.type]}`}>
                      {TYPE_LABELS[opp.type]}
                    </span>
                    {opp.isRemote && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-accent/20 text-accent">Remote</span>
                    )}
                  </div>
                  <h3 className="font-display font-semibold text-text-primary">{opp.title}</h3>
                  <p className="text-sm text-text-secondary">
                    {opp.company || opp.university?.name} {opp.location && `· ${opp.location}`}
                  </p>
                </div>
                {tab === 'per-te' && opp.matchScore !== undefined && (
                  <div className={`text-right ${scoreColor(opp.matchScore)}`}>
                    <div className="text-xl font-bold">{opp.matchScore}%</div>
                    <div className="text-[10px]">match</div>
                  </div>
                )}
              </div>

              <p className="text-sm text-text-secondary line-clamp-2 mb-3">{opp.description}</p>

              {tab === 'per-te' && opp.matchReason && (
                <p className="text-xs text-primary mb-3">✨ {opp.matchReason}</p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 flex-wrap">
                  {opp.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-text-muted">
                      #{tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {opp.deadline && (
                    <span className="text-[10px] text-text-muted">
                      Scad. {new Date(opp.deadline).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  <button
                    onClick={() => toggleSave(opp.id)}
                    className="p-1.5 rounded-full hover:bg-surface transition-colors"
                  >
                    {savedIds.has(opp.id) ? (
                      <svg className="w-5 h-5 text-primary fill-primary" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <p>Nessuna opportunità trovata</p>
        </div>
      )}
    </div>
  );
}
