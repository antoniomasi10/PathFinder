'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { CloseLg as X, Search, ArrowRight } from '@/components/icons';
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
    if (course.sector === c.sector) score += 40;
    else {
      const wA = course.sector.toLowerCase().split(/\s+/);
      const wB = c.sector.toLowerCase().split(/\s+/);
      if (wA.some((w) => wB.includes(w))) score += 25;
    }
    const subSet = new Set(course.subjects.map((s) => s.toLowerCase()));
    score += Math.min(c.subjects.filter((s) => subSet.has(s.toLowerCase())).length * 8, 30);
    if (course.language === c.language) score += 10;
    if (course.city === c.city) score += 10;
    return { course: c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map((s) => s.course);
}

function parsePercent(s: string): number {
  const m = s.match(/([\d,.]+)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(',', '.'));
}

function getStat(course: MockCourse, label: string): number {
  const stat = course.stats.find((s) => s.label === label);
  return stat ? stat.value : 0;
}

function parseCostMax(s: string): number {
  const matches = s.match(/[\d.]+/g);
  if (!matches) return 0;
  const nums = matches.map((m) => parseFloat(m.replace('.', '')));
  return Math.max(...nums);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

export default function CourseComparison({ course, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [courseB, setCourseB] = useState<MockCourse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const comparisonRef = useRef<HTMLDivElement>(null);
  const suggested = useMemo(() => getSimilarCourses(course), [course]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 300);
  };

  const selectCourseB = (c: MockCourse) => {
    setCourseB(c);
    setSearchQuery('');
    setSearchFocused(false);
    setTimeout(() => {
      comparisonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return MOCK_COURSES.filter(
      (c) =>
        c.id !== course.id &&
        (c.title.toLowerCase().includes(q) ||
          c.university.toLowerCase().includes(q) ||
          c.sector.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [searchQuery, course.id]);

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
          maxHeight: '92vh',
          transform: visible && !closing ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Handle + Header */}
        <div
          className="sticky top-0 z-10 px-5 pt-3 pb-4"
          style={{ backgroundColor: '#0D1117', borderBottom: '1px solid #2A3F54' }}
        >
          <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ backgroundColor: '#2A3F54' }} />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Confronto corsi</h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#1C2F43' }}
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 80px)' }}>
          {/* Course A vs Course B cards */}
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-3">
              {/* Course A */}
              <div
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: '#1C2F43', border: '2px solid #6C63FF' }}
              >
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-2"
                  style={{ backgroundColor: '#6C63FF30', color: '#6C63FF' }}
                >
                  Corso A
                </span>
                <p className="text-sm font-bold text-white leading-tight mb-1">
                  {truncate(course.title, 50)}
                </p>
                <p className="text-[11px]" style={{ color: '#8B8FA8' }}>
                  {course.university}
                </p>
              </div>

              <span className="text-xs font-bold" style={{ color: '#8B8FA8' }}>
                VS
              </span>

              {/* Course B */}
              {courseB ? (
                <div
                  className="flex-1 rounded-2xl p-4 relative"
                  style={{ backgroundColor: '#1C2F43', border: '2px solid #4A9EFF' }}
                >
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-2"
                    style={{ backgroundColor: '#4A9EFF30', color: '#4A9EFF' }}
                  >
                    Corso B
                  </span>
                  <p className="text-sm font-bold text-white leading-tight mb-1">
                    {truncate(courseB.title, 50)}
                  </p>
                  <p className="text-[11px]" style={{ color: '#8B8FA8' }}>
                    {courseB.university}
                  </p>
                  <button
                    onClick={() => setCourseB(null)}
                    className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: '#2A3F54', color: '#D0D4DC' }}
                  >
                    Cambia
                  </button>
                </div>
              ) : (
                <div
                  className="flex-1 rounded-2xl p-4 flex flex-col items-center justify-center"
                  style={{
                    backgroundColor: '#1C2F43',
                    border: '2px dashed #2A3F54',
                    minHeight: '100px',
                  }}
                >
                  <p className="text-xs text-center" style={{ color: '#8B8FA8' }}>
                    Seleziona un corso da confrontare
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Search bar (always show if no courseB or for changing) */}
          {!courseB && (
            <>
              <div className="px-5 pb-3 relative">
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl"
                  style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
                >
                  <Search size={16} color="#8B8FA8" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    placeholder="Cerca un corso da confrontare..."
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#8B8FA8]"
                  />
                </div>

                {/* Search results dropdown */}
                {searchFocused && searchResults.length > 0 && (
                  <div
                    className="absolute left-5 right-5 mt-1 rounded-xl overflow-hidden"
                    style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54', zIndex: 20 }}
                  >
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        onMouseDown={() => selectCourseB(c)}
                        className="w-full text-left px-4 py-3 transition-colors hover:bg-[#2A3F54]"
                        style={{ borderBottom: '1px solid #2A3F54' }}
                      >
                        <p className="text-sm font-medium text-white">{truncate(c.title, 55)}</p>
                        <p className="text-[11px]" style={{ color: '#8B8FA8' }}>
                          {c.university} - {c.city}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggested courses */}
              <div className="px-5 pb-5">
                <p className="text-xs font-semibold mb-3" style={{ color: '#8B8FA8' }}>
                  Corsi consigliati
                </p>
                <div
                  className="flex gap-3 overflow-x-auto hide-scrollbar"
                  style={{ scrollbarWidth: 'none' }}
                >
                  <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                  {suggested.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectCourseB(c)}
                      className="flex-shrink-0 rounded-2xl p-3.5 text-left transition-transform active:scale-[0.97]"
                      style={{
                        width: '160px',
                        height: '120px',
                        backgroundColor: '#1C2F43',
                        border: '1px solid #2A3F54',
                      }}
                    >
                      <p className="text-xs font-bold text-white leading-tight mb-1 line-clamp-2">
                        {truncate(c.title, 40)}
                      </p>
                      <p className="text-[10px] mb-2" style={{ color: '#8B8FA8' }}>
                        {c.university}
                      </p>
                      <p className="text-[11px] font-semibold" style={{ color: '#3DD68C' }}>
                        {c.employmentRate} occupaz.
                      </p>
                      <p className="text-[10px]" style={{ color: '#D0D4DC' }}>
                        {c.cost.length > 25 ? c.cost.slice(0, 25) + '...' : c.cost}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Placeholder message */}
              <div className="px-5 pb-8 text-center">
                <p className="text-sm" style={{ color: '#8B8FA8' }}>
                  Seleziona un corso da confrontare per vedere i dettagli
                </p>
              </div>
            </>
          )}

          {/* Comparison charts - only shown when courseB is selected */}
          {courseB && (
            <div ref={comparisonRef} className="px-5 pb-8">
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#6C63FF' }} />
                  <span className="text-[11px] font-medium" style={{ color: '#D0D4DC' }}>
                    {truncate(course.title, 20)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#4A9EFF' }} />
                  <span className="text-[11px] font-medium" style={{ color: '#D0D4DC' }}>
                    {truncate(courseB.title, 20)}
                  </span>
                </div>
              </div>

              {/* Bar charts */}
              <BarComparison
                label="Tasso di occupazione"
                valueA={parsePercent(course.employmentRate)}
                valueB={parsePercent(courseB.employmentRate)}
                maxVal={100}
                formatFn={(v) => `${v}%`}
                higherIsBetter
              />
              <BarComparison
                label="Stipendio medio annuo"
                valueA={course.avgSalary}
                valueB={courseB.avgSalary}
                maxVal={Math.max(course.avgSalary, courseB.avgSalary) * 1.15}
                formatFn={(v) => `${(v / 1000).toFixed(1)}k`}
                higherIsBetter
              />
              <BarComparison
                label="Soddisfazione studenti"
                valueA={parsePercent(course.satisfaction)}
                valueB={parsePercent(courseB.satisfaction)}
                maxVal={100}
                formatFn={(v) => `${v}%`}
                higherIsBetter
              />
              <BarComparison
                label="Costo annuale"
                valueA={parseCostMax(course.cost)}
                valueB={parseCostMax(courseB.cost)}
                maxVal={Math.max(parseCostMax(course.cost), parseCostMax(courseB.cost)) * 1.15}
                formatFn={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
                higherIsBetter={false}
              />
              <BarComparison
                label="Mobilita internazionale"
                valueA={getStat(course, 'Mobilità')}
                valueB={getStat(courseB, 'Mobilità')}
                maxVal={100}
                formatFn={(v) => `${v}%`}
                higherIsBetter
              />
              <BarComparison
                label="Tasso di laurea"
                valueA={getStat(course, 'Laurea')}
                valueB={getStat(courseB, 'Laurea')}
                maxVal={100}
                formatFn={(v) => `${v}%`}
                higherIsBetter
              />

              {/* Text comparisons */}
              <div className="mt-5 space-y-3">
                <TextComparison label="Durata" valueA={course.duration} valueB={courseB.duration} />
                <TextComparison label="Lingua" valueA={course.language} valueB={courseB.language} />
                <TextComparison
                  label="Posti"
                  valueA={course.spots ? String(course.spots) : 'Su requisiti'}
                  valueB={courseB.spots ? String(courseB.spots) : 'Su requisiti'}
                />
                <TextComparison
                  label="Livello inglese"
                  valueA={course.requiredEnglishLevel}
                  valueB={courseB.requiredEnglishLevel}
                />
                <TextComparison label="Citta" valueA={course.city} valueB={courseB.city} />
                <TextComparison label="Affitto medio" valueA={course.rentAvg} valueB={courseB.rentAvg} />
              </div>

              {/* Go to course B detail */}
              <Link
                href={`/universities/course/${courseB.id}`}
                onClick={handleClose}
                className="flex items-center justify-center gap-2 mt-6 py-3 rounded-xl font-semibold text-sm transition-colors"
                style={{ backgroundColor: '#4A9EFF', color: 'white' }}
              >
                Vai al dettaglio di {truncate(courseB.title, 30)}
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BarComparison({
  label,
  valueA,
  valueB,
  maxVal,
  formatFn,
  higherIsBetter,
}: {
  label: string;
  valueA: number;
  valueB: number;
  maxVal: number;
  formatFn: (v: number) => string;
  higherIsBetter: boolean;
}) {
  const pctA = maxVal > 0 ? Math.min((valueA / maxVal) * 100, 100) : 0;
  const pctB = maxVal > 0 ? Math.min((valueB / maxVal) * 100, 100) : 0;

  const aIsBetter = higherIsBetter ? valueA >= valueB : valueA <= valueB;
  const bIsBetter = !aIsBetter;
  const tied = valueA === valueB;

  return (
    <div className="mb-5">
      <p className="text-sm font-semibold text-center mb-3" style={{ color: '#D0D4DC' }}>
        {label}
      </p>

      {/* Bar A */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-5 rounded-lg overflow-hidden relative" style={{ backgroundColor: '#2A2F3D' }}>
          <div
            className="h-full rounded-lg transition-all duration-700 ease-out"
            style={{
              width: `${pctA}%`,
              backgroundColor: '#6C63FF',
              minWidth: '8px',
            }}
          />
        </div>
        <span
          className="text-sm font-bold w-14 text-right"
          style={{ color: !tied && aIsBetter ? '#3DD68C' : '#D0D4DC' }}
        >
          {formatFn(valueA)}
        </span>
      </div>

      {/* Bar B */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-5 rounded-lg overflow-hidden relative" style={{ backgroundColor: '#2A2F3D' }}>
          <div
            className="h-full rounded-lg transition-all duration-700 ease-out"
            style={{
              width: `${pctB}%`,
              backgroundColor: '#4A9EFF',
              minWidth: '8px',
            }}
          />
        </div>
        <span
          className="text-sm font-bold w-14 text-right"
          style={{ color: !tied && bIsBetter ? '#3DD68C' : '#D0D4DC' }}
        >
          {formatFn(valueB)}
        </span>
      </div>
    </div>
  );
}

function TextComparison({
  label,
  valueA,
  valueB,
}: {
  label: string;
  valueA: string;
  valueB: string;
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
    >
      <p className="text-xs font-semibold text-center mb-2" style={{ color: '#8B8FA8' }}>
        {label}
      </p>
      <div className="flex items-center">
        <div className="flex-1 text-center">
          <span className="text-sm font-bold" style={{ color: '#6C63FF' }}>
            {valueA}
          </span>
        </div>
        <div className="w-px h-5" style={{ backgroundColor: '#2A3F54' }} />
        <div className="flex-1 text-center">
          <span className="text-sm font-bold" style={{ color: '#4A9EFF' }}>
            {valueB}
          </span>
        </div>
      </div>
    </div>
  );
}
