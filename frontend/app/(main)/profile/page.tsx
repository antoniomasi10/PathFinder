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
import { getOpportunityTypeColor } from '@/lib/opportunityColors';
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
  const savedSectionRef = useRef<HTMLDivElement | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!expandedOppId) return;
    const timer = setTimeout(() => {
      savedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        expandedCardRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 300);
    }, 80);
    return () => clearTimeout(timer);
  }, [expandedOppId]);

  useEffect(() => {
    if (savedOpps.length === 0) return;
    const oppId = sessionStorage.getItem('openSavedOpp');
    if (!oppId) return;
    sessionStorage.removeItem('openSavedOpp');
    setSavedTab('opportunities');
    setExpandedOppId(oppId);
  }, [savedOpps]);

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
      setEditBio((profile.bio || '').slice(0, 500));
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
      {/* Custom Header */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          height: 64,
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          borderBottom: '1px solid rgba(172,176,206,0.2)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 7,
          paddingRight: 7,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <div style={{ flex: 1 }} />
        {/* COhA Logo centered */}
        <svg width="129" height="37" viewBox="0 0 129 37" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="COhA">
          <path d="M71.4712 25.1531C70.7006 23.029 70.2645 21.7405 69.7296 19.7567C69.4798 20.0067 69.2177 20.2587 68.9286 20.5282L69.9375 25.1531L71.2156 31.1483C71.7336 33.6313 72.0648 34.9232 73.1752 36.9722H79.1393C76.8634 34.9814 75.5636 33.7184 74.1976 31.1483C73.1431 29.2076 72.518 27.9747 71.8426 26.1809C71.7213 25.8588 71.5985 25.5187 71.4712 25.1531Z" fill="#615FE2"/>
          <path d="M69.5115 18.9309C69.2759 19.1653 69.0214 19.41 68.7417 19.6718L68.9286 20.5282C69.2177 20.2587 69.4798 20.0067 69.7296 19.7567C69.659 19.4948 69.5866 19.2207 69.5115 18.9309Z" fill="#615FE2"/>
          <path d="M71.4712 25.1531C71.5985 25.5187 71.7213 25.8588 71.8426 26.1809C72.0364 24.163 72.6335 23.7809 74.368 24.1254C76.6938 24.7753 79.4442 26.9168 85.1034 31.6622L92.2604 36.9722C94.1412 37.0883 95.0542 36.7716 96.4352 35.5163C97.2204 34.6023 97.4273 34.0246 97.6281 32.9469V27.0373C95.4037 28.3877 94.0469 28.6879 91.4935 28.6646C87.9516 28.5053 85.6712 27.6997 81.1842 25.2387C79.009 23.8835 77.7959 23.5366 75.6461 23.0976C73.1617 22.747 71.994 23.0185 71.4712 25.1531Z" fill="#615FE2"/>
          <path d="M68.9286 20.5282L68.7417 19.6718C65.0295 22.409 62.8021 23.2432 58.691 24.0665C52.769 24.8945 49.5694 24.8594 44.2067 23.3814C39.9966 21.8445 38.3941 20.1557 35.9421 16.701V27.9206C38.7186 30.0067 40.7534 30.4547 45.0587 30.233C51.5311 29.5949 54.7311 28.7638 59.6282 26.379C63.4523 24.4414 65.5381 23.2498 68.9286 20.5282Z" fill="#615FE2"/>
          <path d="M69.5115 18.9309C68.9802 17.0008 68.8074 15.9253 68.5743 14.1048C68.0183 10.2861 68.1597 7.99173 71.1304 5.88275C72.9099 5.11587 73.6604 5.16552 74.4532 6.31098C75.8991 8.74632 74.9366 10.9931 72.4084 15.3895C71.4843 16.7174 70.8203 17.586 69.8437 18.5944C69.737 18.7047 69.6265 18.8166 69.5115 18.9309C69.5866 19.2207 69.659 19.4948 69.7296 19.7567C70.5076 18.9782 71.1665 18.2196 72.1528 17.0167C78.562 8.58743 78.5444 5.55711 76.1573 1.25787C76.1573 1.25787 75.5609 0.31576 74.2828 0.0588259C73.0048 -0.198108 71.9375 0.420356 71.0451 1.25787C67.1847 5.69408 66.2893 8.71045 67.8075 15.3895L68.7417 19.6718C69.0214 19.41 69.2759 19.1653 69.5115 18.9309Z" fill="#615FE2"/>
          <mask id="mask0_profile" style={{maskType:'alpha'}} maskUnits="userSpaceOnUse" x="35" y="0" width="63" height="37">
            <path d="M71.4712 25.1531C70.7006 23.029 70.2645 21.7405 69.7296 19.7567C69.4798 20.0067 69.2177 20.2587 68.9286 20.5282L69.9375 25.1531L71.2156 31.1483C71.7336 33.6313 72.0648 34.9232 73.1752 36.9722H79.1393C76.8634 34.9814 75.5636 33.7184 74.1976 31.1483C73.1431 29.2076 72.518 27.9747 71.8426 26.1809C71.7213 25.8588 71.5985 25.5187 71.4712 25.1531Z" fill="#615FE2"/>
            <path d="M69.5115 18.9309C69.2759 19.1653 69.0215 19.41 68.7417 19.6718L68.9286 20.5282C69.2177 20.2587 69.4798 20.0067 69.7296 19.7567C69.659 19.4948 69.5866 19.2207 69.5115 18.9309Z" fill="#615FE2"/>
            <path d="M71.4712 25.1531C71.5985 25.5187 71.7213 25.8588 71.8426 26.1809C72.0364 24.163 72.6335 23.7809 74.368 24.1254C76.6938 24.7753 79.4442 26.9168 85.1034 31.6622L92.2604 36.9722C94.1412 37.0883 95.0542 36.7716 96.4352 35.5163C97.2204 34.6023 97.4273 34.0246 97.6281 32.9469V27.0373C95.4037 28.3877 94.0469 28.6879 91.4935 28.6646C87.9516 28.5053 85.6712 27.6997 81.1842 25.2387C79.009 23.8835 77.7959 23.5366 75.6461 23.0976C73.1617 22.747 71.994 23.0185 71.4712 25.1531Z" fill="#615FE2"/>
            <path d="M68.9286 20.5282L68.7417 19.6718C65.0295 22.409 62.8021 23.2432 58.691 24.0665C52.769 24.8945 49.5694 24.8594 44.2067 23.3814C39.9966 21.8445 38.3941 20.1557 35.9421 16.701V27.9206C38.7186 30.0067 40.7534 30.4547 45.0587 30.233C51.5311 29.5949 54.7311 28.7638 59.6282 26.379C63.4523 24.4414 65.5381 23.2498 68.9286 20.5282Z" fill="#615FE2"/>
            <path d="M69.5115 18.9309C68.9802 17.0008 68.8074 15.9253 68.5743 14.1048C68.0183 10.2861 68.1597 7.99173 71.1304 5.88275C72.9099 5.11587 73.6604 5.16552 74.4532 6.31098C75.8991 8.74632 74.9366 10.9931 72.4084 15.3895C71.4843 16.7174 70.8203 17.586 69.8437 18.5944C69.737 18.7047 69.6265 18.8166 69.5115 18.9309C69.5866 19.2207 69.659 19.4948 69.7296 19.7567C70.5076 18.9782 71.1665 18.2196 72.1528 17.0167C78.562 8.58743 78.5444 5.55711 76.1573 1.25787C76.1573 1.25787 75.5609 0.31576 74.2828 0.0588259C73.0048 -0.198108 71.9375 0.420356 71.0451 1.25787C67.1847 5.69408 66.2893 8.71045 67.8075 15.3895L68.7417 19.6718C69.0215 19.41 69.2759 19.1653 69.5115 18.9309Z" fill="#615FE2"/>
          </mask>
          <g mask="url(#mask0_profile)">
            <rect x="21.1184" y="8.70459" width="46.8622" height="28.2899" fill="url(#profile_g0)"/>
            <rect x="69.215" y="18.6378" width="49.7354" height="29.6082" fill="url(#profile_g1)"/>
            <rect x="64.48" y="23.0285" width="17.4359" height="37.5037" fill="url(#profile_g2)"/>
            <rect x="65.8629" y="-9.88831" width="25.4121" height="27.3988" fill="url(#profile_g3)" fillOpacity="0.75"/>
          </g>
          <path d="M38.29 30.9597C36.9907 30.9597 35.7808 30.7242 34.6601 30.2532C33.5558 29.7822 32.5894 29.1245 31.7612 28.28C30.9329 27.4354 30.2833 26.4448 29.8123 25.3079C29.3575 24.171 29.1302 22.9286 29.1302 21.5806C29.1302 20.2326 29.3575 18.9902 29.8123 17.8534C30.267 16.7003 30.9085 15.7096 31.7368 14.8813C32.5651 14.0368 33.5314 13.3872 34.6358 12.9324C35.7564 12.4614 36.9745 12.2259 38.29 12.2259C39.6055 12.2259 40.7829 12.4452 41.8223 12.8837C42.878 13.3222 43.7712 13.9069 44.5021 14.6377C45.2329 15.3685 45.7526 16.1806 46.0612 17.0738L42.7237 18.6817C42.4151 17.8046 41.8711 17.0819 41.0915 16.5135C40.3282 15.9288 39.3943 15.6365 38.29 15.6365C37.2181 15.6365 36.2761 15.8882 35.4641 16.3917C34.652 16.8952 34.0186 17.5935 33.5639 18.4868C33.1254 19.3638 32.9061 20.3951 32.9061 21.5806C32.9061 22.7662 33.1254 23.8056 33.5639 24.6989C34.0186 25.5921 34.652 26.2905 35.4641 26.7939C36.2761 27.2974 37.2181 27.5491 38.29 27.5491C39.3943 27.5491 40.3282 27.2649 41.0915 26.6965C41.8711 26.1118 42.4151 25.381 42.7237 24.504L46.0612 26.1118C45.7526 27.0051 45.2329 27.8171 44.5021 28.5479C43.7712 29.2788 42.878 29.8634 41.8223 30.3019C40.7829 30.7404 39.6055 30.9597 38.29 30.9597ZM56.9619 30.9597C55.5976 30.9597 54.3309 30.7242 53.1615 30.2532C51.9922 29.7822 50.969 29.1245 50.092 28.28C49.2312 27.4192 48.5573 26.4204 48.07 25.2835C47.5828 24.1467 47.3392 22.9124 47.3392 21.5806C47.3392 20.2489 47.5747 19.0146 48.0457 17.8777C48.5329 16.7409 49.2069 15.7502 50.0676 14.9057C50.9447 14.0611 51.9678 13.4034 53.1372 12.9324C54.3065 12.4614 55.5814 12.2259 56.9619 12.2259C58.3423 12.2259 59.6172 12.4614 60.7866 12.9324C61.9559 13.4034 62.971 14.0611 63.8317 14.9057C64.7087 15.7502 65.3827 16.7409 65.8537 17.8777C66.3409 19.0146 66.5845 20.2489 66.5845 21.5806C66.5845 22.9124 66.3409 24.1467 65.8537 25.2835C65.3665 26.4204 64.6844 27.4192 63.8074 28.28C62.9466 29.1245 61.9316 29.7822 60.7622 30.2532C59.5929 30.7242 58.3261 30.9597 56.9619 30.9597ZM56.9619 27.5491C57.7901 27.5491 58.5535 27.403 59.2518 27.1106C59.9664 26.8183 60.5917 26.4123 61.1276 25.8926C61.6636 25.3566 62.0777 24.7232 62.3701 23.9924C62.6624 23.2616 62.8086 22.4576 62.8086 21.5806C62.8086 20.7036 62.6624 19.9078 62.3701 19.1932C62.0777 18.4624 61.6636 17.829 61.1276 17.2931C60.5917 16.7571 59.9664 16.3511 59.2518 16.075C58.5535 15.7827 57.7901 15.6365 56.9619 15.6365C56.1336 15.6365 55.3621 15.7827 54.6476 16.075C53.9492 16.3511 53.332 16.7571 52.7961 17.2931C52.2602 17.829 51.846 18.4624 51.5537 19.1932C51.2613 19.9078 51.1152 20.7036 51.1152 21.5806C51.1152 22.4576 51.2613 23.2616 51.5537 23.9924C51.846 24.7232 52.2602 25.3566 52.7961 25.8926C53.332 26.4123 53.9492 26.8183 54.6476 27.1106C55.3621 27.403 56.1336 27.5491 56.9619 27.5491ZM82.3872 30.6674L88.5262 12.5183H93.5446L99.6836 30.6674H95.5666L94.3485 26.9645H87.6979L86.4798 30.6674H82.3872ZM88.7454 23.6757H93.301L90.5238 15.1006H91.547L88.7454 23.6757Z" fill="#2C3149"/>
          <defs>
            <linearGradient id="profile_g0" x1="90.8031" y1="24.4817" x2="17.1625" y2="24.4817" gradientUnits="userSpaceOnUse">
              <stop offset="0.240385" stopColor="#615FE2" stopOpacity="0.52"/>
              <stop offset="0.602697" stopColor="#FBF8FF"/>
            </linearGradient>
            <linearGradient id="profile_g1" x1="143.172" y1="35.1501" x2="65.0165" y2="35.1501" gradientUnits="userSpaceOnUse">
              <stop offset="0.649865" stopColor="#FBF8FF"/>
              <stop offset="0.941702" stopColor="#615FE2" stopOpacity="0.52"/>
            </linearGradient>
            <linearGradient id="profile_g2" x1="73.0335" y1="20.1116" x2="73.2974" y2="60.5316" gradientUnits="userSpaceOnUse">
              <stop stopColor="#615FE2" stopOpacity="0.46"/>
              <stop offset="0.447379" stopColor="#FBF8FF" stopOpacity="0.49"/>
            </linearGradient>
            <linearGradient id="profile_g3" x1="87.6447" y1="-10.9698" x2="66.1891" y2="12.2683" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FBF8FF"/>
              <stop offset="0.870192" stopColor="#615FE2"/>
            </linearGradient>
          </defs>
        </svg>
        <div style={{ flex: 1 }} />
      </header>

      {/* Scrollable main content */}
      <div style={{ paddingTop: 64, paddingBottom: 100, backgroundColor: '#fbf8ff', minHeight: '100vh' }}>

        {/* Hero + Avatar + Info */}
        <div style={{ position: 'relative', marginBottom: 0 }}>
          {/* Hero banner */}
          <svg width="391" height="192" viewBox="0 0 391 192" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: 'auto' }}>
            <g clipPath="url(#hero_clip)">
              <path d="M0 3C0 1.34315 1.34315 0 3 0H388C389.657 0 391 1.34315 391 3V173C391 183.493 382.493 192 372 192H19C8.50659 192 0 183.493 0 173V3Z" fill="#4A4BD7"/>
              <rect y="-25" width="391" height="250" rx="26" fill="#615FE2"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M0 102.593C5.92541 112.967 13.2542 122.358 21.8296 130.543C40.0496 147.896 63.6018 159.178 88.2856 165.134C112.969 171.09 138.784 171.733 163.748 168.054C177.228 166.063 190.568 162.903 203.376 158.554C225.048 151.065 245.358 139.568 261.959 123.668C265.018 120.713 267.946 117.616 270.735 114.381C272.659 112.156 274.532 109.889 276.349 107.584C278.165 105.279 279.924 102.937 281.626 100.557C289.378 89.826 296.145 78.3693 302.803 66.8681C306.131 61.117 309.465 55.3522 312.983 49.696C318.254 41.1792 323.897 32.8812 330.451 25.3181C337.005 17.755 344.509 10.9534 353.381 6.01766C360.027 2.27351 367.495 -0.000358582 375.134 -0.000358582C380.678 -0.000358582 386.348 1.11498 391 3.66099V192H0V102.593Z" fill="#ECEDFF" fillOpacity="0.17"/>
              <rect opacity="0.2" width="391" height="165" transform="matrix(1 0 0 -1 0 195)" fill="url(#hero_radial)"/>
            </g>
            <defs>
              <radialGradient id="hero_radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(195.5) scale(276.479 233.345)">
                <stop stopColor="white"/>
                <stop offset="0.5" stopColor="white" stopOpacity="0"/>
                <stop offset="1" stopColor="white" stopOpacity="0"/>
              </radialGradient>
              <clipPath id="hero_clip">
                <path d="M0 3C0 1.34315 1.34315 0 3 0H388C389.657 0 391 1.34315 391 3V173C391 183.493 382.493 192 372 192H19C8.50659 192 0 183.493 0 173V3Z" fill="white"/>
              </clipPath>
            </defs>
          </svg>

          {/* Avatar — overlapping hero, centered */}
          <div style={{
            position: 'absolute',
            bottom: -64,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 128,
            height: 128,
            borderRadius: '50%',
            backgroundColor: 'white',
            border: '4px solid #fdfdfd',
            boxShadow: '0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {currentAvatar && isValidImageUrl(currentAvatar) ? (
              <img src={currentAvatar} alt={fullName} style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontWeight: 700, fontSize: 32, fontFamily: 'var(--font-plus-jakarta)' }}>{initials}</span>
              </div>
            )}
          </div>
        </div>

        {/* Profile info block */}
        <div style={{ paddingTop: 80, paddingLeft: 24, paddingRight: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 700, fontSize: 24, lineHeight: '32px', color: '#2c3149', margin: 0 }}>
            {fullName}
          </h2>
          {profile.university && (
            <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 400, fontSize: 15, lineHeight: '24px', color: '#595e78', margin: '2px 0 0' }}>
              {profile.university.name}
            </p>
          )}
          {profile.courseOfStudy && (
            <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 400, fontSize: 12, lineHeight: '24px', color: 'rgba(89,94,120,0.6)', margin: 0 }}>
              {profile.courseOfStudy}{profile.yearOfStudy ? ` • ${profile.yearOfStudy}° anno` : ''}
            </p>
          )}

          {/* Core skills (principali — purple) */}
          {coreSkills && coreSkills.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {coreSkills.map((skill) => (
                <span key={skill.id} style={{
                  backgroundColor: '#615fe2',
                  borderRadius: 9999,
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 4,
                  paddingBottom: 4,
                  color: 'white',
                  fontFamily: 'var(--font-plus-jakarta)',
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: '20px',
                  whiteSpace: 'nowrap',
                }}>
                  {skill.name}
                </span>
              ))}
            </div>
          )}

          {/* Side skills (secondarie — grey, smaller) */}
          {sideSkills && sideSkills.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {sideSkills.map((skill) => (
                <span key={skill.id} style={{
                  backgroundColor: 'rgba(116,121,149,0.56)',
                  borderRadius: 9999,
                  paddingLeft: 9.802,
                  paddingRight: 9.802,
                  paddingTop: 3.267,
                  paddingBottom: 3.267,
                  color: 'white',
                  fontFamily: 'var(--font-plus-jakarta)',
                  fontWeight: 500,
                  fontSize: 11.436,
                  lineHeight: '16.336px',
                  whiteSpace: 'nowrap',
                }}>
                  {skill.name}
                </span>
              ))}
            </div>
          )}

          {/* Modifica profilo */}
          <button
            onClick={openEditDialog}
            style={{
              width: '100%',
              maxWidth: 320,
              backgroundColor: '#615fe2',
              borderRadius: 24,
              paddingLeft: 24,
              paddingRight: 24,
              paddingTop: 12,
              paddingBottom: 12,
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: '#fbf7ff' }}>
              Modifica profilo
            </span>
          </button>
        </div>

        {/* Stats section */}
        <div style={{
          margin: '16px 24px 0',
          backgroundColor: 'white',
          border: '1px solid #acb0ce',
          borderRadius: 24,
          padding: 21,
          boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 17, padding: '0 8px' }}>
            <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 700, fontSize: 24, lineHeight: '32px', color: '#4a4bd7' }}>
              {friends.length}
            </span>
            <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 500, fontSize: 14, lineHeight: '20px', color: '#595e78', textTransform: 'uppercase', letterSpacing: '0.7px', textAlign: 'center' }}>
              PERSONE CONNESSE
            </span>
          </div>
          <div style={{ width: 1, height: 75, backgroundColor: '#acb0ce', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 17, padding: '0 9px' }}>
            <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 700, fontSize: 24, lineHeight: '32px', color: '#4a4bd7' }}>
              {savedOpps.length}
            </span>
            <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 500, fontSize: 14, lineHeight: '20px', color: '#595e78', textTransform: 'uppercase', letterSpacing: '0.7px', textAlign: 'center' }}>
              OPPORTUNITÀ SALVATE
            </span>
          </div>
        </div>


        {/* Posts section */}
        <div style={{ margin: '16px 24px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 700, fontSize: 20, lineHeight: '28px', color: '#2c3149', margin: 0 }}>
                I tuoi posts
              </h3>
              <button style={{
                width: 40,
                height: 40,
                backgroundColor: '#7073ff',
                borderRadius: '50%',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}>
                <Plus size={18} color="white" strokeWidth={2.5} />
              </button>
            </div>
            <div style={{
              backgroundColor: '#f3f2ff',
              border: '2px dashed #acb0ce',
              borderRadius: 24,
              height: 110,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 34,
            }}>
              <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 500, fontSize: 16, lineHeight: '24px', color: '#595e78', textAlign: 'center' }}>
                Publish your first post
              </span>
            </div>
          </div>
        </div>

        {/* Divider before settings */}
        <div style={{ height: 1, backgroundColor: 'rgba(172,176,206,0.3)', margin: '32px 24px 0' }} />

        {/* Settings / Pathmates — keep existing section here */}
        <div className="px-4 py-6 space-y-6">
          {/* Profile visibility notice */}
          {!publicProfile && (
            <div className="flex items-center gap-2 bg-[#fff8e6] rounded-xl px-4 py-2.5 border border-[rgba(251,191,36,0.3)]">
              <EyeOff size={16} color="#595e78" className="flex-shrink-0" />
              <p className="text-xs text-[#595e78]">
                Profilo <span className="text-[#2c3149] font-medium">privato</span> — visibile solo ai Pathmates
              </p>
            </div>
          )}

        {/* Tabs */}
        <div>
          <div className="flex bg-[#f3f2ff] rounded-xl p-1 mb-4 border border-[rgba(172,176,206,0.2)]">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'settings'
                  ? 'bg-[#615fe2] text-white shadow-sm'
                  : 'text-[#595e78] hover:text-[#2c3149]'
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
                  ? 'bg-[#615fe2] text-white shadow-sm'
                  : 'text-[#595e78] hover:text-[#2c3149]'
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
              <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)] shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
                <h4 className="text-sm font-semibold text-[#2c3149] mb-3">{t.profile.preferences}</h4>
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
                      <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center">
                        <Bell size={20} color="#615fe2" />
                      </div>
                      <span className="text-sm text-[#2c3149]">{t.profile.notifications}</span>
                    </div>
                    <ChevronRight size={20} color="#747995" />
                  </button>
                  <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center">
                        <Moon size={20} color="#615fe2" />
                      </div>
                      <span className="text-sm text-[#2c3149]">{t.profile.darkMode}</span>
                    </div>
                    <ToggleSwitch defaultOn />
                  </div>
                  <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center">
                        <Globe size={20} color="#615fe2" />
                      </div>
                      <span className="text-sm text-[#2c3149]">{t.profile.language}</span>
                    </div>
                    <LanguageDropdown />
                  </div>
                </div>
              </div>

              {/* Security & Info */}
              <div className="bg-white rounded-2xl overflow-hidden border border-[rgba(172,176,206,0.3)] shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
                {[
                  { label: t.profile.securityPrivacy, icon: <ShieldCheck size={20} color="#615fe2" />, onPress: () => setShowSecurityPrivacySheet(true) },
                  { label: t.profile.helpSupport, icon: <CircleHelp size={20} color="#615fe2" />, onPress: () => setShowHelpSheet(true) },
                  { label: t.profile.info, icon: <Info size={20} color="#615fe2" />, onPress: () => setShowInfoSheet(true) },
                ].map((item, i, arr) => (
                  <div key={item.label}>
                    <button
                      onClick={item.onPress}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[rgba(172,176,206,0.08)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center">
                          {item.icon}
                        </div>
                        <span className="text-sm text-[#2c3149]">{item.label}</span>
                      </div>
                      <ChevronRight size={16} color="#747995" />
                    </button>
                    {i < arr.length - 1 && (
                      <div className="ml-[60px] mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
                    )}
                  </div>
                ))}
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full bg-[rgba(239,68,68,0.08)] text-[#EF4444] rounded-2xl py-3.5 text-sm font-medium hover:bg-[rgba(239,68,68,0.15)] transition-colors"
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2"><Search size={16} color="#747995" /></span>
                <input
                  type="text"
                  placeholder={t.profile.searchPathmates}
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  className="w-full bg-[#fbf8ff] border border-[rgba(172,176,206,0.3)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#2c3149] placeholder-[#acb0ce] focus:outline-none focus:border-[#615fe2] transition-colors"
                />
              </div>

              {/* Current Pathmates */}
              {filteredFriends.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center border border-[rgba(172,176,206,0.3)]">
                  <p className="text-sm text-[#595e78]">
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
                        className="bg-white rounded-2xl p-4 flex items-center gap-3 border border-[rgba(172,176,206,0.2)]"
                      >
                        <button
                          onClick={() => router.push(`/profile/${friend.id}`)}
                          className="w-11 h-11 rounded-full bg-gradient-to-br from-[#615fe2] to-[#7073ff] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
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
                          <p className="text-sm font-semibold text-[#2c3149] truncate">{friend.name}</p>
                          <p className="text-xs text-[#595e78] truncate">
                            {friend.courseOfStudy || friend.university?.name || ''}
                          </p>
                        </button>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {messagePrivacy !== 'Nessuno' && (
                            <button
                              onClick={() => router.push(`/networking?openChat=${friend.id}&name=${encodeURIComponent(friend.name)}&avatar=${encodeURIComponent(friend.avatar || '')}`)}
                              className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center hover:bg-[rgba(97,95,226,0.15)] transition-colors"
                            >
                              <ChatDots size={20} color="#615fe2" />
                            </button>
                          )}
                          <button
                            onClick={() => removeFriend(friend.id)}
                            disabled={removingFriend === friend.id}
                            className="w-9 h-9 rounded-[22%] bg-[rgba(239,68,68,0.08)] flex items-center justify-center hover:bg-[rgba(239,68,68,0.15)] transition-colors disabled:opacity-50"
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
                  <h4 className="text-sm font-semibold text-[#595e78] uppercase tracking-wider mb-3 px-1">
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
                          className="bg-white rounded-2xl p-4 flex items-center gap-3 border border-[rgba(172,176,206,0.2)]"
                        >
                          <button
                            onClick={() => router.push(`/profile/${suggested.id}`)}
                            className="w-11 h-11 rounded-full bg-gradient-to-br from-[#615fe2] to-[#7073ff] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
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
                            <p className="text-sm font-semibold text-[#2c3149] truncate">{suggested.name}</p>
                            <p className="text-xs text-[#595e78] truncate">
                              {suggested.courseOfStudy || suggested.university?.name || ''}
                            </p>
                          </button>
                          {suggested.requestSent ? (
                            <span className="text-xs text-[#615fe2] font-medium px-2 flex-shrink-0">Inviata</span>
                          ) : (
                            <button
                              onClick={() => sendFriendRequest(suggested.id)}
                              disabled={sendingRequest === suggested.id}
                              className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center hover:bg-[rgba(97,95,226,0.15)] transition-colors disabled:opacity-50 flex-shrink-0"
                            >
                              <UserAdd size={20} color="#615fe2" />
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
      </div>  {/* end main scrollable */}

      {/* Enhanced Edit Profile Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowEditDialog(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-[calc(1.5rem+5rem)] sm:pb-6 space-y-5 animate-slide-up max-h-[100vh] sm:max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#2c3149]">{t.profile.editProfile}</h3>
              <button
                onClick={() => setShowEditDialog(false)}
                className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors"
              >
                <CloseLg size={20} color="#595e78" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group"
                >
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#615fe2] to-[#7073ff] flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
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
                <p className="text-xs text-[#747995] mt-2">{t.profile.tapToChangePhoto}</p>
              </div>

              {/* Name & Surname */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#595e78] mb-1.5">{t.profile.name}</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#fbf8ff] border border-[rgba(172,176,206,0.3)] rounded-xl px-4 py-3 text-sm text-[#2c3149] placeholder-[#acb0ce] focus:outline-none focus:border-[#615fe2] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#595e78] mb-1.5">{t.profile.surname}</label>
                  <input
                    type="text"
                    value={editSurname}
                    onChange={(e) => setEditSurname(e.target.value)}
                    className="w-full bg-[#fbf8ff] border border-[rgba(172,176,206,0.3)] rounded-xl px-4 py-3 text-sm text-[#2c3149] placeholder-[#acb0ce] focus:outline-none focus:border-[#615fe2] transition-colors"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-medium text-[#595e78]">{t.profile.bio}</label>
                  <span className={`text-xs ${editBio.length > 480 ? 'text-red-400' : 'text-[#acb0ce]'}`}>{editBio.length}/500</span>
                </div>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value.slice(0, 500))}
                  rows={3}
                  maxLength={500}
                  placeholder={t.profile.bioPlaceholder}
                  className="w-full bg-[#fbf8ff] border border-[rgba(172,176,206,0.3)] rounded-xl px-4 py-3 text-sm text-[#2c3149] placeholder-[#acb0ce] focus:outline-none focus:border-[#615fe2] transition-colors resize-none"
                />
              </div>

              {/* Course & Year */}
              <div>
                <label className="block text-xs font-medium text-[#595e78] mb-1.5">{t.profile.course}</label>
                <input
                  type="text"
                  value={editCourse}
                  onChange={(e) => setEditCourse(e.target.value)}
                  placeholder={t.profile.coursePlaceholder}
                  className="w-full bg-[#fbf8ff] border border-[rgba(172,176,206,0.3)] rounded-xl px-4 py-3 text-sm text-[#2c3149] placeholder-[#acb0ce] focus:outline-none focus:border-[#615fe2] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#595e78] mb-1.5">{t.profile.year}</label>
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
                  className="w-full bg-[#fbf8ff] border border-[rgba(172,176,206,0.3)] rounded-xl px-4 py-3 text-sm text-[#2c3149] placeholder-[#acb0ce] focus:outline-none focus:border-[#615fe2] transition-colors"
                />
              </div>

              {/* Core Skills link */}
              <div>
                <label className="block text-xs font-medium text-[#595e78] mb-1.5">{t.profile.skills}</label>
                <button
                  onClick={() => {
                    setShowEditDialog(false);
                    router.push('/profile/skills');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[rgba(97,95,226,0.1)] text-[#615fe2] hover:bg-[rgba(97,95,226,0.15)] transition-colors"
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
                className="flex-1 py-3 rounded-xl text-sm font-medium text-[#595e78] bg-[rgba(172,176,206,0.2)] hover:bg-[rgba(172,176,206,0.15)] transition-colors"
              >
                {t.profile.cancel}
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-[#615fe2] hover:bg-[#4a4bd7] transition-colors disabled:opacity-50"
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
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 animate-slide-up max-h-[80vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#2c3149]">{t.profile.addSkills}</h3>
              <button
                onClick={() => setShowSkillsModal(false)}
                className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors"
              >
                <CloseLg size={20} color="#595e78" />
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
                        ? 'bg-[#615fe2] text-white'
                        : 'bg-[rgba(172,176,206,0.15)] text-[#595e78] hover:bg-[rgba(172,176,206,0.3)] hover:text-[#2c3149]'
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
              className="w-full py-3 rounded-xl text-sm font-medium text-white bg-[#615fe2] hover:bg-[#4a4bd7] transition-colors"
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
        className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          showSecurityPrivacySheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">{t.profile.securityPrivacy}</h2>
          <button
            onClick={() => setShowSecurityPrivacySheet(false)}
            className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors"
          >
            <CloseLg size={20} color="#595e78" />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">

          {/* Sicurezza */}
          <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
            <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider mb-3">{t.security.title}</h4>
            <button onClick={() => { setShowSecurityPrivacySheet(false); setShowChangePassword(true); }} className="w-full flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                  <Key size={20} color="#615fe2" />
                </div>
                <span className="text-sm text-[#2c3149]">{t.security.changePassword}</span>
              </div>
              <ChevronRight size={16} color="#747995" />
            </button>
          </div>

          {/* Visibilità profilo */}
          <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
            <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider mb-3">{t.privacy.profileVisibility}</h4>
            {/* Profilo pubblico / privato toggle */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                  <UserIcon size={20} color="#615fe2" />
                </div>
                <div>
                  <span className="text-sm text-[#2c3149] block">Profilo privato</span>
                </div>
              </div>
              <PrivacyToggle value={!publicProfile} onChange={togglePrivateProfile} />
            </div>
            <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
            {/* Chi può vedere le tue competenze */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                  <Award size={20} color="#615fe2" />
                </div>
                <span className="text-sm text-[#2c3149]">{t.privacy.whoCanSeeSkills}</span>
              </div>
              <PrivacyDropdown value={privacySkills} onChange={setPrivacySkills} allowedOptions={!publicProfile ? ['Pathmates'] : ['Tutti', 'Pathmates']} />
            </div>
          </div>

          {/* Attività */}
          <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
            <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider mb-3">{t.privacy.activity}</h4>
            {/* Opportunità salvate */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                  <Bookmark size={20} color="#615fe2" />
                </div>
                <span className="text-sm text-[#2c3149]">{t.privacy.whoCanSeeSavedOpps}</span>
              </div>
              <PrivacyDropdown value={privacySavedOpps} onChange={setPrivacySavedOpps} allowedOptions={!publicProfile ? ['Pathmates', 'Nessuno'] : undefined} />
            </div>
            <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
            {/* Pathmates */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                  <UsersGroup size={20} color="#615fe2" />
                </div>
                <span className="text-sm text-[#2c3149]">{t.privacy.whoCanSeePathmates}</span>
              </div>
              <PrivacyDropdown value={privacyPathmates} onChange={setPrivacyPathmates} allowedOptions={!publicProfile ? ['Pathmates', 'Nessuno'] : undefined} />
            </div>
            <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
            {/* Messaggi */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                  <ChatDots size={20} color="#615fe2" />
                </div>
                <span className="text-sm text-[#2c3149]">{t.privacy.whoCanMessage}</span>
              </div>
              <PrivacyDropdown value={messagePrivacy} onChange={setMessagePrivacy} allowedOptions={!publicProfile ? ['Pathmates', 'Nessuno'] : undefined} />
            </div>
          </div>

          {/* Account */}
          <div className="bg-white rounded-2xl overflow-hidden border border-[rgba(172,176,206,0.3)]">
            <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider px-4 pt-4 pb-2">Account</h4>
            <button onClick={() => { setShowSecurityPrivacySheet(false); setShowDeleteModal(true); }} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[rgba(239,68,68,0.05)] transition-colors">
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
        className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          showHelpSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">{t.help.title}</h2>
          <button onClick={() => setShowHelpSheet(false)} className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors">
            <CloseLg size={20} color="#595e78" />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
            <div>
              {/* Centro assistenza */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => setShowFaqSheet(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                    <CircleHelp size={20} color="#615fe2" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-[#2c3149]">{t.help.helpCenter}</span>
                    <span className="text-xs text-[#747995]">{t.help.browseFaq}</span>
                  </div>
                </div>
                <ChevronRight size={16} color="#747995" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
              {/* Contattaci */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => setShowContactSheet(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                    <Mail size={20} color="#615fe2" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-[#2c3149]">{t.help.contactUs}</span>
                    <span className="text-xs text-[#747995]">{t.help.writeForHelp}</span>
                  </div>
                </div>
                <ChevronRight size={16} color="#747995" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
              {/* Segnala un problema */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => { setReportSubmitted(false); setReportCategory(''); setReportDescription(''); setShowReportSheet(true); }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                    <TriangleWarning size={20} color="#615fe2" />
                  </div>
                  <span className="text-sm text-[#2c3149]">{t.help.reportProblem}</span>
                </div>
                <ChevronRight size={16} color="#747995" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
              {/* Termini di servizio */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => setShowTermsSheet(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                    <FileText size={20} color="#615fe2" />
                  </div>
                  <span className="text-sm text-[#2c3149]">{t.help.termsOfService}</span>
                </div>
                <ChevronRight size={16} color="#747995" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
              {/* Informativa sulla privacy */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => setShowPrivacySheet(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={20} color="#615fe2" />
                  </div>
                  <span className="text-sm text-[#2c3149]">{t.help.privacyPolicy}</span>
                </div>
                <ChevronRight size={16} color="#747995" />
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
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          showFaqSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">Centro assistenza</h2>
          <button onClick={() => setShowFaqSheet(false)} className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors">
            <svg className="w-5 h-5 text-[#595e78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-[rgba(172,176,206,0.3)]">
              <button
                className="w-full flex items-center justify-between px-4 py-4 text-left gap-3"
                onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
              >
                <span className="text-sm text-[#2c3149] font-medium leading-snug">{item.q}</span>
                <svg
                  className={`w-5 h-5 text-[#747995] flex-shrink-0 transition-transform duration-200 ${openFaqIndex === i ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaqIndex === i && (
                <div className="px-4 pb-4 text-sm text-[#595e78] leading-relaxed border-t border-[rgba(172,176,206,0.2)] pt-3">
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
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          showContactSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">{t.help.contactUs}</h2>
          <button onClick={() => setShowContactSheet(false)} className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors">
            <svg className="w-5 h-5 text-[#595e78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          {/* Intro */}
          <p className="text-sm text-[#595e78] leading-relaxed">
            Hai bisogno di aiuto? Il nostro team è disponibile per supportarti.
          </p>
          {/* Contatti card */}
          <div className="bg-white rounded-2xl overflow-hidden border border-[rgba(172,176,206,0.3)]">
            {/* Email */}
            <a
              href="mailto:support@pathfinder.app"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(172,176,206,0.08)] transition-colors"
            >
              <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-[#615fe2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#747995] font-medium">Email</p>
                <p className="text-sm text-[#615fe2] font-medium truncate">support@pathfinder.app</p>
              </div>
              <svg className="w-4 h-4 text-[#747995] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <div className="mx-4 h-px bg-[rgba(172,176,206,0.2)]" />
            {/* Orari */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-[22%] bg-[#22C55E]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-[#747995] font-medium">Disponibilità</p>
                <p className="text-sm text-[#2c3149]">Lun–Ven, 9:00–18:00</p>
              </div>
            </div>
          </div>
          {/* CTA button */}
          <button
            onClick={() => { setContactSubject(''); setContactMessage(''); setContactFormSent(false); setShowContactFormSheet(true); }}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-[#615fe2] text-white hover:bg-[#4a4bd7] transition-colors flex items-center justify-center gap-2"
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
        className={`fixed bottom-0 left-0 right-0 z-[80] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          showContactFormSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">Scrivi un messaggio</h2>
          <button onClick={() => setShowContactFormSheet(false)} className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors">
            <svg className="w-5 h-5 text-[#595e78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              <p className="text-[#2c3149] font-semibold text-base">Messaggio inviato</p>
              <p className="text-[#595e78] text-sm text-center leading-relaxed">
                Ti risponderemo all'indirizzo email associato al tuo account entro 48 ore lavorative.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 space-y-4 border border-[rgba(172,176,206,0.3)]">
                <div>
                  <label className="text-xs text-[#747995] font-medium uppercase tracking-wider block mb-2">Oggetto</label>
                  <input
                    type="text"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    placeholder="Di cosa hai bisogno?"
                    className="w-full bg-[#fbf8ff] text-sm text-[#2c3149] placeholder-[#acb0ce] rounded-xl px-4 py-3 border border-[rgba(172,176,206,0.3)] focus:outline-none focus:border-[#615fe2]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#747995] font-medium uppercase tracking-wider block mb-2">Messaggio</label>
                  <textarea
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Descrivi la tua richiesta nel dettaglio..."
                    rows={5}
                    className="w-full bg-[#fbf8ff] text-sm text-[#2c3149] placeholder-[#acb0ce] rounded-xl px-4 py-3 border border-[rgba(172,176,206,0.3)] focus:outline-none focus:border-[#615fe2] resize-none"
                  />
                </div>
              </div>
              <button
                onClick={() => { if (contactSubject.trim() && contactMessage.trim()) setContactFormSent(true); }}
                disabled={!contactSubject.trim() || !contactMessage.trim()}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all bg-[#615fe2] text-white hover:bg-[#4a4bd7] disabled:opacity-40 disabled:cursor-not-allowed"
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
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          showReportSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">{t.help.reportProblem}</h2>
          <button onClick={() => setShowReportSheet(false)} className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors">
            <svg className="w-5 h-5 text-[#595e78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              <p className="text-[#2c3149] font-semibold text-base">Segnalazione inviata</p>
              <p className="text-[#595e78] text-sm text-center leading-relaxed">
                Grazie per il tuo feedback.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 space-y-4 border border-[rgba(172,176,206,0.3)]">
                {/* Category dropdown */}
                <div>
                  <label className="text-xs text-[#747995] font-medium uppercase tracking-wider block mb-2">
                    Categoria
                  </label>
                  <div className="relative">
                    <select
                      value={reportCategory}
                      onChange={(e) => setReportCategory(e.target.value)}
                      className="w-full appearance-none bg-[#fbf8ff] text-sm text-[#2c3149] rounded-xl px-4 py-3 border border-[rgba(172,176,206,0.3)] focus:outline-none focus:border-[#615fe2] pr-10"
                    >
                      <option value="" disabled>Seleziona una categoria...</option>
                      <option value="bug">Bug tecnico</option>
                      <option value="content">Contenuto inappropriato</option>
                      <option value="user">Problema con un utente</option>
                      <option value="other">Altro</option>
                    </select>
                    <svg className="w-4 h-4 text-[#747995] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {/* Description */}
                <div>
                  <label className="text-xs text-[#747995] font-medium uppercase tracking-wider block mb-2">
                    Descrizione
                  </label>
                  <textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Descrivi il problema nel dettaglio..."
                    rows={4}
                    className="w-full bg-[#fbf8ff] text-sm text-[#2c3149] placeholder-[#acb0ce] rounded-xl px-4 py-3 border border-[rgba(172,176,206,0.3)] focus:outline-none focus:border-[#615fe2] resize-none"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  if (!reportCategory || !reportDescription.trim()) return;
                  setReportSubmitted(true);
                }}
                disabled={!reportCategory || !reportDescription.trim()}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all bg-[#615fe2] text-white hover:bg-[#4a4bd7] disabled:opacity-40 disabled:cursor-not-allowed"
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
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          showTermsSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">{t.help.termsOfService}</h2>
          <button onClick={() => setShowTermsSheet(false)} className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors">
            <svg className="w-5 h-5 text-[#595e78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar text-sm text-[#595e78] leading-relaxed">
          <p className="text-xs text-[#acb0ce]">Ultimo aggiornamento: gennaio 2025</p>
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
            <div key={i} className="bg-white rounded-2xl p-4 space-y-2 border border-[rgba(172,176,206,0.3)]">
              <h3 className="text-[#2c3149] font-semibold text-sm">{section.title}</h3>
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
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          showPrivacySheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">{t.help.privacyPolicy}</h2>
          <button onClick={() => setShowPrivacySheet(false)} className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors">
            <svg className="w-5 h-5 text-[#595e78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar text-sm text-[#595e78] leading-relaxed">
          <p className="text-xs text-[#acb0ce]">Ultimo aggiornamento: gennaio 2025 · Conforme al GDPR (Reg. UE 2016/679)</p>
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
            <div key={i} className="bg-white rounded-2xl p-4 space-y-2 border border-[rgba(172,176,206,0.3)]">
              <h3 className="text-[#2c3149] font-semibold text-sm">{section.title}</h3>
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
        className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          showNotificationSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">Notifiche</h2>
          <button onClick={() => setShowNotificationSheet(false)} className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors">
            <CloseLg size={20} color="#595e78" />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          {/* Master push toggle */}
          <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
            <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider mb-3">Notifiche push</h4>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-[#2c3149] block">Notifiche push del browser</span>
                <span className="text-xs text-[#747995]">
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
          <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
            <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider mb-3">Categorie</h4>
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
                      <span className="text-sm text-[#2c3149] block">{item.label}</span>
                      <span className="text-xs text-[#747995]">{item.desc}</span>
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
                  {i < arr.length - 1 && <div className="h-px bg-[rgba(172,176,206,0.2)]" />}
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
        className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          showInfoSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">{t.info.title}</h2>
          <button onClick={() => setShowInfoSheet(false)} className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors">
            <CloseLg size={20} color="#595e78" />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
            <div>
              {/* Versione app */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                    <Info size={20} color="#615fe2" />
                  </div>
                  <span className="text-sm text-[#2c3149]">{t.info.appVersion}</span>
                </div>
                <span className="text-sm text-[#747995]">1.0.0</span>
              </div>
              <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
              {/* Novità */}
              <button className="w-full flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                    <Star size={20} color="#615fe2" />
                  </div>
                  <div>
                    <span className="text-sm text-[#2c3149] block">{t.info.whatsNew}</span>
                    <span className="text-xs text-[#747995]">{t.info.discoverFeatures}</span>
                  </div>
                </div>
                <ChevronRight size={16} color="#747995" />
              </button>
              <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
              {/* Seguici sui social */}
              <button className="w-full flex items-center justify-between py-2" onClick={() => setShowSocialSheet(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0">
                    <Globe size={20} color="#615fe2" />
                  </div>
                  <span className="text-sm text-[#2c3149]">{t.info.followSocial}</span>
                </div>
                <ChevronRight size={16} color="#747995" />
              </button>
            </div>
          </div>
          {/* Footer */}
          <p className="text-center text-xs text-[#747995] py-2 flex items-center justify-center gap-1">Made with <Heart size={12} color="#EF4444" filled /> in Italy</p>
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
        className={`fixed bottom-0 left-0 right-0 z-[70] max-w-lg mx-auto bg-white rounded-t-3xl transition-transform duration-300 ease-out ${
          showSocialSheet ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(172,176,206,0.3)]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(172,176,206,0.2)]">
          <h2 className="text-[#2c3149] font-bold text-lg">{t.info.followSocial}</h2>
          <button onClick={() => setShowSocialSheet(false)} className="p-1 rounded-full hover:bg-[rgba(172,176,206,0.08)] transition-colors">
            <svg className="w-5 h-5 text-[#595e78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-8 pt-4">
          <div className="bg-white rounded-2xl overflow-hidden border border-[rgba(172,176,206,0.3)]">
            {/* Instagram */}
            <a
              href="https://instagram.com/pathfinder.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(172,176,206,0.08)] transition-colors"
            >
              <div className="w-9 h-9 rounded-[22%] bg-[#E1306C]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#E1306C]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#2c3149] font-medium">Instagram</p>
                <p className="text-xs text-[#747995]">@pathfinder.app</p>
              </div>
              <svg className="w-4 h-4 text-[#acb0ce] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <div className="mx-4 h-px bg-[rgba(172,176,206,0.2)]" />
            {/* LinkedIn */}
            <a
              href="https://linkedin.com/company/pathfinder-app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(172,176,206,0.08)] transition-colors"
            >
              <div className="w-9 h-9 rounded-[22%] bg-[#0A66C2]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#2c3149] font-medium">LinkedIn</p>
                <p className="text-xs text-[#747995]">Pathfinder</p>
              </div>
              <svg className="w-4 h-4 text-[#acb0ce] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <div className="mx-4 h-px bg-[rgba(172,176,206,0.2)]" />
            {/* TikTok */}
            <a
              href="https://tiktok.com/@pathfinder.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(172,176,206,0.08)] transition-colors"
            >
              <div className="w-9 h-9 rounded-[22%] bg-[rgba(172,176,206,0.15)] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#2c3149]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#2c3149] font-medium">TikTok</p>
                <p className="text-xs text-[#747995]">@pathfinder.app</p>
              </div>
              <svg className="w-4 h-4 text-[#acb0ce] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <div className="mx-4 h-px bg-[rgba(172,176,206,0.2)]" />
            {/* X / Twitter */}
            <a
              href="https://x.com/pathfinderapp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(172,176,206,0.08)] transition-colors"
            >
              <div className="w-9 h-9 rounded-[22%] bg-[rgba(172,176,206,0.15)] flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-[#2c3149]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#2c3149] font-medium">X (Twitter)</p>
                <p className="text-xs text-[#747995]">@pathfinderapp</p>
              </div>
              <svg className="w-4 h-4 text-[#acb0ce] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 animate-slide-up border border-[rgba(172,176,206,0.3)]">
            <div className="w-14 h-14 rounded-full bg-[rgba(239,68,68,0.08)] flex items-center justify-center mx-auto">
              <TriangleWarning size={28} color="#EF4444" />
            </div>
            <div className="text-center">
              <h3 className="text-[#2c3149] font-bold text-lg mb-1">{t.privacy.deleteAccount}</h3>
              <p className="text-sm text-[#595e78]">{t.profile.deleteIrreversibleMsg}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingAccount}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-[#595e78] bg-[rgba(172,176,206,0.2)] hover:bg-[rgba(172,176,206,0.15)] transition-colors disabled:opacity-50"
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
      } ${on ? 'bg-[#615fe2]' : 'bg-[rgba(172,176,206,0.4)]'}`}
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
        value ? 'bg-[#615fe2]' : 'bg-[rgba(172,176,206,0.4)]'
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
        className="flex items-center gap-1.5 text-sm text-[#595e78] hover:text-[#2c3149] transition-colors"
      >
        <span>{LANGUAGE_DISPLAY_NAMES[language]}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[rgba(172,176,206,0.3)] rounded-xl overflow-hidden shadow-xl z-10 min-w-[120px]">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setLanguage(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                opt === language
                  ? 'text-[#615fe2] bg-[rgba(97,95,226,0.08)]'
                  : 'text-[#595e78] hover:bg-[rgba(172,176,206,0.08)] hover:text-[#2c3149]'
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
        className="flex items-center gap-1.5 text-sm text-[#595e78] hover:text-[#2c3149] transition-colors"
      >
        <span>{currentLabel}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[rgba(172,176,206,0.3)] rounded-xl overflow-hidden shadow-xl z-10 min-w-[120px]">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                onChange(opt.key);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                opt.key === value
                  ? 'text-[#615fe2] bg-[rgba(97,95,226,0.08)]'
                  : 'text-[#595e78] hover:bg-[rgba(172,176,206,0.08)] hover:text-[#2c3149]'
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
