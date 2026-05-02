'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSavedOpportunities } from '@/lib/savedOpportunities';
import { useLanguage } from '@/lib/language';
import { isValidExternalUrl } from '@/lib/urlValidation';
import api from '@/lib/api';
import { parseDeadlineDate } from '@/lib/dateUtils';
import { getOpportunityTypeColor } from '@/lib/opportunityColors';
import { Bookmark, MapPin, CalendarIcon, Search, Filter } from '@/components/icons';

/* ── Types ───────────────────────────────────────────────────────── */

interface Opportunity {
  id: string;
  title: string;
  company: string;
  badge: string;
  description: string;
  matchScore: number;
  location: string;
  about: string;
  url?: string;
  type: string;
  remote: boolean;
  isAbroad?: boolean;
  skills: string[];
  requiredEnglishLevel?: string;
  matchReason: string;
  deadline: string;
  isNew?: boolean;
  source?: string;
}

const CC_BY_SOURCES = new Set(['EURES', 'Portale Europeo Giovani', 'MUR', 'AlmaLaurea']);
function isCCBYSource(source?: string): boolean {
  return !!source && CC_BY_SOURCES.has(source);
}

interface AdvancedFilters {
  badges: Record<string, string[]>;
  company: string;
  location: string;
  minScore: number;
  maxScore: number;
  deadline: '' | '7' | '30' | 'month';
  onlyRemote: boolean;
  onlyAbroad: boolean;
  onlyNew: boolean;
  englishLevels: string[];
  tags: string[];
}

const DEFAULT_FILTERS: AdvancedFilters = {
  badges: {}, company: '', location: '', minScore: 1, maxScore: 100,
  deadline: '', onlyRemote: false, onlyAbroad: false, onlyNew: false,
  englishLevels: [], tags: [],
};

/* ── Static fallback ─────────────────────────────────────────────── */

type BaseOpportunity = Omit<Opportunity, 'description' | 'about' | 'location'>;

const BASE_OPPORTUNITIES: BaseOpportunity[] = [
  { id: '1', title: 'Software Engineer Intern', company: 'TechNova Solutions', badge: 'FULL-TIME • REMOTE', matchScore: 85, url: 'https://www.technova.io/careers/software-engineer-intern', type: 'Internship', remote: true, skills: [], matchReason: '', deadline: '2026-04-02' },
  { id: '2', title: 'Product Design Workshop', company: 'Creative Hub Milan', badge: 'WORKSHOP • HYBRID', matchScore: 62, url: 'https://www.creativehubmilan.it/workshop/product-design', type: 'Event', remote: false, skills: [], matchReason: '', deadline: '2026-04-05' },
  { id: '3', title: 'Data Analyst Junior', company: 'Fintech Alpha', badge: 'JUNIOR • IN-PERSON', matchScore: 35, type: 'Internship', remote: false, skills: [], matchReason: '', deadline: '2026-04-20' },
  { id: '4', title: 'Master in AI Ethics', company: 'Politecnico di Milano', badge: 'EDUCATION • PART-TIME', matchScore: 92, url: 'https://www.polimi.it/formazione/master-e-corsi/master/master-in-ai-ethics', type: 'Summer school', remote: false, skills: [], matchReason: '', deadline: '2026-05-10' },
];

function getOpportunities(t: ReturnType<typeof useLanguage>['t']): Opportunity[] {
  return BASE_OPPORTUNITIES.map((opp) => ({
    ...opp,
    ...t.opportunitiesContent[opp.id as keyof typeof t.opportunitiesContent],
  }));
}

/* ── Filter logic ────────────────────────────────────────────────── */

function matchesSearch(opp: Opportunity, q: string): boolean {
  if (!q) return true;
  return opp.title.toLowerCase().includes(q) || opp.company.toLowerCase().includes(q) || opp.type.toLowerCase().includes(q);
}

function matchesClientFilters(opp: Opportunity, f: AdvancedFilters, tab: 'per-te' | 'esplora'): boolean {
  const badge = opp.badge.toLowerCase();
  const type = opp.type.toLowerCase();
  for (const values of Object.values(f.badges)) {
    if (values.length === 0) continue;
    if (!values.some((v) => badge.includes(v) || type.includes(v))) return false;
  }
  if (opp.matchScore < f.minScore || opp.matchScore > f.maxScore) return false;
  if (f.onlyNew && tab !== 'per-te' && !opp.isNew) return false;
  if (f.tags.length > 0 && !opp.skills.some((s) => f.tags.includes(s))) return false;
  return true;
}

function buildServerParams(search: string, f: AdvancedFilters): string {
  const p: Record<string, string> = {};
  if (search.trim()) p.search = search.trim();
  if (f.company) p.company = f.company;
  if (f.location) p.location = f.location;
  if (f.onlyRemote) p.isRemote = 'true';
  if (f.onlyAbroad) p.isAbroad = 'true';
  if (f.englishLevels.length) p.englishLevel = f.englishLevels.join(',');
  if (f.deadline) p.deadline = f.deadline;
  const qs = new URLSearchParams(p).toString();
  return qs ? `&${qs}` : '';
}

function hasAnyFilter(f: AdvancedFilters): boolean {
  return (
    Object.values(f.badges).some((arr) => arr.length > 0) ||
    !!f.company || !!f.location || f.minScore > 1 || f.maxScore < 100 ||
    !!f.deadline || f.onlyRemote || f.onlyAbroad || f.onlyNew ||
    f.englishLevels.length > 0 || f.tags.length > 0
  );
}

