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

const TYPE_ICONS: Record<string, string> = {
  INTERNSHIP: '💼',
  SCHOLARSHIP: '🎓',
  ERASMUS: '✈️',
  PROJECT: '🚀',
  EVENT: '📅',
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

  const handleDownloadData = () => {
    if (!profile) return;
    const data = {
      name: profile.name,
      email: profile.email,
      bio: profile.bio,
      university: profile.university?.name,
      courseOfStudy: profile.courseOfStudy,
      yearOfStudy: profile.yearOfStudy,
      skills: profile.profile?.passions ?? [],
      clusterTag: profile.profile?.clusterTag,
      pathmates: friends.map((f) => ({ id: f.id, name: f.name, university: f.university?.name })),
      savedOpportunities: savedOpps.map((o) => ({ id: o.id, title: o.title, company: o.company })),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pathfinder-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete('/profile/me');
    } catch {
      // Even if the API call fails, proceed with local cleanup and logout
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
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>

        {/* Profile visibility notice */}
        {!publicProfile && (
          <div className="flex items-center gap-2 bg-[#1E293B] rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 text-[#64748B] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
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
                <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
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
              <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
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
                            <span className="text-lg">{TYPE_ICONS[opp.type] || '📌'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-white line-clamp-2">{opp.title}</h4>
                            <p className="text-xs text-[#64748B] truncate">{opp.company || opp.university?.name || ''}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#4F46E5]/20 text-[#4F46E5] font-medium uppercase">
                              {opp.type}
                            </span>
                            <svg
                              className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
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
                                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                    </svg>
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
                                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                    </svg>
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
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
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
                      <span className="text-white text-lg">🎓</span>
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
              <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
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
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t.profile.settings}
              </span>
            </button>
            {privacyPathmates !== 'Nessuno' && (
              <button
                onClick={() => setActiveTab('pathmates')}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'pathmates'
                    ? 'bg-[#4F46E5] text-white shadow-md'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Pathmates
                  {friends.length > 0 && (
                    <span className="text-xs opacity-70">({friends.length})</span>
                  )}
                </span>
              </button>
            )}
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
                        <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      </div>
                      <span className="text-sm text-white">{t.profile.notifications}</span>
                    </div>
                    <svg className="w-5 h-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      </div>
                      <span className="text-sm text-white">{t.profile.darkMode}</span>
                    </div>
                    <ToggleSwitch defaultOn />
                  </div>
                  <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
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
                  { label: t.profile.securityPrivacy, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', onPress: () => setShowSecurityPrivacySheet(true) },
                  { label: t.profile.helpSupport, icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', onPress: () => setShowHelpSheet(true) },
                  { label: t.profile.info, icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', onPress: () => setShowInfoSheet(true) },
                ].map((item, i, arr) => (
                  <div key={item.label}>
                    <button
                      onClick={item.onPress}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#334155]/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                          </svg>
                        </div>
                        <span className="text-sm text-white">{item.label}</span>
                      </div>
                      <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
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
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
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
                              <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => removeFriend(friend.id)}
                            disabled={removingFriend === friend.id}
                            className="w-9 h-9 rounded-[22%] bg-[#EF4444]/10 flex items-center justify-center hover:bg-[#EF4444]/20 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M22 11h-6" />
                            </svg>
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
                              <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v6m3-3h-6" />
                              </svg>
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
                <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
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
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
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
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
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
                <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                      <svg className="w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
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
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
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
                  <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <span className="text-sm text-white">{t.security.changePassword}</span>
              </div>
              <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Visibilità profilo */}
          <div className="bg-[#1E293B] rounded-2xl p-4">
            <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">{t.privacy.profileVisibility}</h4>
            {/* Profilo pubblico / privato toggle */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
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
                  <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
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
                  <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
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
                  <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
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
                  <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
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
                  <svg className="w-5 h-5 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <span className="text-sm text-[#EF4444] font-medium">{t.privacy.deleteAccount}</span>
              </div>
              <svg className="w-4 h-4 text-[#EF4444]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
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
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          <div className="bg-[#1E293B] rounded-2xl p-4">
            <div>
              {/* Centro assistenza */}
              <button className="w-full flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm text-white block">{t.help.helpCenter}</span>
                    <span className="text-xs text-[#64748B]">{t.help.browseFaq}</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Contattaci */}
              <button className="w-full flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm text-white block">{t.help.contactUs}</span>
                    <span className="text-xs text-[#64748B]">{t.help.writeForHelp}</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Segnala un problema */}
              <button className="w-full flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <span className="text-sm text-white">{t.help.reportProblem}</span>
                </div>
                <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Termini di servizio */}
              <button className="w-full flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm text-white">{t.help.termsOfService}</span>
                </div>
                <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Informativa sulla privacy */}
              <button className="w-full flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="text-sm text-white">{t.help.privacyPolicy}</span>
                </div>
                <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
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
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
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
            <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          <div className="bg-[#1E293B] rounded-2xl p-4">
            <div>
              {/* Versione app */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                    </svg>
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
                    <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm text-white block">{t.info.whatsNew}</span>
                    <span className="text-xs text-[#64748B]">{t.info.discoverFeatures}</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="ml-12 mr-2 h-px bg-[#334155]/50" />
              {/* Seguici sui social */}
              <button className="w-full flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <span className="text-sm text-white">{t.info.followSocial}</span>
                </div>
                <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          {/* Footer */}
          <p className="text-center text-xs text-[#64748B] py-2">Made with ❤️ in Italy</p>
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
              <svg className="w-7 h-7 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
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
  const options: Language[] = ['Italiano', 'Inglese', 'Cinese', 'Spagnolo'];

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
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
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
        <span className="text-base">🏆</span>
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
                  {unlocked ? badge.icon : '🔒'}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#8B8FA8" strokeWidth="2" strokeLinecap="round" />
              </svg>
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
                    {unlocked ? badge.icon : '🔒'}
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
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
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
