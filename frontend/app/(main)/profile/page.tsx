'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';

interface FullProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  courseOfStudy?: string;
  yearOfStudy?: number;
  university?: { name: string };
  profile?: {
    clusterTag?: string;
    passions: string[];
    primaryInterest?: string;
  };
  savedOpportunities?: any[];
}

const CLUSTER_COLORS: Record<string, string> = {
  Analista: 'bg-primary/20 text-primary',
  Creativo: 'bg-secondary/20 text-secondary',
  Leader: 'bg-warning/20 text-warning',
  Imprenditore: 'bg-success/20 text-success',
  Sociale: 'bg-accent/20 text-accent',
  Explorer: 'bg-error/20 text-error',
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [savedOpps, setSavedOpps] = useState<any[]>([]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data } = await api.get('/profile/me');
      setProfile(data);
      setBio(data.bio || '');
      const { data: saved } = await api.get('/opportunities/saved');
      setSavedOpps(saved);
    } catch {} finally { setLoading(false); }
  };

  const saveBio = async () => {
    try {
      await api.patch('/profile/me', { bio });
      setEditing(false);
      loadProfile();
    } catch {}
  };

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-border rounded-full" />
          <div><div className="h-5 bg-border rounded w-32 mb-2" /><div className="h-3 bg-border rounded w-24" /></div>
        </div>
        <div className="h-20 bg-border rounded-2xl" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="px-4 py-4">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-2xl font-bold text-white">
          {profile.name[0]}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-display font-bold">{profile.name}</h2>
          <p className="text-sm text-text-secondary">{profile.university?.name}</p>
          <p className="text-xs text-text-muted">{profile.courseOfStudy} {profile.yearOfStudy && `· ${profile.yearOfStudy}° anno`}</p>
        </div>
        <button onClick={() => setEditing(!editing)} className="p-2 rounded-full hover:bg-card transition-colors">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Bio */}
      <div className="card mb-4">
        <h3 className="font-display font-semibold text-sm mb-2">Bio</h3>
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="input-field resize-none"
              rows={3}
              placeholder="Raccontaci di te..."
            />
            <div className="flex gap-2">
              <button onClick={saveBio} className="btn-primary text-sm">Salva</button>
              <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Annulla</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">{profile.bio || 'Nessuna bio ancora. Clicca la rotella per aggiungerne una!'}</p>
        )}
      </div>

      {/* Competenze Tags */}
      {profile.profile && (
        <div className="card mb-4">
          <h3 className="font-display font-semibold text-sm mb-3">Competenze</h3>
          <div className="flex flex-wrap gap-2">
            {profile.profile.clusterTag && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${CLUSTER_COLORS[profile.profile.clusterTag] || 'bg-card text-text-secondary'}`}>
                {profile.profile.clusterTag}
              </span>
            )}
            {profile.profile.passions.map((p) => (
              <span key={p} className="px-3 py-1.5 rounded-full text-xs bg-card border border-border text-text-secondary">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Saved Opportunities */}
      <div className="card mb-4">
        <h3 className="font-display font-semibold text-sm mb-3">Opportunità salvate ({savedOpps.length})</h3>
        {savedOpps.length === 0 ? (
          <p className="text-sm text-text-muted">Nessuna opportunità salvata ancora</p>
        ) : (
          <div className="space-y-2">
            {savedOpps.slice(0, 5).map((opp) => (
              <div key={opp.id} className="flex items-center justify-between p-3 bg-surface rounded-xl">
                <div>
                  <p className="text-sm font-medium text-text-primary">{opp.title}</p>
                  <p className="text-xs text-text-muted">{opp.company || opp.university?.name}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary">{opp.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logout */}
      <button onClick={logout} className="w-full py-3 text-center text-error text-sm hover:bg-error/10 rounded-2xl transition-colors">
        Esci dall'account
      </button>
    </div>
  );
}
