'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useSavedOpportunities } from '@/lib/savedOpportunities';
import { useSavedCourses } from '@/lib/savedCourses';
import { getSavedSimulations, SavedSimulation } from '@/components/AdmissionSimulator';
import { useLanguage, Language, LANGUAGE_DISPLAY_NAMES, SKILL_KEYS, getSkillLabel, normalizePassionToKey } from '@/lib/language';
import { usePrivacy } from '@/lib/privacy';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { isValidImageUrl, isValidExternalUrl } from '@/lib/urlValidation';
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getPushPermissionState } from '@/lib/pushManager';
import { parseDeadlineDate } from '@/lib/dateUtils';
import {
  Pencil, EyeOff, Plus, Bookmark, ChevronDown, ChevronRight, MapPin, CalendarIcon,
  Gear, UsersGroup, Bell, Moon, Globe, ShieldCheck, CircleHelp, Info, Search,
  ChatDots, UserAdd, CloseLg, CloseSm, Camera, Check, Key, UserIcon, Award,
  Trash, TriangleWarning, CircleWarning, Mail, FileText, Star, Lock, Trophy,
  Heart, Briefcase, GraduationCap, Plane, Rocket, Target, TrendingUp, CloseMd, BookOpen,
} from '@/components/icons';

interface FullProfile {
  id: string;
  name: string;
  surname: string;
  email: string;
  avatar?: string;
  bio?: string;
  courseOfStudy?: string;
  yearOfStudy?: number;
  university?: { name: string };
  skills?: {
    interests?: { id: string; name: string; selectedAt: string }[];
    [key: string]: unknown;
  };
  profile?: {
    clusterTag?: string;
    passions: string[];
    primaryInterest?: string;
  };
}

interface Friend {
  id: string;
  name: string;
  avatar?: string;
  courseOfStudy?: string;
  university?: { name: string };
  requestSent?: boolean;
}

const CLUSTER_COLORS: Record<string, string> = {
  Analista: 'bg-[#4F46E5]/20 text-[#4F46E5]',
  Creativo: 'bg-[#EC4899]/20 text-[#EC4899]',
  Leader: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  Imprenditore: 'bg-[#22C55E]/20 text-[#22C55E]',
  Sociale: 'bg-[#06B6D4]/20 text-[#06B6D4]',
  Explorer: 'bg-[#EF4444]/20 text-[#EF4444]',
};

function TypeIcon({ type, className = 'w-5 h-5' }: { type: string; className?: string }) {
  const props = { className };
  switch (type) {
    case 'INTERNSHIP':   return <Briefcase {...props} />;
    case 'SCHOLARSHIP':  return <GraduationCap {...props} />;
    case 'ERASMUS':      return <Plane {...props} />;
    case 'PROJECT':      return <Rocket {...props} />;
    case 'EVENT':        return <CalendarIcon {...props} />;
    case 'CORSO':        return <BookOpen {...props} />;
    default:             return <Bookmark {...props} />;
  }
}

