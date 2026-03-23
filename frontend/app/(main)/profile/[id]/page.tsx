'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { isValidImageUrl } from '@/lib/urlValidation';

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
    } catch (err) {
      console.error('Failed to load user profile:', err);
    } finally { setLoading(false); }
  };

  const sendFriendRequest = async () => {
    try {
      await api.post('/friends/request', { toUserId: id });
      setFriendStatus('PENDING');
    } catch (err) {
      console.error('Failed to send friend request:', err);
    }
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
    return <div className="px-4 py-12 text-center text-text-muted">Profilo non trovato</div>;
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white overflow-hidden"
          style={{
            backgroundColor: profile.avatar && isValidImageUrl(profile.avatar) ? '#FFFFFF' : undefined,
            background: !(profile.avatar && isValidImageUrl(profile.avatar))
              ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
              : undefined,
          }}
        >
          {profile.avatar && isValidImageUrl(profile.avatar) ? (
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            profile.name[0]
          )}
        </div>
        <div>
          <h2 className="text-xl font-display font-bold">{profile.name}</h2>
          <p className="text-sm text-text-secondary">{profile.university?.name}</p>
          <p className="text-xs text-text-muted">{profile.courseOfStudy}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => router.push(`/networking?chat=${id}`)}
          className="btn-primary flex-1 text-sm"
        >
          Invia messaggio
        </button>
        {friendStatus === 'ACCEPTED' ? (
          <button className="btn-secondary flex-1 text-sm" disabled>
            Connesso
          </button>
        ) : friendStatus === 'PENDING' ? (
          <button className="btn-secondary flex-1 text-sm" disabled>
            Richiesta inviata
          </button>
        ) : (
          <button onClick={sendFriendRequest} className="btn-secondary flex-1 text-sm">
            Connetti
          </button>
        )}
      </div>

      {profile.bio && (
        <div className="card mb-4">
          <h3 className="font-display font-semibold text-sm mb-2">Bio</h3>
          <p className="text-sm text-text-secondary">{profile.bio}</p>
        </div>
      )}

      {profile.profile && (
        <div className="card">
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
    </div>
  );
}
