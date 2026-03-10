'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { useLanguage, getSkillLabel } from '@/lib/language';

interface SavedOpportunity {
  id: string;
  title: string;
  company?: string;
  type: string;
  university?: { name: string };
}

interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  courseOfStudy?: string;
  yearOfStudy?: number;
  university?: { name: string };
  profile?: {
    clusterTag?: string;
    passions: string[];
  };
  isPathmate?: boolean;
  canMessage?: boolean;
  canViewDetails?: boolean;
  savedOpportunities?: SavedOpportunity[] | null;
}

const CLUSTER_COLORS: Record<string, string> = {
  Analista: 'bg-primary/20 text-primary',
  Creativo: 'bg-secondary/20 text-secondary',
  Leader: 'bg-warning/20 text-warning',
  Imprenditore: 'bg-success/20 text-success',
  Sociale: 'bg-accent/20 text-accent',
  Explorer: 'bg-error/20 text-error',
};

export default function UserProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friendStatus, setFriendStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    if (id === user?.id) {
      router.replace('/profile');
      return;
    }
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    try {
      const { data } = await api.get(`/profile/${id}`);
      setProfile(data);
      const { data: status } = await api.get(`/friends/status/${id}`);
      setFriendStatus(status.status);
    } catch {} finally { setLoading(false); }
  };

  const sendFriendRequest = async () => {
    try {
      await api.post('/friends/request', { toUserId: id });
      setFriendStatus('PENDING');
    } catch {}
  };

  if (loading) {
    return (
      <div className="px-4 py-4 animate-pulse">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-border rounded-full" />
          <div><div className="h-5 bg-border rounded w-32 mb-2" /><div className="h-3 bg-border rounded w-24" /></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <div className="px-4 py-12 text-center text-text-muted">{t.userProfile.notFound}</div>;
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-2xl font-bold text-white">
          {profile.name[0]}
        </div>
        <div>
          <h2 className="text-xl font-display font-bold">{profile.name}</h2>
          {profile.canViewDetails !== false && (
            <>
              <p className="text-sm text-text-secondary">{profile.university?.name}</p>
              <p className="text-xs text-text-muted">{profile.courseOfStudy}</p>
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => router.push(`/networking`)}
          disabled={profile.canMessage === false}
          className="btn-primary flex-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          title={profile.canMessage === false ? 'Questo utente non accetta messaggi' : undefined}
        >
          {t.userProfile.sendMessage}
        </button>
        {friendStatus === 'ACCEPTED' ? (
          <button className="btn-secondary flex-1 text-sm" disabled>
            {t.userProfile.connected}
          </button>
        ) : friendStatus === 'PENDING' ? (
          <button className="btn-secondary flex-1 text-sm" disabled>
            {t.userProfile.requestSent}
          </button>
        ) : (
          <button onClick={sendFriendRequest} className="btn-secondary flex-1 text-sm">
            {t.userProfile.connect}
          </button>
        )}
      </div>

      {profile.bio && profile.canViewDetails !== false && (
        <div className="card mb-4">
          <h3 className="font-display font-semibold text-sm mb-2">{t.userProfile.bio}</h3>
          <p className="text-sm text-text-secondary">{profile.bio}</p>
        </div>
      )}

      {profile.profile && profile.canViewDetails !== false && (
        <div className="card mb-4">
          <h3 className="font-display font-semibold text-sm mb-3">{t.userProfile.skills}</h3>
          <div className="flex flex-wrap gap-2">
            {profile.profile.clusterTag && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${CLUSTER_COLORS[profile.profile.clusterTag] || 'bg-card text-text-secondary'}`}>
                {profile.profile.clusterTag}
              </span>
            )}
            {profile.profile.passions.map((p) => (
              <span key={p} className="px-3 py-1.5 rounded-full text-xs bg-card border border-border text-text-secondary">
                {getSkillLabel(p, t)}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.savedOpportunities && profile.savedOpportunities.length > 0 && (
        <div className="card">
          <h3 className="font-display font-semibold text-sm mb-3">{t.profile.savedOpp}</h3>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {profile.savedOpportunities.map((opp) => (
              <div key={opp.id} className="flex-shrink-0 w-48 bg-background rounded-xl p-3 border border-border">
                <p className="text-xs font-semibold text-text-primary line-clamp-2 mb-1">{opp.title}</p>
                <p className="text-xs text-text-muted truncate">{opp.company || opp.university?.name || ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