function getDaysLeft(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseDeadlineDate(deadline);
  if (!d) return Infinity;
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const daysLeft = getDaysLeft(deadline);
  const parsed = parseDeadlineDate(deadline);
  const dateStr = parsed ? parsed.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : deadline;
  const label = daysLeft <= 0 ? 'Scaduta' : daysLeft === 1 ? 'Scade domani' : dateStr;
  const colors =
    daysLeft <= 2
      ? 'bg-red-500/20 text-red-400'
      : daysLeft <= 14
      ? 'bg-amber-500/20 text-amber-400'
      : 'bg-green-500/20 text-green-400';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${colors}`}>
      <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
      {label}
    </span>
  );
}

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const { savedOpps, toggleSave } = useSavedOpportunities();
  const { savedCourses } = useSavedCourses();
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const { language, setLanguage, t } = useLanguage();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'pathmates'>('settings');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [modalSkills, setModalSkills] = useState<string[]>([]);
  const [editName, setEditName] = useState('');
  const [editSurname, setEditSurname] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCourse, setEditCourse] = useState('');
  const [editYear, setEditYear] = useState<number | undefined>();
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [showSecurityPrivacySheet, setShowSecurityPrivacySheet] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showHelpSheet, setShowHelpSheet] = useState(false);
  const [showFaqSheet, setShowFaqSheet] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [showContactSheet, setShowContactSheet] = useState(false);
  const [showContactFormSheet, setShowContactFormSheet] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactFormSent, setContactFormSent] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [reportCategory, setReportCategory] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showSocialSheet, setShowSocialSheet] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  // Privacy settings from global context (persisted to localStorage)
  const {
    publicProfile,
    privacySkills, setPrivacySkills,
    privacyUniversity, setPrivacyUniversity,
    privacySavedOpps, setPrivacySavedOpps,
    privacyPathmates, setPrivacyPathmates,
    messagePrivacy, setMessagePrivacy,
    togglePrivateProfile,
  } = usePrivacy();
  const [showNotificationSheet, setShowNotificationSheet] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    pushEnabled: true,
    networking: true,
    opportunities: true,
    deadlines: true,
    social: true,
    postLikes: false,
    chat: true,
    system: true,
  });
  const [savedTab, setSavedTab] = useState<'opportunities' | 'universities'>('opportunities');
  const [oppSort, setOppSort] = useState<'recenti' | 'scadenza'>('recenti');
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);
  const [suggestedUsers, setSuggestedUsers] = useState<Friend[]>([]);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [removingFriend, setRemovingFriend] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const expandedCardRef = useRef<HTMLDivElement | null>(null);
  const savedScrollRef = useRef<HTMLDivElement | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!expandedOppId) return;
    const timer = setTimeout(() => {
      expandedCardRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 30);
    return () => clearTimeout(timer);
  }, [expandedOppId]);

  const { isLoading: loading } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const [profileRes, friendsRes, suggestionsRes] = await Promise.all([
        api.get('/profile/me'),
        api.get('/friends').catch(() => ({ data: [] })),
        api.get('/friends/suggestions').catch(() => ({ data: [] })),
      ]);
      const rawPassions: string[] = profileRes.data.profile?.passions || [];
      const normalizedPassions = rawPassions.map(normalizePassionToKey);
      const profileData = profileRes.data;
      if (profileData.profile) profileData.profile.passions = normalizedPassions;
      if (normalizedPassions.some((k: string, i: number) => k !== rawPassions[i])) {
        api.patch('/profile/me', { passions: normalizedPassions }).catch(() => {});
      }
      setProfile(profileData);
      setEditName(profileRes.data.name || '');
      setEditSurname(profileRes.data.surname || '');
      setEditBio(profileRes.data.bio || '');
      setEditCourse(profileRes.data.courseOfStudy || '');
      setEditYear(profileRes.data.yearOfStudy);
      setEditSkills(normalizedPassions);
      setFriends(friendsRes.data);
      setSuggestedUsers(suggestionsRes.data);
      return profileData;
    },
  });

  useEffect(() => {
    setSimulations(getSavedSimulations());
  }, []);

  useEffect(() => {
    if (showSkillsModal) {
      setModalSkills(profile?.profile?.passions || []);
    }
  }, [showSkillsModal]);

  const loadData = () => queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });

  const openEditDialog = () => {
    if (profile) {
      setEditName(profile.name || '');
      setEditSurname(profile.surname || '');
      setEditBio(profile.bio || '');
      setEditCourse(profile.courseOfStudy || '');
      setEditYear(profile.yearOfStudy);
      setEditSkills(profile.profile?.passions || []);
      setAvatarPreview(null);
      setEditError('');
    }
    setShowEditDialog(true);
  };

  const saveProfile = async () => {
    const trimmedName = editName.trim();
    const trimmedSurname = editSurname.trim();
    if (!trimmedName || !trimmedSurname) {
      setEditError(t.profile.nameRequired);
      return;
    }
    setEditError('');
    setSaving(true);
    try {
      await api.patch('/profile/me', {
        name: editName,
        surname: editSurname,
        bio: editBio,
        courseOfStudy: editCourse,
        yearOfStudy: editYear,
        passions: editSkills,
        ...(avatarPreview && { avatar: avatarPreview }),
      });
      setShowEditDialog(false);
      await loadData();
      if (avatarPreview && user) {
        setUser({ ...user, avatar: avatarPreview });
      }
      setAvatarPreview(null);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleEditSkill = (skill: string) => {
    setEditSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const addSkillFromModal = async (skill: string) => {
    const currentPassions = profile?.profile?.passions || [];
    if (currentPassions.includes(skill)) return;
    const newPassions = [...currentPassions, skill];
    if (profile?.profile) {
      setProfile({ ...profile, profile: { ...profile.profile, passions: newPassions } });
    }
    setModalSkills(newPassions);
    try {
      await api.patch('/profile/me', { passions: newPassions });
    } catch {
      if (profile?.profile) {
        setProfile({ ...profile, profile: { ...profile.profile, passions: currentPassions } });
      }
      setModalSkills(currentPassions);
    }
  };

  const removeSkill = async (skill: string) => {
    const currentPassions = profile?.profile?.passions || [];
    const newPassions = currentPassions.filter((s) => s !== skill);
    if (profile?.profile) {
      setProfile({ ...profile, profile: { ...profile.profile, passions: newPassions } });
    }
    setModalSkills(newPassions);
    try {
      await api.patch('/profile/me', { passions: newPassions });
    } catch {
      if (profile?.profile) {
        setProfile({ ...profile, profile: { ...profile.profile, passions: currentPassions } });
      }
      setModalSkills(currentPassions);
    }
  };

  const removeFriend = async (friendId: string) => {
    setRemovingFriend(friendId);
    try {
      await api.delete(`/friends/${friendId}`);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      // Refresh suggestions since the removed user might now appear
      api.get('/friends/suggestions').then((res) => setSuggestedUsers(res.data)).catch((err) => {
        console.error('Failed to refresh friend suggestions:', err);
      });
    } catch (err) {
      console.error('Failed to remove friend:', err);
    } finally {
      setRemovingFriend(null);
    }
  };

  const sendFriendRequest = async (userId: string) => {
    setSendingRequest(userId);
    try {
      await api.post('/friends/request', { toUserId: userId });
      setSuggestedUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, requestSent: true } : u
      ));
    } catch (err) {
      console.error('Failed to send friend request:', err);
    } finally {
      setSendingRequest(null);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete('/profile/me');
    } catch {
      setDeletingAccount(false);
      return;
    }
    // Clear all user-specific data from localStorage
    [
      'pathfinder_privacy',
      'pathfinder_saved_opps',
      'pathfinder-saved-courses',
      'openChatWith',
      'pinnedConversations',
    ].forEach((k) => localStorage.removeItem(k));
    logout();
  };

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(friendSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-6 animate-pulse">
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 bg-[#1E293B] rounded-full" />
          <div className="h-5 bg-[#1E293B] rounded w-36" />
          <div className="h-3 bg-[#1E293B] rounded w-48" />
        </div>
        <div className="h-24 bg-[#1E293B] rounded-2xl" />
        <div className="h-40 bg-[#1E293B] rounded-2xl" />
      </div>
    );
  }

  if (!profile) return null;

  const fullName = [profile.name, profile.surname].filter(Boolean).join(' ');
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const skillsData = profile.skills as any;
  const coreSkills = skillsData?.core as { id: string; name: string }[] | null | undefined;
  const sideSkills = skillsData?.side as { id: string; name: string }[] | null | undefined;
  const interests = skillsData?.interests as { id: string; name: string; selectedAt: string }[] | undefined;
  // Show core skills if defined, otherwise fall back to interests
  const profilePills: { id: string; name: string }[] | undefined =
    coreSkills && coreSkills.length > 0 ? coreSkills : interests;

  const tags: { label: string; color: string }[] = [];
  if (profile.profile?.passions) {
    profile.profile.passions.forEach((p) => {
      tags.push({ label: getSkillLabel(p, t), color: 'bg-[#334155] text-[#94A3B8]' });
    });
  }

  const currentAvatar = avatarPreview || profile.avatar;

  return (
    <>
      <div className="px-4 py-6 space-y-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">{t.profile.title}</h1>
          <button
            onClick={openEditDialog}
            className="p-2 rounded-full hover:bg-[#1E293B] transition-colors"
          >
            <Pencil size={20} color="#94A3B8" />
          </button>
        </div>

        {/* Profile visibility notice */}
        {!publicProfile && (
          <div className="flex items-center gap-2 bg-[#1E293B] rounded-xl px-4 py-2.5">
            <EyeOff size={16} color="#64748B" className="flex-shrink-0" />
            <p className="text-xs text-[#64748B]">
              Profilo <span className="text-[#94A3B8] font-medium">privato</span> — visibile solo ai Pathmates
            </p>
          </div>
        )}

        {/* Profile Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg overflow-hidden"
            style={{
              backgroundColor: currentAvatar && isValidImageUrl(currentAvatar) ? '#FFFFFF' : undefined,
              background: !(currentAvatar && isValidImageUrl(currentAvatar))
                ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
                : undefined,
              boxShadow: '0 10px 15px -3px rgba(79,70,229,0.2)',
            }}
          >
            {currentAvatar && isValidImageUrl(currentAvatar) ? (
              <img
                src={currentAvatar}
                alt={fullName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{fullName}</h2>
            {privacyUniversity !== 'Nessuno' && profile.university && (
              <p className="text-sm text-[#94A3B8] mt-0.5">{profile.university.name}</p>
            )}
            {privacyUniversity !== 'Nessuno' && profile.courseOfStudy && (
              <p className="text-xs text-[#64748B] mt-0.5">
                {profile.courseOfStudy}
                {profile.yearOfStudy ? ` - ${profile.yearOfStudy}${t.profile.yearSuffix}` : ''}
              </p>
            )}
            {privacyUniversity === 'Nessuno' && (
              <p className="text-xs text-[#475569] mt-0.5 italic">{t.profile.universityHidden}</p>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-[#94A3B8] max-w-xs leading-relaxed">{profile.bio}</p>
          )}

          {/* Skill / Interest pills */}
          {privacySkills !== 'Nessuno' ? (
            <>
              {profilePills && profilePills.length > 0 && (
                <div className="flex justify-center gap-2 pt-1 overflow-x-auto max-w-full scrollbar-hide">
                  {profilePills.map((pill) => (
                    <span
                      key={pill.id}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-[#4F46E5]/20 text-[#4F46E5] whitespace-nowrap flex-shrink-0"
                    >
                      {pill.name}
                    </span>
                  ))}
                </div>
              )}
              {/* Side skills rows */}
              {sideSkills && sideSkills.length > 0 ? (
                <div className="flex flex-col items-center gap-1.5">
                  {/* Row 1: up to 3 pills */}
                  <div className="flex justify-center gap-2">
                    {sideSkills.slice(0, 3).map((pill) => (
                      <span
                        key={pill.id}
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-normal text-white border border-[#4F46E5]/50 whitespace-nowrap"
                      >
                        {pill.name}
                      </span>
                    ))}
                  </div>
                  {/* Row 2: remaining pills (up to 2), only if > 3 */}
                  {sideSkills.length > 3 && (
                    <div className="flex justify-center gap-2">
                      {sideSkills.slice(3, 5).map((pill) => (
                        <span
                          key={pill.id}
                          className="px-2.5 py-0.5 rounded-full text-[11px] font-normal text-white border border-[#4F46E5]/50 whitespace-nowrap"
                        >
                          {pill.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : coreSkills && coreSkills.length > 0 ? (
                <button
                  onClick={() => router.push('/profile/skills')}
                  className="text-[11px] text-[#4F46E5]/70 hover:text-[#4F46E5] transition-colors"
                >
                  + Aggiungi competenze secondarie
                </button>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-[#475569] italic pt-1">Competenze nascoste</p>
          )}
        </div>

        {/* Salvati Section */}
        <div style={privacySavedOpps === 'Nessuno' ? { display: 'none' } : undefined}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bookmark size={16} color="#94A3B8" />
              <h3 className="text-base font-semibold text-white">{t.profile.saved}</h3>
            </div>
            <div className="flex bg-[#1E293B] rounded-lg p-0.5">
              <button
                onClick={() => setSavedTab('universities')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  savedTab === 'universities'
                    ? 'bg-[#4F46E5] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {t.profile.savedUni}
              </button>
              <button
                onClick={() => setSavedTab('opportunities')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  savedTab === 'opportunities'
                    ? 'bg-[#4F46E5] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {t.profile.savedOpp}
              </button>
            </div>
          </div>

          {savedTab === 'opportunities' ? (
            savedOpps.length === 0 ? (
              <div className="bg-[#1E293B] rounded-2xl p-6 text-center">
                <p className="text-sm text-[#64748B]">{t.profile.noSavedOpportunities}</p>
                <button
                  onClick={() => router.push('/home')}
                  className="mt-3 text-sm text-[#4F46E5] font-medium hover:underline"
                >
                  {t.profile.exploreOpportunities}
                </button>
              </div>
            ) : (
              <>
                {/* Sort selector */}
                <div className="flex bg-[#1E293B] rounded-lg p-0.5 mb-3 w-fit">
                  <button
                    onClick={() => setOppSort('recenti')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${oppSort === 'recenti' ? 'bg-[#4F46E5] text-white' : 'text-[#94A3B8] hover:text-white'}`}
                  >
                    Recenti
                  </button>
                  <button
                    onClick={() => setOppSort('scadenza')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${oppSort === 'scadenza' ? 'bg-[#4F46E5] text-white' : 'text-[#94A3B8] hover:text-white'}`}
                  >
                    In scadenza
                  </button>
                </div>

                {/* Horizontal scroll — align-items:start so non-expanded cards don't stretch */}
                <div ref={savedScrollRef} className="flex gap-3 overflow-x-auto no-scrollbar p-0.5 pb-2" style={{ alignItems: 'start' }}>
                  {[...savedOpps].sort((a, b) => {
                    if (oppSort !== 'scadenza') return 0;
                    if (!a.deadline && !b.deadline) return 0;
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return (parseDeadlineDate(a.deadline)?.getTime() ?? Infinity) - (parseDeadlineDate(b.deadline)?.getTime() ?? Infinity);
                  }).map((opp) => {
                    const isExpanded = expandedOppId === opp.id;
                    return (
                      <div
                        key={opp.id}
                        ref={isExpanded ? expandedCardRef : null}
                        style={{
                          flexShrink: 0,
                          width: isExpanded ? `${savedScrollRef.current?.offsetWidth ?? 280}px` : '192px',
                          transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
                        }}
                        className={`bg-[#161B22] rounded-2xl overflow-hidden ${isExpanded ? 'ring-1 ring-[#4F46E5]' : ''}`}
                      >
                        {/* Collapsed header — always visible */}
                        <button
                          onClick={() => setExpandedOppId(isExpanded ? null : opp.id)}
                          className="w-full text-left p-3 active:opacity-75 transition-opacity flex flex-col"
                          style={{ height: '150px' }}
                        >
                          <div className="w-9 h-9 rounded-lg bg-[#1E293B] flex items-center justify-center mb-2">
                            <TypeIcon type={opp.type} />
                          </div>
                          <h4 className="text-[13px] font-semibold text-white line-clamp-2 leading-snug mb-1">{opp.title}</h4>
                          <p className="text-[11px] text-[#64748B] truncate mb-2">{opp.company || opp.university?.name || ''}</p>
                          {oppSort === 'scadenza'
                            ? opp.deadline
                              ? <DeadlineBadge deadline={opp.deadline} />
                              : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1E293B] text-[#64748B]">Non indicata</span>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#4F46E5]/20 text-[#4F46E5] uppercase">{opp.type}</span>
                          }
                        </button>

                        {/* Expandable detail */}
                        <div style={{ display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
                          <div style={{ overflow: 'hidden', minHeight: 0 }}>
                            <div className="px-3 pb-3 space-y-2">
                              <div className="h-px bg-[#1E293B]" />

                              {opp.description && (
                                <p className="text-gray-400 text-[11px] leading-relaxed">{opp.description}</p>
                              )}

                              {(opp.location || opp.isRemote || opp.deadline) && (
                                <div className="flex flex-col gap-1.5">
                                  {opp.location && (
                                    <div className="flex items-center gap-1.5">
                                      <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                      </svg>
                                      <span className="text-gray-400 text-[11px]">{opp.location}{opp.isRemote ? ' · Remoto' : ''}</span>
                                    </div>
                                  )}
                                  {opp.deadline && (
                                    <div className="flex items-center gap-1.5">
                                      <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                      </svg>
                                      <span className="text-gray-400 text-[11px]">{parseDeadlineDate(opp.deadline)?.toLocaleDateString('it-IT') ?? opp.deadline}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {opp.about && (
                                <p className="text-gray-500 text-[10px] leading-relaxed line-clamp-3">{opp.about}</p>
                              )}

                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => opp.url && isValidExternalUrl(opp.url) && window.open(opp.url, '_blank', 'noopener,noreferrer')}
                                  disabled={!opp.url || !isValidExternalUrl(opp.url)}
                                  className={`flex-1 py-2.5 rounded-xl font-semibold text-[11px] transition-opacity ${
                                    opp.url && isValidExternalUrl(opp.url)
                                      ? 'bg-primary text-white active:opacity-90'
                                      : 'bg-[#1E293B] text-gray-500 cursor-not-allowed'
                                  }`}
                                >
                                  {opp.url && isValidExternalUrl(opp.url) ? 'Vai' : 'Non disponibile'}
                                </button>
                                <button
                                  onClick={() => { toggleSave(opp.id); setExpandedOppId(null); }}
                                  className="w-9 h-9 bg-[#0D1117] rounded-xl flex items-center justify-center flex-shrink-0 text-primary"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          ) : savedCourses.length === 0 ? (
            <div className="bg-[#1E293B] rounded-2xl p-6 text-center">
              <p className="text-sm text-[#64748B]">Nessun corso salvato ancora</p>
              <button
                onClick={() => router.push('/universities')}
                className="mt-3 text-sm text-[#4F46E5] font-medium hover:underline"
              >
                Esplora corsi
              </button>
            </div>
          ) : (
            <div ref={savedScrollRef} className="flex gap-3 overflow-x-auto no-scrollbar p-0.5 pb-2" style={{ alignItems: 'start' }}>
              {savedCourses.map((c) => {
                const isExpanded = expandedOppId === c.id;
                return (
                  <div
                    key={c.id}
                    ref={isExpanded ? expandedCardRef : null}
                    style={{
                      flexShrink: 0,
                      width: isExpanded ? `${savedScrollRef.current?.offsetWidth ?? 280}px` : '192px',
                      transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
                    }}
                    className={`bg-[#161B22] rounded-2xl overflow-hidden ${isExpanded ? 'ring-1 ring-[#4F46E5]' : ''}`}
                  >
                    <button
                      onClick={() => setExpandedOppId(isExpanded ? null : c.id)}
                      className="w-full text-left p-3 active:opacity-75 transition-opacity flex flex-col"
                      style={{ height: '150px' }}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: '#4F46E5' }}>
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <h4 className="text-[13px] font-semibold text-white line-clamp-2 leading-snug mb-1">{c.name}</h4>
                      <p className="text-[11px] text-[#64748B] truncate">{c.university?.name}</p>
                    </button>

                    <div style={{ display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
                      <div style={{ overflow: 'hidden', minHeight: 0 }}>
                        <div className="px-3 pb-3 space-y-2">
                          <div className="h-px bg-[#1E293B]" />
                          {c.university?.city && (
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                              </svg>
                              <span className="text-gray-400 text-[11px]">{c.university?.city}</span>
                            </div>
                          )}
                          <button
                            onClick={() => router.push(`/universities/course/${c.id}`)}
                            className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-[11px] active:opacity-90 transition-opacity"
                          >
                            Vai al corso
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Simulazioni salvate */}
        {simulations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} color="#94A3B8" />
              <h3 className="text-base font-semibold text-white">Le mie simulazioni</h3>
            </div>
            <div className="bg-[#1E293B] rounded-2xl p-4">
              <div className="space-y-3">
                {simulations.map((sim) => (
                  <div
                    key={sim.id}
                    onClick={() => router.push(`/universities/course/${sim.courseId}`)}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-[#2A3F54]/50 transition-colors"
                    style={{ backgroundColor: '#0F172A' }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${sim.result.categoria.color}20` }}
                    >
                      <span className="text-sm font-bold" style={{ color: sim.result.categoria.color }}>
                        {sim.result.probabilitaFinale}%
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-white line-clamp-1 mb-0.5">{sim.courseTitle}</h4>
                      <p className="text-xs text-[#64748B] truncate">
                        {sim.university} · {sim.result.categoria.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div>
          <div className="flex bg-[#1E293B] rounded-xl p-1 mb-4">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'settings'
                  ? 'bg-[#4F46E5] text-white shadow-md'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Gear size={16} />
                {t.profile.settings}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('pathmates')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'pathmates'
                  ? 'bg-[#4F46E5] text-white shadow-md'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <UsersGroup size={16} />
                Pathmates
                {friends.length > 0 && (
                  <span className="text-xs opacity-70">({friends.length})</span>
                )}
              </span>
            </button>
          </div>

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-3">
              {/* Unified Preferences */}
              <div className="bg-[#1E293B] rounded-2xl p-4">
                <h4 className="text-sm font-semibold text-white mb-3">{t.profile.preferences}</h4>
                <div>
                  <button
                    className="flex items-center justify-between py-2 w-full"
                    onClick={() => {
                      api.get('/notifications/preferences')
                        .then(({ data }) => {
                          const { id, userId, ...prefs } = data;
                          setNotifPrefs(prefs);
                        })
                        .catch(() => {});
                      setShowNotificationSheet(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center">
                        <Bell size={20} color="#4F46E5" />
                      </div>
                      <span className="text-sm text-white">{t.profile.notifications}</span>
                    </div>
                    <ChevronRight size={20} color="#64748B" />
                  </button>
                  <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center">
                        <Moon size={20} color="#4F46E5" />
                      </div>
                      <span className="text-sm text-white">{t.profile.darkMode}</span>
                    </div>
                    <ToggleSwitch defaultOn />
                  </div>
                  <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center">
                        <Globe size={20} color="#4F46E5" />
                      </div>
                      <span className="text-sm text-white">{t.profile.language}</span>
                    </div>
                    <LanguageDropdown />
                  </div>
                </div>
              </div>

              {/* Security & Info */}
              <div className="bg-[#1E293B] rounded-2xl overflow-hidden">
                {[
                  { label: t.profile.securityPrivacy, icon: <ShieldCheck size={20} color="#4F46E5" />, onPress: () => setShowSecurityPrivacySheet(true) },
                  { label: t.profile.helpSupport, icon: <CircleHelp size={20} color="#4F46E5" />, onPress: () => setShowHelpSheet(true) },
                  { label: t.profile.info, icon: <Info size={20} color="#4F46E5" />, onPress: () => setShowInfoSheet(true) },
                ].map((item, i, arr) => (
                  <div key={item.label}>
                    <button
                      onClick={item.onPress}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#334155]/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center">
                          {item.icon}
                        </div>
                        <span className="text-sm text-white">{item.label}</span>
                      </div>
                      <ChevronRight size={16} color="#64748B" />
                    </button>
                    {i < arr.length - 1 && (
                      <div className="ml-[60px] mr-2 h-px bg-[#334155]/50" />
                    )}
                  </div>
                ))}
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full bg-[#EF4444]/10 text-[#EF4444] rounded-2xl py-3.5 text-sm font-medium hover:bg-[#EF4444]/20 transition-colors"
              >
                {t.profile.logout}
              </button>
            </div>
          )}

          {/* Pathmates Tab */}
          {activeTab === 'pathmates' && (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2"><Search size={16} color="#64748B" /></span>
                <input
                  type="text"
                  placeholder={t.profile.searchPathmates}
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#4F46E5] transition-colors"
                />
              </div>

              {/* Current Pathmates */}
              {filteredFriends.length === 0 ? (
                <div className="bg-[#1E293B] rounded-2xl p-6 text-center">
                  <p className="text-sm text-[#64748B]">
                    {friendSearch ? t.profile.noResults : t.profile.noPathmates}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFriends.map((friend) => {
                    const friendInitials = friend.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <div
                        key={friend.id}
                        className="bg-[#1E293B] rounded-2xl p-4 flex items-center gap-3"
                      >
                        <button
                          onClick={() => router.push(`/profile/${friend.id}`)}
                          className="w-11 h-11 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                        >
                          {friend.avatar && isValidImageUrl(friend.avatar) ? (
                            <img src={friend.avatar} alt={friend.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            friendInitials
                          )}
                        </button>
                        <button
                          onClick={() => router.push(`/profile/${friend.id}`)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="text-sm font-semibold text-white truncate">{friend.name}</p>
                          <p className="text-xs text-[#64748B] truncate">
                            {friend.courseOfStudy || friend.university?.name || ''}
                          </p>
                        </button>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {messagePrivacy !== 'Nessuno' && (
                            <button
                              onClick={() => router.push(`/networking?openChat=${friend.id}&name=${encodeURIComponent(friend.name)}&avatar=${encodeURIComponent(friend.avatar || '')}`)}
                              className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center hover:bg-[#4F46E5]/30 transition-colors"
                            >
                              <ChatDots size={20} color="#4F46E5" />
                            </button>
                          )}
                          <button
                            onClick={() => removeFriend(friend.id)}
                            disabled={removingFriend === friend.id}
                            className="w-9 h-9 rounded-[22%] bg-[#EF4444]/10 flex items-center justify-center hover:bg-[#EF4444]/20 transition-colors disabled:opacity-50"
                          >
                            <UserIcon size={16} color="#EF4444" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Suggested Pathmates */}
              {suggestedUsers.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-3 px-1">
                    {t.profile.suggestedPathmates}
                  </h4>
                  <div className="space-y-2">
                    {suggestedUsers.map((suggested) => {
                      const suggestedInitials = suggested.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);

                      return (
                        <div
                          key={suggested.id}
                          className="bg-[#1E293B] rounded-2xl p-4 flex items-center gap-3"
                        >
                          <button
                            onClick={() => router.push(`/profile/${suggested.id}`)}
                            className="w-11 h-11 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                          >
                            {suggested.avatar && isValidImageUrl(suggested.avatar) ? (
                              <img src={suggested.avatar} alt={suggested.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              suggestedInitials
                            )}
                          </button>
                          <button
                            onClick={() => router.push(`/profile/${suggested.id}`)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className="text-sm font-semibold text-white truncate">{suggested.name}</p>
                            <p className="text-xs text-[#64748B] truncate">
                              {suggested.courseOfStudy || suggested.university?.name || ''}
                            </p>
                          </button>
                          {suggested.requestSent ? (
                            <span className="text-xs text-[#4F46E5] font-medium px-2 flex-shrink-0">Inviata</span>
                          ) : (
                            <button
                              onClick={() => sendFriendRequest(suggested.id)}
                              disabled={sendingRequest === suggested.id}
                              className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center hover:bg-[#4F46E5]/30 transition-colors disabled:opacity-50 flex-shrink-0"
                            >
                              <UserAdd size={20} color="#4F46E5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Edit Profile Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowEditDialog(false)}
          />
          <div className="relative w-full max-w-lg bg-[#1E293B] rounded-t-3xl sm:rounded-3xl p-6 pb-[calc(1.5rem+5rem)] sm:pb-6 space-y-5 animate-slide-up max-h-[100vh] sm:max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{t.profile.editProfile}</h3>
              <button
                onClick={() => setShowEditDialog(false)}
                className="p-1 rounded-full hover:bg-[#334155] transition-colors"
              >
                <CloseLg size={20} color="#94A3B8" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group"
                >
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
                    {currentAvatar ? (
                      <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} color="white" />
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <p className="text-xs text-[#64748B] mt-2">{t.profile.tapToChangePhoto}</p>
              </div>

              {/* Name & Surname */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">{t.profile.name}</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#4F46E5] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">{t.profile.surname}</label>
                  <input
                    type="text"
                    value={editSurname}
                    onChange={(e) => setEditSurname(e.target.value)}
                    className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#4F46E5] transition-colors"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">{t.profile.bio}</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  placeholder={t.profile.bioPlaceholder}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#4F46E5] transition-colors resize-none"
                />
              </div>

              {/* Course & Year */}
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">{t.profile.course}</label>
                <input
                  type="text"
                  value={editCourse}
                  onChange={(e) => setEditCourse(e.target.value)}
                  placeholder={t.profile.coursePlaceholder}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#4F46E5] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">{t.profile.year}</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={editYear || ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!e.target.value) { setEditYear(undefined); return; }
                    if (Number.isInteger(v) && v >= 1 && v <= 5) setEditYear(v);
                  }}
                  placeholder={t.profile.yearPlaceholder}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#4F46E5] transition-colors"
                />
              </div>

              {/* Core Skills link */}
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">{t.profile.skills}</label>
                <button
                  onClick={() => {
                    setShowEditDialog(false);
                    router.push('/profile/skills');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#4F46E5]/20 text-[#4F46E5] hover:bg-[#4F46E5]/30 transition-colors"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  {t.profile.add}
                </button>
              </div>
            </div>

            {editError && (
              <div className="bg-error/10 text-error rounded-xl px-4 py-3 text-sm">
                {editError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowEditDialog(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-[#94A3B8] bg-[#334155]/50 hover:bg-[#334155] transition-colors"
              >
                {t.profile.cancel}
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] transition-colors disabled:opacity-50"
              >
                {saving ? t.profile.saving : t.profile.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skills Modal */}
      {showSkillsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSkillsModal(false)}
          />
          <div className="relative w-full max-w-lg bg-[#1E293B] rounded-t-3xl sm:rounded-3xl p-6 space-y-4 animate-slide-up max-h-[80vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{t.profile.addSkills}</h3>
              <button
                onClick={() => setShowSkillsModal(false)}
                className="p-1 rounded-full hover:bg-[#334155] transition-colors"
              >
                <CloseLg size={20} color="#94A3B8" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {SKILL_KEYS.map((key) => {
                const isAdded = modalSkills.includes(key);
                const label = getSkillLabel(key, t);
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (isAdded) {
                        removeSkill(key);
                      } else {
                        addSkillFromModal(key);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isAdded
                        ? 'bg-[#4F46E5] text-white'
                        : 'bg-[#334155] text-[#94A3B8] hover:bg-[#475569] hover:text-white'
                    }`}
                  >
                    {isAdded && (
                      <Check size={12} strokeWidth={3} className="inline mr-1" />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowSkillsModal(false)}
              className="w-full py-3 rounded-xl text-sm font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] transition-colors"
            >
              {t.profile.done}
            </button>
          </div>
        </div>
      )}

      {/* ── Sicurezza e Privacy Sheet ─────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 ${
          showSecurityPrivacySheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowSecurityPrivacySheet(false)}
      />
      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          showSecurityPrivacySheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#334155]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E293B]">
          <h2 className="text-white font-bold text-lg">{t.profile.securityPrivacy}</h2>
          <button
            onClick={() => setShowSecurityPrivacySheet(false)}
            className="p-1 rounded-full hover:bg-[#334155] transition-colors"
          >
            <CloseLg size={20} color="#94A3B8" />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">

          {/* Sicurezza */}
          <div className="bg-[#1E293B] rounded-2xl p-4">
            <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">{t.security.title}</h4>
            <button onClick={() => { setShowSecurityPrivacySheet(false); setShowChangePassword(true); }} className="w-full flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                  <Key size={20} color="#4F46E5" />
                </div>
                <span className="text-sm text-white">{t.security.changePassword}</span>
              </div>
              <ChevronRight size={16} color="#64748B" />
            </button>
          </div>

          {/* Visibilità profilo */}
          <div className="bg-[#1E293B] rounded-2xl p-4">
            <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">{t.privacy.profileVisibility}</h4>
            {/* Profilo pubblico / privato toggle */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                  <UserIcon size={20} color="#4F46E5" />
                </div>
                <div>
                  <span className="text-sm text-white block">Profilo privato</span>
                </div>
              </div>
              <PrivacyToggle value={!publicProfile} onChange={togglePrivateProfile} />
            </div>
            <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
            {/* Chi può vedere le tue competenze */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                  <Award size={20} color="#4F46E5" />
                </div>
                <span className="text-sm text-white">{t.privacy.whoCanSeeSkills}</span>
              </div>
              <PrivacyDropdown value={privacySkills} onChange={setPrivacySkills} allowedOptions={!publicProfile ? ['Pathmates'] : ['Tutti', 'Pathmates']} />
            </div>
          </div>

          {/* Attività */}
          <div className="bg-[#1E293B] rounded-2xl p-4">
            <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">{t.privacy.activity}</h4>
            {/* Opportunità salvate */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                  <Bookmark size={20} color="#4F46E5" />
                </div>
                <span className="text-sm text-white">{t.privacy.whoCanSeeSavedOpps}</span>
              </div>
              <PrivacyDropdown value={privacySavedOpps} onChange={setPrivacySavedOpps} allowedOptions={!publicProfile ? ['Pathmates', 'Nessuno'] : undefined} />
            </div>
            <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
            {/* Pathmates */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                  <UsersGroup size={20} color="#4F46E5" />
                </div>
                <span className="text-sm text-white">{t.privacy.whoCanSeePathmates}</span>
              </div>
              <PrivacyDropdown value={privacyPathmates} onChange={setPrivacyPathmates} allowedOptions={!publicProfile ? ['Pathmates', 'Nessuno'] : undefined} />
            </div>
            <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
            {/* Messaggi */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                  <ChatDots size={20} color="#4F46E5" />
                </div>
                <span className="text-sm text-white">{t.privacy.whoCanMessage}</span>
              </div>
              <PrivacyDropdown value={messagePrivacy} onChange={setMessagePrivacy} allowedOptions={!publicProfile ? ['Pathmates', 'Nessuno'] : undefined} />
            </div>
          </div>

          {/* Account */}
          <div className="bg-[#1E293B] rounded-2xl overflow-hidden">
            <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider px-4 pt-4 pb-2">Account</h4>
            <button onClick={() => { setShowSecurityPrivacySheet(false); setShowDeleteModal(true); }} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#EF4444]/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[#EF4444]/10 flex items-center justify-center flex-shrink-0">
                  <Trash size={20} color="#EF4444" />
                </div>
                <span className="text-sm text-[#EF4444] font-medium">{t.privacy.deleteAccount}</span>
              </div>
              <ChevronRight size={16} color="rgba(239,68,68,0.5)" />
            </button>
          </div>

        </div>
      </div>

      {/* ── Aiuto & Supporto Sheet ──────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 ${
          showHelpSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowHelpSheet(false)}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          showHelpSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#334155]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E293B]">
          <h2 className="text-white font-bold text-lg">{t.help.title}</h2>
          <button onClick={() => setShowHelpSheet(false)} className="p-1 rounded-full hover:bg-[#334155] transition-colors">
            <CloseLg size={20} color="#94A3B8" />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          <div className="bg-[#1E293B] rounded-2xl p-4">
            <div>
              {/* Centro assistenza */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => setShowFaqSheet(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <CircleHelp size={20} color="#4F46E5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-white">{t.help.helpCenter}</span>
                    <span className="text-xs text-[#64748B]">{t.help.browseFaq}</span>
                  </div>
                </div>
                <ChevronRight size={16} color="#64748B" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Contattaci */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => setShowContactSheet(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <Mail size={20} color="#4F46E5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-white">{t.help.contactUs}</span>
                    <span className="text-xs text-[#64748B]">{t.help.writeForHelp}</span>
                  </div>
                </div>
                <ChevronRight size={16} color="#64748B" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Segnala un problema */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => { setReportSubmitted(false); setReportCategory(''); setReportDescription(''); setShowReportSheet(true); }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <TriangleWarning size={20} color="#4F46E5" />
                  </div>
                  <span className="text-sm text-white">{t.help.reportProblem}</span>
                </div>
                <ChevronRight size={16} color="#64748B" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Termini di servizio */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => setShowTermsSheet(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <FileText size={20} color="#4F46E5" />
                  </div>
                  <span className="text-sm text-white">{t.help.termsOfService}</span>
                </div>
                <ChevronRight size={16} color="#64748B" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Informativa sulla privacy */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => setShowPrivacySheet(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={20} color="#4F46E5" />
                  </div>
                  <span className="text-sm text-white">{t.help.privacyPolicy}</span>
                </div>
                <ChevronRight size={16} color="#64748B" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FAQ Sheet ────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[70] bg-black/60 transition-opacity duration-300 ${
          showFaqSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowFaqSheet(false)}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          showFaqSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#334155]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E293B]">
          <h2 className="text-white font-bold text-lg">Centro assistenza</h2>
          <button onClick={() => setShowFaqSheet(false)} className="p-1 rounded-full hover:bg-[#334155] transition-colors">
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-3 max-h-[75vh] overflow-y-auto no-scrollbar">
          {[
            {
              q: 'Come viene calcolato il punteggio di affinità con un\'opportunità?',
              a: 'Il punteggio di affinità è calcolato da un algoritmo che analizza diversi fattori del tuo profilo: le competenze che hai inserito, il tuo corso di laurea, l\'università che frequenti e l\'anno accademico. L\'algoritmo confronta questi dati con i requisiti dell\'opportunità e restituisce una percentuale di compatibilità. Più il tuo profilo è completo e aggiornato, più il punteggio sarà accurato e le opportunità mostrate in "Per te" saranno rilevanti per te.',
            },
            {
              q: 'Posso candidarmi direttamente da Pathfinder?',
              a: 'Al momento Pathfinder non gestisce direttamente le candidature. La nostra funzione è quella di metterti in contatto con le opportunità più adatte a te. Una volta trovata quella giusta, puoi accedere alla pagina ufficiale dell\'opportunità tramite il tasto "Vai all\'opportunità", dove potrai completare la candidatura secondo le modalità previste dall\'azienda o dall\'ente che la pubblica.',
            },
            {
              q: 'Cosa succede alle mie conversazioni se rimuovo un Pathmate?',
              a: 'Se rimuovi un Pathmate, la cronologia dei messaggi precedenti rimane visibile per entrambi, ma non sarà più possibile inviare nuovi messaggi finché non tornate ad essere Pathmates. Inoltre, se nelle tue impostazioni privacy hai configurato alcune sezioni del profilo come visibili solo ai Pathmates, quell\'utente perderà automaticamente l\'accesso a quelle informazioni nel momento in cui viene rimosso.',
            },
            {
              q: 'Se imposto il profilo privato, i miei Pathmates attuali perdono accesso alle mie informazioni?',
              a: 'No, attivare il profilo privato non influisce sulla visibilità verso i tuoi Pathmates attuali. Loro continueranno a vedere tutte le informazioni del tuo profilo come prima. Il profilo privato agisce esclusivamente verso gli utenti che non sono tuoi Pathmates: questi ultimi non potranno vedere competenze, università, opportunità salvate e lista dei Pathmates finché non li aggiungi.',
            },
            {
              q: 'Le opportunità salvate sono visibili alle aziende?',
              a: 'No, le aziende non hanno accesso alla lista delle opportunità che hai salvato. I salvati sono una funzione personale pensata per aiutarti a tenere traccia delle opportunità che ti interessano. Puoi scegliere nelle impostazioni privacy se renderli visibili a tutti, solo ai tuoi Pathmates o a nessuno, ma in ogni caso le aziende che pubblicano le opportunità non ricevono alcuna notifica né hanno accesso a questi dati.',
            },
          ].map((item, i) => (
            <div key={i} className="bg-[#1E293B] rounded-2xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-4 text-left gap-3"
                onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
              >
                <span className="text-sm text-white font-medium leading-snug">{item.q}</span>
                <svg
                  className={`w-5 h-5 text-[#64748B] flex-shrink-0 transition-transform duration-200 ${openFaqIndex === i ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaqIndex === i && (
                <div className="px-4 pb-4 text-sm text-[#94A3B8] leading-relaxed border-t border-[#334155]/50 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Contattaci Sheet ─────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[70] bg-black/60 transition-opacity duration-300 ${
          showContactSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowContactSheet(false)}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          showContactSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#334155]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E293B]">
          <h2 className="text-white font-bold text-lg">{t.help.contactUs}</h2>
          <button onClick={() => setShowContactSheet(false)} className="p-1 rounded-full hover:bg-[#334155] transition-colors">
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          {/* Intro */}
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            Hai bisogno di aiuto? Il nostro team è disponibile per supportarti.
          </p>
          {/* Contatti card */}
          <div className="bg-[#1E293B] rounded-2xl overflow-hidden">
            {/* Email */}
            <a
              href="mailto:support@pathfinder.app"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#334155]/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#64748B] font-medium">Email</p>
                <p className="text-sm text-[#4F46E5] font-medium truncate">support@pathfinder.app</p>
              </div>
              <svg className="w-4 h-4 text-[#64748B] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <div className="mx-4 h-px bg-[#334155]/50" />
            {/* Orari */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-[22%] bg-[#22C55E]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-[#64748B] font-medium">Disponibilità</p>
                <p className="text-sm text-white">Lun–Ven, 9:00–18:00</p>
              </div>
            </div>
          </div>
          {/* CTA button */}
          <button
            onClick={() => { setContactSubject(''); setContactMessage(''); setContactFormSent(false); setShowContactFormSheet(true); }}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-[#4F46E5] text-white hover:bg-[#4338CA] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Scrivi un messaggio
          </button>
        </div>
      </div>

      {/* ── Scrivi un messaggio Sheet ─────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[80] bg-black/60 transition-opacity duration-300 ${
          showContactFormSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowContactFormSheet(false)}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[80] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          showContactFormSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#334155]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E293B]">
          <h2 className="text-white font-bold text-lg">Scrivi un messaggio</h2>
          <button onClick={() => setShowContactFormSheet(false)} className="p-1 rounded-full hover:bg-[#334155] transition-colors">
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          {contactFormSent ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold text-base">Messaggio inviato</p>
              <p className="text-[#94A3B8] text-sm text-center leading-relaxed">
                Ti risponderemo all'indirizzo email associato al tuo account entro 48 ore lavorative.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#1E293B] rounded-2xl p-4 space-y-4">
                <div>
                  <label className="text-xs text-[#64748B] font-medium uppercase tracking-wider block mb-2">Oggetto</label>
                  <input
                    type="text"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    placeholder="Di cosa hai bisogno?"
                    className="w-full bg-[#0D1117] text-sm text-white placeholder-[#475569] rounded-xl px-4 py-3 border border-[#334155] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#64748B] font-medium uppercase tracking-wider block mb-2">Messaggio</label>
                  <textarea
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Descrivi la tua richiesta nel dettaglio..."
                    rows={5}
                    className="w-full bg-[#0D1117] text-sm text-white placeholder-[#475569] rounded-xl px-4 py-3 border border-[#334155] focus:outline-none focus:border-[#4F46E5] resize-none"
                  />
                </div>
              </div>
              <button
                onClick={() => { if (contactSubject.trim() && contactMessage.trim()) setContactFormSent(true); }}
                disabled={!contactSubject.trim() || !contactMessage.trim()}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all bg-[#4F46E5] text-white hover:bg-[#4338CA] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Invia
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Segnala un problema Sheet ─────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[70] bg-black/60 transition-opacity duration-300 ${
          showReportSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowReportSheet(false)}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          showReportSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#334155]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E293B]">
          <h2 className="text-white font-bold text-lg">{t.help.reportProblem}</h2>
          <button onClick={() => setShowReportSheet(false)} className="p-1 rounded-full hover:bg-[#334155] transition-colors">
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          {reportSubmitted ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold text-base">Segnalazione inviata</p>
              <p className="text-[#94A3B8] text-sm text-center leading-relaxed">
                Grazie per il tuo feedback.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#1E293B] rounded-2xl p-4 space-y-4">
                {/* Category dropdown */}
                <div>
                  <label className="text-xs text-[#64748B] font-medium uppercase tracking-wider block mb-2">
                    Categoria
                  </label>
                  <div className="relative">
                    <select
                      value={reportCategory}
                      onChange={(e) => setReportCategory(e.target.value)}
                      className="w-full appearance-none bg-[#0D1117] text-sm text-white rounded-xl px-4 py-3 border border-[#334155] focus:outline-none focus:border-[#4F46E5] pr-10"
                    >
                      <option value="" disabled>Seleziona una categoria...</option>
                      <option value="bug">Bug tecnico</option>
                      <option value="content">Contenuto inappropriato</option>
                      <option value="user">Problema con un utente</option>
                      <option value="other">Altro</option>
                    </select>
                    <svg className="w-4 h-4 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {/* Description */}
                <div>
                  <label className="text-xs text-[#64748B] font-medium uppercase tracking-wider block mb-2">
                    Descrizione
                  </label>
                  <textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Descrivi il problema nel dettaglio..."
                    rows={4}
                    className="w-full bg-[#0D1117] text-sm text-white placeholder-[#475569] rounded-xl px-4 py-3 border border-[#334155] focus:outline-none focus:border-[#4F46E5] resize-none"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  if (!reportCategory || !reportDescription.trim()) return;
                  setReportSubmitted(true);
                }}
                disabled={!reportCategory || !reportDescription.trim()}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all bg-[#4F46E5] text-white hover:bg-[#4338CA] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Invia segnalazione
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Termini di Servizio Sheet ─────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[70] bg-black/60 transition-opacity duration-300 ${
          showTermsSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowTermsSheet(false)}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          showTermsSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#334155]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E293B]">
          <h2 className="text-white font-bold text-lg">{t.help.termsOfService}</h2>
          <button onClick={() => setShowTermsSheet(false)} className="p-1 rounded-full hover:bg-[#334155] transition-colors">
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar text-sm text-[#94A3B8] leading-relaxed">
          <p className="text-xs text-[#475569]">Ultimo aggiornamento: gennaio 2025</p>
          {[
            {
              title: 'Accettazione dei termini',
              body: 'Utilizzando Pathfinder accetti integralmente i presenti Termini di Servizio. Se non accetti, ti preghiamo di non utilizzare la piattaforma. Pathfinder è riservato a studenti universitari maggiorenni residenti in Italia. La registrazione implica la piena accettazione di questi termini.',
            },
            {
              title: 'Utilizzo del servizio',
              body: 'Pathfinder è una piattaforma di networking universitario. Puoi utilizzarla per scoprire opportunità (tirocini, borse di studio, Erasmus, progetti, eventi), connetterti con altri studenti (Pathmates) e ricevere suggerimenti personalizzati. È vietato usare il servizio per attività illecite, per inviare spam o per raccogliere dati di altri utenti senza consenso.',
            },
            {
              title: 'Contenuti degli utenti',
              body: 'I contenuti che pubblichi su Pathfinder (post, commenti, messaggi) restano di tua proprietà. Concedi tuttavia a Pathfinder una licenza non esclusiva per visualizzarli e distribuirli all\'interno della piattaforma. È vietato pubblicare contenuti illegali, offensivi, discriminatori o che violino diritti di terzi. Ci riserviamo il diritto di rimuovere contenuti che violino queste regole.',
            },
            {
              title: 'Privacy',
              body: 'La raccolta e il trattamento dei tuoi dati personali sono regolati dall\'Informativa sulla Privacy, che ti invitiamo a leggere. Utilizziamo i tuoi dati esclusivamente per fornire e migliorare il servizio, nel rispetto del GDPR (Reg. UE 2016/679) e della normativa italiana vigente.',
            },
            {
              title: 'Limitazioni di responsabilità',
              body: 'Pathfinder non garantisce la disponibilità continua del servizio né l\'accuratezza delle informazioni sulle opportunità pubblicate. Non siamo responsabili per danni diretti o indiretti derivanti dall\'utilizzo della piattaforma, dalla partecipazione a opportunità trovate tramite essa, o da contenuti pubblicati da altri utenti.',
            },
            {
              title: 'Modifiche ai termini',
              body: 'Ci riserviamo il diritto di modificare i presenti Termini in qualsiasi momento. Le modifiche saranno comunicate tramite notifica nell\'app con almeno 7 giorni di preavviso. L\'utilizzo continuato della piattaforma dopo le modifiche costituisce accettazione dei nuovi Termini. In caso di disaccordo, puoi cancellare il tuo account.',
            },
          ].map((section, i) => (
            <div key={i} className="bg-[#1E293B] rounded-2xl p-4 space-y-2">
              <h3 className="text-white font-semibold text-sm">{section.title}</h3>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Informativa sulla Privacy Sheet ──────────────────────── */}
      <div
        className={`fixed inset-0 z-[70] bg-black/60 transition-opacity duration-300 ${
          showPrivacySheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowPrivacySheet(false)}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          showPrivacySheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#334155]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E293B]">
          <h2 className="text-white font-bold text-lg">{t.help.privacyPolicy}</h2>
          <button onClick={() => setShowPrivacySheet(false)} className="p-1 rounded-full hover:bg-[#334155] transition-colors">
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar text-sm text-[#94A3B8] leading-relaxed">
          <p className="text-xs text-[#475569]">Ultimo aggiornamento: gennaio 2025 · Conforme al GDPR (Reg. UE 2016/679)</p>
          {[
            {
              title: 'Dati raccolti',
              body: 'Raccogliamo i dati che fornisci durante la registrazione (nome, email, università, corso di laurea, anno accademico) e quelli del profilo accademico inseriti nell\'onboarding (interessi, competenze, livello di inglese, disponibilità a trasferirsi). Registriamo inoltre le tue interazioni con la piattaforma (opportunità salvate, post, commenti, messaggi) e dati tecnici anonimi di navigazione.',
            },
            {
              title: 'Come usiamo i tuoi dati',
              body: 'I tuoi dati sono utilizzati per: fornire il servizio di matching personalizzato con opportunità accademiche e professionali; abilitare il networking con altri studenti (Pathmates); inviare notifiche sull\'attività nella piattaforma; migliorare l\'algoritmo di raccomandazione; garantire la sicurezza degli account e prevenire comportamenti abusivi.',
            },
            {
              title: 'Condivisione dei dati',
              body: 'Non vendiamo i tuoi dati a terzi. Il tuo profilo è visibile ad altri utenti Pathfinder secondo le impostazioni di privacy da te scelte. Utilizziamo fornitori tecnici (hosting, analytics) vincolati da accordi di riservatezza che trattano i dati esclusivamente per conto nostro. Non condividiamo dati con le aziende che pubblicano opportunità.',
            },
            {
              title: 'Sicurezza',
              body: 'Adottiamo misure tecniche e organizzative adeguate per proteggere i tuoi dati da accessi non autorizzati, perdita o divulgazione. Le password sono conservate in forma cifrata. Le comunicazioni tra app e server avvengono tramite connessione crittografata (HTTPS). In caso di violazione dei dati ti informeremo entro 72 ore.',
            },
            {
              title: 'I tuoi diritti',
              body: 'Ai sensi del GDPR hai diritto di: accedere ai tuoi dati, rettificarli o cancellarli; limitare od opporti al trattamento; portabilità dei dati; revocare il consenso in qualsiasi momento. Puoi esercitare questi diritti scrivendo a support@pathfinder.app. Hai inoltre il diritto di presentare reclamo al Garante per la Protezione dei Dati Personali (www.garanteprivacy.it).',
            },
            {
              title: 'Contatti',
              body: 'Il titolare del trattamento è Pathfinder S.r.l. Per qualsiasi domanda sulla presente Informativa o per esercitare i tuoi diritti, contattaci a support@pathfinder.app. Risponderemo entro 30 giorni dalla ricezione della tua richiesta.',
            },
          ].map((section, i) => (
            <div key={i} className="bg-[#1E293B] rounded-2xl p-4 space-y-2">
              <h3 className="text-white font-semibold text-sm">{section.title}</h3>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Notification Settings Sheet ──────────────────────────── */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 ${
          showNotificationSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowNotificationSheet(false)}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          showNotificationSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#334155]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E293B]">
          <h2 className="text-white font-bold text-lg">Notifiche</h2>
          <button onClick={() => setShowNotificationSheet(false)} className="p-1 rounded-full hover:bg-[#334155] transition-colors">
            <CloseLg size={20} color="#94A3B8" />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          {/* Master push toggle */}
          <div className="bg-[#1E293B] rounded-2xl p-4">
            <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Notifiche push</h4>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-white block">Notifiche push del browser</span>
                <span className="text-xs text-[#64748B]">
                  {getPushPermissionState() === 'denied'
                    ? 'Bloccate — abilita nelle impostazioni del browser'
                    : 'Ricevi notifiche anche quando l\'app è chiusa'}
                </span>
              </div>
              <ToggleSwitch
                on={notifPrefs.pushEnabled}
                onChange={async (v) => {
                  if (v) {
                    if (!isPushSupported()) return;
                    const perm = getPushPermissionState();
                    if (perm === 'denied') return;
                    if (perm === 'default') {
                      const result = await Notification.requestPermission();
                      if (result !== 'granted') return;
                    }
                    await subscribeToPush();
                  } else {
                    await unsubscribeFromPush();
                  }
                  setNotifPrefs(p => ({ ...p, pushEnabled: v }));
                  api.put('/notifications/preferences', { pushEnabled: v }).catch(() => {});
                }}
              />
            </div>
          </div>

          {/* Category toggles */}
          <div className="bg-[#1E293B] rounded-2xl p-4">
            <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Categorie</h4>
            <div>
              {([
                { key: 'networking' as const, label: 'Networking', desc: 'Richieste di amicizia e connessioni' },
                { key: 'opportunities' as const, label: 'Opportunità', desc: 'Nuove opportunità consigliate' },
                { key: 'deadlines' as const, label: 'Scadenze', desc: 'Scadenze di opportunità e università' },
                { key: 'social' as const, label: 'Social', desc: 'Commenti e risposte ai tuoi post' },
                { key: 'postLikes' as const, label: 'Like ai post', desc: 'Quando qualcuno mette like' },
                { key: 'chat' as const, label: 'Chat', desc: 'Nuovi messaggi' },
                { key: 'system' as const, label: 'Sistema', desc: 'Aggiornamenti e comunicazioni' },
              ] as const).map((item, i, arr) => (
                <div key={item.key}>
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <span className="text-sm text-white block">{item.label}</span>
                      <span className="text-xs text-[#64748B]">{item.desc}</span>
                    </div>
                    <ToggleSwitch
                      on={notifPrefs[item.key]}
                      onChange={(v) => {
                        setNotifPrefs(p => ({ ...p, [item.key]: v }));
                        api.put('/notifications/preferences', { [item.key]: v }).catch(() => {});
                      }}
                      disabled={!notifPrefs.pushEnabled}
                    />
                  </div>
                  {i < arr.length - 1 && <div className="h-px bg-[#334155]/50" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Info Sheet ─────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 ${
          showInfoSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowInfoSheet(false)}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          showInfoSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#334155]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E293B]">
          <h2 className="text-white font-bold text-lg">{t.info.title}</h2>
          <button onClick={() => setShowInfoSheet(false)} className="p-1 rounded-full hover:bg-[#334155] transition-colors">
            <CloseLg size={20} color="#94A3B8" />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          <div className="bg-[#1E293B] rounded-2xl p-4">
            <div>
              {/* Versione app */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <Info size={20} color="#4F46E5" />
                  </div>
                  <span className="text-sm text-white">{t.info.appVersion}</span>
                </div>
                <span className="text-sm text-[#64748B]">1.0.0</span>
              </div>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Novità */}
              <button className="w-full flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <Star size={20} color="#4F46E5" />
                  </div>
                  <div>
                    <span className="text-sm text-white block">{t.info.whatsNew}</span>
                    <span className="text-xs text-[#64748B]">{t.info.discoverFeatures}</span>
                  </div>
                </div>
                <ChevronRight size={16} color="#64748B" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Seguici sui social */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => setShowSocialSheet(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <Globe size={20} color="#4F46E5" />
                  </div>
                  <span className="text-sm text-white">{t.info.followSocial}</span>
                </div>
                <ChevronRight size={16} color="#64748B" />
              </button>
            </div>
          </div>
          {/* Footer */}
          <p className="text-center text-xs text-[#64748B] py-2 flex items-center justify-center gap-1">Made with <Heart size={12} color="#EF4444" filled /> in Italy</p>
        </div>
      </div>

      {/* ── Seguici sui social Sheet ─────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[70] bg-black/60 transition-opacity duration-300 ${
          showSocialSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowSocialSheet(false)}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          showSocialSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#334155]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E293B]">
          <h2 className="text-white font-bold text-lg">{t.info.followSocial}</h2>
          <button onClick={() => setShowSocialSheet(false)} className="p-1 rounded-full hover:bg-[#334155] transition-colors">
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4">
          <div className="bg-[#1E293B] rounded-2xl overflow-hidden">
            {/* Instagram */}
            <a
              href="https://instagram.com/pathfinder.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#334155]/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-[22%] bg-[#E1306C]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#E1306C]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">Instagram</p>
                <p className="text-xs text-[#64748B]">@pathfinder.app</p>
              </div>
              <svg className="w-4 h-4 text-[#334155] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <div className="mx-4 h-px bg-[#334155]/50" />
            {/* LinkedIn */}
            <a
              href="https://linkedin.com/company/pathfinder-app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#334155]/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-[22%] bg-[#0A66C2]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">LinkedIn</p>
                <p className="text-xs text-[#64748B]">Pathfinder</p>
              </div>
              <svg className="w-4 h-4 text-[#334155] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <div className="mx-4 h-px bg-[#334155]/50" />
            {/* TikTok */}
            <a
              href="https://tiktok.com/@pathfinder.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#334155]/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-[22%] bg-white/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">TikTok</p>
                <p className="text-xs text-[#64748B]">@pathfinder.app</p>
              </div>
              <svg className="w-4 h-4 text-[#334155] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <div className="mx-4 h-px bg-[#334155]/50" />
            {/* X / Twitter */}
            <a
              href="https://x.com/pathfinderapp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#334155]/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-[22%] bg-white/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">X (Twitter)</p>
                <p className="text-xs text-[#64748B]">@pathfinderapp</p>
              </div>
              <svg className="w-4 h-4 text-[#334155] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* ── Change Password Modal ─────────────────────────────────── */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {/* ── Delete Account Modal ──────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !deletingAccount && setShowDeleteModal(false)} />
          <div className="relative w-full max-w-sm bg-[#1E293B] rounded-3xl p-6 space-y-4 animate-slide-up">
            <div className="w-14 h-14 rounded-full bg-[#EF4444]/10 flex items-center justify-center mx-auto">
              <TriangleWarning size={28} color="#EF4444" />
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-lg mb-1">{t.privacy.deleteAccount}</h3>
              <p className="text-sm text-[#94A3B8]">{t.profile.deleteIrreversibleMsg}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingAccount}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-[#94A3B8] bg-[#334155]/50 hover:bg-[#334155] transition-colors disabled:opacity-50"
              >
                {t.profile.cancel}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-[#EF4444] hover:bg-[#DC2626] transition-colors disabled:opacity-50"
              >
                {deletingAccount ? t.profile.deletingAccount : t.privacy.deleteAccount}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

function ToggleSwitch({ defaultOn = false, on: controlledOn, onChange, disabled }: { defaultOn?: boolean; on?: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  const [internalOn, setInternalOn] = useState(defaultOn);
  const isControlled = controlledOn !== undefined;
  const on = isControlled ? controlledOn : internalOn;

  return (
    <button
      onClick={() => {
        if (disabled) return;
        if (isControlled && onChange) {
          onChange(!on);
        } else {
          setInternalOn(!on);
        }
      }}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${on ? 'bg-[#4F46E5]' : 'bg-[#334155]'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// Controlled toggle for the Privacy sheet (value driven by parent state)
function PrivacyToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        value ? 'bg-[#4F46E5]' : 'bg-[#334155]'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function LanguageDropdown() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options: Language[] = ['Italiano', 'Inglese', 'Francese', 'Cinese', 'Spagnolo'];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-[#94A3B8] hover:text-white transition-colors"
      >
        <span>{LANGUAGE_DISPLAY_NAMES[language]}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[#0F172A] border border-[#334155] rounded-xl overflow-hidden shadow-xl z-10 min-w-[120px]">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setLanguage(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                opt === language
                  ? 'text-[#4F46E5] bg-[#4F46E5]/10'
                  : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'
              }`}
            >
              {LANGUAGE_DISPLAY_NAMES[opt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type PrivacyOption = 'Tutti' | 'Pathmates' | 'Nessuno';

function PrivacyDropdown({
  value,
  onChange,
  allowedOptions,
}: {
  value: PrivacyOption;
  onChange: (v: PrivacyOption) => void;
  allowedOptions?: PrivacyOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();
  const allOptions: { key: PrivacyOption; label: string }[] = [
    { key: 'Tutti', label: t.privacy.everyone },
    { key: 'Pathmates', label: 'Pathmates' },
    { key: 'Nessuno', label: t.privacy.nobody },
  ];
  const options = allowedOptions
    ? allOptions.filter((o) => allowedOptions.includes(o.key))
    : allOptions;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentLabel = options.find((o) => o.key === value)?.label ?? value;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-[#94A3B8] hover:text-white transition-colors"
      >
        <span>{currentLabel}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[#0F172A] border border-[#334155] rounded-xl overflow-hidden shadow-xl z-10 min-w-[120px]">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                onChange(opt.key);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                opt.key === value
                  ? 'text-[#4F46E5] bg-[#4F46E5]/10'
                  : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
