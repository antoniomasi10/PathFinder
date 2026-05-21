'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useSavedOpportunities } from '@/lib/savedOpportunities';
import { useSavedCourses } from '@/lib/savedCourses';
import { getSavedSimulations, SavedSimulation } from '@/components/AdmissionSimulator';
import { useLanguage, Language, LANGUAGE_DISPLAY_NAMES, getSkillLabel, normalizePassionToKey } from '@/lib/language';
import { usePrivacy } from '@/lib/privacy';
import { isValidImageUrl, isValidExternalUrl } from '@/lib/urlValidation';
import { getOpportunityTypeColor } from '@/lib/opportunityColors';
import {
  EyeOff, Bookmark, ChevronDown, ChevronRight, CalendarIcon,
  Bell, Globe, ShieldCheck, CircleHelp, Info, Camera,
  Briefcase, GraduationCap, Plane, Rocket, BookOpen,
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

export default function ProfilePage() {
  const { logout, setUser, user } = useAuth();
  const router = useRouter();
  const { savedOpps, toggleSave } = useSavedOpportunities();
  const { savedCourses } = useSavedCourses();
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const { language, setLanguage, t } = useLanguage();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const { publicProfile } = usePrivacy();
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [savedTab, setSavedTab] = useState<'opportunities' | 'universities'>('opportunities');
  const [oppSort, setOppSort] = useState<'recenti' | 'scadenza'>('recenti');
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const expandedCardRef = useRef<HTMLDivElement | null>(null);
  const savedScrollRef = useRef<HTMLDivElement | null>(null);
  const savedSectionRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const { isLoading: loading, isError: profileError } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const [profileRes, friendsRes] = await Promise.all([
        api.get('/profile/me'),
        api.get('/friends').catch(() => ({ data: [] })),
      ]);
      const rawPassions: string[] = profileRes.data.profile?.passions || [];
      const normalizedPassions = rawPassions.map(normalizePassionToKey);
      const profileData = profileRes.data;
      if (profileData.profile) profileData.profile.passions = normalizedPassions;
      if (normalizedPassions.some((k: string, i: number) => k !== rawPassions[i])) {
        api.patch('/profile/me', { passions: normalizedPassions }).catch(() => {});
      }
      setProfile(profileData);
      setFriends(friendsRes.data);
      return profileData;
    },
  });

  useEffect(() => {
    setSimulations(getSavedSimulations());
  }, []);

  useEffect(() => {
    api.get('/notifications/preferences').then(({ data }) => {
      setNotifEnabled(data.pushEnabled ?? true);
    }).catch(() => {});
  }, []);

  const handleNotifToggle = (v: boolean) => {
    setNotifEnabled(v);
    api.put('/notifications/preferences', { pushEnabled: v }).catch(() => setNotifEnabled(!v));
  };

  const handleLogout = () => {
    logout();
  };

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

  if (profileError || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6" style={{ backgroundColor: '#fbf8ff' }}>
        <p className="text-[#595e78] text-sm text-center">Impossibile caricare il profilo. Riprova.</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['profile', 'me'] })}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#615fe2]"
        >
          Riprova
        </button>
      </div>
    );
  }

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
      try {
        await api.patch('/profile/me', { avatar: base64 });
        if (user) setUser({ ...user, avatar: base64 });
      } catch {
        setAvatarPreview(null);
      }
    };
    reader.readAsDataURL(file);
  };

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
            border: '5px solid white',
            boxShadow: '0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative group"
              style={{ width: '100%', height: '100%', display: 'block', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
              aria-label="Cambia foto profilo"
            >
              {currentAvatar && isValidImageUrl(currentAvatar) ? (
                <img src={currentAvatar} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontWeight: 700, fontSize: 32, fontFamily: 'var(--font-plus-jakarta)' }}>{initials}</span>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <Camera size={26} color="white" />
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
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
            onClick={() => router.push('/profile/edit')}
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
          padding: '21px 0',
          boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <button
            onClick={() => router.push('/profile/pathmates')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 17, padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
            className="active:opacity-75"
          >
            <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 700, fontSize: 24, lineHeight: '32px', color: '#4a4bd7' }}>
              {friends.length}
            </span>
            <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 500, fontSize: 14, lineHeight: '20px', color: '#595e78', textTransform: 'uppercase', letterSpacing: '0.7px', textAlign: 'center', width: '100%' }}>
              PERSONE CONNESSE
            </span>
          </button>
          <div style={{ width: 1, height: 75, backgroundColor: '#acb0ce', flexShrink: 0 }} />
          <button
            onClick={() => router.push('/profile/saved-opportunities')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 17, padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
            className="active:opacity-75"
          >
            <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 700, fontSize: 24, lineHeight: '32px', color: '#4a4bd7' }}>
              {savedOpps.length}
            </span>
            <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 500, fontSize: 14, lineHeight: '20px', color: '#595e78', textTransform: 'uppercase', letterSpacing: '0.7px', textAlign: 'center', width: '100%' }}>
              OPPORTUNITÀ SALVATE
            </span>
          </button>
        </div>


        {/* Divider before settings */}
        <div style={{ height: 1, backgroundColor: 'rgba(172,176,206,0.3)', margin: '32px 24px 0' }} />

        {/* Settings section */}
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

          <div className="space-y-3">
              {/* Unified Preferences */}
              <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)] shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
                <h4 className="text-sm font-semibold text-[#2c3149] mb-3">{t.profile.preferences}</h4>
                <div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center">
                        <Bell size={20} color="#615fe2" />
                      </div>
                      <span className="text-sm text-[#2c3149]">{t.profile.notifications}</span>
                    </div>
                    <button
                      onClick={() => handleNotifToggle(!notifEnabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${notifEnabled ? 'bg-[#615fe2]' : 'bg-[rgba(172,176,206,0.4)]'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${notifEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
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
                  { label: t.profile.securityPrivacy, icon: <ShieldCheck size={20} color="#615fe2" />, onPress: () => router.push('/settings/security') },
                  { label: t.profile.helpSupport, icon: <CircleHelp size={20} color="#615fe2" />, onPress: () => router.push('/settings/help') },
                  { label: t.profile.info, icon: <Info size={20} color="#615fe2" />, onPress: () => router.push('/settings/info') },
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
      </div>
      </div>  {/* end main scrollable */}

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
        disabled
        className="flex items-center gap-1.5 text-sm text-[#595e78] opacity-40 cursor-not-allowed"
      >
        <span>{LANGUAGE_DISPLAY_NAMES[language]}</span>
        <ChevronDown size={16} />
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

