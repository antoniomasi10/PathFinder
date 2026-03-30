'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useSavedOpportunities } from '@/lib/savedOpportunities';
import { useSavedCourses } from '@/lib/savedCourses';
import { getSavedSimulations, SavedSimulation } from '@/components/AdmissionSimulator';
import { BADGES, getAllBadgeStates, getUnlockedCount, RARITY_COLORS, RARITY_LABELS, type BadgeDefinition, type BadgeProgress } from '@/lib/badges';
import { useLanguage, Language, LANGUAGE_DISPLAY_NAMES, SKILL_KEYS, getSkillLabel, normalizePassionToKey } from '@/lib/language';
import { usePrivacy } from '@/lib/privacy';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { isValidImageUrl, isValidExternalUrl } from '@/lib/urlValidation';
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getPushPermissionState } from '@/lib/pushManager';
import {
  Pencil, EyeOff, Plus, Bookmark, ChevronDown, ChevronRight, MapPin, CalendarIcon,
  Gear, UsersGroup, Bell, Moon, Globe, ShieldCheck, CircleHelp, Info, Search,
  ChatDots, UserAdd, CloseLg, CloseSm, Camera, Check, Key, UserIcon, Award,
  Trash, TriangleWarning, CircleWarning, Mail, FileText, Star, Lock, Trophy,
  Heart, Briefcase, GraduationCap, Plane, Rocket, Target, TrendingUp, CloseMd,
} from '@/components/icons';

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

const TYPE_ICONS: Record<string, React.ReactNode> = {
  INTERNSHIP: <Briefcase size={16} color="#4A9EFF" />,
  SCHOLARSHIP: <GraduationCap size={16} color="#F59E0B" />,
  ERASMUS: <Plane size={16} color="#22C55E" />,
  PROJECT: <Rocket size={16} color="#EF4444" />,
  EVENT: <CalendarIcon size={16} color="#9C5AFF" />,
};


