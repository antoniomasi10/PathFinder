'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { MOCK_COURSES, CourseDeadline } from '@/lib/mockCourses';
import { useSavedCourses } from '@/lib/savedCourses';
import AdmissionSimulator from '@/components/AdmissionSimulator';
import CourseComparison from '@/components/CourseComparison';
import LivingMap from '@/components/LivingMap';

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const course = MOCK_COURSES.find((c) => c.id === Number(params.id));
  const { savedIds, toggleSave } = useSavedCourses();

  const bookmarked = course ? savedIds.has(course.id) : false;
  const [checklist, setChecklist] = useState<Record<number, boolean>>({});
  const [calendarAdded, setCalendarAdded] = useState<Set<number>>(new Set());
  const [showSimulator, setShowSimulator] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

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
    setChecklist((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const completedItems = Object.values(checklist).filter(Boolean).length;
  const totalItems = course.requirements.length;


  return (
    <div style={{ backgroundColor: '#0D1117' }} className="min-h-screen pb-48">
      {/* Hero Section */}
      <div className="relative">
        <div
          className="relative h-56 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1C2F43 0%, #2A3F54 50%, #4A9EFF 100%)',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-16 h-16" style={{ color: '#4A9EFF', opacity: 0.3 }} />
          </div>
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(13, 17, 23, 0.7)', backdropFilter: 'blur(8px)' }}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => toggleSave({ id: course.id, title: course.title, university: course.university, city: course.city })}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(13, 17, 23, 0.7)', backdropFilter: 'blur(8px)' }}
          >
            <Bookmark
              className={`w-5 h-5 ${bookmarked ? 'fill-[#4A9EFF] text-[#4A9EFF]' : 'text-white'}`}
            />
          </button>
        </div>

        <div className="px-5 pt-5 pb-4">
          <h1 className="text-2xl font-bold text-white leading-tight mb-2">{course.title}</h1>
          <p style={{ fontSize: '16px', color: '#8B8FA8' }} className="mb-1">
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

      {/* Subjects */}
      <div className="px-5 pb-6">
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
        >
          <h2 className="text-lg font-bold text-white mb-4">Materie principali</h2>
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
        </div>
      </div>

      {/* Career Outlets */}
      <div className="px-5 pb-6">
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
        >
          <h2 className="text-lg font-bold text-white mb-4">Sbocchi professionali</h2>
          <div className="space-y-2">
            {course.careerOutlets.map((career) => (
              <div key={career} className="flex items-center gap-3">
                <Briefcase className="w-4 h-4" style={{ color: '#4A9EFF' }} />
                <span style={{ fontSize: '14px', color: '#D0D4DC' }}>{career}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admission Simulator CTA */}
      <div className="px-5 pb-6">
        <button
          onClick={() => setShowSimulator(true)}
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

          <div className="space-y-3 mb-4">
            {course.requirements.map((req, index) => (
              <ChecklistItem
                key={req}
                checked={!!checklist[index]}
                onChange={() => toggleChecklistItem(index)}
                label={req}
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
                  onClick={() => !isAdded && addToCalendar(deadline, index)}
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
            onClick={() => toggleSave({ id: course.id, title: course.title, university: course.university, city: course.city })}
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
            onClick={() => setShowComparison(true)}
            className="flex-1 py-3 rounded-xl font-semibold transition-colors"
            style={{ border: '2px solid #4A9EFF', color: '#4A9EFF' }}
          >
            Confronta
          </button>
        </div>
        <button
          className="w-full py-2.5 rounded-xl font-medium transition-colors mt-2 max-w-md mx-auto block"
          style={{ border: '1px solid #2A3F54', color: '#D0D4DC' }}
        >
          Candidati ora
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
