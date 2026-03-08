'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { MOCK_COURSES } from '@/lib/mockCourses';

const STORAGE_KEY_FILTERS = 'pf-uni-filters';
const STORAGE_KEY_QUERY = 'pf-uni-query';

const uniqueSectors = [...new Set(MOCK_COURSES.map((c) => c.sector))];
const uniqueUniversities = [...new Set(MOCK_COURSES.map((c) => c.university))];
const uniqueCities = [...new Set(MOCK_COURSES.map((c) => c.city))];

interface Filters {
  sectors: string[];
  universities: string[];
  cities: string[];
}

const emptyFilters: Filters = { sectors: [], universities: [], cities: [] };

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function CircularProgress({
  value,
  label,
  color,
  isPrimary = false,
  delay = 0,
}: {
  value: number;
  label: string;
  color: string;
  isPrimary?: boolean;
  delay?: number;
}) {
  const size = isPrimary ? 80 : 60;
  const strokeWidth = isPrimary ? 8 : 6;
  const fontSize = isPrimary ? 20 : 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const ref = useRef<HTMLDivElement>(null);
  const [animatedValue, setAnimatedValue] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.disconnect();

          const timeoutId = setTimeout(() => {
            const startTime = performance.now();
            const duration = 1200;

            const animate = (now: number) => {
              const progress = Math.min((now - startTime) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
              setAnimatedValue(Math.round(value * eased));
              if (progress < 1) requestAnimationFrame(animate);
            };

            requestAnimationFrame(animate);
          }, delay);

          return () => clearTimeout(timeoutId);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, delay]);

  const offset = circumference - (animatedValue / 100) * circumference;

  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={isPrimary ? 'md:w-[100px] md:h-[100px]' : 'md:w-[70px] md:h-[70px]'}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2A3F54"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="white"
          fontSize={fontSize}
          fontWeight="bold"
        >
          {animatedValue}%
        </text>
      </svg>
      <span style={{ fontSize: '11px', color: '#8B8FA8' }}>{label}</span>
    </div>
  );
}

function FilterChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '14px',
        border: selected ? '1px solid #6C63FF' : '1px solid #2A3F54',
        backgroundColor: selected ? 'rgba(108,99,255,0.15)' : 'transparent',
        color: selected ? '#6C63FF' : '#D0D4DC',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

