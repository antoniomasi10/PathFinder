'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Bookmark,
  Briefcase,
  Award,
  Star,
  MapPin,
  ChevronDown,
  Download,
  ArrowLeft,
  ClockIcon as Clock,
  Users,
  BookOpen,
  ExternalLink,
  CalendarIcon as Calendar,
  Check,
  GraduationCap,
  TrendingUp,
  Target,
  FileText,
  Send,
} from '@/components/icons';
import { MOCK_COURSES, CourseDeadline, CourseRequirement } from '@/lib/mockCourses';
import { useSavedCourses } from '@/lib/savedCourses';
import { useSavedOpportunities } from '@/lib/savedOpportunities';
import api from '@/lib/api';
import AdmissionSimulator from '@/components/AdmissionSimulator';
import CourseComparison from '@/components/CourseComparison';
import LivingMap from '@/components/LivingMap';
import { isValidExternalUrl } from '@/lib/urlValidation';
import { toISODeadline } from '@/lib/dateUtils';
import { trackAction } from '@/lib/badges';

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const course = MOCK_COURSES.find((c) => c.id === Number(params.id));
  const [backendCourse, setBackendCourse] = useState<any>(null);
  const { savedIds, toggleSave } = useSavedCourses();
  const { savedIds: savedOppIds, toggleSave: toggleSaveOpp } = useSavedOpportunities();

  // Also fetch from backend API for real data sync
  useEffect(() => {
    if (params.id) {
      api.get(`/courses/${params.id}`).then((res) => setBackendCourse(res.data)).catch(() => {});
    }
  }, [params.id]);

  const courseId = String(params.id);
  const bookmarked = savedIds.has(courseId);
  const [checklist, setChecklist] = useState<Record<number, boolean>>({});
  const [calendarAdded, setCalendarAdded] = useState<Set<number>>(new Set());
  const [showSimulator, setShowSimulator] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [userProfile, setUserProfile] = useState<any>(null);
  const [checklistInitialized, setChecklistInitialized] = useState(false);

  const GPA_ORDER = ['GPA_18_20', 'GPA_21_24', 'GPA_25_27', 'GPA_28_30'];
  const ENG_ORDER = ['A2', 'B1_B2', 'C1', 'C2_PLUS'];

  function isRequirementMet(req: CourseRequirement, profile: any): boolean | null {
    if (req.type === 'english' && profile?.englishLevel && req.minEnglishLevel) {
      return ENG_ORDER.indexOf(profile.englishLevel) >= ENG_ORDER.indexOf(req.minEnglishLevel);
    }
    if (req.type === 'gpa' && profile?.gpa && req.minGpa) {
      return GPA_ORDER.indexOf(profile.gpa) >= GPA_ORDER.indexOf(req.minGpa);
    }
    return null;
  }

  useEffect(() => {
    api.get('/profile/me').then((res) => setUserProfile(res.data)).catch((err) => {
      console.error('Failed to fetch user profile:', err);
    });
  }, []);

  useEffect(() => {
    if (!course || checklistInitialized) return;
    const storageKey = `checklist-${params.id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setChecklist(parsed);
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
      setChecklistInitialized(true);
      return;
    }
    if (userProfile) {
      const initial: Record<number, boolean> = {};
      course.requirements.forEach((req, i) => {
        const met = isRequirementMet(req, userProfile);
        if (met === true) initial[i] = true;
      });
      setChecklist(initial);
      setChecklistInitialized(true);
    }
  }, [course, userProfile, checklistInitialized, params.id]);

  useEffect(() => {
    const stored = localStorage.getItem(`calendar-added-${params.id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCalendarAdded(new Set(parsed));
        }
      } catch {
        localStorage.removeItem(`calendar-added-${params.id}`);
      }
    }
  }, [params.id]);

  const addToCalendar = (deadline: CourseDeadline, index: number) => {
    // Parse Italian date string to ICS format
    const monthMap: Record<string, string> = {
      'Gen': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'Mag': '05', 'Giu': '06', 'Lug': '07', 'Ago': '08',
      'Set': '09', 'Ott': '10', 'Nov': '11', 'Dic': '12',
    };

    let dtStart = '';
    // Try to match "7 Lug 2025" or "30 Ott 2025"
    const fullMatch = deadline.date.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
    // Try to match "Mar 2026" (month + year only)
    const monthYearMatch = deadline.date.match(/^(\w{3})\s+(\d{4})$/);

    if (fullMatch) {
      const day = fullMatch[1].padStart(2, '0');
      const month = monthMap[fullMatch[2]] || '01';
      const year = fullMatch[3];
      dtStart = `${year}${month}${day}T090000Z`;
    } else if (monthYearMatch) {
      const month = monthMap[monthYearMatch[1]] || '01';
      const year = monthYearMatch[2];
      dtStart = `${year}${month}01T090000Z`;
    } else {
      // For date ranges like "9 Ott - 5 Nov 2025", use the first date
      const rangeMatch = deadline.date.match(/(\d{1,2})\s+(\w{3})/);
      const yearMatch = deadline.date.match(/(\d{4})/);
      if (rangeMatch && yearMatch) {
        const day = rangeMatch[1].padStart(2, '0');
        const month = monthMap[rangeMatch[2]] || '01';
        dtStart = `${yearMatch[1]}${month}${day}T090000Z`;
      } else {
        dtStart = '20260101T090000Z';
      }
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PathFinder//Deadline//IT',
      'BEGIN:VEVENT',
      `DTSTART:${dtStart}`,
      `SUMMARY:${deadline.label} - ${course!.title}`,
      `LOCATION:${course!.university}`,
      `DESCRIPTION:${deadline.label} - ${course!.title} (${course!.university})`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deadline.label.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const newSet = new Set(calendarAdded);
    newSet.add(index);
    setCalendarAdded(newSet);
    localStorage.setItem(`calendar-added-${params.id}`, JSON.stringify([...newSet]));
  };

  // If no mock course but backend data exists, show a backend-powered detail view
  if (!course && backendCourse) {
    return (
      <div className="min-h-screen bg-[#0A0E1A]">
        {/* Header */}
        <div className="sticky top-0 z-20 px-4 pt-4 pb-3 flex items-center justify-between" style={{ backgroundColor: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(12px)' }}>
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(28,47,67,0.8)' }}>
            <ArrowLeft size={20} className="text-white" />
          </button>
          <button
            onClick={() => {
              toggleSave({ id: courseId, name: backendCourse.name, university: backendCourse.university });
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(28,47,67,0.8)' }}
          >
            <Bookmark size={20} filled={bookmarked} className={bookmarked ? 'text-[#4A9EFF]' : 'text-white'} />
          </button>
        </div>

        <div className="px-4 pb-32 space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">{backendCourse.name}</h1>
            <p className="text-[#4A9EFF] font-medium">{backendCourse.university?.name}</p>
            {backendCourse.university?.city && (
              <p className="text-[#64748B] text-sm mt-1">{backendCourse.university.city}</p>
            )}
          </div>

          {/* Info pills */}
          <div className="flex flex-wrap gap-2">
            {backendCourse.type && (
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#1E293B] text-[#94A3B8]">
                {backendCourse.type === 'TRIENNALE' ? 'Triennale' : backendCourse.type === 'MAGISTRALE' ? 'Magistrale' : 'Ciclo Unico'}
              </span>
            )}
            {backendCourse.languageOfInstruction && (
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#1E293B] text-[#94A3B8]">
                {backendCourse.languageOfInstruction}
              </span>
            )}
            {backendCourse.programDuration && (
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#1E293B] text-[#94A3B8]">
                {backendCourse.programDuration}
              </span>
            )}
            {backendCourse.internationalOpportunities && (
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#4F46E5]/20 text-[#4F46E5]">
                Opportunità internazionali
              </span>
            )}
          </div>

          {/* Stats */}
          {(backendCourse.employmentRate || backendCourse.avgSalaryAfterGraduation) && (
            <div className="grid grid-cols-2 gap-3">
              {backendCourse.employmentRate && (
                <div className="bg-[#161B22] rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-[#4A9EFF]">{Math.round(backendCourse.employmentRate * 100)}%</p>
                  <p className="text-xs text-[#64748B] mt-1">Tasso occupazione</p>
                </div>
              )}
              {backendCourse.avgSalaryAfterGraduation && (
                <div className="bg-[#161B22] rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-[#22C55E]">{backendCourse.avgSalaryAfterGraduation.toLocaleString('it-IT')}€</p>
                  <p className="text-xs text-[#64748B] mt-1">Stipendio medio</p>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {backendCourse.tags?.length > 0 && (
            <div>
              <h3 className="text-white font-semibold mb-3">Aree tematiche</h3>
              <div className="flex flex-wrap gap-2">
                {backendCourse.tags.map((tag: string) => (
                  <span key={tag} className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#1E293B] text-[#94A3B8]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {backendCourse.field && (
            <div className="bg-[#161B22] rounded-2xl p-4">
              <h3 className="text-white font-semibold mb-2">Campo di studio</h3>
              <p className="text-[#94A3B8] text-sm">{backendCourse.field}</p>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 z-30" style={{ backgroundColor: '#0D1117', borderTop: '1px solid #2A3F54' }}>
          <div className="flex gap-3 max-w-md mx-auto">
            <button
              onClick={() => {
                toggleSave({ id: courseId, name: backendCourse.name, university: backendCourse.university });
              }}
              className="flex-1 py-3 rounded-xl font-semibold shadow-md transition-colors"
              style={{
                backgroundColor: bookmarked ? '#2A3F54' : '#4A9EFF',
                color: bookmarked ? '#4A9EFF' : 'white',
                border: bookmarked ? '1px solid #4A9EFF' : 'none',
              }}
            >
              {bookmarked ? '✓ Salvato' : '+ Salva corso'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Neither mock nor backend course found yet — show loading
  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-[#8B8FA8] text-base">Caricamento corso...</div>
      </div>
    );
  }

  const toggleChecklistItem = (index: number) => {
    setChecklist((prev) => {
      const updated = { ...prev, [index]: !prev[index] };
      localStorage.setItem(`checklist-${params.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const completedItems = Object.values(checklist).filter(Boolean).length;
  const totalItems = course.requirements.length;
  const autoVerifiableCount = course.requirements.filter((r) => r.type === 'english' || r.type === 'gpa').length;
  const autoMetCount = course.requirements.filter((r, i) =>
    (r.type === 'english' || r.type === 'gpa') && checklist[i]
  ).length;


  const cityImages: Record<string, string> = {
    'Milano': '/cities/milano.jpg',
    'Roma': '/cities/roma.jpg',
    'Bologna': '/cities/bologna.jpg',
    'Torino': '/cities/torino.jpg',
    'Napoli': '/cities/napoli.jpg',
    'Firenze': '/cities/firenze.jpg',
    'Padova': '/cities/padova.jpg',
    'Pisa': '/cities/pisa.jpg',
  };
  const heroImage = cityImages[course.city] || '/cities/default.jpg';

  return (
    <div style={{ backgroundColor: '#0D1117' }} className="min-h-screen pb-48">
      {/* Hero image + header overlay */}
      <div className="relative h-[200px] md:h-[280px]">
        {/* City panorama */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Gradient overlay bottom */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(13,17,23,0.4) 0%, rgba(13,17,23,0) 40%, rgba(13,17,23,0.85) 85%, #0D1117 100%)',
          }}
        />
        {/* Header navigazione (overlay) */}
        <div className="relative px-5 pt-5 pb-2 flex items-center justify-between z-10">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(28,47,67,0.8)', backdropFilter: 'blur(8px)' }}
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <button
            onClick={() => {
              const name = backendCourse?.name || course?.title || '';
              const uni = backendCourse?.university || (course ? { name: course.university, city: course.city } : undefined);
              toggleSave({ id: courseId, name, university: uni });
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(28,47,67,0.8)', backdropFilter: 'blur(8px)' }}
          >
            <Bookmark
              className={`w-5 h-5 ${bookmarked ? 'fill-[#4A9EFF] text-[#4A9EFF]' : 'text-white'}`}
            />
          </button>
        </div>
      </div>

      {/* Titolo e info corso */}
      <div className="px-5 pt-3 pb-6">
        <h1 className="text-2xl font-bold text-white leading-tight mb-2">
          {course.title}
        </h1>
        <p style={{ fontSize: '14px', color: '#8B8FA8' }} className="mb-3">
          {course.university} — {course.city}
        </p>
        {course.officialUrl && isValidExternalUrl(course.officialUrl) && (
          <a
            href={course.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: '#4A9EFF' }}
          >
            <ExternalLink size={14} />
            Sito ufficiale del corso
          </a>
        )}
      </div>

      {/* Description */}
      <div className="px-5 pb-6">
        <p style={{ fontSize: '14px', color: '#D0D4DC', lineHeight: '1.6' }}>
          {course.fullDescription}
        </p>
      </div>

      {/* Key Statistics */}
      <div className="px-5 pb-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Briefcase size={24} color="#4A9EFF" />}
            value={course.employmentRate}
            label="Tasso occupazione"
          />
          <StatCard
            icon={<Award size={24} color="#4A9EFF" />}
            value={course.ranking}
            label="Classifica"
          />
          <StatCard
            icon={<Star size={24} color="#4A9EFF" />}
            value={course.satisfaction}
            label="Soddisfazione"
          />
        </div>
      </div>

      {/* Social Proof Carousel */}
      <SocialProofCarousel socialProof={course.socialProof} />

      {/* Course Info Pills */}
      <div className="px-5 pb-6">
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
        >
          <h2 className="text-lg font-bold text-white mb-4">Info corso</h2>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={<Clock size={16} color="#4A9EFF" />} label="Durata" value={course.duration} />
            <InfoRow icon={<Users size={16} color="#4A9EFF" />} label="Posti" value={course.spots ? String(course.spots) : 'Su requisiti'} />
            <InfoRow icon={<BookOpen size={16} color="#4A9EFF" />} label="Lingua" value={course.language} />
            <InfoRow icon={<MapPin size={16} color="#4A9EFF" />} label="Modalità" value={course.mode} />
          </div>
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid #2A3F54' }}>
            <InfoRow icon={<span style={{ color: '#4A9EFF', fontSize: '14px', fontWeight: 'bold' }}>€</span>} label="Costo" value={course.cost} />
          </div>
        </div>
      </div>

      {/* Subjects — Accordion */}
      <div className="px-5 pb-6">
        <AccordionSection title="Materie principali" count={course.subjects.length}>
          <div className="flex flex-wrap gap-2">
            {course.subjects.map((subject) => (
              <span
                key={subject}
                className="px-3 py-1.5 rounded-full text-sm"
                style={{ backgroundColor: '#0D1117', color: '#D0D4DC', border: '1px solid #2A3F54' }}
              >
                {subject}
              </span>
            ))}
          </div>
        </AccordionSection>
      </div>

      {/* Career Outlets — Accordion */}
      <div className="px-5 pb-6">
        <AccordionSection title="Sbocchi professionali" count={course.careerOutlets.length}>
          <div className="space-y-2">
            {course.careerOutlets.map((career) => (
              <div key={career} className="flex items-center gap-3">
                <Briefcase size={16} color="#4A9EFF" />
                <span style={{ fontSize: '14px', color: '#D0D4DC' }}>{career}</span>
              </div>
            ))}
          </div>
        </AccordionSection>
      </div>

      {/* Admission Simulator CTA */}
      <div className="px-5 pb-6">
        <button
          onClick={() => { setShowSimulator(true); }}
          className="w-full rounded-2xl p-5 text-left transition-transform active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #1C2F43 0%, #162232 100%)',
            border: '1px solid #2A3F54',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4A9EFF, #7C3AED)' }}
            >
              <GraduationCap size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-white mb-0.5">Simula la tua ammissione</h2>
              <p className="text-xs" style={{ color: '#8B8FA8' }}>
                Calcola la tua probabilità in 4 semplici step
              </p>
            </div>
            <ChevronDown size={20} color="#4A9EFF" className="-rotate-90" />
          </div>
        </button>
      </div>

      {showSimulator && (
        <AdmissionSimulator course={course} onClose={() => setShowSimulator(false)} />
      )}

      {showComparison && (
        <CourseComparison course={course} onClose={() => setShowComparison(false)} />
      )}

      {/* Application Checklist */}
      <div className="px-5 pb-6">
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Checklist iscrizione</h2>
            <span className="text-sm font-semibold" style={{ color: '#4A9EFF' }}>
              {completedItems}/{totalItems}
            </span>
          </div>

          {userProfile && autoVerifiableCount > 0 && (
            <p className="text-xs mb-3" style={{ color: autoMetCount === autoVerifiableCount ? '#3DD68C' : '#F59E0B' }}>
              Possiedi {autoMetCount} di {autoVerifiableCount} requisiti verificabili dal tuo profilo
            </p>
          )}

          <div className="space-y-3 mb-4">
            {course.requirements.map((req, index) => (
              <ChecklistItem
                key={req.label}
                checked={!!checklist[index]}
                onChange={() => toggleChecklistItem(index)}
                label={req.label}
              />
            ))}
          </div>

          <div
            className="h-2 rounded-full overflow-hidden mb-4"
            style={{ backgroundColor: '#0D1117' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%`,
                backgroundColor: '#4A9EFF',
              }}
            />
          </div>

          <button
            onClick={() => { const url = course.requirementsUrl || course.officialUrl; if (isValidExternalUrl(url)) window.open(url, '_blank', 'noopener,noreferrer'); }}
            className="w-full py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            style={{ border: '1px solid #2A3F54', color: '#D0D4DC' }}
          >
            <Download size={16} />
            Scarica requisiti ufficiali
          </button>
        </div>
      </div>

      {/* Scadenze - Card orizzontali */}
      <div className="pb-6">
        <h2 className="text-lg font-bold text-white mb-4 px-5">Scadenze</h2>
        <div
          className="flex gap-3 overflow-x-auto px-5 hide-scrollbar"
          style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
        >
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
          {course.deadlines.map((deadline, index) => {
            const isAdded = calendarAdded.has(index);
            const isPast = deadline.status === 'past';
            const isImminent = deadline.status === 'upcoming';
            const deadlineOppId = `course-deadline-${courseId}-${index}`;
            const isSavedAsOpp = savedOppIds.has(deadlineOppId);
            const typeColors: Record<string, { bg: string; accent: string }> = {
              apertura: { bg: '#166534', accent: '#22C55E' },
              scadenza: { bg: '#92400E', accent: '#F59E0B' },
              test: { bg: '#991B1B', accent: '#EF4444' },
              risultati: { bg: '#1E3A5F', accent: '#4A9EFF' },
            };
            const colors = deadline.type ? typeColors[deadline.type] : typeColors.risultati;

            return (
              <div
                key={index}
                className="flex-shrink-0 rounded-2xl p-4 flex flex-col justify-between"
                style={{
                  width: '200px',
                  height: '120px',
                  backgroundColor: isPast ? '#2A3F54' : colors.bg,
                  opacity: isPast ? 0.5 : 1,
                  scrollSnapAlign: 'start',
                  border: `1px solid ${isPast ? '#3A4F64' : colors.accent}30`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white leading-tight">{deadline.date}</p>
                    {isImminent && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full animate-pulse"
                        style={{ backgroundColor: `${colors.accent}30`, color: colors.accent }}
                      >
                        Imminente
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1 leading-tight" style={{ color: isPast ? '#8B8FA8' : '#D0D4DC' }}>
                    {deadline.label}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { if (!isAdded) { trackAction('deadlines_added'); addToCalendar(deadline, index); } }}
                    className="flex items-center gap-1.5 transition-colors"
                    style={{ color: isAdded ? '#22C55E' : '#D0D4DC' }}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium">Aggiunta</span>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium">Aggiungi</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => toggleSaveOpp(deadlineOppId, {
                      title: `${deadline.label} — ${course!.title}`,
                      type: 'CORSO',
                      deadline: toISODeadline(deadline.date),
                      company: course!.university,
                    })}
                    className="transition-colors"
                    style={{ color: isSavedAsOpp ? '#4F46E5' : '#D0D4DC' }}
                  >
                    <Bookmark className="w-3.5 h-3.5" filled={isSavedAsOpp} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vivi qui — Mappa interattiva */}
      <div className="px-5 pb-6">
        <LivingMap city={course.city} />
      </div>

      {/* Disclaimer */}
      <div className="px-5 pb-6">
        <p className="text-center" style={{ fontSize: '12px', color: '#8B8FA8', lineHeight: '1.5' }}>
          Informazioni aggiornate a Marzo 2026 da siti ufficiali delle università e AlmaLaurea.
          Per dettagli sempre aggiornati, visita il{' '}
          {isValidExternalUrl(course.officialUrl) ? (
            <a
              href={course.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#4A9EFF', textDecoration: 'underline' }}
            >
              sito ufficiale del corso
            </a>
          ) : (
            <span style={{ color: '#4A9EFF' }}>sito ufficiale del corso</span>
          )}.
        </p>
      </div>

      {/* Fixed Bottom CTA */}
      <div
        className="fixed bottom-[48px] left-0 right-0 px-5 py-4"
        style={{
          backgroundColor: '#0D1117',
          borderTop: '1px solid #2A3F54',
        }}
      >
        <div className="flex gap-3 max-w-md mx-auto">
          <button
            onClick={() => {
              const name = backendCourse?.name || course?.title || '';
              const uni = backendCourse?.university || (course ? { name: course.university, city: course.city } : undefined);
              toggleSave({ id: courseId, name, university: uni });
            }}
            className="flex-1 py-3 rounded-xl font-semibold shadow-md transition-colors"
            style={{
              backgroundColor: bookmarked ? '#2A3F54' : '#4A9EFF',
              color: bookmarked ? '#4A9EFF' : 'white',
              border: bookmarked ? '1px solid #4A9EFF' : 'none',
            }}
          >
            {bookmarked ? 'Salvato' : 'Salva corso'}
          </button>
          <button
            onClick={() => { setShowComparison(true); }}
            className="flex-1 py-3 rounded-xl font-semibold transition-colors"
            style={{ border: '2px solid #4A9EFF', color: '#4A9EFF' }}
          >
            Confronta
          </button>
        </div>
        <button
          onClick={() => { if (isValidExternalUrl(course.officialUrl)) window.open(course.officialUrl, '_blank', 'noopener,noreferrer'); }}
          className="w-full py-2.5 rounded-xl font-medium transition-colors mt-2 max-w-md mx-auto flex items-center justify-center gap-2"
          style={{ border: '1px solid #2A3F54', color: '#D0D4DC' }}
        >
          Candidati ora
          <ExternalLink size={16} />
        </button>
      </div>
    </div>
  );
}

/* Supporting Components */

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col items-center text-center"
      style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
    >
      <div className="mb-2">{icon}</div>
      <div className="text-xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-xs leading-tight" style={{ color: '#8B8FA8' }}>
        {label}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-sm" style={{ color: '#8B8FA8' }}>
        {label}:
      </span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

function ChecklistItem({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        className="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all"
        style={{
          backgroundColor: checked ? '#4A9EFF' : 'transparent',
          borderColor: checked ? '#4A9EFF' : '#2A3F54',
        }}
      >
        {checked && (
          <Check size={16} color="white" strokeWidth={2.5} />
        )}
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        className="text-sm transition-colors"
        style={{ color: checked ? '#8B8FA8' : '#D0D4DC', textDecoration: checked ? 'line-through' : 'none' }}
      >
        {label}
      </span>
    </label>
  );
}


function AccordionSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [open, children]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 cursor-pointer transition-colors hover:bg-[#243344]"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {count !== undefined && (
            <span className="text-sm" style={{ color: '#8B8FA8' }}>({count})</span>
          )}
        </div>
        <ChevronDown
          size={20}
          color="#8B8FA8"
          className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        style={{
          maxHeight: open ? `${contentHeight}px` : '0px',
          overflow: 'hidden',
          transition: open ? 'max-height 300ms ease-out' : 'max-height 250ms ease-in',
        }}
      >
        <div ref={contentRef} className="px-5 pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function SocialProofCarousel({ socialProof }: { socialProof: { savedCount: number; simulatorRate: number; requirementsRate: number; appliedLastMonth: number } }) {
  const slides = [
    { icon: <Users size={24} color="#6C63FF" />, value: String(socialProof.savedCount), label: "studenti hanno salvato\nquesto corso" },
    { icon: <Target size={24} color="#3DD68C" />, value: `${socialProof.simulatorRate}%`, label: "ha provato il simulatore\nammissione" },
    { icon: <FileText size={24} color="#F59E0B" />, value: `${socialProof.requirementsRate}%`, label: "ha consultato\ni requisiti ufficiali" },
    { icon: <Send size={24} color="#4A9EFF" />, value: String(socialProof.appliedLastMonth), label: "candidature\nnell'ultimo mese" },
  ];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isPaused = useRef(false);
  const total = slides.length;

  const scrollToSlide = (idx: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const child = container.children[idx] as HTMLElement | undefined;
    if (!child) return;
    const containerRect = container.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();
    const targetScrollLeft =
      container.scrollLeft +
      (childRect.left - containerRect.left) -
      (containerRect.width - childRect.width) / 2;
    container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
  };

  // Auto-scroll
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % total;
        scrollToSlide(next);
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [total]);

  // Detect manual scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let timeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      isPaused.current = true;
      clearTimeout(timeout);
      timeout = setTimeout(() => { isPaused.current = false; }, 4000);

      const scrollLeft = el.scrollLeft;
      const cardWidth = el.children[0]?.clientWidth || 1;
      const gap = 12;
      const idx = Math.round(scrollLeft / (cardWidth + gap));
      setActiveIndex(Math.min(idx, total - 1));
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => { el.removeEventListener('scroll', handleScroll); clearTimeout(timeout); };
  }, [total]);

  const goTo = (idx: number) => {
    setActiveIndex(idx);
    scrollToSlide(idx);
    isPaused.current = true;
    setTimeout(() => { isPaused.current = false; }, 4000);
  };

  return (
    <div className="pb-6">
      <div className="flex items-center gap-2 mb-4 px-5">
        <TrendingUp size={20} color="#4A9EFF" />
        <h2 className="text-lg font-bold text-white">Interesse per questo corso</h2>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-5 hide-scrollbar"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        onMouseEnter={() => { isPaused.current = true; }}
        onMouseLeave={() => { isPaused.current = false; }}
      >
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        {slides.map((slide, i) => (
          <div
            key={i}
            className="flex-shrink-0 flex flex-col items-center justify-center text-center rounded-2xl"
            style={{
              width: '220px',
              height: '165px',
              backgroundColor: '#1C2F43',
              border: i === activeIndex ? '2px solid #4A9EFF40' : '1px solid #2A3F54',
              scrollSnapAlign: 'center',
              padding: '24px',
              transition: 'border-color 0.3s, transform 0.3s',
              transform: i === activeIndex ? 'scale(1)' : 'scale(0.95)',
            }}
          >
            <div className="mb-2">{slide.icon}</div>
            <span className="text-3xl font-bold mb-1.5" style={{ color: '#FFFFFF' }}>{slide.value}</span>
            <span className="text-xs leading-snug whitespace-pre-line" style={{ color: '#8B8FA8', maxWidth: '180px' }}>{slide.label}</span>
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2.5 mt-4">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Vai a statistica ${i + 1}`}
            style={{
              width: i === activeIndex ? '10px' : '8px',
              height: i === activeIndex ? '10px' : '8px',
              borderRadius: '50%',
              backgroundColor: i === activeIndex ? '#6C63FF' : '#4A4A6A',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function InfoChip({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg p-2 text-center" style={{ backgroundColor: '#0D1117' }}>
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xs mb-0.5" style={{ color: '#8B8FA8' }}>
        {label}
      </div>
      <div className="text-xs font-semibold text-white">{value}</div>
    </div>
  );
}
