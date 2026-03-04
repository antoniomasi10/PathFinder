'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Bookmark,
  Briefcase,
  Award,
  Star,
  MapPin,
  ChevronDown,
  Download,
  Plus,
  ArrowLeft,
  Clock,
  Users,
  BookOpen,
} from 'lucide-react';
import { MOCK_COURSES } from '@/lib/mockCourses';

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const course = MOCK_COURSES.find((c) => c.id === Number(params.id));

  const [bookmarked, setBookmarked] = useState(false);
  const [checklist, setChecklist] = useState<Record<number, boolean>>({});
  const [degreeGrade, setDegreeGrade] = useState('');
  const [englishCert, setEnglishCert] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [probability, setProbability] = useState<'high' | 'medium' | 'low' | null>(null);

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

  const calculateProbability = () => {
    const grade = parseFloat(degreeGrade);
    if (!grade || !englishCert || !fieldOfStudy) return;

    if (grade >= 27 && (englishCert === 'C1' || englishCert === 'C2') && fieldOfStudy === 'related') {
      setProbability('high');
    } else if (grade >= 24 || englishCert === 'B2') {
      setProbability('medium');
    } else {
      setProbability('low');
    }
  };

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
            onClick={() => setBookmarked(!bookmarked)}
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
          <p style={{ fontSize: '16px', color: '#8B8FA8' }} className="mb-3">
            {course.university}
          </p>
          <div className="flex flex-wrap gap-2">
            {[course.duration, course.language, course.mode].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-sm"
                style={{ backgroundColor: '#1C2F43', color: '#D0D4DC' }}
              >
                {tag}
              </span>
            ))}
          </div>
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
            <InfoRow icon={<Users className="w-4 h-4" style={{ color: '#4A9EFF' }} />} label="Posti" value={String(course.spots)} />
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

      {/* Admission Simulator */}
      <div className="px-5 pb-6">
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, #1C2F43 0%, #162232 100%)',
            border: '1px solid #2A3F54',
          }}
        >
          <h2 className="text-lg font-bold text-white mb-4">Simula la tua ammissione</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#D0D4DC' }}>
                Voto di laurea
              </label>
              <input
                type="number"
                placeholder="Es. 105"
                value={degreeGrade}
                onChange={(e) => setDegreeGrade(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A9EFF]"
                style={{
                  backgroundColor: '#0D1117',
                  border: '1px solid #2A3F54',
                  color: 'white',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#D0D4DC' }}>
                Certificazione inglese
              </label>
              <div className="relative">
                <select
                  value={englishCert}
                  onChange={(e) => setEnglishCert(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#4A9EFF]"
                  style={{
                    backgroundColor: '#0D1117',
                    border: '1px solid #2A3F54',
                    color: englishCert ? 'white' : '#8B8FA8',
                  }}
                >
                  <option value="">Seleziona</option>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#8B8FA8' }} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#D0D4DC' }}>
                Campo di studi precedente
              </label>
              <div className="relative">
                <select
                  value={fieldOfStudy}
                  onChange={(e) => setFieldOfStudy(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#4A9EFF]"
                  style={{
                    backgroundColor: '#0D1117',
                    border: '1px solid #2A3F54',
                    color: fieldOfStudy ? 'white' : '#8B8FA8',
                  }}
                >
                  <option value="">Seleziona</option>
                  <option value="related">Informatica/Ingegneria</option>
                  <option value="stem">STEM</option>
                  <option value="other">Altro</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#8B8FA8' }} />
              </div>
            </div>

            <button
              onClick={calculateProbability}
              className="w-full py-3 rounded-xl font-semibold shadow-md transition-colors mt-2"
              style={{ backgroundColor: '#4A9EFF', color: 'white' }}
            >
              Calcola probabilità
            </button>

            {probability && (
              <div
                className="mt-4 p-4 rounded-xl"
                style={{ backgroundColor: '#0D1117', border: '1px solid #2A3F54' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: '#D0D4DC' }}>
                    Probabilità di ammissione
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor:
                        probability === 'high'
                          ? 'rgba(61, 214, 140, 0.15)'
                          : probability === 'medium'
                          ? 'rgba(255, 170, 51, 0.15)'
                          : 'rgba(255, 77, 77, 0.15)',
                      color:
                        probability === 'high'
                          ? '#3DD68C'
                          : probability === 'medium'
                          ? '#FFAA33'
                          : '#FF4D4D',
                    }}
                  >
                    {probability === 'high' ? 'Alta' : probability === 'medium' ? 'Media' : 'Bassa'}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: '#2A3F54' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width:
                        probability === 'high' ? '83%' : probability === 'medium' ? '50%' : '25%',
                      backgroundColor:
                        probability === 'high'
                          ? '#3DD68C'
                          : probability === 'medium'
                          ? '#FFAA33'
                          : '#FF4D4D',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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

      {/* Timeline */}
      <div className="px-5 pb-6">
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
        >
          <h2 className="text-lg font-bold text-white mb-4">Scadenze</h2>
          <div className="space-y-4">
            {course.deadlines.map((deadline, index) => (
              <TimelineItem
                key={index}
                date={deadline.date}
                label={deadline.label}
                status={deadline.status}
                isLast={index === course.deadlines.length - 1}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Vivi qui */}
      <div className="px-5 pb-6">
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
        >
          <h2 className="text-lg font-bold text-white mb-4">Vivi qui</h2>
          <div
            className="h-48 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #162232 0%, #1C2F43 50%, #2A3F54 100%)',
            }}
          >
            <MapPin className="w-12 h-12" style={{ color: '#4A9EFF' }} />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(13,17,23,0.4) 0%, transparent 100%)',
              }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <InfoChip icon="€" label="Affitto medio" value={course.rentAvg} />
            <InfoChip icon="💰" label="Costo vita" value={course.costOfLiving} />
            <InfoChip icon="📍" label="Dal centro" value={course.distanceFromCenter} />
          </div>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div
        className="fixed bottom-16 left-0 right-0 px-5 py-4"
        style={{
          backgroundColor: '#0D1117',
          borderTop: '1px solid #2A3F54',
        }}
      >
        <div className="flex gap-3 max-w-md mx-auto">
          <button
            className="flex-1 py-3 rounded-xl font-semibold shadow-md transition-colors"
            style={{ backgroundColor: '#4A9EFF', color: 'white' }}
          >
            Salva corso
          </button>
          <button
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

function TimelineItem({
  date,
  label,
  status,
  isLast,
}: {
  date: string;
  label: string;
  status: 'past' | 'upcoming' | 'future';
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3 relative">
      <div className="flex flex-col items-center">
        <div
          className="w-3 h-3 rounded-full"
          style={{
            backgroundColor:
              status === 'past' ? '#8B8FA8' : status === 'upcoming' ? '#4A9EFF' : '#2A3F54',
          }}
        />
        {!isLast && (
          <div
            className="w-0.5 flex-1 mt-1"
            style={{ backgroundColor: '#2A3F54' }}
          />
        )}
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: status === 'upcoming' ? '#4A9EFF' : '#D0D4DC' }}
            >
              {label}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#8B8FA8' }}>
              {date}
            </p>
          </div>
          <button className="transition-colors" style={{ color: '#8B8FA8' }}>
            <Plus className="w-5 h-5" />
          </button>
        </div>
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