export default function UniversitiesPage() {
  const [searchQuery, setSearchQuery] = useState(() => loadFromStorage(STORAGE_KEY_QUERY, ''));
  const [debouncedQuery, setDebouncedQuery] = useState(() => loadFromStorage(STORAGE_KEY_QUERY, ''));
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => loadFromStorage(STORAGE_KEY_FILTERS, emptyFilters));
  const [tempFilters, setTempFilters] = useState<Filters>(emptyFilters);
  const [filtersPanelVisible, setFiltersPanelVisible] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Persist filters
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(filters));
  }, [filters]);

  // Persist search query
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_QUERY, JSON.stringify(searchQuery));
  }, [searchQuery]);

  // Filter modal open/close with animation
  const openFilters = useCallback(() => {
    setTempFilters(filters);
    setShowFilters(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFiltersPanelVisible(true));
    });
  }, [filters]);

  const closeFilters = useCallback(() => {
    setFiltersPanelVisible(false);
    setTimeout(() => setShowFilters(false), 300);
  }, []);

  const applyFilters = useCallback(() => {
    setFilters(tempFilters);
    closeFilters();
  }, [tempFilters, closeFilters]);

  const toggleTempFilter = useCallback((category: keyof Filters, value: string) => {
    setTempFilters((prev) => ({
      ...prev,
      [category]: prev[category].includes(value)
        ? prev[category].filter((v) => v !== value)
        : [...prev[category], value],
    }));
  }, []);

  const activeFilterCount = filters.sectors.length + filters.universities.length + filters.cities.length;
  const tempFilterCount = tempFilters.sectors.length + tempFilters.universities.length + tempFilters.cities.length;

  const activeFilterChips = useMemo(() => {
    const chips: { category: keyof Filters; value: string }[] = [];
    filters.sectors.forEach((v) => chips.push({ category: 'sectors', value: v }));
    filters.universities.forEach((v) => chips.push({ category: 'universities', value: v }));
    filters.cities.forEach((v) => chips.push({ category: 'cities', value: v }));
    return chips;
  }, [filters]);

  const removeFilter = useCallback((category: keyof Filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [category]: prev[category].filter((v) => v !== value),
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(emptyFilters);
    setSearchQuery('');
  }, []);

  const isSearchActive = debouncedQuery.length > 0 || activeFilterCount > 0;

  const filteredCourses = useMemo(() => {
    return MOCK_COURSES.filter((course) => {
      // Text search
      if (debouncedQuery) {
        const q = debouncedQuery.toLowerCase();
        const matchesText =
          course.title.toLowerCase().includes(q) ||
          course.university.toLowerCase().includes(q) ||
          course.city.toLowerCase().includes(q) ||
          course.sector.toLowerCase().includes(q) ||
          course.description.toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      // Filters (OR within same category, AND between categories)
      if (filters.sectors.length > 0 && !filters.sectors.includes(course.sector)) return false;
      if (filters.universities.length > 0 && !filters.universities.includes(course.university)) return false;
      if (filters.cities.length > 0 && !filters.cities.includes(course.city)) return false;
      return true;
    });
  }, [debouncedQuery, filters]);

  return (
    <div className="px-4 py-4 pb-24">
      {/* Search bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#1C2333',
          border: '1px solid #2A2F3D',
          borderRadius: '12px',
          height: '48px',
          padding: '0 16px',
          gap: '12px',
          marginBottom: '0px',
        }}
      >
        {/* Search icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7" stroke="#8B8FA8" strokeWidth="2" />
          <path d="M16.5 16.5L21 21" stroke="#8B8FA8" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cerca corsi, universita, citta..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'white',
            fontSize: '15px',
            minWidth: 0,
          }}
        />
        {/* Clear button */}
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#8B8FA8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {/* Filter button (funnel icon) */}
        <button
          type="button"
          onClick={openFilters}
          style={{
            position: 'relative',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 4h18l-7 8.5V18l-4 2v-7.5L3 4z"
              stroke={activeFilterCount > 0 ? '#6C63FF' : '#8B8FA8'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {activeFilterCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#FF4444',
                color: 'white',
                fontSize: '10px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <p style={{ fontSize: '16px', color: '#8B8FA8', marginBottom: '16px', marginTop: '20px' }}>
        Scopri i corsi consigliati
      </p>

      {/* Active filter chips */}
      {activeFilterChips.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}
          className="scrollbar-hide"
        >
          {activeFilterChips.map((chip) => (
            <button
              key={`${chip.category}-${chip.value}`}
              type="button"
              onClick={() => removeFilter(chip.category, chip.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                backgroundColor: 'rgba(108,99,255,0.15)',
                border: '1px solid #6C63FF',
                color: '#6C63FF',
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {chip.value}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          ))}
          {activeFilterChips.length > 2 && (
            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                backgroundColor: 'transparent',
                border: '1px solid #2A3F54',
                color: '#8B8FA8',
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Cancella tutti
            </button>
          )}
        </div>
      )}

      {/* Results counter */}
      {isSearchActive && (
        <p style={{ fontSize: '14px', color: '#8B8FA8', marginBottom: '16px' }}>
          {filteredCourses.length} cors{filteredCourses.length === 1 ? 'o' : 'i'} trovat{filteredCourses.length === 1 ? 'o' : 'i'}
        </p>
      )}

      {/* Course cards or empty state */}
      {filteredCourses.length > 0 ? (
        <div className="space-y-4">
          {filteredCourses.map((course) => (
            <Link
              key={course.id}
              href={`/universities/course/${course.id}`}
              className="block cursor-pointer"
            >
              <div
                style={{
                  backgroundColor: '#1C2F43',
                  borderRadius: '16px',
                  padding: '20px',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                className="hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 active:scale-[0.98]"
              >
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>
                  {course.title}
                </h2>
                <p style={{ fontSize: '14px', color: '#8B8FA8', marginBottom: '10px' }}>
                  {course.university}
                </p>
                <p style={{ fontSize: '14px', color: '#D0D4DC', marginBottom: '16px', lineHeight: '1.5' }}>
                  {course.description}
                </p>
                <div style={{ height: '1px', backgroundColor: '#2A3F54', marginBottom: '16px' }} />
                <div className="flex justify-between items-center">
                  {course.stats.map((stat, index) => (
                    <CircularProgress
                      key={stat.label}
                      value={stat.value}
                      label={stat.label}
                      color={stat.color}
                      isPrimary={stat.label === 'Affinità'}
                      delay={index * 100}
                    />
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            textAlign: 'center',
          }}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '20px', opacity: 0.4 }}>
            <circle cx="11" cy="11" r="7" stroke="#8B8FA8" strokeWidth="2" />
            <path d="M16.5 16.5L21 21" stroke="#8B8FA8" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>
            Nessun corso trovato
          </h3>
          <p style={{ fontSize: '14px', color: '#8B8FA8', marginBottom: '24px', maxWidth: '280px' }}>
            Prova a modificare i filtri o la ricerca per trovare altri corsi
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#6C63FF',
              border: 'none',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancella tutti i filtri
          </button>
        </div>
      )}

      <p className="text-center mt-6 px-2" style={{ fontSize: '11px', color: '#8B8FA8', lineHeight: '1.5' }}>
        Dati da siti ufficiali delle universita e AlmaLaurea. Aggiornati a Marzo 2026.
      </p>

      {/* Filter modal */}
      {showFilters && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          {/* Overlay */}
          <div
            onClick={closeFilters}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              transition: 'opacity 0.3s ease',
              opacity: filtersPanelVisible ? 1 : 0,
            }}
          />
          {/* Panel */}
          <div
            style={{
              position: 'relative',
              backgroundColor: '#141B2D',
              borderRadius: '20px 20px 0 0',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.3s ease',
              transform: filtersPanelVisible ? 'translateY(0)' : 'translateY(100%)',
            }}
          >
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px' }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', backgroundColor: '#2A3F54' }} />
            </div>

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px 16px',
                borderBottom: '1px solid #2A3F54',
              }}
            >
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>Filtri</h2>
              <button
                type="button"
                onClick={closeFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="#8B8FA8" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Accordion filter sections */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {([
                { key: 'sectors' as keyof Filters, label: 'Settore', options: uniqueSectors },
                { key: 'universities' as keyof Filters, label: 'Universita', options: uniqueUniversities },
                { key: 'cities' as keyof Filters, label: 'Citta', options: uniqueCities },
              ]).map(({ key, label, options }) => {
                const isOpen = openAccordion === key;
                const activeCount = tempFilters[key].length;
                return (
                  <div key={key}>
                    {/* Accordion header */}
                    <button
                      type="button"
                      onClick={() => setOpenAccordion(isOpen ? null : key)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        backgroundColor: isOpen ? '#242B3D' : '#1C2333',
                        borderBottom: '1px solid #2A2F3D',
                        border: 'none',
                        borderBottomStyle: 'solid',
                        borderBottomWidth: '1px',
                        borderBottomColor: '#2A2F3D',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 500, color: '#FFFFFF' }}>{label}</span>
                        {activeCount > 0 && (
                          <span style={{ fontSize: '13px', color: '#6C63FF', fontWeight: 600 }}>
                            ({activeCount})
                          </span>
                        )}
                      </div>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        style={{
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.3s ease',
                        }}
                      >
                        <path d="M5 7.5L10 12.5L15 7.5" stroke="#8B8FA8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {/* Accordion content */}
                    <div
                      style={{
                        maxHeight: isOpen ? '300px' : '0px',
                        overflow: 'hidden',
                        transition: 'max-height 0.3s ease',
                        backgroundColor: '#141B2D',
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px 20px' }}>
                        {options.map((option) => (
                          <FilterChip
                            key={option}
                            label={option}
                            selected={tempFilters[key].includes(option)}
                            onToggle={() => toggleTempFilter(key, option)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                padding: '16px 20px',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
                borderTop: '1px solid #2A3F54',
              }}
            >
              <button
                type="button"
                onClick={() => setTempFilters(emptyFilters)}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  border: '1px solid #2A3F54',
                  color: '#D0D4DC',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancella filtri
              </button>
              <button
                type="button"
                onClick={applyFilters}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: '#6C63FF',
                  border: 'none',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Applica{tempFilterCount > 0 ? ` (${tempFilterCount})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
