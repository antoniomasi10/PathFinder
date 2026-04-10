'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { useLanguage, getSkillLabel } from '@/lib/language';
import {
  Briefcase,
  Building,
  GraduationCap,
  CalendarIcon,
  Trophy,
  UserIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  ChatDots,
  UserAdd,
  Lock,
  Bookmark,
  UsersGroup,
  MapPin,
} from '@/components/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicProfile {
  id: string;
  name: string;
  avatar?: string | null;
  bio?: string | null;
  courseOfStudy?: string | null;
  yearOfStudy?: number | null;
  university?: { name: string } | null;
  publicProfile: boolean;
  privacySavedOpps?: string;
  privacyPathmates?: string;
  skills?: { interests?: { id: string; name: string; selectedAt: string }[]; [key: string]: unknown } | null;
  profile?: { clusterTag?: string | null; passions: string[] } | null;
  savedOpportunities?: Array<{
    id: string;
    title: string;
    company?: string | null;
    type: string;
    location?: string | null;
  }> | null;
  pathmates: Array<{
    id: string;
    name: string;
    avatar?: string | null;
    courseOfStudy?: string | null;
    university?: { name: string } | null;
  }>;
  pathmatesCount: number;
  friendStatus: string | null;
  friendRequestId: string | null;
  iAmRequester: boolean | null;
  isPathmate: boolean;
  messagePrivacy: string;
  canSeeSkills: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OPP_TYPE_ICON: Record<string, React.ReactNode> = {
  STAGE: <Briefcase size={16} color="#4A9EFF" />,
  INTERNSHIP: <Building size={16} color="#4A9EFF" />,
  EXTRACURRICULAR: <GraduationCap size={16} color="#F59E0B" />,
  EVENT: <CalendarIcon size={16} color="#9C5AFF" />,
  FELLOWSHIP: <Trophy size={16} color="#FFD700" />,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserAvatar({
  name,
  avatar,
  size = 'lg',
}: {
  name: string;
  avatar?: string | null;
  size?: 'sm' | 'lg';
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const cls = size === 'lg' ? 'w-24 h-24 text-2xl' : 'w-10 h-10 text-sm';
  return (
    <div
      className={`${cls} rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center font-bold text-white shrink-0 shadow-lg shadow-[#4F46E5]/20 overflow-hidden`}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-4 py-4 animate-pulse space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[#1E293B] rounded-full" />
        <div className="h-4 bg-[#1E293B] rounded w-24" />
      </div>
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-24 h-24 bg-[#1E293B] rounded-full" />
        <div className="h-5 bg-[#1E293B] rounded w-40" />
        <div className="h-3 bg-[#1E293B] rounded w-56" />
      </div>
      <div className="h-20 bg-[#1E293B] rounded-2xl" />
      <div className="h-32 bg-[#1E293B] rounded-2xl" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserProfilePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const router = useRouter();

  const { t } = useLanguage();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [removingPathmate, setRemovingPathmate] = useState(false);

  useEffect(() => {
    if (!id) return;

    // If viewing own profile, redirect there
    if (id === user?.id) {
      router.replace('/profile');
      return;
    }

    setLoading(true);
    setNotFound(false);

    api
      .get(`/profile/${id}`)
      .then(({ data }) => {
        setProfile(data);
      })
      .catch(() => {
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id, user?.id]);

  const handleAddPathmate = async () => {
    if (!profile || sendingRequest) return;
    setSendingRequest(true);
    try {
      await api.post('/friends/request', { toUserId: profile.id });
      setProfile((p) => (p ? { ...p, friendStatus: 'PENDING', iAmRequester: true } : p));
    } catch {
      // Request failed — do not update UI
    } finally {
      setSendingRequest(false);
    }
  };

  const handleRemovePathmate = async () => {
    if (!profile || removingPathmate) return;
    setRemovingPathmate(true);
    try {
      await api.delete(`/friends/${profile.id}`);
      setProfile((p) => (p ? { ...p, isPathmate: false, friendStatus: null } : p));
    } catch {
      // Request failed — do not update UI
    } finally {
      setRemovingPathmate(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!profile?.friendRequestId) return;
    try {
      await api.patch(`/friends/request/${profile.friendRequestId}`, { status: 'ACCEPTED' });
      setProfile((p) => (p ? { ...p, isPathmate: true, friendStatus: 'ACCEPTED', iAmRequester: null } : p));
    } catch {}
  };

  const handleRejectRequest = async () => {
    if (!profile?.friendRequestId) return;
    try {
      await api.patch(`/friends/request/${profile.friendRequestId}`, { status: 'REJECTED' });
      setProfile((p) => (p ? { ...p, friendStatus: null, friendRequestId: null, iAmRequester: null } : p));
    } catch {}
  };

  const handleMessage = () => {
    if (!profile) return;
    localStorage.setItem(
      'openChatWith',
      JSON.stringify({ id: profile.id, name: profile.name, avatar: profile.avatar })
    );
    router.push('/networking');
  };

  // ── Render states ──

  if (loading) return <LoadingSkeleton />;

  if (notFound) {
    return (
      <div className="px-4 py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-[#1E293B] flex items-center justify-center mx-auto mb-4">
          <UserIcon size={40} color="#475569" strokeWidth={1.5} />
        </div>
        <p className="text-white font-semibold text-lg mb-1">Utente eliminato</p>
        <p className="text-[#64748B] text-sm mb-4">Questo account è stato eliminato</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-[#4F46E5]"
        >
          Torna indietro
        </button>
      </div>
    );
  }

  if (!profile) return null;

  // ── Derived data ──

  const isPrivateAndNotConnected = !profile.publicProfile && !profile.isPathmate;

  // Visibility of saved opportunities based on owner's privacy settings
  const privacySavedOpps = profile.privacySavedOpps ?? 'Tutti';
  const canSeeSavedOpps = !profile.publicProfile
    ? profile.isPathmate
    : privacySavedOpps === 'Tutti' ||
      (privacySavedOpps === 'Pathmates' && profile.isPathmate);

  const privacyPathmates = profile.privacyPathmates ?? 'Tutti';
  const canSeePathmates = !profile.publicProfile
    ? profile.isPathmate
    : privacyPathmates === 'Tutti' ||
      (privacyPathmates === 'Pathmates' && profile.isPathmate);

  const canMessage =
    profile.messagePrivacy === 'Tutti' ||
    (profile.messagePrivacy === 'Pathmates' && profile.isPathmate);

  const skillsData = profile.canSeeSkills ? (profile.skills as any) : undefined;
  const coreSkills = skillsData?.core as { id: string; name: string }[] | null | undefined;
  const sideSkills = skillsData?.side as { id: string; name: string }[] | null | undefined;
  const interests = skillsData?.interests as { id: string; name: string; selectedAt: string }[] | undefined;
  const profilePills: { id: string; name: string }[] | undefined =
    coreSkills && coreSkills.length > 0 ? coreSkills : interests;

  // ── Main render ──

  return (
    <div className="px-4 py-4 space-y-5 pb-24">
      {/* Back button */}
      <div className="flex items-center">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[#94A3B8] hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-sm">Indietro</span>
        </button>
      </div>

      {/* Profile header */}
      <div className="flex flex-col items-center text-center gap-3">
        <UserAvatar name={profile.name} avatar={profile.avatar} size="lg" />

        <div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white">{profile.name}</h1>
            {profile.isPathmate && (
              <span className="flex items-center gap-1 text-xs bg-[#22C55E]/15 text-[#22C55E] px-2.5 py-0.5 rounded-full font-medium border border-[#22C55E]/20">
                <Check size={12} strokeWidth={2.5} />
                Pathmate
              </span>
            )}
          </div>

          {profile.university && (
            <p className="text-sm text-[#94A3B8] mt-0.5">{profile.university.name}</p>
          )}
          {profile.courseOfStudy && (
            <p className="text-xs text-[#64748B] mt-0.5">
              {profile.courseOfStudy}
              {profile.yearOfStudy ? ` · ${profile.yearOfStudy}° anno` : ''}
            </p>
          )}
        </div>

        {profile.bio && (
          <p className="text-sm text-[#94A3B8] leading-relaxed max-w-xs">{profile.bio}</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {canMessage && <button
            onClick={handleMessage}
            className="flex items-center gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <ChatDots size={16} />
            Invia messaggio
          </button>}

          {profile.isPathmate ? (
            <button
              onClick={handleRemovePathmate}
              disabled={removingPathmate}
              className="flex items-center gap-1 text-xs text-[#EF4444]/70 border border-[#EF4444]/20 px-3 py-2 rounded-xl hover:bg-[#EF4444]/10 hover:text-[#EF4444] transition-colors disabled:opacity-40"
            >
              <UserIcon size={14} />
              Rimuovi
            </button>
          ) : (
            profile.friendStatus === 'PENDING' && !profile.iAmRequester ? (
              // Incoming request: show Accept / Reject
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAcceptRequest}
                  className="flex items-center gap-1.5 text-sm text-white bg-[#4F46E5] px-4 py-2 rounded-xl hover:bg-[#4338CA] transition-colors"
                >
                  Accetta
                </button>
                <button
                  onClick={handleRejectRequest}
                  className="text-sm text-[#64748B] border border-[#334155] px-4 py-2 rounded-xl hover:bg-[#1E293B] transition-colors"
                >
                  Rifiuta
                </button>
              </div>
            ) : profile.friendStatus === 'PENDING' ? (
              <span className="text-xs text-[#64748B] border border-[#334155] px-4 py-2 rounded-xl">
                Richiesta inviata
              </span>
            ) : (
              <button
                onClick={handleAddPathmate}
                disabled={sendingRequest}
                className="flex items-center gap-1.5 text-sm text-[#4F46E5] border border-[#4F46E5]/40 px-4 py-2 rounded-xl hover:bg-[#4F46E5]/10 transition-colors disabled:opacity-50"
              >
                <UserAdd size={16} />
                Aggiungi ai Pathmates
              </button>
            )
          )}
        </div>
      </div>

      {/* Private profile notice */}
      {isPrivateAndNotConnected && (
        <div className="bg-[#1E293B] rounded-2xl p-5 text-center">
          <Lock size={32} color="#64748B" className="mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-[#64748B]">Questo profilo è privato</p>
          <p className="text-xs text-[#475569] mt-1">
            Diventa pathmate per vedere il profilo completo
          </p>
        </div>
      )}

      {/* Skill / Interest pills */}
      {(profilePills && profilePills.length > 0) && (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4">
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">
            {coreSkills && coreSkills.length > 0 ? 'Competenze' : 'Interessi'}
          </h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {profilePills.map((pill) => (
              <span
                key={pill.id}
                className="px-3 py-1 rounded-full text-xs font-medium bg-[#4F46E5]/20 text-[#4F46E5] whitespace-nowrap flex-shrink-0"
              >
                {pill.name}
              </span>
            ))}
          </div>
          {sideSkills && sideSkills.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-2">
              {sideSkills.map((pill) => (
                <span
                  key={pill.id}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-normal text-white border border-[#4F46E5]/50 whitespace-nowrap flex-shrink-0"
                >
                  {pill.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved opportunities — visibility controlled by owner's privacy settings */}
      {canSeeSavedOpps &&
        profile.savedOpportunities &&
        profile.savedOpportunities.length > 0 && (
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bookmark size={16} color="#64748B" />
              <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Salvati
              </h2>
              <span className="text-xs text-[#475569] ml-auto">
                {profile.savedOpportunities.length}
              </span>
            </div>
            <div className="space-y-2">
              {profile.savedOpportunities.slice(0, 5).map((opp) => (
                <div key={opp.id} className="flex items-center gap-3 py-1">
                  <span className="flex items-center justify-center w-5 h-5">{OPP_TYPE_ICON[opp.type] || <MapPin size={16} color="#64748B" />}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{opp.title}</p>
                    {opp.company && (
                      <p className="text-xs text-[#64748B] truncate">{opp.company}</p>
                    )}
                  </div>
                </div>
              ))}
              {profile.savedOpportunities.length > 5 && (
                <p className="text-xs text-[#475569] text-center pt-1">
                  +{profile.savedOpportunities.length - 5} altri
                </p>
              )}
            </div>
          </div>
        )}

      {/* Pathmates list */}
      {canSeePathmates && profile.pathmatesCount > 0 && (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <UsersGroup size={16} color="#64748B" />
            <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Pathmates
            </h2>
            <span className="text-xs text-[#475569] ml-auto">
              {profile.pathmatesCount}
            </span>
          </div>

          {profile.pathmates.length > 0 ? (
            <div className="space-y-3">
              {profile.pathmates.map((pm) => (
                <button
                  key={pm.id}
                  onClick={() => router.push(`/profile/${pm.id}`)}
                  className="w-full flex items-center gap-3 hover:bg-[#1E293B] rounded-xl p-1 -mx-1 transition-colors text-left"
                >
                  <UserAvatar name={pm.name} avatar={pm.avatar} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{pm.name}</p>
                    {pm.university && (
                      <p className="text-xs text-[#64748B] truncate">
                        {pm.university.name}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} color="#334155" className="shrink-0 ml-auto" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#475569] text-center py-2">
              Pathmates non visibili
            </p>
          )}
        </div>
      )}
    </div>
  );
}
