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
      <div style={{ height: '10.5rem', backgroundColor: '#C4BFEF' }} />
      {/* Avatar placeholder */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -48 }}>
        <div style={{ width: '6.75rem', height: '6.75rem', borderRadius: '50%', backgroundColor: '#DDD8F7', border: '0.25rem solid #fbf8ff' }} />
      </div>
      <div className="px-6 pt-4 flex flex-col items-center gap-2">
        <div style={{ height: '1.5rem', width: '10rem', backgroundColor: '#E8E4F8', borderRadius: '0.5rem' }} />
        <div style={{ height: '0.875rem', width: '12.5rem', backgroundColor: '#EDE9FB', borderRadius: '0.375rem' }} />
        <div style={{ height: '0.75rem', width: '8.75rem', backgroundColor: '#F0EDFC', borderRadius: '0.375rem' }} />
      </div>
      <div className="px-4 mt-6 space-y-3">
        <div style={{ height: '5rem', backgroundColor: '#EDE9FB', borderRadius: '1rem' }} />
        <div style={{ height: '7.5rem', backgroundColor: '#EDE9FB', borderRadius: '1rem' }} />
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
        <div style={{ width: '5rem', height: '5rem', borderRadius: '50%', backgroundColor: '#EDE9FB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
          <UserIcon size={40} color="#9B9BB0" strokeWidth={1.5} />
        </div>
        <p style={{ color: '#1F1F2E', fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>{t.profile.deletedUserTitle}</p>
        <p style={{ color: '#9B9BB0', fontSize: '0.875rem', marginBottom: '1.25rem' }}>{t.profile.deletedUserSub}</p>
        <button onClick={() => router.back()} style={{ color: '#615FE2', fontSize: '0.875rem' }}>
          {t.profile.goBack}
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
    <div style={{ backgroundColor: '#fbf8ff', minHeight: '100vh', paddingBottom: '6.25rem', position: 'relative' }}>

      {/* Back + menu — float over banner */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1rem 0' }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          <ChevronLeft size={20} color="white" />
          {t.profile.back}
        </button>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{ padding: '0.5rem', color: 'white', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '0.75rem' }}
          >
            <MoreHorizontal size={20} color="white" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpen(false)} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: '0.25rem',
                backgroundColor: 'white', border: '1px solid #EDE9FE',
                borderRadius: '1rem', boxShadow: '0 8px 24px rgba(97,95,226,0.12)',
                padding: '0.25rem 0', zIndex: 10, minWidth: '11.25rem',
              }}>
                <button
                  onClick={handleShare}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 1rem', fontSize: '0.875rem', color: '#6B6B80', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Share size={15} color="#9B9BB0" />
                  {t.profile.shareProfile}
                </button>
                {!reported && (
                  <button
                    onClick={() => { setMenuOpen(false); setReportModal(true); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 1rem', fontSize: '0.875rem', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <Flag size={15} color="#EF4444" />
                    {t.profile.reportUser}
                  </button>
                )}
                {reported && (
                  <span style={{ display: 'block', padding: '0.625rem 1rem', fontSize: '0.875rem', color: '#9B9BB0', fontStyle: 'italic' }}>
                    {t.profile.alreadyReported}
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
          position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, backgroundColor: 'white', border: '1px solid #EDE9FE',
          borderRadius: '1rem', padding: '0.625rem 1.25rem', fontSize: '0.875rem', color: '#1F1F2E',
          boxShadow: '0 8px 24px rgba(97,95,226,0.15)',
        }}>
          {t.profile.linkCopied}
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
          width: '8rem',
          height: '8rem',
          borderRadius: '50%',
          border: '0.3125rem solid white',
          boxShadow: '0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          {profile.avatar ? (
            <img src={profile.avatar} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #615FE2, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: '2rem' }}>
                {fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Profile info ── */}
      <div style={{ paddingTop: '5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        {/* Nome */}
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', lineHeight: '2rem', color: '#2c3149', margin: '0 0 0.125rem' }}>
          {fullName}
        </h1>

        {profile.university && (
          <p style={{ fontSize: '0.9375rem', color: '#595e78', margin: '0.125rem 0 0', fontWeight: 400 }}>
            {profile.university.name}
          </p>
        )}
        {profile.courseOfStudy && (
          <p style={{ fontSize: '0.75rem', color: 'rgba(89,94,120,0.65)', margin: '0.125rem 0 0' }}>
            {profile.courseOfStudy}
            {profile.yearOfStudy ? ` · ${profile.yearOfStudy}° anno` : ''}
          </p>
        )}

        {profile.bio && (
          <p style={{ fontSize: '0.875rem', color: '#595e78', lineHeight: '1.375rem', maxWidth: '18.75rem', margin: '0.625rem 0 0' }}>
            {profile.bio}
          </p>
        )}

        {/* ── Bottoni azione ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1.125rem' }}>
          {canMessage && (
            <button
              onClick={handleMessage}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                backgroundColor: '#615fe2', color: 'white',
                fontSize: '0.9375rem', fontWeight: 600,
                padding: '0.6875rem 1.375rem', borderRadius: '1.5rem',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(97,95,226,0.3)',
              }}
            >
              <ChatDots size={17} color="white" />
              {t.userProfile.sendMessage}
            </button>
          )}

          {profile.isPathmate ? (
            <button
              onClick={() => setShowRemoveConfirm(true)}
              disabled={removePathmateMutation.isPending}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                backgroundColor: 'rgba(34,197,94,0.12)', color: '#16A34A',
                fontSize: '0.8125rem', fontWeight: 600,
                padding: '0.6875rem 1rem', borderRadius: '1.5rem',
                border: '0.09375rem solid rgba(34,197,94,0.3)', cursor: 'pointer',
                opacity: removePathmateMutation.isPending ? 0.5 : 1,
              }}
            >
              <Check size={14} strokeWidth={2.5} color="#16A34A" />
              {t.profile.pathmate}
            </button>
          ) : (
            profile.friendStatus === 'PENDING' && !profile.iAmRequester ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleAcceptRequest}
                  style={{
                    backgroundColor: '#615fe2', color: 'white',
                    fontSize: '0.875rem', fontWeight: 600,
                    padding: '0.6875rem 1.375rem', borderRadius: '1.5rem',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {t.profile.accept}
                </button>
                <button
                  onClick={handleRejectRequest}
                  style={{
                    backgroundColor: 'white', color: '#595e78',
                    fontSize: '0.875rem', fontWeight: 500,
                    padding: '0.6875rem 1.375rem', borderRadius: '1.5rem',
                    border: '0.09375rem solid #DDD8F7', cursor: 'pointer',
                  }}
                >
                  {t.profile.reject}
                </button>
              </div>
            ) : profile.friendStatus === 'PENDING' ? (
              <span style={{
                fontSize: '0.875rem', color: '#9B9BB0',
                padding: '0.6875rem 1.375rem', borderRadius: '1.5rem',
                border: '0.09375rem solid #DDD8F7', backgroundColor: 'white',
              }}>
                {t.profile.requestSent}
              </span>
            ) : (
              <button
                onClick={handleAddPathmate}
                disabled={addPathmateMutation.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  backgroundColor: '#615fe2', color: 'white',
                  fontSize: '0.9375rem', fontWeight: 600,
                  padding: '0.6875rem 1.375rem', borderRadius: '1.5rem',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(97,95,226,0.3)',
                  opacity: addPathmateMutation.isPending ? 0.6 : 1,
                }}
              >
                <UserAdd size={17} color="white" />
                {t.profile.addPathmate}
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Cards section ── */}
      <div style={{ padding: '1.25rem 1rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        {/* Profilo privato */}
        {isPrivateAndNotConnected && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', textAlign: 'center', boxShadow: '0 2px 12px rgba(97,95,226,0.08)', border: '1px solid #EDE9FE' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <Lock size={32} color="#C4BFEF" strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: '0.875rem', color: '#595e78', fontWeight: 500 }}>{t.profile.privateProfile}</p>
            <p style={{ fontSize: '0.75rem', color: '#9B9BB0', marginTop: '0.25rem' }}>
              {t.profile.becomePathmate}
            </p>
          </div>
        )}

        {/* Competenze / Interessi */}
        {profilePills && profilePills.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 12px rgba(97,95,226,0.08)', border: '1px solid #EDE9FE' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9B9BB0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
              {coreSkills && coreSkills.length > 0 ? t.profile.skills : t.profile.interests}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.125rem' }}>
              {profilePills.map((pill) => (
                <span key={pill.id} style={{
                  backgroundColor: '#615fe2', color: 'white',
                  padding: '0.25rem 0.75rem', borderRadius: '624.9375rem',
                  fontSize: '0.8125rem', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {pill.name}
                </span>
              ))}
            </div>
            {sideSkills && sideSkills.length > 0 && (
              <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto', paddingBottom: '0.125rem', marginTop: '0.5rem' }}>
                {sideSkills.map((pill) => (
                  <span key={pill.id} style={{
                    backgroundColor: 'rgba(97,95,226,0.1)', color: '#615fe2',
                    padding: '0.1875rem 0.625rem', borderRadius: '624.9375rem',
                    fontSize: '0.6875rem', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
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
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 12px rgba(97,95,226,0.08)', border: '1px solid #EDE9FE' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <Bookmark size={15} color="#9B9BB0" />
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9B9BB0', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>
                {t.profile.savedOpportunities}
              </p>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#615fe2' }}>
                {profile.savedOpportunities.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {profile.savedOpportunities.slice(0, 5).map((opp) => (
                <div key={opp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.375rem 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '1.25rem', height: '1.25rem' }}>
                    {OPP_TYPE_ICON[opp.type] || <MapPin size={16} color="#9B9BB0" />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.875rem', color: '#2c3149', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.title}</p>
                    {opp.company && (
                      <p style={{ fontSize: '0.75rem', color: '#9B9BB0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.company}</p>
                    )}
                  </div>
                </div>
              ))}
              {profile.savedOpportunities.length > 5 && (
                <p style={{ fontSize: '0.75rem', color: '#9B9BB0', textAlign: 'center', paddingTop: '0.25rem' }}>
                  {t.profile.moreItems.replace('{n}', String(profile.savedOpportunities.length - 5))}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Pathmates */}
        {canSeePathmates && profile.pathmatesCount > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 12px rgba(97,95,226,0.08)', border: '1px solid #EDE9FE' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <UsersGroup size={15} color="#9B9BB0" />
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9B9BB0', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>
                Pathmates
              </p>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#615fe2' }}>
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
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.625rem 0.5rem', margin: '0 -0.5rem', borderRadius: '0.75rem',
                      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                      borderTop: idx > 0 ? '1px solid #F5F3FF' : 'none',
                    }}
                  >
                    <UserAvatar name={pm.name} avatar={pm.avatar} size="sm" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2c3149', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pm.name}
                      </p>
                      {pm.courseOfStudy ? (
                        <p style={{ fontSize: '0.75rem', color: '#9B9BB0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pm.courseOfStudy}
                        </p>
                      ) : pm.university ? (
                        <p style={{ fontSize: '0.75rem', color: '#9B9BB0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pm.university.name}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight size={16} color="#C4BFEF" />
                  </button>
                ))}
                {profile.pathmatesCount > profile.pathmates.length && (
                  <p style={{ fontSize: '0.75rem', color: '#9B9BB0', textAlign: 'center', paddingTop: '0.5rem', borderTop: '1px solid #F5F3FF', marginTop: '0.25rem' }}>
                    {t.profile.moreItems.replace('{n}', String(profile.pathmatesCount - profile.pathmates.length))}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: '#9B9BB0', textAlign: 'center', padding: '0.5rem 0' }}>
                {t.profile.pathmatesHidden}
              </p>
            )}
          </div>
        )}

      </div>{/* end cards section */}

      {/* ── Conferma rimozione Pathmate ── */}
      {showRemoveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)', padding: '0 1.5rem' }}
          onClick={() => setShowRemoveConfirm(false)}
        >
          <div
            style={{ backgroundColor: 'white', width: '100%', maxWidth: '22.5rem', borderRadius: '1.5rem', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'none' }} />
            <h3 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#2c3149', margin: '0 0 0.375rem' }}>
              {t.profile.removePathmateTitle.replace('{name}', profile.name)}
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#9B9BB0', margin: '0 0 1.5rem', lineHeight: '1.25rem' }}>
              {t.profile.removePathmateDesc}
            </p>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button
                onClick={() => setShowRemoveConfirm(false)}
                style={{
                  flex: 1, padding: '0.8125rem 0', borderRadius: '1.5rem',
                  border: '0.09375rem solid #EDE9FE', color: '#9B9BB0',
                  fontSize: '0.9375rem', fontWeight: 500, background: 'white', cursor: 'pointer',
                }}
              >
                {t.common.cancel}
              </button>
              <button
                onClick={() => { setShowRemoveConfirm(false); handleRemovePathmate(); }}
                style={{
                  flex: 1, padding: '0.8125rem 0', borderRadius: '1.5rem',
                  backgroundColor: '#EF4444', color: 'white',
                  fontSize: '0.9375rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                }}
              >
                {t.profile.remove}
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
              backgroundColor: 'white', width: '100%', maxWidth: '25rem',
              borderRadius: '1.25rem 1.25rem 0 0', padding: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '2.5rem', height: '0.25rem', borderRadius: '0.125rem', backgroundColor: '#DDD8F7', margin: '0 auto 1rem' }} />

            {reportSuccess ? (
              <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
                <div style={{ width: '3.25rem', height: '3.25rem', borderRadius: '50%', backgroundColor: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                  <Check size={26} color="#16A34A" strokeWidth={2.5} />
                </div>
                <p style={{ fontWeight: 600, fontSize: '1rem', color: '#2c3149', marginBottom: '0.25rem' }}>{t.profile.reportSent}</p>
                <p style={{ fontSize: '0.875rem', color: '#9B9BB0' }}>
                  {t.profile.reportThanks}
                </p>
              </div>
            ) : (
              <>
                <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: '#2c3149', margin: '0 0 0.25rem' }}>{t.profile.reportTitle}</h3>
                <p style={{ fontSize: '0.875rem', color: '#9B9BB0', marginBottom: '1rem' }}>
                  {t.profile.reportQuestion}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {[
                    t.profile.reportReasonFake,
                    t.profile.reportReasonSpam,
                    t.profile.reportReasonInappropriate,
                    t.profile.reportReasonHarassment,
                    t.profile.reportReasonOther,
                  ].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setReportReason(reason)}
                      style={{
                        textAlign: 'left', padding: '0.6875rem 1rem', borderRadius: '0.75rem',
                        fontSize: '0.875rem', cursor: 'pointer', border: '0.09375rem solid',
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
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                  <button
                    onClick={() => { setReportModal(false); setReportReason(''); }}
                    style={{
                      flex: 1, padding: '0.75rem 0', borderRadius: '1.5rem',
                      border: '0.09375rem solid #EDE9FE', color: '#9B9BB0',
                      fontSize: '0.875rem', fontWeight: 500, background: 'white', cursor: 'pointer',
                    }}
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={!reportReason || reportMutation.isPending}
                    style={{
                      flex: 1, padding: '0.75rem 0', borderRadius: '1.5rem',
                      backgroundColor: '#EF4444', color: 'white',
                      fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                      opacity: (!reportReason || reportMutation.isPending) ? 0.45 : 1,
                    }}
                  >
                    {reportMutation.isPending ? t.profile.sending : t.profile.report}
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