/* ── Search history ─────────────────────────────────────────────── */

const HISTORY_KEY = 'pf_search_history';
const MAX_HISTORY = 5;

function loadHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function persistHistory(items: string[]) { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); }

/* ── Smart search ────────────────────────────────────────────────── */

type SuggestionTab = 'per-te' | 'esplora';
interface Suggestion { opp: Opportunity; tab: SuggestionTab }

function getSuggestions(query: string, perTe: Opportunity[], esplora: Opportunity[]): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const combined: Suggestion[] = [];
  for (const opp of perTe) { if (!seen.has(opp.id)) { seen.add(opp.id); combined.push({ opp, tab: 'per-te' }); } }
  for (const opp of esplora) { if (!seen.has(opp.id)) { seen.add(opp.id); combined.push({ opp, tab: 'esplora' }); } }
  const rank = (opp: Opportunity) => {
    const t = opp.title.toLowerCase(), c = opp.company.toLowerCase();
    return t.startsWith(q) ? 4 : c.startsWith(q) ? 3 : t.includes(q) ? 2 : c.includes(q) ? 1 : 0;
  };
  return combined.filter(({ opp }) => matchesSearch(opp, q))
    .sort((a, b) => rank(b.opp) - rank(a.opp) || b.opp.matchScore - a.opp.matchScore)
    .slice(0, 6);
}

/* ── Filter config ───────────────────────────────────────────────── */

function getFilterCategories(t: ReturnType<typeof useLanguage>['t']) {
  return [
    { id: 'tipo', label: t.home.filterType, options: [
      { label: t.home.filterFullTime, value: 'full-time' },
      { label: t.home.filterPartTime, value: 'part-time' },
      { label: t.home.filterWorkshop, value: 'workshop' },
      { label: t.home.filterInternship, value: 'intern' },
      { label: t.home.filterEducation, value: 'education' },
    ]},
    { id: 'modalita', label: t.home.filterMode, options: [
      { label: t.home.filterRemote, value: 'remote' },
      { label: t.home.filterInPerson, value: 'in-person' },
      { label: t.home.filterHybrid, value: 'hybrid' },
    ]},
    { id: 'livello', label: t.home.filterLevel, options: [
      { label: t.home.filterJunior, value: 'junior' },
      { label: t.home.filterSenior, value: 'senior' },
    ]},
  ];
}

const ENGLISH_LEVELS = [
  { label: 'A2', value: 'A2' }, { label: 'B1-B2', value: 'B1_B2' },
  { label: 'C1', value: 'C1' }, { label: 'C2+', value: 'C2_PLUS' },
];

/* ── Shared primitives ───────────────────────────────────────────── */

function Accordion({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.32s cubic-bezier(0.4,0,0.2,1)' }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>{children}</div>
    </div>
  );
}

function ChevronDown({ rotated }: { rotated: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="#acb0ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`flex-shrink-0 transition-transform duration-300 ${rotated ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function Chip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="px-4 py-2 rounded-xl text-sm font-medium transition-all active:opacity-75 whitespace-nowrap"
      style={{ backgroundColor: active ? '#4a4bd7' : '#f0f1f8', color: active ? 'white' : '#595e78' }}
    >
      {label}
    </button>
  );
}

function Toggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:opacity-75"
      style={{ backgroundColor: active ? '#4a4bd7' : '#f0f1f8', color: active ? 'white' : '#595e78' }}
    >
      {active && (
        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
      {label}
    </button>
  );
}

/* ── DualRangeSlider ─────────────────────────────────────────────── */

function DualRangeSlider({ minVal, maxVal, onMinChange, onMaxChange }: {
  minVal: number; maxVal: number;
  onMinChange: (v: number) => void; onMaxChange: (v: number) => void;
}) {
  const minZ = minVal >= maxVal - 4 ? 5 : 3;
  const maxZ = minVal >= maxVal - 4 ? 3 : 5;
  return (
    <div>
      <div className="flex justify-end mb-3">
        <span className="text-sm font-bold tabular-nums" style={{ color: '#4a4bd7' }}>{minVal}% – {maxVal}%</span>
      </div>
      <div className="relative h-1.5 rounded-full my-4 mx-2.5" style={{ backgroundColor: '#e8e9f5' }}>
        <div className="absolute h-full rounded-full" style={{ backgroundColor: '#4a4bd7', left: `${minVal}%`, right: `${100 - maxVal}%` }} />
      </div>
      <div className="pf-dual-range">
        <input type="range" min={1} max={99} value={minVal}
          onChange={(e) => { const v = Number(e.target.value); if (v < maxVal) onMinChange(v); }} style={{ zIndex: minZ }} />
        <input type="range" min={2} max={100} value={maxVal}
          onChange={(e) => { const v = Number(e.target.value); if (v > minVal) onMaxChange(v); }} style={{ zIndex: maxZ }} />
      </div>
    </div>
  );
}

/* ── Deadline helpers ───────────────────────────────────────────── */

