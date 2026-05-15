'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';
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
  MoreHorizontal,
  Flag,
  Share,
} from '@/components/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicProfile {
  id: string;
  name: string;
  surname?: string;
  avatar?: string | null;
  bio?: string | null;
  courseOfStudy?: string | null;
  yearOfStudy?: number | null;
  university?: { name: string; shortName?: string } | null;
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
    university?: { name: string; shortName?: string } | null;
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
  STAGE: <Briefcase size={16} color="#615FE2" />,
  INTERNSHIP: <Building size={16} color="#615FE2" />,
  EXTRACURRICULAR: <GraduationCap size={16} color="#F59E0B" />,
  EVENT: <CalendarIcon size={16} color="#615FE2" />,
  FELLOWSHIP: <Trophy size={16} color="#F59E0B" />,
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
  const dim = size === 'lg' ? 96 : 40;
  const fontSize = size === 'lg' ? 28 : 14;
  return (
    <div style={{
      width: dim,
      height: dim,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #615FE2, #7C3AED)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize,
      color: 'white',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {avatar ? (
        <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initials
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ backgroundColor: '#fbf8ff', minHeight: '100vh' }} className="animate-pulse">
      {/* Banner placeholder */}
      <div style={{ height: 168, backgroundColor: '#C4BFEF' }} />
      {/* Avatar placeholder */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -48 }}>
        <div style={{ width: 108, height: 108, borderRadius: '50%', backgroundColor: '#DDD8F7', border: '4px solid #fbf8ff' }} />
      </div>
      <div className="px-6 pt-4 flex flex-col items-center gap-2">
        <div style={{ height: 24, width: 160, backgroundColor: '#E8E4F8', borderRadius: 8 }} />
        <div style={{ height: 14, width: 200, backgroundColor: '#EDE9FB', borderRadius: 6 }} />
        <div style={{ height: 12, width: 140, backgroundColor: '#F0EDFC', borderRadius: 6 }} />
      </div>
      <div className="px-4 mt-6 space-y-3">
        <div style={{ height: 80, backgroundColor: '#EDE9FB', borderRadius: 16 }} />
        <div style={{ height: 120, backgroundColor: '#EDE9FB', borderRadius: 16 }} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserProfilePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { t } = useLanguage();

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reported, setReported] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  if (id && id === user?.id) {
    router.replace('/profile');
  }

  const { data: profile, isLoading: loading, isError: notFound } = useQuery<PublicProfile>({
    queryKey: ['profile', id],
    queryFn: async () => {
      const { data } = await api.get(`/profile/${id}`);
      return data;
    },
    enabled: !!id && id !== user?.id,
    retry: false,
  });

  const addPathmateMutation = useMutation({
    mutationFn: () => api.post('/friends/request', { toUserId: profile!.id }),
    onSuccess: () => {
      queryClient.setQueryData<PublicProfile>(['profile', id], (p) =>
        p ? { ...p, friendStatus: 'PENDING', iAmRequester: true } : p
      );
    },
  });

  const removePathmateMutation = useMutation({
    mutationFn: () => api.delete(`/friends/${profile!.id}`),
    onSuccess: () => {
      queryClient.setQueryData<PublicProfile>(['profile', id], (p) =>
        p ? { ...p, isPathmate: false, friendStatus: null } : p
      );
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: () => api.patch(`/friends/request/${profile!.friendRequestId}`, { status: 'ACCEPTED' }),
    onSuccess: () => {
      queryClient.setQueryData<PublicProfile>(['profile', id], (p) =>
        p ? { ...p, isPathmate: true, friendStatus: 'ACCEPTED', iAmRequester: null } : p
      );
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: () => api.patch(`/friends/request/${profile!.friendRequestId}`, { status: 'REJECTED' }),
    onSuccess: () => {
      queryClient.setQueryData<PublicProfile>(['profile', id], (p) =>
        p ? { ...p, friendStatus: null, friendRequestId: null, iAmRequester: null } : p
      );
    },
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) => api.post(`/users/${id}/report`, { reason }),
    onSuccess: () => {
      setReported(true);
      setReportSuccess(true);
      setTimeout(() => {
        setReportModal(false);
        setReportReason('');
        setReportSuccess(false);
      }, 2000);
    },
    onError: () => {
      setReportModal(false);
      setReportReason('');
    },
  });

  const handleAddPathmate = () => addPathmateMutation.mutate();
  const handleRemovePathmate = () => removePathmateMutation.mutate();
  const handleAcceptRequest = () => acceptRequestMutation.mutate();
  const handleRejectRequest = () => rejectRequestMutation.mutate();

  const handleMessage = () => {
    if (!profile) return;
    localStorage.setItem(
      'openChatWith',
      JSON.stringify({ id: profile.id, name: profile.name, avatar: profile.avatar })
    );
    router.push('/networking');
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/profile/${id}`;
    setMenuOpen(false);
    if (navigator.share) {
      try {
        await navigator.share({ title: profile?.name, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const handleReport = () => {
    if (!reportReason || reportMutation.isPending) return;
    reportMutation.mutate(reportReason);
  };

  // ── Render states ──

  if (loading) return <LoadingSkeleton />;

  if (notFound) {
    return (
      <div style={{ backgroundColor: '#fbf8ff', minHeight: '100vh' }} className="flex flex-col items-center justify-center px-6 text-center">
        <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: '#EDE9FB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <UserIcon size={40} color="#9B9BB0" strokeWidth={1.5} />
        </div>
        <p style={{ color: '#1F1F2E', fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Utente eliminato</p>
        <p style={{ color: '#9B9BB0', fontSize: 14, marginBottom: 20 }}>Questo account è stato eliminato</p>
        <button onClick={() => router.back()} style={{ color: '#615FE2', fontSize: 14 }}>
          Torna indietro
        </button>
      </div>
    );
  }

  if (!profile) return null;

  // ── Derived data ──

  const isPrivateAndNotConnected = !profile.publicProfile && !profile.isPathmate;

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

  const fullName = [profile.name, profile.surname].filter(Boolean).join(' ');

  // ── Main render ──

  return (
    <div style={{ backgroundColor: '#fbf8ff', minHeight: '100vh', paddingBottom: 100, position: 'relative' }}>

      {/* Back + menu — float over banner */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 0' }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
        >
          <ChevronLeft size={20} color="white" />
          Indietro
        </button>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{ padding: 8, color: 'white', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 12 }}
          >
            <MoreHorizontal size={20} color="white" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpen(false)} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4,
                backgroundColor: 'white', border: '1px solid #EDE9FE',
                borderRadius: 16, boxShadow: '0 8px 24px rgba(97,95,226,0.12)',
                padding: '4px 0', zIndex: 10, minWidth: 180,
              }}>
                <button
                  onClick={handleShare}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 14, color: '#6B6B80', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Share size={15} color="#9B9BB0" />
                  Condividi profilo
                </button>
                {!reported && (
                  <button
                    onClick={() => { setMenuOpen(false); setReportModal(true); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 14, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <Flag size={15} color="#EF4444" />
                    Segnala utente
                  </button>
                )}
                {reported && (
                  <span style={{ display: 'block', padding: '10px 16px', fontSize: 14, color: '#9B9BB0', fontStyle: 'italic' }}>
                    Già segnalato
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Share copied toast */}
      {shareCopied && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, backgroundColor: 'white', border: '1px solid #EDE9FE',
          borderRadius: 16, padding: '10px 20px', fontSize: 14, color: '#1F1F2E',
          boxShadow: '0 8px 24px rgba(97,95,226,0.15)',
        }}>
          Link copiato negli appunti
        </div>
      )}

      {/* ── Hero banner + Avatar ── */}
      <div style={{ position: 'relative', marginBottom: 0 }}>
        <svg width="391" height="192" viewBox="0 0 391 192" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: 'auto' }}>
          <g clipPath="url(#pub_hero_clip)">
            <path d="M0 3C0 1.34315 1.34315 0 3 0H388C389.657 0 391 1.34315 391 3V173C391 183.493 382.493 192 372 192H19C8.50659 192 0 183.493 0 173V3Z" fill="#4A4BD7"/>
            <rect y="-25" width="391" height="250" rx="26" fill="#615FE2"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M0 102.593C5.92541 112.967 13.2542 122.358 21.8296 130.543C40.0496 147.896 63.6018 159.178 88.2856 165.134C112.969 171.09 138.784 171.733 163.748 168.054C177.228 166.063 190.568 162.903 203.376 158.554C225.048 151.065 245.358 139.568 261.959 123.668C265.018 120.713 267.946 117.616 270.735 114.381C272.659 112.156 274.532 109.889 276.349 107.584C278.165 105.279 279.924 102.937 281.626 100.557C289.378 89.826 296.145 78.3693 302.803 66.8681C306.131 61.117 309.465 55.3522 312.983 49.696C318.254 41.1792 323.897 32.8812 330.451 25.3181C337.005 17.755 344.509 10.9534 353.381 6.01766C360.027 2.27351 367.495 -0.000358582 375.134 -0.000358582C380.678 -0.000358582 386.348 1.11498 391 3.66099V192H0V102.593Z" fill="#ECEDFF" fillOpacity="0.17"/>
            <rect opacity="0.2" width="391" height="165" transform="matrix(1 0 0 -1 0 195)" fill="url(#pub_hero_radial)"/>
          </g>
          <defs>
            <radialGradient id="pub_hero_radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(195.5) scale(276.479 233.345)">
              <stop stopColor="white"/>
              <stop offset="0.5" stopColor="white" stopOpacity="0"/>
              <stop offset="1" stopColor="white" stopOpacity="0"/>
            </radialGradient>
            <clipPath id="pub_hero_clip">
              <path d="M0 3C0 1.34315 1.34315 0 3 0H388C389.657 0 391 1.34315 391 3V173C391 183.493 382.493 192 372 192H19C8.50659 192 0 183.493 0 173V3Z" fill="white"/>
            </clipPath>
          </defs>
        </svg>

        {/* Avatar — sovrapposto al banner, bordo bianco */}
        <div style={{
          position: 'absolute',
          bottom: -64,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 128,
          height: 128,
          borderRadius: '50%',
          border: '5px solid white',
          boxShadow: '0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          {profile.avatar ? (
            <img src={profile.avatar} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #615FE2, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 32 }}>
                {fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Profile info ── */}
      <div style={{ paddingTop: 80, paddingLeft: 24, paddingRight: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        {/* Nome */}
        <h1 style={{ fontWeight: 700, fontSize: 24, lineHeight: '32px', color: '#2c3149', margin: '0 0 2px' }}>
          {fullName}
        </h1>

        {profile.university && (
          <p style={{ fontSize: 15, color: '#595e78', margin: '2px 0 0', fontWeight: 400 }}>
            {profile.university.name}
          </p>
        )}
        {profile.courseOfStudy && (
          <p style={{ fontSize: 12, color: 'rgba(89,94,120,0.65)', margin: '2px 0 0' }}>
            {profile.courseOfStudy}
            {profile.yearOfStudy ? ` · ${profile.yearOfStudy}° anno` : ''}
          </p>
        )}

        {profile.bio && (
          <p style={{ fontSize: 14, color: '#595e78', lineHeight: '22px', maxWidth: 300, margin: '10px 0 0' }}>
            {profile.bio}
          </p>
        )}

        {/* ── Bottoni azione ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
          {canMessage && (
            <button
              onClick={handleMessage}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                backgroundColor: '#615fe2', color: 'white',
                fontSize: 15, fontWeight: 600,
                padding: '11px 22px', borderRadius: 24,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(97,95,226,0.3)',
              }}
            >
              <ChatDots size={17} color="white" />
              Invia messaggio
            </button>
          )}

          {profile.isPathmate ? (
            <button
              onClick={() => setShowRemoveConfirm(true)}
              disabled={removePathmateMutation.isPending}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                backgroundColor: 'rgba(34,197,94,0.12)', color: '#16A34A',
                fontSize: 13, fontWeight: 600,
                padding: '11px 16px', borderRadius: 24,
                border: '1.5px solid rgba(34,197,94,0.3)', cursor: 'pointer',
                opacity: removePathmateMutation.isPending ? 0.5 : 1,
              }}
            >
              <Check size={14} strokeWidth={2.5} color="#16A34A" />
              Pathmate
            </button>
          ) : (
            profile.friendStatus === 'PENDING' && !profile.iAmRequester ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleAcceptRequest}
                  style={{
                    backgroundColor: '#615fe2', color: 'white',
                    fontSize: 14, fontWeight: 600,
                    padding: '11px 22px', borderRadius: 24,
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Accetta
                </button>
                <button
                  onClick={handleRejectRequest}
                  style={{
                    backgroundColor: 'white', color: '#595e78',
                    fontSize: 14, fontWeight: 500,
                    padding: '11px 22px', borderRadius: 24,
                    border: '1.5px solid #DDD8F7', cursor: 'pointer',
                  }}
                >
                  Rifiuta
                </button>
              </div>
            ) : profile.friendStatus === 'PENDING' ? (
              <span style={{
                fontSize: 14, color: '#9B9BB0',
                padding: '11px 22px', borderRadius: 24,
                border: '1.5px solid #DDD8F7', backgroundColor: 'white',
              }}>
                Richiesta inviata
              </span>
            ) : (
              <button
                onClick={handleAddPathmate}
                disabled={addPathmateMutation.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  backgroundColor: '#615fe2', color: 'white',
                  fontSize: 15, fontWeight: 600,
                  padding: '11px 22px', borderRadius: 24,
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(97,95,226,0.3)',
                  opacity: addPathmateMutation.isPending ? 0.6 : 1,
                }}
              >
                <UserAdd size={17} color="white" />
                Aggiungi ai Pathmates
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Cards section ── */}
      <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Profilo privato */}
        {isPrivateAndNotConnected && (
          <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 20, textAlign: 'center', boxShadow: '0 2px 12px rgba(97,95,226,0.08)', border: '1px solid #EDE9FE' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <Lock size={32} color="#C4BFEF" strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 14, color: '#595e78', fontWeight: 500 }}>Questo profilo è privato</p>
            <p style={{ fontSize: 12, color: '#9B9BB0', marginTop: 4 }}>
              Diventa pathmate per vedere il profilo completo
            </p>
          </div>
        )}

        {/* Competenze / Interessi */}
        {profilePills && profilePills.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(97,95,226,0.08)', border: '1px solid #EDE9FE' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9B9BB0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              {coreSkills && coreSkills.length > 0 ? 'Competenze' : 'Interessi'}
            </p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {profilePills.map((pill) => (
                <span key={pill.id} style={{
                  backgroundColor: '#615fe2', color: 'white',
                  padding: '4px 12px', borderRadius: 9999,
                  fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {pill.name}
                </span>
              ))}
            </div>
            {sideSkills && sideSkills.length > 0 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginTop: 8 }}>
                {sideSkills.map((pill) => (
                  <span key={pill.id} style={{
                    backgroundColor: 'rgba(97,95,226,0.1)', color: '#615fe2',
                    padding: '3px 10px', borderRadius: 9999,
                    fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
                    border: '1px solid rgba(97,95,226,0.2)',
                  }}>
                    {pill.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Opportunità salvate */}
        {canSeeSavedOpps && profile.savedOpportunities && profile.savedOpportunities.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(97,95,226,0.08)', border: '1px solid #EDE9FE' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Bookmark size={15} color="#9B9BB0" />
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9B9BB0', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>
                Opportunità salvate
              </p>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#615fe2' }}>
                {profile.savedOpportunities.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {profile.savedOpportunities.slice(0, 5).map((opp) => (
                <div key={opp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}>
                    {OPP_TYPE_ICON[opp.type] || <MapPin size={16} color="#9B9BB0" />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, color: '#2c3149', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.title}</p>
                    {opp.company && (
                      <p style={{ fontSize: 12, color: '#9B9BB0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.company}</p>
                    )}
                  </div>
                </div>
              ))}
              {profile.savedOpportunities.length > 5 && (
                <p style={{ fontSize: 12, color: '#9B9BB0', textAlign: 'center', paddingTop: 4 }}>
                  +{profile.savedOpportunities.length - 5} altri
                </p>
              )}
            </div>
          </div>
        )}

        {/* Pathmates */}
        {canSeePathmates && profile.pathmatesCount > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(97,95,226,0.08)', border: '1px solid #EDE9FE' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <UsersGroup size={15} color="#9B9BB0" />
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9B9BB0', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>
                Pathmates
              </p>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#615fe2' }}>
                {profile.pathmatesCount}
              </span>
            </div>

            {profile.pathmates.length > 0 ? (
              <div>
                {profile.pathmates.map((pm, idx) => (
                  <button
                    key={pm.id}
                    onClick={() => router.push(`/profile/${pm.id}`)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 8px', margin: '0 -8px', borderRadius: 12,
                      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                      borderTop: idx > 0 ? '1px solid #F5F3FF' : 'none',
                    }}
                  >
                    <UserAvatar name={pm.name} avatar={pm.avatar} size="sm" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#2c3149', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pm.name}
                      </p>
                      {pm.courseOfStudy ? (
                        <p style={{ fontSize: 12, color: '#9B9BB0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pm.courseOfStudy}
                        </p>
                      ) : pm.university ? (
                        <p style={{ fontSize: 12, color: '#9B9BB0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pm.university.shortName || pm.university.name}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight size={16} color="#C4BFEF" />
                  </button>
                ))}
                {profile.pathmatesCount > profile.pathmates.length && (
                  <p style={{ fontSize: 12, color: '#9B9BB0', textAlign: 'center', paddingTop: 8, borderTop: '1px solid #F5F3FF', marginTop: 4 }}>
                    +{profile.pathmatesCount - profile.pathmates.length} altri
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: '#9B9BB0', textAlign: 'center', padding: '8px 0' }}>
                Pathmates non visibili
              </p>
            )}
          </div>
        )}

      </div>{/* end cards section */}

      {/* ── Conferma rimozione Pathmate ── */}
      {showRemoveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)', padding: '0 24px' }}
          onClick={() => setShowRemoveConfirm(false)}
        >
          <div
            style={{ backgroundColor: 'white', width: '100%', maxWidth: 360, borderRadius: 24, padding: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'none' }} />
            <h3 style={{ fontWeight: 700, fontSize: 17, color: '#2c3149', margin: '0 0 6px' }}>
              Rimuovi {profile.name} dai Pathmates?
            </h3>
            <p style={{ fontSize: 14, color: '#9B9BB0', margin: '0 0 24px', lineHeight: '20px' }}>
              Non potrete più vedere i profili privati e le opportunità salvate l'uno dell'altro.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowRemoveConfirm(false)}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 24,
                  border: '1.5px solid #EDE9FE', color: '#9B9BB0',
                  fontSize: 15, fontWeight: 500, background: 'white', cursor: 'pointer',
                }}
              >
                Annulla
              </button>
              <button
                onClick={() => { setShowRemoveConfirm(false); handleRemovePathmate(); }}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 24,
                  backgroundColor: '#EF4444', color: 'white',
                  fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer',
                }}
              >
                Rimuovi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Modal ── */}
      {reportModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => { setReportModal(false); setReportReason(''); }}
        >
          <div
            style={{
              backgroundColor: 'white', width: '100%', maxWidth: 400,
              borderRadius: '20px 20px 0 0', padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD8F7', margin: '0 auto 16px' }} />

            {reportSuccess ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Check size={26} color="#16A34A" strokeWidth={2.5} />
                </div>
                <p style={{ fontWeight: 600, fontSize: 16, color: '#2c3149', marginBottom: 4 }}>Segnalazione inviata</p>
                <p style={{ fontSize: 14, color: '#9B9BB0' }}>
                  Grazie per aver contribuito alla sicurezza della community.
                </p>
              </div>
            ) : (
              <>
                <h3 style={{ fontWeight: 700, fontSize: 18, color: '#2c3149', margin: '0 0 4px' }}>Segnala utente</h3>
                <p style={{ fontSize: 14, color: '#9B9BB0', marginBottom: 16 }}>
                  Perché vuoi segnalare questo profilo?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {['Profilo falso', 'Spam', 'Contenuto inappropriato', 'Molestie o bullismo', 'Altro'].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setReportReason(reason)}
                      style={{
                        textAlign: 'left', padding: '11px 16px', borderRadius: 12,
                        fontSize: 14, cursor: 'pointer', border: '1.5px solid',
                        borderColor: reportReason === reason ? '#615fe2' : '#EDE9FE',
                        backgroundColor: reportReason === reason ? 'rgba(97,95,226,0.06)' : 'white',
                        color: reportReason === reason ? '#615fe2' : '#595e78',
                        fontWeight: reportReason === reason ? 500 : 400,
                      }}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { setReportModal(false); setReportReason(''); }}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 24,
                      border: '1.5px solid #EDE9FE', color: '#9B9BB0',
                      fontSize: 14, fontWeight: 500, background: 'white', cursor: 'pointer',
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={!reportReason || reportMutation.isPending}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 24,
                      backgroundColor: '#EF4444', color: 'white',
                      fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
                      opacity: (!reportReason || reportMutation.isPending) ? 0.45 : 1,
                    }}
                  >
                    {reportMutation.isPending ? 'Invio...' : 'Segnala'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
