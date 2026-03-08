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
  Clock,
  Users,
  BookOpen,
  ExternalLink,
  Calendar,
  Check,
  GraduationCap,
  TrendingUp,
  Target,
  FileText,
  Send,
} from 'lucide-react';
import { MOCK_COURSES, CourseDeadline, CourseRequirement } from '@/lib/mockCourses';
import { useSavedCourses } from '@/lib/savedCourses';
import api from '@/lib/api';
import AdmissionSimulator from '@/components/AdmissionSimulator';
import CourseComparison from '@/components/CourseComparison';
import LivingMap from '@/components/LivingMap';
import { useBadges } from '@/components/BadgeProvider';

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const course = MOCK_COURSES.find((c) => c.id === Number(params.id));
  const { savedIds, toggleSave } = useSavedCourses();
  const { track } = useBadges();

  const bookmarked = course ? savedIds.has(course.id) : false;
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
    api.get('/profile/me').then((res) => setUserProfile(res.data)).catch(() => {});
  }, []);

  // Track course view for badges
  useEffect(() => {
    if (course) track('courses_viewed');
  }, [course, track]);

  useEffect(() => {
    if (!course || checklistInitialized) return;
    const storageKey = `checklist-${params.id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setChecklist(JSON.parse(stored));
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
      setCalendarAdded(new Set(JSON.parse(stored)));
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

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: '#8B8FA8', fontSize: '16px' }}>Corso non trovato</p>
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


  return (
    <div style={{ backgroundColor: '#0D1117' }} className="min-h-screen pb-48">
      {/* Header navigazione */}
      <div className="px-5 pt-5 pb-2 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#1C2F43' }}
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() => toggleSave({ id: course.id, title: course.title, university: course.university, city: course.city })}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#1C2F43' }}
        >
          <Bookmark
            className={`w-5 h-5 ${bookmarked ? 'fill-[#4A9EFF] text-[#4A9EFF]' : 'text-white'}`}
          />
        </button>
      </div>

      {/* Titolo e info corso */}
      <div className="px-5 pt-3 pb-6">
        <h1 className="text-2xl font-bold text-white leading-tight mb-2">
          {course.title}
        </h1>
        <p style={{ fontSize: '14px', color: '#8B8FA8' }} className="mb-3">
          {course.university} — {course.city}
        </p>
        <a
          href={course.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: '#4A9EFF' }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Sito ufficiale del corso
        </a>
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
            icon={<Briefcase className="w-6 h-6" style={{ color: '#4A9EFF' }} />}
            value={course.employmentRate}
            label="Tasso occupazione"
          />
          <StatCard
            icon={<Award className="w-6 h-6" style={{ color: '#4A9EFF' }} />}
            value={course.ranking}
            label="Classifica"
          />
          <StatCard
            icon={<Star className="w-6 h-6" style={{ color: '#4A9EFF' }} />}
            value={course.satisfaction}
            label="Soddisfazione"
          />
        </div>
      </div>

      {/* Social Proof */}
      <div className="px-5 pb-6">
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5" style={{ color: '#4A9EFF' }} />
            <h2 className="text-lg font-bold text-white">Interesse per questo corso</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SocialProofStat
              icon={<Users className="w-5 h-5" style={{ color: '#6C63FF' }} />}
              value={course.socialProof.savedCount}
              label="studenti l'hanno salvato"
            />
            <SocialProofStat
              icon={<Target className="w-5 h-5" style={{ color: '#3DD68C' }} />}
              value={`${course.socialProof.simulatorRate}%`}
              label="ha provato il simulatore"
            />
            <SocialProofStat
              icon={<FileText className="w-5 h-5" style={{ color: '#F59E0B' }} />}
              value={`${course.socialProof.requirementsRate}%`}
              label="ha consultato i requisiti"
            />
            <SocialProofStat
              icon={<Send className="w-5 h-5" style={{ color: '#4A9EFF' }} />}
              value={course.socialProof.appliedLastMonth}
              label="candidature questo mese"
            />
          </div>
        </div>
      </div>

      {/* Course Info Pills */}
      <div className="px-5 pb-6">
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
        >
          <h2 className="text-lg font-bold text-white mb-4">Info corso</h2>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={<Clock className="w-4 h-4" style={{ color: '#4A9EFF' }} />} label="Durata" value={course.duration} />
            <InfoRow icon={<Users className="w-4 h-4" style={{ color: '#4A9EFF' }} />} label="Posti" value={course.spots ? String(course.spots) : 'Su requisiti'} />
            <InfoRow icon={<BookOpen className="w-4 h-4" style={{ color: '#4A9EFF' }} />} label="Lingua" value={course.language} />
            <InfoRow icon={<MapPin className="w-4 h-4" style={{ color: '#4A9EFF' }} />} label="Modalità" value={course.mode} />
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
                <Briefcase className="w-4 h-4" style={{ color: '#4A9EFF' }} />
                <span style={{ fontSize: '14px', color: '#D0D4DC' }}>{career}</span>
              </div>
            ))}
          </div>
        </AccordionSection>
      </div>

      {/* Admission Simulator CTA */}
      <div className="px-5 pb-6">
        <button
          onClick={() => { track('simulations_done'); setShowSimulator(true); }}
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
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-white mb-0.5">Simula la tua ammissione</h2>
              <p className="text-xs" style={{ color: '#8B8FA8' }}>
                Calcola la tua probabilità in 4 semplici step
              </p>
            </div>
            <ChevronDown className="w-5 h-5 -rotate-90" style={{ color: '#4A9EFF' }} />
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
            onClick={() => { track('requirements_viewed'); window.open(course.requirementsUrl || course.officialUrl, '_blank', 'noopener,noreferrer'); }}
            className="w-full py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            style={{ border: '1px solid #2A3F54', color: '#D0D4DC' }}
          >
            <Download className="w-4 h-4" />
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
                <button
                  onClick={() => { if (!isAdded) { track('deadlines_added'); addToCalendar(deadline, index); } }}
                  className="flex items-center gap-1.5 self-start transition-colors"
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
          <a
            href={course.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#4A9EFF', textDecoration: 'underline' }}
          >
            sito ufficiale del corso
          </a>.
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
            onClick={() => { if (!bookmarked) track('courses_saved'); toggleSave({ id: course.id, title: course.title, university: course.university, city: course.city }); }}
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
            onClick={() => { track('courses_compared'); setShowComparison(true); }}
            className="flex-1 py-3 rounded-xl font-semibold transition-colors"
            style={{ border: '2px solid #4A9EFF', color: '#4A9EFF' }}
          >
            Confronta
          </button>
        </div>
        <button
          onClick={() => { track('applications_clicked'); window.open(course.officialUrl, '_blank', 'noopener,noreferrer'); }}
          className="w-full py-2.5 rounded-xl font-medium transition-colors mt-2 max-w-md mx-auto flex items-center justify-center gap-2"
          style={{ border: '1px solid #2A3F54', color: '#D0D4DC' }}
        >
          Candidati ora
          <ExternalLink className="w-4 h-4" />
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
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
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
          className="w-5 h-5 transition-transform duration-300"
          style={{
            color: '#8B8FA8',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
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

function SocialProofStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-1.5 p-3 rounded-xl" style={{ backgroundColor: '#0D1117' }}>
      {icon}
      <span className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>{value}</span>
      <span className="text-xs leading-tight" style={{ color: '#8B8FA8' }}>{label}</span>
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