function getDaysLeft(deadline: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = parseDeadlineDate(deadline);
  if (!d) return Infinity;
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function deadlineUrgency(days: number): 'green' | 'yellow' | 'red' {
  return days <= 2 ? 'red' : days <= 14 ? 'yellow' : 'green';
}

function DeadlineLabel({ deadline, size = 'sm' }: { deadline: string; size?: 'sm' | 'xs' }) {
  const daysLeft = getDaysLeft(deadline);
  const urgency = deadlineUrgency(daysLeft);
  const parsed = parseDeadlineDate(deadline);
  const dateStr = parsed ? parsed.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : deadline;
  const colors = { green: { bg: '#f0fdf4', text: '#16a34a' }, yellow: { bg: '#fffbeb', text: '#d97706' }, red: { bg: '#fef2f2', text: '#dc2626' } };
  const { bg, text } = colors[urgency];
  const label = daysLeft <= 0 ? 'Scaduta' : daysLeft === 1 ? 'Scade domani' : dateStr;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}
      style={{ backgroundColor: bg, color: text }}>
      <svg className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
      {label}
    </span>
  );
}

/* ── Opportunity of the Day ──────────────────────────────────────── */

function OpportunityOfTheDay({ opp, onOpen }: { opp: Opportunity; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left relative overflow-hidden rounded-[24px]"
      style={{
        height: 220,
        backgroundColor: '#6B6CF5',
        boxShadow: '0 0 48px 18px rgba(220,218,255,0.60), 0 4px 24px rgba(107,108,245,0.35)',
      }}
    >
      {/* Watermark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-coha-watermark.svg" alt="" aria-hidden
        className="absolute pointer-events-none select-none"
        style={{ right: '0%', top: '-5%', width: '100%', height: 'auto', opacity: 0.65 }}
      />

      <div className="relative z-10 p-[27px] flex flex-col h-full">
        {/* Label */}
        <div className="flex items-center gap-[8px] mb-auto">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)" stroke="none">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span
            className="text-[16px] font-semibold uppercase tracking-[0.8px]"
            style={{ color: 'white', fontFamily: 'var(--font-plus-jakarta)' }}
          >
            OPPORTUNITY OF THE DAY
          </span>
        </div>

        {/* Company + title */}
        <div className="flex items-center gap-[16px] mt-[8px]">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-full bg-white"
            style={{ width: 56, height: 56, boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)' }}
          >
            <span className="text-[18px] font-bold" style={{ color: '#4a4bd7' }}>
              {opp.company.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[20px] font-bold leading-[28px] text-white" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
              {opp.title}
            </p>
            <p className="text-[16px] leading-[24px] truncate" style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-plus-jakarta)' }}>
              {opp.company}{opp.location ? ` • ${opp.location}` : ''}
            </p>
          </div>
        </div>

        {/* Bottom row */}
        <div
          className="flex items-center justify-between mt-[13px] pt-[13px]"
          style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}
        >
          <div>
            <p className="text-[10px] font-medium lowercase" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-plus-jakarta)' }}>
              affinità
            </p>
            <p className="text-[20px] font-bold text-white leading-[28px]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
              {opp.matchScore}%
            </p>
          </div>
          <div
            className="rounded-full px-[17px] py-[7px]"
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <span className="text-[16px] font-medium text-white" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
              {opp.type || 'Internship'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ── OpportunityCard ─────────────────────────────────────────────── */

function OpportunityCard({ opp, isSaved, onSave, onOpen }: {
  opp: Opportunity; isSaved: boolean; onSave: () => void; onOpen: () => void;
}) {
  return (
    <div
      className="bg-white overflow-hidden"
      style={{ border: '1px solid #ecedff', borderRadius: 24, boxShadow: '0px 2px 4px rgba(0,0,0,0.02)' }}
    >
      <button onClick={onOpen} className="w-full text-left active:opacity-75 transition-opacity" style={{ padding: 17 }}>
        {/* Top row: logo + title + bookmark */}
        <div className="flex items-center gap-[12px]">
          <div
            className="flex-shrink-0 flex items-center justify-center overflow-hidden"
            style={{ width: 48, height: 48, backgroundColor: '#e4e7ff', border: '1px solid #ecedff', borderRadius: 16, padding: 1 }}
          >
            <span className="text-[16px] font-bold" style={{ color: '#4a4bd7' }}>
              {opp.company.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[16px] leading-[24px] truncate" style={{ color: '#2c3149', fontFamily: 'var(--font-plus-jakarta)' }}>
              {opp.title}
            </p>
            <p className="text-[13px] leading-[24px] truncate" style={{ color: '#595e78', fontFamily: 'var(--font-plus-jakarta)' }}>
              {opp.company}{opp.location ? ` • ${opp.location}` : ''}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            className="p-1 flex-shrink-0 active:opacity-75"
            style={{ color: isSaved ? '#4a4bd7' : '#acb0ce' }}
          >
            <Bookmark filled={isSaved} strokeWidth={1.8} className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom row: affinità + deadline + type pill */}
        <div className="flex items-center justify-between mt-[4px] pt-[5px]" style={{ borderTop: '1px solid #f3f2ff' }}>
          <div>
            <p className="text-[11px] font-medium lowercase" style={{ color: '#595e78', fontFamily: 'var(--font-plus-jakarta)' }}>
              affinità
            </p>
            <p className="text-[16px] font-bold leading-[28px]" style={{ color: '#4a4bd7', fontFamily: 'var(--font-plus-jakarta)' }}>
              {opp.matchScore}%
            </p>
          </div>
          {opp.deadline && <DeadlineLabel deadline={opp.deadline} size="xs" />}
          <div
            className="rounded-full px-[10px] py-[4px]"
            style={{ backgroundColor: getOpportunityTypeColor(opp.type || opp.badge.split(' • ')[0]) }}
          >
            <span className="text-[13px] font-medium" style={{ color: '#4f5160', fontFamily: 'var(--font-plus-jakarta)' }}>
              {opp.type || opp.badge.split(' • ')[0]}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

/* ── SearchDropdown ──────────────────────────────────────────────── */

function SearchDropdown({ suggestions, query, activeIndex, onSelect, onHover }: {
  suggestions: Suggestion[]; query: string; activeIndex: number;
  onSelect: (s: Suggestion) => void; onHover: (i: number) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <div className="absolute top-[calc(100%+6px)] left-0 right-0 rounded-[20px] overflow-hidden"
      style={{ backgroundColor: 'white', border: '1px solid #ecedff', boxShadow: '0 8px 24px rgba(74,75,215,0.12)', zIndex: 9999 }}>
      {suggestions.map((s, i) => (
        <button key={s.opp.id}
          onMouseDown={(e) => e.preventDefault()} onClick={() => onSelect(s)} onMouseEnter={() => onHover(i)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
          style={{ backgroundColor: i === activeIndex ? '#f0f1f8' : 'transparent', borderBottom: i < suggestions.length - 1 ? '1px solid #f3f2ff' : 'none' }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm" style={{ backgroundColor: '#e4e7ff', color: '#4a4bd7' }}>
            {s.opp.company.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate font-medium" style={{ color: '#2c3149' }}>{s.opp.title}</p>
            <p className="text-xs truncate" style={{ color: '#595e78' }}>{s.opp.company}</p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full flex-shrink-0 uppercase tracking-wide" style={{ backgroundColor: '#ecedff', color: '#4a4bd7' }}>
            {s.opp.type || s.opp.badge.split(' • ')[0]}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── SearchHistoryDropdown ───────────────────────────────────────── */

function SearchHistoryDropdown({ history, onSelect, onRemove, onClear }: {
  history: string[]; onSelect: (term: string) => void; onRemove: (term: string) => void; onClear: () => void;
}) {
  if (!history.length) return null;
  return (
    <div className="absolute top-[calc(100%+6px)] left-0 right-0 rounded-[20px] overflow-hidden"
      style={{ backgroundColor: 'white', border: '1px solid #ecedff', boxShadow: '0 8px 24px rgba(74,75,215,0.12)', zIndex: 9999 }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#acb0ce' }}>Recenti</span>
        <button onMouseDown={(e) => e.preventDefault()} onClick={onClear} className="text-xs" style={{ color: '#acb0ce' }}>Cancella tutto</button>
      </div>
      {history.map((term) => (
        <div key={term} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: '1px solid #f3f2ff' }}>
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#acb0ce' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => onSelect(term)} className="flex-1 text-left text-sm truncate" style={{ color: '#2c3149' }}>{term}</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => onRemove(term)} className="p-1 -mr-1 flex-shrink-0" style={{ color: '#acb0ce' }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Pagination ─────────────────────────────────────────────────── */

function Pagination({ currentPage, totalPages, onPageChange, disabled }: {
  currentPage: number; totalPages: number; onPageChange: (page: number) => void; disabled?: boolean;
}) {
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }
  const btn = 'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium transition-all active:opacity-75';
  return (
    <div className="flex items-center justify-center gap-1.5 mt-6 mb-2">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={disabled || currentPage === 1}
        className={btn} style={{ backgroundColor: currentPage === 1 ? 'transparent' : '#f0f1f8', color: currentPage === 1 ? '#d1d5db' : '#595e78' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8L10 4" /></svg>
      </button>
      {pages.map((p, i) => p === '...' ? (
        <span key={`d-${i}`} className="w-8 text-center text-sm" style={{ color: '#acb0ce' }}>...</span>
      ) : (
        <button key={p} onClick={() => onPageChange(p)} disabled={disabled || p === currentPage}
          className={btn} style={{ backgroundColor: p === currentPage ? '#4a4bd7' : '#f0f1f8', color: p === currentPage ? 'white' : '#595e78' }}>
          {p}
        </button>
      ))}
      <button onClick={() => onPageChange(currentPage + 1)} disabled={disabled || currentPage === totalPages}
        className={btn} style={{ backgroundColor: currentPage === totalPages ? 'transparent' : '#f0f1f8', color: currentPage === totalPages ? '#d1d5db' : '#595e78' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4L10 8L6 12" /></svg>
      </button>
    </div>
  );
}

/* ── FilterSheet ─────────────────────────────────────────────────── */

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#acb0ce' }}>{label}</p>
      {children}
    </div>
  );
}

function FilterSheet({ open, draft, allTags, matchCount, filterCategories, tab, t, onUpdate, onToggleBadge, onReset, onApply, onClose }: {
  open: boolean; draft: AdvancedFilters; allTags: string[]; matchCount: number;
  filterCategories: ReturnType<typeof getFilterCategories>; tab: 'per-te' | 'esplora';
  t: ReturnType<typeof useLanguage>['t'];
  onUpdate: (partial: Partial<AdvancedFilters>) => void; onToggleBadge: (catId: string, value: string) => void;
  onReset: () => void; onApply: () => void; onClose: () => void;
}) {
  const deadlineOptions: Array<{ label: string; value: AdvancedFilters['deadline'] }> = [
    { label: t.home.filterDeadlineAll, value: '' }, { label: t.home.filterDeadline7d, value: '7' },
    { label: t.home.filterDeadline30d, value: '30' }, { label: t.home.filterDeadlineThisMonth, value: 'month' },
  ];

  const inputStyle = { backgroundColor: '#f8f8ff', border: '1.5px solid #ecedff', color: '#2c3149', borderRadius: 12, padding: '12px 16px', fontSize: 14, width: '100%', outline: 'none' };

  return (
    <>
      <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ backgroundColor: 'rgba(44,49,73,0.4)' }} onClick={onClose} />
      <div className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto rounded-t-3xl transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ backgroundColor: 'white', boxShadow: '0 -8px 40px rgba(74,75,215,0.1)' }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#d8daf7' }} />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4">
          <h2 className="font-bold text-lg" style={{ color: '#2c3149' }}>{t.home.filters}</h2>
          <button onClick={onReset} className="text-sm font-semibold" style={{ color: '#4a4bd7' }}>{t.home.reset}</button>
        </div>
        <div className="px-5 pb-4 space-y-6 max-h-[68vh] overflow-y-auto no-scrollbar">
          <FilterSection label={t.home.filterCompany}>
            <div className="relative">
              <input type="text" placeholder={t.home.filterCompanyPlaceholder} value={draft.company}
                onChange={(e) => onUpdate({ company: e.target.value })} style={inputStyle} />
              {draft.company && (
                <button onClick={() => onUpdate({ company: '' })} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#acb0ce' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </FilterSection>
          <FilterSection label={t.home.filterLocation}>
            <div className="relative">
              <input type="text" placeholder={t.home.filterLocationPlaceholder} value={draft.location}
                onChange={(e) => onUpdate({ location: e.target.value })} style={inputStyle} />
              {draft.location && (
                <button onClick={() => onUpdate({ location: '' })} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#acb0ce' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </FilterSection>
          <div className="h-px" style={{ backgroundColor: '#f3f2ff' }} />
          <FilterSection label={t.home.filterScoreRange}>
            <DualRangeSlider minVal={draft.minScore} maxVal={draft.maxScore}
              onMinChange={(v) => onUpdate({ minScore: v })} onMaxChange={(v) => onUpdate({ maxScore: v })} />
          </FilterSection>
          <div className="h-px" style={{ backgroundColor: '#f3f2ff' }} />
          <FilterSection label={t.home.filterDeadline}>
            <div className="flex flex-wrap gap-2">
              {deadlineOptions.map((opt) => <Chip key={opt.value} label={opt.label} active={draft.deadline === opt.value} onToggle={() => onUpdate({ deadline: opt.value })} />)}
            </div>
          </FilterSection>
          <div className="h-px" style={{ backgroundColor: '#f3f2ff' }} />
          <div className="flex flex-wrap gap-2">
            <Toggle label={t.home.filterOnlyRemote} active={draft.onlyRemote} onToggle={() => onUpdate({ onlyRemote: !draft.onlyRemote })} />
            <Toggle label={t.home.filterOnlyAbroad} active={draft.onlyAbroad} onToggle={() => onUpdate({ onlyAbroad: !draft.onlyAbroad })} />
            {tab === 'esplora' && <Toggle label={t.home.filterOnlyNew} active={draft.onlyNew} onToggle={() => onUpdate({ onlyNew: !draft.onlyNew })} />}
          </div>
          <div className="h-px" style={{ backgroundColor: '#f3f2ff' }} />
          {filterCategories.map((cat) => (
            <FilterSection key={cat.id} label={cat.label}>
              <div className="flex flex-wrap gap-2">
                {cat.options.map((opt) => <Chip key={opt.value} label={opt.label} active={(draft.badges[cat.id] ?? []).includes(opt.value)} onToggle={() => onToggleBadge(cat.id, opt.value)} />)}
              </div>
            </FilterSection>
          ))}
          <div className="h-px" style={{ backgroundColor: '#f3f2ff' }} />
          <FilterSection label={t.home.filterEnglishLevel}>
            <div className="flex flex-wrap gap-2">
              {ENGLISH_LEVELS.map((opt) => (
                <Chip key={opt.value} label={opt.label} active={draft.englishLevels.includes(opt.value)}
                  onToggle={() => onUpdate({ englishLevels: draft.englishLevels.includes(opt.value) ? draft.englishLevels.filter((v) => v !== opt.value) : [...draft.englishLevels, opt.value] })} />
              ))}
            </div>
          </FilterSection>
          {allTags.length > 0 && (
            <>
              <div className="h-px" style={{ backgroundColor: '#f3f2ff' }} />
              <FilterSection label={t.home.filterSkillsTags}>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <Chip key={tag} label={tag} active={draft.tags.includes(tag)}
                      onToggle={() => onUpdate({ tags: draft.tags.includes(tag) ? draft.tags.filter((v) => v !== tag) : [...draft.tags, tag] })} />
                  ))}
                </div>
              </FilterSection>
            </>
          )}
        </div>
        <div className="px-5 pt-4 pb-8" style={{ borderTop: '1px solid #f3f2ff' }}>
          <button onClick={onApply} className="w-full py-4 rounded-[20px] font-semibold text-[15px] text-white" style={{ backgroundColor: '#4a4bd7', fontFamily: 'var(--font-plus-jakarta)' }}>
            {`${t.home.applyFilters} (${matchCount})`}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<'per-te' | 'esplora'>('per-te');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const { savedIds, savedOpps, toggleSave } = useSavedOpportunities();
  const { t } = useLanguage();
  const allOpportunities = getOpportunities(t);
  const filterCategories = getFilterCategories(t);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingOpps, setLoadingOpps] = useState(true);
  const [perTePage, setPerTePage] = useState(1);
  const [perTeTotalPages, setPerTeTotalPages] = useState(1);
  const perTeTopRef = useRef<HTMLDivElement>(null);

  const [newOpportunities, setNewOpportunities] = useState<Opportunity[]>([]);
  const [loadingNew, setLoadingNew] = useState(false);
  const [esploraPage, setEsploraPage] = useState(1);
  const [esploraTotalPages, setEsploraTotalPages] = useState(1);
  const esploraTopRef = useRef<HTMLDivElement>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  useEffect(() => { setSearchHistory(loadHistory()); }, []);

  function addToHistory(term: string) {
    const tr = term.trim();
    if (!tr) return;
    const updated = [tr, ...searchHistory.filter((h) => h !== tr)].slice(0, MAX_HISTORY);
    setSearchHistory(updated); persistHistory(updated);
  }
  function removeFromHistory(term: string) { const u = searchHistory.filter((h) => h !== term); setSearchHistory(u); persistHistory(u); }
  function clearHistory() { setSearchHistory([]); localStorage.removeItem(HISTORY_KEY); }

  const searchContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) { setSearchFocused(false); setActiveSuggestionIndex(-1); }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function mapOpportunity(opp: any, extras?: Partial<Opportunity>): Opportunity {
    return {
      id: opp.id, title: opp.title,
      company: opp.company || opp.universityName || opp.university?.name || '',
      badge: `${opp.type}${opp.isRemote ? ' • REMOTE' : ''}`,
      description: opp.description || '', matchScore: opp.matchScore || 0,
      location: opp.location || opp.universityCity || opp.university?.city || '',
      about: opp.about || '', url: opp.url || '', type: opp.type || '',
      remote: opp.isRemote || false, isAbroad: opp.isAbroad || false,
      skills: opp.tags || [], requiredEnglishLevel: opp.requiredEnglishLevel || '',
      matchReason: opp.matchReason || '', deadline: opp.deadline || '',
      source: opp.source || '', ...extras,
    };
  }

  const loadPerTePage = useCallback((page: number, search: string, filters: AdvancedFilters, scrollToTop = false) => {
    setLoadingOpps(true);
    const qs = buildServerParams(search, filters);
    api.get(`/opportunities?matched=true&page=${page}&limit=20${qs}`)
      .then(({ data }) => {
        const items = data.data || data;
        const mapped = (Array.isArray(items) ? items : []).map((o: any) => mapOpportunity(o));
        setOpportunities(mapped.length > 0 ? mapped : [...allOpportunities].sort((a, b) => b.matchScore - a.matchScore));
        setPerTeTotalPages(data.totalPages || 1); setPerTePage(page);
        if (scrollToTop) setTimeout(() => perTeTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      })
      .catch(() => setOpportunities([...allOpportunities].sort((a, b) => b.matchScore - a.matchScore)))
      .finally(() => setLoadingOpps(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEsploraPage = useCallback((page: number, search: string, filters: AdvancedFilters, scrollToTop = false) => {
    setLoadingNew(true);
    const qs = buildServerParams(search, filters);
    api.get(`/opportunities?new=true&page=${page}&limit=20${qs}`)
      .then(({ data }) => {
        const items = data.data || data;
        const mapped = (Array.isArray(items) ? items : []).map((o: any) => mapOpportunity(o, { isNew: o.isNew ?? false }));
        setNewOpportunities(mapped.length > 0 ? mapped : [...allOpportunities].sort((a, b) => b.matchScore - a.matchScore));
        setEsploraTotalPages(data.totalPages || 1); setEsploraPage(page);
        if (scrollToTop) setTimeout(() => esploraTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      })
      .catch(() => setNewOpportunities([...allOpportunities].sort((a, b) => b.matchScore - a.matchScore)))
      .finally(() => setLoadingNew(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadPerTePage(1, '', DEFAULT_FILTERS); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    [...opportunities, ...newOpportunities].forEach((o) => o.skills.forEach((s) => s && set.add(s)));
    return Array.from(set).sort();
  }, [opportunities, newOpportunities]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>({ ...DEFAULT_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFilters>({ ...DEFAULT_FILTERS });

  function updateDraft(partial: Partial<AdvancedFilters>) { setDraftFilters((prev) => ({ ...prev, ...partial })); }
  function toggleDraftBadge(catId: string, value: string) {
    setDraftFilters((prev) => {
      const current = prev.badges[catId] ?? [];
      return { ...prev, badges: { ...prev.badges, [catId]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] } };
    });
  }
  function openFilterSheet() {
    setDraftFilters({ ...appliedFilters, badges: Object.fromEntries(Object.entries(appliedFilters.badges).map(([k, v]) => [k, [...v]])) });
    setFilterOpen(true);
  }

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      if (tab === 'per-te') loadPerTePage(1, searchQuery, appliedFilters);
      else loadEsploraPage(1, searchQuery, appliedFilters);
    }, 350);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  function applyFilters() {
    const newFilters = { ...draftFilters };
    setAppliedFilters(newFilters); setFilterOpen(false);
    if (tab === 'per-te') loadPerTePage(1, searchQuery, newFilters);
    else loadEsploraPage(1, searchQuery, newFilters);
  }

  const hasActiveFilters = hasAnyFilter(appliedFilters);

  function handleTabChange(newTab: 'per-te' | 'esplora') {
    setTab(newTab);
    if (newTab === 'esplora') loadEsploraPage(1, searchQuery, appliedFilters);
  }

  const viewedRef = useRef<Set<string>>(new Set());
  function handleOpen(opp: Opportunity) {
    if (!viewedRef.current.has(opp.id)) { viewedRef.current.add(opp.id); api.post(`/opportunities/${opp.id}/view`).catch(() => {}); }
    try { sessionStorage.setItem(`opp_${opp.id}`, JSON.stringify(opp)); } catch {}
    router.push(`/opportunities/${opp.id}`);
  }

  function handleSave(opp: Opportunity) {
    toggleSave(opp.id, { title: opp.title, company: opp.company, type: opp.type, description: opp.description, about: opp.about, location: opp.location, isRemote: opp.remote, url: opp.url, deadline: opp.deadline });
  }

  const perTePool = opportunities.filter((o) => matchesClientFilters(o, appliedFilters, 'per-te'));
  const esploraPool = newOpportunities.filter((o) => matchesClientFilters(o, appliedFilters, 'esplora'));
  const suggestions = getSuggestions(searchQuery, perTePool, esploraPool);
  const showSuggestions = searchFocused && searchQuery.trim().length > 0 && suggestions.length > 0;
  const showHistory = searchFocused && searchQuery.trim().length === 0 && searchHistory.length > 0;

  function handleSuggestionSelect(s: Suggestion) {
    addToHistory(searchQuery); setSearchFocused(false); setActiveSuggestionIndex(-1); setSearchQuery('');
    handleOpen(s.opp);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setSearchFocused(false); setActiveSuggestionIndex(-1); return; }
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggestionIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0) handleSuggestionSelect(suggestions[activeSuggestionIndex]);
      else { addToHistory(searchQuery); setSearchFocused(false); }
    }
  }

  const perTeFiltered = opportunities.filter((o) => matchesClientFilters(o, appliedFilters, 'per-te'));
  const esploraFiltered = newOpportunities.filter((o) => matchesClientFilters(o, appliedFilters, 'esplora'));
  const activeDataset = tab === 'per-te' ? opportunities : newOpportunities;
  const draftMatchCount = activeDataset.filter((o) => matchesClientFilters(o, draftFilters, tab)).length;
  const topOpportunity = perTeFiltered[0] ?? null;

  const isLoading = (loadingOpps && !opportunities.length) || (tab === 'esplora' && loadingNew && !newOpportunities.length);

  return (
    <>
      {/* ── Scrollable content ────────────────────────────────────── */}
      <div className="flex flex-col gap-[10px] px-[16px] pt-[8px] pb-[24px]">

        {/* 1. Opportunity of the Day */}
        {tab === 'per-te' && !searchQuery && (
          loadingOpps && !opportunities.length ? (
            <div className="rounded-[24px] animate-pulse" style={{ height: 220, backgroundColor: '#dddeff' }} />
          ) : topOpportunity ? (
            <OpportunityOfTheDay opp={topOpportunity} onOpen={() => handleOpen(topOpportunity)} />
          ) : null
        )}

        {/* 2. Search bar */}
        <div ref={searchContainerRef}>
          <div className="relative">
            <div className="bg-white rounded-full flex items-center" style={{ border: '1px solid #e4e7ff', boxShadow: '0px 1px 2px 0px rgba(0,0,0,0.05)', paddingTop: 14, paddingBottom: 14 }}>
              <div className="pl-[16px] pr-[8px] flex-shrink-0">
                <Search size={18} strokeWidth={2} color="#acb0ce" />
              </div>
              <input
                type="text"
                placeholder="Search internships, jobs..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setActiveSuggestionIndex(-1); }}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
                className="flex-1 min-w-0 bg-transparent outline-none text-[16px]"
                style={{ color: '#2c3149', fontFamily: 'var(--font-plus-jakarta)' }}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchFocused(false); }} className="px-2 flex-shrink-0" style={{ color: '#acb0ce' }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button onClick={openFilterSheet} className="pr-[16px] pl-[8px] flex-shrink-0 relative" style={{ color: hasActiveFilters ? '#4a4bd7' : '#acb0ce' }}>
                <Filter size={18} strokeWidth={2} color={hasActiveFilters ? '#4a4bd7' : '#acb0ce'} />
                {hasActiveFilters && (
                  <span className="absolute top-0 right-3 w-2 h-2 rounded-full" style={{ backgroundColor: '#4a4bd7' }} />
                )}
              </button>
            </div>

            {showHistory && (
              <SearchHistoryDropdown history={searchHistory} onSelect={(term) => { setSearchQuery(term); setActiveSuggestionIndex(-1); }} onRemove={removeFromHistory} onClear={clearHistory} />
            )}
            {showSuggestions && (
              <SearchDropdown suggestions={suggestions} query={searchQuery} activeIndex={activeSuggestionIndex} onSelect={handleSuggestionSelect} onHover={setActiveSuggestionIndex} />
            )}
          </div>
        </div>

        {/* 3. Filter chips — horizontally scrollable */}
        <div className="flex gap-[8px] overflow-x-auto no-scrollbar">
          <button
            onClick={() => handleTabChange('per-te')}
            className="flex-shrink-0 rounded-full font-medium text-[16px] px-[16px] transition-all"
            style={{
              paddingTop: 8.5, paddingBottom: 8.5,
              backgroundColor: tab === 'per-te' ? '#4a4bd7' : '#ecedff',
              color: tab === 'per-te' ? '#fbf7ff' : '#595e78',
              fontFamily: 'var(--font-plus-jakarta)',
              boxShadow: tab === 'per-te' ? '0px 1px 1px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            {t.home.forYou}
          </button>
          <button
            onClick={() => handleTabChange('esplora')}
            className="flex-shrink-0 rounded-full font-medium text-[16px] px-[17px] transition-all"
            style={{
              paddingTop: 9, paddingBottom: 9,
              backgroundColor: tab === 'esplora' ? '#4a4bd7' : '#ecedff',
              color: tab === 'esplora' ? '#fbf7ff' : '#595e78',
              fontFamily: 'var(--font-plus-jakarta)',
              boxShadow: tab === 'esplora' ? '0px 1px 1px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            {t.home.explore}
          </button>
        </div>

        {/* 4. Alert scadenze */}
        {(() => {
          const expiring = savedOpps.filter((o) => { if (!o.deadline) return false; const d = getDaysLeft(o.deadline); return d >= 0 && d <= 7; });
          if (!expiring.length) return null;
          const nearest = expiring.reduce((a, b) => getDaysLeft(a.deadline!) <= getDaysLeft(b.deadline!) ? a : b);
          const days = getDaysLeft(nearest.deadline!);
          const time = days <= 0 ? 'oggi' : days === 1 ? 'domani' : `tra ${days} giorni`;
          const verb = expiring.length === 1 ? 'scade' : 'scadono';
          return (
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-xs font-medium" style={{ color: '#d97706' }}>{`${expiring.length} opportunità ${verb} ${time}`}</p>
            </div>
          );
        })()}

        {/* 5. Opportunity cards */}
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[24px] p-[17px] animate-pulse" style={{ border: '1px solid #ecedff' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-[16px]" style={{ width: 48, height: 48, backgroundColor: '#e4e7ff' }} />
                  <div className="flex-1">
                    <div className="h-4 rounded-full mb-2" style={{ backgroundColor: '#ecedff', width: '70%' }} />
                    <div className="h-3 rounded-full" style={{ backgroundColor: '#ecedff', width: '50%' }} />
                  </div>
                </div>
                <div className="flex justify-between pt-[5px]" style={{ borderTop: '1px solid #f3f2ff' }}>
                  <div className="h-6 rounded-full" style={{ backgroundColor: '#ecedff', width: 48 }} />
                  <div className="h-6 rounded-full" style={{ backgroundColor: '#e0e1f4', width: 80 }} />
                </div>
              </div>
            ))}
          </>
        ) : tab === 'per-te' ? (
          <>
            <div ref={perTeTopRef} style={{ scrollMarginTop: 80 }} />
            {perTeFiltered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20" style={{ color: '#acb0ce' }}>
                <Search size={40} strokeWidth={1.5} color="#acb0ce" className="mb-3" />
                <p className="text-sm font-medium">{t.home.noOpportunities}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-[16px]">
                  {perTeFiltered.map((opp) => (
                    <OpportunityCard key={opp.id} opp={opp}
                      onOpen={() => handleOpen(opp)} isSaved={savedIds.has(opp.id)} onSave={() => handleSave(opp)} />
                  ))}
                </div>
                {perTeTotalPages > 1 && (
                  <Pagination currentPage={perTePage} totalPages={perTeTotalPages}
                    onPageChange={(p) => loadPerTePage(p, searchQuery, appliedFilters, true)} disabled={loadingOpps} />
                )}
              </>
            )}
          </>
        ) : esploraFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: '#acb0ce' }}>
            <Search size={40} strokeWidth={1.5} color="#acb0ce" className="mb-3" />
            <p className="text-sm font-medium">{t.home.noOpportunities}</p>
          </div>
        ) : (
          <>
            <div ref={esploraTopRef} style={{ scrollMarginTop: 80 }} />
            <div className="flex flex-col gap-[16px]">
              {esploraFiltered.map((opp) => (
                <OpportunityCard key={opp.id} opp={opp}
                  onOpen={() => handleOpen(opp)} isSaved={savedIds.has(opp.id)} onSave={() => handleSave(opp)} />
              ))}
            </div>
            {esploraTotalPages > 1 && (
              <Pagination currentPage={esploraPage} totalPages={esploraTotalPages}
                onPageChange={(p) => loadEsploraPage(p, searchQuery, appliedFilters, true)} disabled={loadingNew} />
            )}
          </>
        )}
      </div>

      {/* ── Filter sheet ──────────────────────────────────────────── */}
      <FilterSheet
        open={filterOpen} draft={draftFilters} allTags={allTags}
        matchCount={draftMatchCount} filterCategories={filterCategories}
        tab={tab} t={t}
        onUpdate={updateDraft} onToggleBadge={toggleDraftBadge}
        onReset={() => setDraftFilters({ ...DEFAULT_FILTERS })}
        onApply={applyFilters} onClose={() => setFilterOpen(false)}
      />
    </>
  );
}