export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const { savedOpps, toggleSave } = useSavedOpportunities();
  const { savedCourses } = useSavedCourses();
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'pathmates'>('settings');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [modalSkills, setModalSkills] = useState<string[]>([]);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCourse, setEditCourse] = useState('');
  const [editYear, setEditYear] = useState<number | undefined>();
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [showSecurityPrivacySheet, setShowSecurityPrivacySheet] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showHelpSheet, setShowHelpSheet] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
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
    universities: true,
    social: true,
    postLikes: false,
    chat: true,
    achievements: true,
    system: true,
  });
  const [savedTab, setSavedTab] = useState<'opportunities' | 'universities'>('opportunities');
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);
  const [suggestedUsers, setSuggestedUsers] = useState<Friend[]>([]);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [removingFriend, setRemovingFriend] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    setSimulations(getSavedSimulations());
  }, []);

  useEffect(() => {
    if (showSkillsModal) {
      setModalSkills(profile?.profile?.passions || []);
    }
  }, [showSkillsModal]);

  const loadData = async () => {
    try {
      const [profileRes, friendsRes, suggestionsRes] = await Promise.all([
        api.get('/profile/me'),
        api.get('/friends').catch(() => ({ data: [] })),
        api.get('/friends/suggestions').catch(() => ({ data: [] })),
      ]);
      const rawPassions: string[] = profileRes.data.profile?.passions || [];
      const normalizedPassions = rawPassions.map(normalizePassionToKey);
      const profileData = profileRes.data;
      if (profileData.profile) profileData.profile.passions = normalizedPassions;
      if (normalizedPassions.some((k, i) => k !== rawPassions[i])) {
        api.patch('/profile/me', { passions: normalizedPassions }).catch(() => {});
      }
      setProfile(profileData);
      setEditName(profileRes.data.name || '');
      setEditBio(profileRes.data.bio || '');
      setEditCourse(profileRes.data.courseOfStudy || '');
      setEditYear(profileRes.data.yearOfStudy);
      setEditSkills(normalizedPassions);
      setFriends(friendsRes.data);
      setSuggestedUsers(suggestionsRes.data);
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = () => {
    if (profile) {
      setEditName(profile.name || '');
      setEditBio(profile.bio || '');
      setEditCourse(profile.courseOfStudy || '');
      setEditYear(profile.yearOfStudy);
      setEditSkills(profile.profile?.passions || []);
      setAvatarPreview(null);
    }
    setShowEditDialog(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch('/profile/me', {
        name: editName,
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

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const tags: { label: string; color: string }[] = [];
  if (profile.profile?.clusterTag) {
    tags.push({
      label: profile.profile.clusterTag,
      color: CLUSTER_COLORS[profile.profile.clusterTag] || 'bg-[#334155] text-[#94A3B8]',
    });
  }
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
                alt={profile.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{profile.name}</h2>
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

          {/* Tags with + button */}
          {privacySkills !== 'Nessuno' ? (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {tags.map((tag) => (
                <span
                  key={tag.label}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${tag.color}`}
                >
                  {tag.label}
                </span>
              ))}
              <button
                onClick={() => setShowSkillsModal(true)}
                className="w-7 h-7 rounded-full bg-[#334155] flex items-center justify-center hover:bg-[#475569] transition-colors"
              >
                <Plus size={14} color="#94A3B8" strokeWidth={2.5} />
              </button>
            </div>
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
              <div className="space-y-3">
                {savedOpps.map((opp) => {
                  const isExpanded = expandedOppId === opp.id;
                  return (
                    <div key={opp.id} className="bg-[#161B22] rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setExpandedOppId(isExpanded ? null : opp.id)}
                        className="w-full text-left p-4 active:opacity-75 transition-opacity"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#1E293B] flex items-center justify-center flex-shrink-0">
                            {TYPE_ICONS[opp.type] || <Target size={16} color="#94A3B8" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-white line-clamp-2">{opp.title}</h4>
                            <p className="text-xs text-[#64748B] truncate">{opp.company || opp.university?.name || ''}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#4F46E5]/20 text-[#4F46E5] font-medium uppercase">
                              {opp.type}
                            </span>
                            <ChevronDown size={16} color="#6B7280" className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </button>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateRows: isExpanded ? '1fr' : '0fr',
                          transition: 'grid-template-rows 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        <div style={{ overflow: 'hidden', minHeight: 0 }}>
                          <div className="px-4 pb-4 space-y-3">
                            <div className="h-px bg-[#1E293B]" />

                            {opp.description && (
                              <p className="text-gray-400 text-sm leading-relaxed">{opp.description}</p>
                            )}

                            {(opp.location || opp.isRemote || opp.deadline) && (
                              <div className="flex flex-wrap gap-2">
                                {opp.location && (
                                  <div className="flex items-center gap-1.5 bg-[#0D1117] rounded-xl px-3 py-2">
                                    <MapPin size={14} color="#9CA3AF" className="flex-shrink-0" />
                                    <span className="text-gray-300 text-xs">{opp.location}</span>
                                  </div>
                                )}
                                {opp.isRemote && (
                                  <div className="flex items-center gap-1.5 bg-[#0D1117] rounded-xl px-3 py-2">
                                    <span className="text-gray-300 text-xs">Remoto</span>
                                  </div>
                                )}
                                {opp.deadline && (
                                  <div className="flex items-center gap-1.5 bg-[#0D1117] rounded-xl px-3 py-2">
                                    <CalendarIcon size={14} color="#9CA3AF" className="flex-shrink-0" />
                                    <span className="text-gray-300 text-xs">Scadenza: {new Date(opp.deadline).toLocaleDateString('it-IT')}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {opp.about && (
                              <>
                                <div className="h-px bg-[#1E293B]" />
                                <div>
                                  <p className="text-white font-semibold text-sm mb-1">{opp.company || opp.university?.name}</p>
                                  <p className="text-gray-400 text-sm leading-relaxed">{opp.about}</p>
                                </div>
                              </>
                            )}

                            <div className="flex gap-3">
                              <button
                                onClick={() => opp.url && isValidExternalUrl(opp.url) && window.open(opp.url, '_blank', 'noopener,noreferrer')}
                                disabled={!opp.url || !isValidExternalUrl(opp.url)}
                                className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-opacity ${
                                  opp.url && isValidExternalUrl(opp.url)
                                    ? 'bg-primary text-white active:opacity-90'
                                    : 'bg-[#1E293B] text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                {opp.url && isValidExternalUrl(opp.url) ? 'Vai all\u2019opportunità' : 'Link non disponibile'}
                              </button>
                              <button
                                onClick={() => toggleSave(opp.id)}
                                className="w-12 h-12 bg-[#0D1117] rounded-2xl flex items-center justify-center flex-shrink-0 text-primary"
                              >
                                <Bookmark size={20} filled />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
            <div className="bg-[#1E293B] rounded-2xl p-4">
              <div className="space-y-3">
                {savedCourses.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/universities/course/${c.id}`)}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-[#2A3F54]/50 transition-colors"
                    style={{ backgroundColor: '#0F172A' }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#4F46E5' }}>
                      <GraduationCap size={20} color="white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-white line-clamp-2 mb-0.5">{c.name}</h4>
                      <p className="text-xs text-[#64748B] truncate">{c.university?.name} — {c.university?.city}</p>
                    </div>
                  </div>
                ))}
              </div>
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

        {/* Achievement Badges */}
        <BadgesSection />

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
          <div className="relative w-full max-w-lg bg-[#1E293B] rounded-t-3xl sm:rounded-3xl p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar">
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

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">{t.profile.name}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#4F46E5] transition-colors"
                />
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

              {/* Skills in Edit */}
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">{t.profile.skills}</label>
                <div className="flex flex-wrap gap-2">
                  {editSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#334155] text-[#94A3B8]"
                    >
                      {getSkillLabel(skill, t)}
                      <button
                        onClick={() => toggleEditSkill(skill)}
                        className="hover:text-white transition-colors"
                      >
                        <CloseSm size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={() => {
                      setShowEditDialog(false);
                      setShowSkillsModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#4F46E5]/20 text-[#4F46E5] hover:bg-[#4F46E5]/30 transition-colors"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                    {t.profile.add}
                  </button>
                </div>
              </div>
            </div>

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
              <button className="w-full flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <CircleHelp size={20} color="#4F46E5" />
                  </div>
                  <div>
                    <span className="text-sm text-white block">{t.help.helpCenter}</span>
                    <span className="text-xs text-[#64748B]">{t.help.browseFaq}</span>
                  </div>
                </div>
                <ChevronRight size={16} color="#64748B" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Contattaci */}
              <button className="w-full flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <Mail size={20} color="#4F46E5" />
                  </div>
                  <div>
                    <span className="text-sm text-white block">{t.help.contactUs}</span>
                    <span className="text-xs text-[#64748B]">{t.help.writeForHelp}</span>
                  </div>
                </div>
                <ChevronRight size={16} color="#64748B" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Segnala un problema */}
              <button className="w-full flex items-center justify-between py-2">
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
              <button className="w-full flex items-center justify-between py-2">
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
              <button className="w-full flex items-center justify-between py-2">
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
                { key: 'opportunities' as const, label: 'Opportunità', desc: 'Nuove opportunità e scadenze' },
                { key: 'universities' as const, label: 'Università', desc: 'Corsi e scadenze accademiche' },
                { key: 'social' as const, label: 'Social', desc: 'Commenti e risposte ai tuoi post' },
                { key: 'postLikes' as const, label: 'Like ai post', desc: 'Quando qualcuno mette like' },
                { key: 'chat' as const, label: 'Chat', desc: 'Nuovi messaggi' },
                { key: 'achievements' as const, label: 'Traguardi', desc: 'Badge e obiettivi sbloccati' },
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
              <button className="w-full flex items-center justify-between py-2">
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

function BadgesSection() {
  const [badges, setBadges] = useState<{ badge: BadgeDefinition; progress: BadgeProgress; unlocked: boolean }[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<{ badge: BadgeDefinition; progress: BadgeProgress; unlocked: boolean } | null>(null);

  useEffect(() => {
    // Load from localStorage immediately for fast render
    setBadges(getAllBadgeStates());
    // Then sync from backend
    api.get('/badges').then((res) => {
      const serverBadges = res.data.map((b: any) => ({
        badge: { id: b.id, name: b.name, icon: b.icon, description: b.description, rarity: b.rarity, category: b.category, target: b.target, trackingKey: b.trackingKey },
        progress: { current: b.progress, unlockedAt: b.unlockedAt },
        unlocked: b.unlocked,
      }));
      if (serverBadges.length > 0) setBadges(serverBadges);
    }).catch(() => {});
  }, []);

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const totalCount = badges.length;
  const pct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  if (totalCount === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={16} color="#FFD700" />
        <h3 className="text-base font-semibold text-white">Achievement</h3>
        <span className="text-xs ml-auto" style={{ color: '#8B8FA8' }}>
          {unlockedCount}/{totalCount} ({pct}%)
        </span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-4" style={{ backgroundColor: '#1E293B' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: '#4F46E5' }}
        />
      </div>

      <div className="bg-[#1E293B] rounded-2xl p-4">
        <div className="grid grid-cols-4 gap-3">
          {badges.map(({ badge, progress, unlocked }) => {
            const colors = RARITY_COLORS[badge.rarity];
            return (
              <button
                key={badge.id}
                onClick={() => setSelectedBadge({ badge, progress, unlocked })}
                className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: unlocked ? colors.bg : '#2A2F3D',
                    border: `2px solid ${unlocked ? colors.border : '#3A3F4D'}`,
                    boxShadow: unlocked ? colors.glow : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    opacity: unlocked ? 1 : 0.4,
                  }}
                >
                  {unlocked ? badge.icon : <Lock size={16} color="#64748B" />}
                </div>
                <span
                  className="text-[10px] font-semibold leading-tight text-center"
                  style={{ color: unlocked ? '#FFFFFF' : '#8B8FA8', maxWidth: '72px' }}
                >
                  {unlocked ? badge.name : '???'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedBadge && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={() => setSelectedBadge(null)}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
          />
          <div
            style={{
              position: 'relative',
              backgroundColor: '#141B2D',
              borderRadius: '20px',
              padding: '28px 24px',
              maxWidth: '320px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <button
              onClick={() => setSelectedBadge(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <CloseLg size={20} color="#8B8FA8" />
            </button>

            {(() => {
              const { badge, progress, unlocked } = selectedBadge;
              const colors = RARITY_COLORS[badge.rarity];
              const progressPct = Math.min(Math.round((progress.current / badge.target) * 100), 100);
              return (
                <>
                  <div
                    style={{
                      width: '88px',
                      height: '88px',
                      borderRadius: '20px',
                      background: unlocked ? colors.bg : '#2A2F3D',
                      border: `2px solid ${unlocked ? colors.border : '#3A3F4D'}`,
                      boxShadow: unlocked ? colors.glow : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '40px',
                      margin: '0 auto 16px',
                      opacity: unlocked ? 1 : 0.5,
                    }}
                  >
                    {unlocked ? badge.icon : <Lock size={16} color="#64748B" />}
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
                    {badge.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#8B8FA8', marginBottom: '16px' }}>
                    {badge.description}
                  </p>

                  <div className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: '#2A2F3D' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progressPct}%`,
                        background: unlocked ? colors.bg : '#4F46E5',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '13px', color: '#D0D4DC', marginBottom: '12px' }}>
                    {progress.current}/{badge.target}
                  </p>

                  <div
                    className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: unlocked ? colors.bg : '#2A2F3D',
                      border: `1px solid ${unlocked ? colors.border : '#3A3F4D'}`,
                      color: '#FFFFFF',
                    }}
                  >
                    {RARITY_LABELS[badge.rarity]}
                  </div>

                  {unlocked && progress.unlockedAt && (
                    <p style={{ fontSize: '11px', color: '#8B8FA8', marginTop: '12px' }}>
                      Sbloccato il {new Date(progress.unlockedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}

                  {!unlocked && (
                    <p style={{ fontSize: '12px', color: '#F59E0B', marginTop: '12px' }}>
                      Ancora {badge.target - progress.current} per sbloccarlo!
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

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
