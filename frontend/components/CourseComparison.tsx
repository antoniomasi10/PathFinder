'use client';

import { useState, useEffect } from 'react';
import { X, Briefcase, Award, Star, ChevronRight, BookOpen } from 'lucide-react';
import { MockCourse, MOCK_COURSES } from '@/lib/mockCourses';
import Link from 'next/link';

interface Props {
  course: MockCourse;
  onClose: () => void;
}

function getSimilarCourses(course: MockCourse): MockCourse[] {
  const others = MOCK_COURSES.filter((c) => c.id !== course.id);

  const scored = others.map((c) => {
    let score = 0;
    // Same sector keywords overlap
    const wordsA = course.sector.toLowerCase().split(/\s+/);
    const wordsB = c.sector.toLowerCase().split(/\s+/);
    if (course.sector === c.sector) score += 40;
    else if (wordsA.some((w) => wordsB.includes(w))) score += 25;

    // Overlapping subjects
    const subSet = new Set(course.subjects.map((s) => s.toLowerCase()));
    const shared = c.subjects.filter((s) => subSet.has(s.toLowerCase())).length;
    score += Math.min(shared * 8, 30);

    // Same language
    if (course.language === c.language) score += 10;

    // Same city
    if (course.city === c.city) score += 10;

    return { course: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.course);
}

function parsePercent(s: string): number | null {
  const m = s.match(/([\d,.]+)/);
  if (!m) return null;
  return parseFloat(m[1].replace(',', '.'));
}

export default function CourseComparison({ course, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const similar = getSimilarCourses(course);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 300);
  };

  const allCourses = [course, ...similar];

  return (
    <div className="fixed inset-0" style={{ zIndex: 60 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          backgroundColor: 'rgba(0,0,0,0.6)',
          opacity: visible && !closing ? 1 : 0,
          transitionDuration: '250ms',
        }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
        style={{
          backgroundColor: '#0D1117',
          maxHeight: '90vh',
          transform: visible && !closing ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Handle + Header */}
        <div className="sticky top-0 z-10 px-5 pt-3 pb-4" style={{ backgroundColor: '#0D1117', borderBottom: '1px solid #2A3F54' }}>
          <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ backgroundColor: '#2A3F54' }} />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Confronta corsi</h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#1C2F43' }}
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {/* Horizontal scroll comparison table */}
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Course headers */}
              <div className="flex">
                <div className="w-28 flex-shrink-0" />
                {allCourses.map((c, i) => (
                  <div
                    key={c.id}
                    className="w-40 flex-shrink-0 p-3 text-center"
                    style={{
                      backgroundColor: i === 0 ? '#162232' : 'transparent',
                      borderBottom: '1px solid #2A3F54',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
                      style={{ backgroundColor: i === 0 ? '#4A9EFF' : '#1C2F43' }}
                    >
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-white leading-tight mb-0.5 line-clamp-2">
                      {c.title.length > 40 ? c.title.slice(0, 40) + '...' : c.title}
                    </p>
                    <p className="text-[10px]" style={{ color: '#8B8FA8' }}>{c.university}</p>
                    {i === 0 && (
                      <span
                        className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#4A9EFF20', color: '#4A9EFF' }}
                      >
                        Attuale
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Comparison rows */}
              <ComparisonRow
                label="Occupazione"
                icon={<Briefcase className="w-3.5 h-3.5" style={{ color: '#4A9EFF' }} />}
                values={allCourses.map((c) => c.employmentRate)}
                highlightIndex={0}
                bestFn={(vals) => {
                  const nums = vals.map(parsePercent);
                  const max = Math.max(...nums.filter((n): n is number => n !== null));
                  return nums.indexOf(max);
                }}
              />
              <ComparisonRow
                label="Soddisfazione"
                icon={<Star className="w-3.5 h-3.5" style={{ color: '#4A9EFF' }} />}
                values={allCourses.map((c) => c.satisfaction)}
                highlightIndex={0}
                bestFn={(vals) => {
                  const nums = vals.map(parsePercent);
                  const max = Math.max(...nums.filter((n): n is number => n !== null));
                  return nums.indexOf(max);
                }}
              />
              <ComparisonRow
                label="Classifica"
                icon={<Award className="w-3.5 h-3.5" style={{ color: '#4A9EFF' }} />}
                values={allCourses.map((c) => c.ranking)}
                highlightIndex={0}
              />
              <ComparisonRow
                label="Durata"
                icon={null}
                values={allCourses.map((c) => c.duration)}
                highlightIndex={0}
              />
              <ComparisonRow
                label="Lingua"
                icon={null}
                values={allCourses.map((c) => c.language)}
                highlightIndex={0}
              />
              <ComparisonRow
                label="Costo"
                icon={null}
                values={allCourses.map((c) => c.cost)}
                highlightIndex={0}
              />
              <ComparisonRow
                label="Posti"
                icon={null}
                values={allCourses.map((c) => c.spots ? String(c.spots) : 'Su requisiti')}
                highlightIndex={0}
              />
              <ComparisonRow
                label="Inglese"
                icon={null}
                values={allCourses.map((c) => c.requiredEnglishLevel)}
                highlightIndex={0}
              />
              <ComparisonRow
                label="Città"
                icon={null}
                values={allCourses.map((c) => c.city)}
                highlightIndex={0}
              />
              <ComparisonRow
                label="Affitto medio"
                icon={null}
                values={allCourses.map((c) => c.rentAvg)}
                highlightIndex={0}
              />
            </div>
          </div>

          {/* Links to other courses */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold mb-3" style={{ color: '#8B8FA8' }}>Vai al dettaglio</p>
            {similar.map((c) => (
              <Link
                key={c.id}
                href={`/universities/course/${c.id}`}
                onClick={handleClose}
                className="flex items-center justify-between py-3"
                style={{ borderBottom: '1px solid #2A3F54' }}
              >
                <div>
                  <p className="text-sm font-medium text-white">{c.title.length > 45 ? c.title.slice(0, 45) + '...' : c.title}</p>
                  <p className="text-xs" style={{ color: '#8B8FA8' }}>{c.university}</p>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: '#4A9EFF' }} />
              </Link>
            ))}
          </div>

          {/* Bottom padding */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  icon,
  values,
  highlightIndex,
  bestFn,
}: {
  label: string;
  icon: React.ReactNode;
  values: string[];
  highlightIndex: number;
  bestFn?: (vals: string[]) => number;
}) {
  const bestIdx = bestFn ? bestFn(values) : -1;

  return (
    <div className="flex" style={{ borderBottom: '1px solid #1C2F43' }}>
      <div className="w-28 flex-shrink-0 p-3 flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-medium" style={{ color: '#8B8FA8' }}>{label}</span>
      </div>
      {values.map((val, i) => (
        <div
          key={i}
          className="w-40 flex-shrink-0 p-3 text-center"
          style={{
            backgroundColor: i === highlightIndex ? '#162232' : 'transparent',
          }}
        >
          <span
            className="text-xs font-semibold"
            style={{
              color: bestIdx === i ? '#3DD68C' : '#D0D4DC',
            }}
          >
            {val}
          </span>
        </div>
      ))}
    </div>
  );
}
