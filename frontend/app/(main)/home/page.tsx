'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSavedOpportunities } from '@/lib/savedOpportunities';
import { useLanguage } from '@/lib/language';
import { isValidExternalUrl } from '@/lib/urlValidation';
import api from '@/lib/api';
import { parseDeadlineDate } from '@/lib/dateUtils';
import {
  GridSmall, Bulb, BookOpen, TrendingUp,
  ChevronDown as ChevronDownIcon,
  Bookmark, MapPin, CalendarIcon, Search, Filter,
} from '@/components/icons';

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

const CC_BY_SOURCES = new Set([
  'EURES',
  'Portale Europeo Giovani',
  'MUR',
  'AlmaLaurea',
]);

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
  badges: {},
  company: '',
  location: '',
  minScore: 1,
  maxScore: 100,
  deadline: '',
  onlyRemote: false,
  onlyAbroad: false,
  onlyNew: false,
  englishLevels: [],
  tags: [],
};

/* ── Score helpers ───────────────────────────────────────────────── */

function getScoreColor(score: number): string {
  if (score >= 75) return '#22C55E';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function CircularProgress({ score }: { score: number }) {
  const radius = 24;
  const stroke = 3.5;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);
  return (
    <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
      <svg width={56} height={56} className="-rotate-90">
        <circle cx={28} cy={28} r={normalizedRadius} fill="transparent" stroke="#1E293B" strokeWidth={stroke} />
        <circle cx={28} cy={28} r={normalizedRadius} fill="transparent"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>
        {score}%
      </span>
    </div>
  );
}

/* ── Static fallback data ────────────────────────────────────────── */

type BaseOpportunity = Omit<Opportunity, 'description' | 'about' | 'location'>;

const BASE_OPPORTUNITIES: BaseOpportunity[] = [
  { id: '1', title: 'Software Engineer Intern', company: 'TechNova Solutions', badge: 'FULL-TIME • REMOTE', matchScore: 85, url: 'https://www.technova.io/careers/software-engineer-intern', type: 'full-time', remote: true, skills: [], matchReason: '', deadline: '2026-04-02' },
  { id: '2', title: 'Product Design Workshop', company: 'Creative Hub Milan', badge: 'WORKSHOP • HYBRID', matchScore: 62, url: 'https://www.creativehubmilan.it/workshop/product-design', type: 'workshop', remote: false, skills: [], matchReason: '', deadline: '2026-04-05' },
  { id: '3', title: 'Data Analyst Junior', company: 'Fintech Alpha', badge: 'JUNIOR • IN-PERSON', matchScore: 35, type: 'junior', remote: false, skills: [], matchReason: '', deadline: '2026-04-20' },
  { id: '4', title: 'Master in AI Ethics', company: 'Politecnico di Milano', badge: 'EDUCATION • PART-TIME', matchScore: 92, url: 'https://www.polimi.it/formazione/master-e-corsi/master/master-in-ai-ethics', type: 'education', remote: false, skills: [], matchReason: '', deadline: '2026-05-10' },
];

function OpportunityIcon({ type, size = 24 }: { type: string; size?: number }) {
  const t = type.toLowerCase();
  if (t.includes('full-time') || t.includes('intern')) return <GridSmall size={size} className="text-gray-400" />;
  if (t.includes('workshop')) return <Bulb size={size} className="text-gray-400" />;
  if (t.includes('education') || t.includes('master')) return <BookOpen size={size} className="text-gray-400" />;
  return <TrendingUp size={size} className="text-gray-400" />;
}

function getOpportunities(t: ReturnType<typeof useLanguage>['t']): Opportunity[] {
  return BASE_OPPORTUNITIES.map((opp) => ({
    ...opp,
    ...t.opportunitiesContent[opp.id as keyof typeof t.opportunitiesContent],
  }));
}

/* ── Filter predicates ───────────────────────────────────────────── */

function matchesSearch(opp: Opportunity, q: string): boolean {
  if (!q) return true;
  return opp.title.toLowerCase().includes(q) || opp.company.toLowerCase().includes(q) || opp.badge.toLowerCase().includes(q);
}

function matchesAllFilters(opp: Opportunity, q: string, f: AdvancedFilters, tab: 'per-te' | 'esplora'): boolean {
  if (!matchesSearch(opp, q)) return false;

  // Badge chips (tipo / modalità / livello)
  const badge = opp.badge.toLowerCase();
  const type = opp.type.toLowerCase();
  for (const values of Object.values(f.badges)) {
    if (values.length === 0) continue;
    if (!values.some((v) => badge.includes(v) || type.includes(v))) return false;
  }

  // Text filters
  if (f.company && !opp.company.toLowerCase().includes(f.company.toLowerCase())) return false;
  if (f.location && !opp.location.toLowerCase().includes(f.location.toLowerCase())) return false;

  // Score range
  if (opp.matchScore < f.minScore || opp.matchScore > f.maxScore) return false;

  // Deadline
  if (f.deadline) {
    const daysLeft = getDaysLeft(opp.deadline);
    if (f.deadline === '7' && daysLeft > 7) return false;
    if (f.deadline === '30' && daysLeft > 30) return false;
    if (f.deadline === 'month') {
      const today = new Date();
      const d = parseDeadlineDate(opp.deadline);
      if (!d || d.getMonth() !== today.getMonth() || d.getFullYear() !== today.getFullYear()) return false;
    }
  }

  // Toggles
  if (f.onlyRemote && !opp.remote) return false;
  if (f.onlyAbroad && !opp.isAbroad) return false;
  if (f.onlyNew && tab !== 'per-te' && !opp.isNew) return false;

  // English level
  if (f.englishLevels.length > 0 && (!opp.requiredEnglishLevel || !f.englishLevels.includes(opp.requiredEnglishLevel))) return false;

  // Skills/tags
  if (f.tags.length > 0 && !opp.skills.some((s) => f.tags.includes(s))) return false;

  return true;
}

function hasAnyFilter(f: AdvancedFilters): boolean {
  return (
    Object.values(f.badges).some((arr) => arr.length > 0) ||
    !!f.company || !!f.location ||
    f.minScore > 1 || f.maxScore < 100 ||
    !!f.deadline ||
    f.onlyRemote || f.onlyAbroad || f.onlyNew ||
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

function persistHistory(items: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

/* ── Smart search helpers ────────────────────────────────────────── */

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
  return combined
    .filter(({ opp }) => matchesSearch(opp, q))
    .sort((a, b) => rank(b.opp) - rank(a.opp) || b.opp.matchScore - a.opp.matchScore)
    .slice(0, 6);
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <span className="text-gray-400">{text}</span>;
  return (
    <>
      <span className="text-gray-400">{text.slice(0, idx)}</span>
      <span className="text-white font-semibold">{text.slice(idx, idx + q.length)}</span>
      <span className="text-gray-400">{text.slice(idx + q.length)}</span>
    </>
  );
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
  { label: 'A2',    value: 'A2' },
  { label: 'B1-B2', value: 'B1_B2' },
  { label: 'C1',    value: 'C1' },
  { label: 'C2+',   value: 'C2_PLUS' },
];

/* ── Shared primitives ───────────────────────────────────────────── */

function ChevronDown({ rotated }: { rotated: boolean }) {
  return (
    <ChevronDownIcon size={16} strokeWidth={2}
      className={`text-gray-500 flex-shrink-0 transition-transform duration-300 ${rotated ? 'rotate-180' : ''}`}
    />
  );
}

function Accordion({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.32s cubic-bezier(0.4,0,0.2,1)' }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>{children}</div>
    </div>
  );
}

function BookmarkIcon({ filled, className }: { filled: boolean; className?: string }) {
  return <Bookmark filled={filled} strokeWidth={1.8} className={className} />;
}

function Chip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all active:opacity-75 ${active ? 'bg-primary text-white' : 'bg-[#0D1117] text-gray-400'}`}>
      {label}
    </button>
  );
}

function Toggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:opacity-75 ${active ? 'bg-primary text-white' : 'bg-[#0D1117] text-gray-400'}`}>
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
        <span className="text-primary text-sm font-bold tabular-nums">{minVal}% – {maxVal}%</span>
      </div>

      {/* Shared visual track */}
      <div className="relative h-1.5 rounded-full bg-[#0D1117] my-4 mx-2.5">
        <div className="absolute h-full rounded-full bg-primary transition-all duration-75"
          style={{ left: `${minVal}%`, right: `${100 - maxVal}%` }} />
      </div>

      {/* Two overlapping transparent range inputs */}
      <div className="pf-dual-range">
        <input type="range" min={1} max={99} value={minVal}
          onChange={(e) => { const v = Number(e.target.value); if (v < maxVal) onMinChange(v); }}
          style={{ zIndex: minZ }}
        />
        <input type="range" min={2} max={100} value={maxVal}
          onChange={(e) => { const v = Number(e.target.value); if (v > minVal) onMaxChange(v); }}
          style={{ zIndex: maxZ }}
        />
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
  const colors = { green: 'bg-green-500/20 text-green-400', yellow: 'bg-amber-500/20 text-amber-400', red: 'bg-red-500/20 text-red-400' };
  const label = daysLeft <= 0 ? 'Scaduta' : daysLeft === 1 ? 'Scade domani' : dateStr;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${colors[urgency]} ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}>
      <svg className={size === 'xs' ? 'w-2.5 h-2.5 flex-shrink-0' : 'w-3 h-3 flex-shrink-0'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
      {label}
    </span>
  );
}

/* ── FullWidthCard ───────────────────────────────────────────────── */

function FullWidthCard({ opp, showScore, isExpanded, onToggle, isSaved, onSave }: {
  opp: Opportunity; showScore?: boolean; isExpanded: boolean;
  onToggle: () => void; isSaved: boolean; onSave: () => void;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  return (
    <div ref={ref} className="bg-[#161B22] rounded-2xl overflow-hidden" style={{ scrollMarginTop: 80 }}>
      <button onClick={onToggle} className="w-full text-left p-5 active:opacity-75 transition-opacity">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-14 h-14 rounded-xl bg-[#1E293B] flex items-center justify-center flex-shrink-0">
            <OpportunityIcon type={opp.type} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-[17px] leading-tight">{opp.title}</h3>
            <p className="text-primary text-sm font-medium mt-0.5">{opp.company}</p>
          </div>
          <div className="flex-shrink-0">
            {showScore ? (
              <div className="relative" style={{ width: 56, height: 56 }}>
                <div className={`absolute inset-0 transition-opacity duration-300 ${isExpanded ? 'opacity-0' : 'opacity-100'}`}>
                  <CircularProgress score={opp.matchScore} />
                </div>
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                  <ChevronDown rotated={isExpanded} />
                </div>
              </div>
            ) : (
              <span className={isExpanded ? 'visible' : 'invisible'}><ChevronDown rotated={isExpanded} /></span>
            )}
          </div>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-block bg-[#1E293B] text-gray-400 text-[11px] font-semibold tracking-wider px-3 py-1.5 rounded-lg">{opp.badge}</span>
          {opp.isNew && <span className="inline-block bg-primary/20 text-primary text-[11px] font-bold tracking-wider px-2.5 py-1.5 rounded-lg">NEW</span>}
        </div>
        <p className={`text-gray-400 text-sm leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>{opp.description}</p>
      </button>
      <Accordion open={isExpanded}>
        <div className="px-5 pb-5 space-y-4">
          <div className="h-px bg-[#1E293B]" />

          {/* Location + date + source chips */}
          <div className="flex flex-wrap gap-2">
            {opp.location && (
              <div className="flex items-center gap-1.5 bg-[#0D1117] rounded-xl px-3 py-2">
                <MapPin size={14} strokeWidth={1.8} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-300 text-xs">{opp.location}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-[#0D1117] rounded-xl px-3 py-2">
              <CalendarIcon size={14} strokeWidth={1.8} className="text-gray-400 flex-shrink-0" />
              <span className="text-gray-300 text-xs">{t.home.publishedDaysAgo}</span>
            </div>
            {opp.source && (
              <div className="flex items-center gap-1.5 bg-[#0D1117] rounded-xl px-3 py-2">
                <span className="text-primary text-xs font-medium">{opp.source}</span>
              </div>
            )}
          </div>
          <div className="h-px bg-[#1E293B]" />
          <div>
            <p className="text-white font-semibold text-sm mb-2">{opp.company}</p>
            <p className="text-gray-400 text-sm leading-relaxed">{opp.about}</p>
          </div>

          {/* Source attribution */}
          {opp.source && (
            <p className="text-gray-500 text-[10px]">
              {isCCBYSource(opp.source)
                ? `Dati forniti da ${opp.source} — licenza CC BY 4.0`
                : `Fonte: ${opp.source}`}
            </p>
          )}

          {/* CTA */}
          <div className="flex gap-3">
            <button onClick={() => opp.url && isValidExternalUrl(opp.url) && window.open(opp.url, '_blank', 'noopener,noreferrer')}
              disabled={!opp.url || !isValidExternalUrl(opp.url)}
              className={`flex-1 py-3.5 rounded-2xl font-semibold text-[15px] transition-opacity ${opp.url && isValidExternalUrl(opp.url) ? 'bg-primary text-white active:opacity-90' : 'bg-[#1E293B] text-gray-500 cursor-not-allowed'}`}>
              {opp.url ? t.home.goToOpportunity : t.home.linkUnavailable}
            </button>
            <button onClick={onSave}
              className={`w-12 h-12 bg-[#0D1117] rounded-2xl flex items-center justify-center flex-shrink-0 active:opacity-75 transition-all ${isSaved ? 'text-primary' : 'text-gray-400'}`}>
              <BookmarkIcon filled={isSaved} className="w-5 h-5" />
            </button>
          </div>
        </div>
      </Accordion>
    </div>
  );
}

/* ── HalfWidthCard ───────────────────────────────────────────────── */

function HalfWidthCard({ opp, isExpanded, onToggle, isSaved, onSave }: {
  opp: Opportunity; isExpanded: boolean; onToggle: () => void; isSaved: boolean; onSave: () => void;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  return (
    <div ref={ref} className="bg-[#161B22] rounded-2xl overflow-hidden" style={{ scrollMarginTop: 80 }}>
      <button onClick={onToggle} className="w-full text-left p-4 active:opacity-75 transition-opacity">
        <div className="flex items-start gap-2.5 mb-1.5">
          <div className="w-9 h-9 rounded-lg bg-[#1E293B] flex items-center justify-center flex-shrink-0">
            <OpportunityIcon type={opp.type} size={18} />
          </div>
          <h3 className="text-white font-semibold text-[13px] leading-snug flex-1 min-w-0 line-clamp-2">{opp.title}</h3>
          <span className={isExpanded ? 'visible' : 'invisible'}><ChevronDown rotated={isExpanded} /></span>
        </div>
        <p className="text-primary text-[11px] font-medium line-clamp-1">{opp.company}</p>
        <div className="flex items-center gap-1.5 mt-3">
          <span className="inline-block bg-[#1E293B] text-gray-400 text-[10px] font-semibold tracking-wider px-2 py-1 rounded-lg">{opp.badge.split(' • ')[0]}</span>
          <span className="text-[11px] font-bold" style={{ color: getScoreColor(opp.matchScore) }}>{opp.matchScore}%</span>
        </div>
      </button>
      <Accordion open={isExpanded}>
        <div className="px-4 pb-4 space-y-3">
          <div className="h-px bg-[#1E293B]" />
          <p className="text-gray-400 text-[12px] leading-relaxed">{opp.description}</p>

          {/* Location + source chips */}
          <div className="flex flex-wrap gap-1.5">
            {opp.location && (
              <div className="flex items-center gap-1.5 bg-[#0D1117] rounded-xl px-2.5 py-1.5">
                <MapPin size={12} strokeWidth={1.8} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-300 text-[11px]">{opp.location}</span>
              </div>
            )}
            {opp.source && (
              <div className="flex items-center bg-[#0D1117] rounded-xl px-2.5 py-1.5">
                <span className="text-primary text-[11px] font-medium">{opp.source}</span>
              </div>
            )}
          </div>
          <div className="h-px bg-[#1E293B]" />
          <div>
            <p className="text-white font-semibold text-[12px] mb-1.5">{opp.company}</p>
            <p className="text-gray-400 text-[11px] leading-relaxed">{opp.about}</p>
          </div>

          {/* Source attribution */}
          {opp.source && (
            <p className="text-gray-500 text-[9px]">
              {isCCBYSource(opp.source)
                ? `Dati forniti da ${opp.source} — licenza CC BY 4.0`
                : `Fonte: ${opp.source}`}
            </p>
          )}

          {/* CTA — scaled down to fit the narrow column */}
          <div className="flex gap-2 pt-1">
            <button onClick={() => opp.url && isValidExternalUrl(opp.url) && window.open(opp.url, '_blank', 'noopener,noreferrer')}
              disabled={!opp.url || !isValidExternalUrl(opp.url)}
              className={`flex-1 py-3 rounded-xl font-semibold text-[12px] transition-opacity ${opp.url && isValidExternalUrl(opp.url) ? 'bg-primary text-white active:opacity-90' : 'bg-[#1E293B] text-gray-500 cursor-not-allowed'}`}>
              {opp.url ? t.home.goToOpportunity : t.home.linkUnavailable}
            </button>
            <button onClick={onSave}
              className={`w-10 h-10 bg-[#0D1117] rounded-xl flex items-center justify-center flex-shrink-0 active:opacity-75 transition-all ${isSaved ? 'text-primary' : 'text-gray-400'}`}>
              <BookmarkIcon filled={isSaved} className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Accordion>
    </div>
  );
}

/* ── PairRow ─────────────────────────────────────────────────────── */

function PairRow({ items, expandedId, onToggle, savedIds, onSave }: {
  items: Opportunity[]; expandedId: string | null;
  onToggle: (id: string) => void; savedIds: Set<string>; onSave: (id: string) => void;
}) {
  const expandedIndex = items.findIndex((o) => o.id === expandedId);
  const anyExpanded = expandedIndex !== -1;
  const hasPair = items.length > 1;
  const latchedSiblingRef = useRef<Opportunity | null>(null);
  if (anyExpanded && hasPair) latchedSiblingRef.current = items.find((o) => o.id !== expandedId) ?? null;
  const displayedSibling = latchedSiblingRef.current;
  const gridTemplateColumns = expandedIndex === 0 ? '1fr 0fr' : expandedIndex === 1 ? '0fr 1fr' : '1fr 1fr';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns, gap: anyExpanded ? 0 : 16, alignItems: 'start', transition: 'grid-template-columns 0.32s cubic-bezier(0.4,0,0.2,1), gap 0.32s cubic-bezier(0.4,0,0.2,1)' }}>
        {items.map((opp) => (
          <div key={opp.id} style={{ overflow: 'hidden' }}>
            <HalfWidthCard opp={opp} isExpanded={expandedId === opp.id} onToggle={() => onToggle(opp.id)} isSaved={savedIds.has(opp.id)} onSave={() => onSave(opp.id)} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateRows: anyExpanded && hasPair ? '1fr' : '0fr', marginTop: anyExpanded && hasPair ? 16 : 0, transition: 'grid-template-rows 0.32s cubic-bezier(0.4,0,0.2,1), margin-top 0.32s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {displayedSibling && (
            <HalfWidthCard opp={displayedSibling} isExpanded={false} onToggle={() => onToggle(displayedSibling.id)} isSaved={savedIds.has(displayedSibling.id)} onSave={() => onSave(displayedSibling.id)} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── EsploraGrid ─────────────────────────────────────────────────── */

function EsploraGrid({ items, expandedId, onToggle, savedIds, onSave }: {
  items: Opportunity[]; expandedId: string | null;
  onToggle: (id: string) => void; savedIds: Set<string>; onSave: (id: string) => void;
}) {
  const chunks: Array<{ type: 'full' | 'pair'; items: Opportunity[] }> = [];
  let i = 0;
  while (i < items.length) {
    chunks.push({ type: 'full', items: [items[i]] }); i++;
    if (i < items.length) {
      const pair = items.slice(i, Math.min(i + 2, items.length));
      chunks.push({ type: 'pair', items: pair });
      i += pair.length;
    }
  }
  return (
    <div className="space-y-4">
      {chunks.map((chunk) => chunk.type === 'full' ? (
        <FullWidthCard key={chunk.items[0].id} opp={chunk.items[0]} showScore isExpanded={expandedId === chunk.items[0].id} onToggle={() => onToggle(chunk.items[0].id)} isSaved={savedIds.has(chunk.items[0].id)} onSave={() => onSave(chunk.items[0].id)} />
      ) : (
        <PairRow key={chunk.items.map((o) => o.id).join('-')} items={chunk.items} expandedId={expandedId} onToggle={onToggle} savedIds={savedIds} onSave={onSave} />
      ))}
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
    <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-[#161B22] rounded-2xl border border-[#1E293B] overflow-hidden shadow-2xl" style={{ zIndex: 9999 }}>
      {suggestions.map((s, i) => (
        <button key={s.opp.id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(s)}
          onMouseEnter={() => onHover(i)}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#0D1117] last:border-0 ${i === activeIndex ? 'bg-[#1E293B]' : 'hover:bg-[#1E293B]/60'}`}>
          <div className="w-8 h-8 rounded-lg bg-[#0D1117] flex items-center justify-center flex-shrink-0">
            <OpportunityIcon type={s.opp.type} size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate leading-tight"><HighlightedText text={s.opp.title} query={query} /></p>
            <p className="text-xs truncate mt-0.5"><HighlightedText text={s.opp.company} query={query} /></p>
          </div>
          <span className="text-[10px] text-gray-500 bg-[#0D1117] px-2 py-1 rounded-lg flex-shrink-0 uppercase tracking-wide whitespace-nowrap">
            {s.opp.badge.split(' • ')[0]}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── SearchHistoryDropdown ───────────────────────────────────────── */

function SearchHistoryDropdown({ history, onSelect, onRemove, onClear }: {
  history: string[];
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
}) {
  if (!history.length) return null;
  return (
    <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-[#161B22] rounded-2xl border border-[#1E293B] overflow-hidden shadow-2xl" style={{ zIndex: 9999 }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Recenti</span>
        <button onMouseDown={(e) => e.preventDefault()} onClick={onClear}
          className="text-gray-500 text-xs active:opacity-60 transition-opacity">
          Cancella tutto
        </button>
      </div>
      {history.map((term) => (
        <div key={term} className="flex items-center gap-3 px-4 py-2.5 border-t border-[#0D1117] hover:bg-[#1E293B]/60 transition-colors">
          <svg className="w-4 h-4 text-gray-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => onSelect(term)}
            className="flex-1 text-left text-sm text-gray-300 truncate">
            {term}
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => onRemove(term)}
            className="text-gray-600 active:opacity-60 p-1 -mr-1 flex-shrink-0">
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

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  // Build page numbers: show at most 5 pages around current
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const btnBase = 'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium transition-all active:opacity-75';

  return (
    <div className="flex items-center justify-center gap-1.5 mt-6 mb-2">
      {/* Prev arrow */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled || currentPage === 1}
        className={`${btnBase} ${currentPage === 1 ? 'text-gray-600 cursor-not-allowed' : 'bg-[#161B22] text-gray-300'}`}
        aria-label="Pagina precedente"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 12L6 8L10 4" />
        </svg>
      </button>

      {/* Page numbers */}
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="w-8 text-center text-gray-500 text-sm">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            disabled={disabled || p === currentPage}
            className={`${btnBase} ${
              p === currentPage
                ? 'bg-primary text-white'
                : 'bg-[#161B22] text-gray-400 hover:text-white'
            }`}
          >
            {p}
          </button>
        )
      )}

      {/* Next arrow */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled || currentPage === totalPages}
        className={`${btnBase} ${currentPage === totalPages ? 'text-gray-600 cursor-not-allowed' : 'bg-[#161B22] text-gray-300'}`}
        aria-label="Pagina successiva"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4L10 8L6 12" />
        </svg>
      </button>
    </div>
  );
}

/* ── FilterSheet ─────────────────────────────────────────────────── */

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">{label}</p>
      {children}
    </div>
  );
}

function FilterSheet({
  open, draft, allTags, matchCount, filterCategories, tab, t,
  onUpdate, onToggleBadge, onReset, onApply, onClose,
}: {
  open: boolean;
  draft: AdvancedFilters;
  allTags: string[];
  matchCount: number;
  filterCategories: ReturnType<typeof getFilterCategories>;
  tab: 'per-te' | 'esplora';
  t: ReturnType<typeof useLanguage>['t'];
  onUpdate: (partial: Partial<AdvancedFilters>) => void;
  onToggleBadge: (catId: string, value: string) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const deadlineOptions: Array<{ label: string; value: AdvancedFilters['deadline'] }> = [
    { label: t.home.filterDeadlineAll, value: '' },
    { label: t.home.filterDeadline7d, value: '7' },
    { label: t.home.filterDeadline30d, value: '30' },
    { label: t.home.filterDeadlineThisMonth, value: 'month' },
  ];

  return (
    <>
      <div className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}>

        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-[#2D3748]" /></div>

        <div className="flex items-center justify-between px-5 pt-3 pb-4">
          <h2 className="text-white font-bold text-lg">{t.home.filters}</h2>
          <button onClick={onReset} className="text-primary text-sm font-semibold active:opacity-70 transition-opacity">{t.home.reset}</button>
        </div>

        <div className="px-5 pb-4 space-y-6 max-h-[68vh] overflow-y-auto no-scrollbar">

          {/* ── Azienda ───────────────────────────────── */}
          <FilterSection label={t.home.filterCompany}>
            <div className="relative">
              <input type="text" placeholder={t.home.filterCompanyPlaceholder} value={draft.company}
                onChange={(e) => onUpdate({ company: e.target.value })}
                className="w-full bg-[#0D1117] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              {draft.company && (
                <button onClick={() => onUpdate({ company: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 active:opacity-70">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </FilterSection>

          {/* ── Sede ──────────────────────────────────── */}
          <FilterSection label={t.home.filterLocation}>
            <div className="relative">
              <input type="text" placeholder={t.home.filterLocationPlaceholder} value={draft.location}
                onChange={(e) => onUpdate({ location: e.target.value })}
                className="w-full bg-[#0D1117] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              {draft.location && (
                <button onClick={() => onUpdate({ location: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 active:opacity-70">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </FilterSection>

          <div className="h-px bg-[#1E293B]" />

          {/* ── Affinità ───────────────────────────────── */}
          <FilterSection label={t.home.filterScoreRange}>
            <DualRangeSlider
              minVal={draft.minScore} maxVal={draft.maxScore}
              onMinChange={(v) => onUpdate({ minScore: v })}
              onMaxChange={(v) => onUpdate({ maxScore: v })}
            />
          </FilterSection>

          <div className="h-px bg-[#1E293B]" />

          {/* ── Scadenza ───────────────────────────────── */}
          <FilterSection label={t.home.filterDeadline}>
            <div className="flex flex-wrap gap-2">
              {deadlineOptions.map((opt) => (
                <Chip key={opt.value} label={opt.label} active={draft.deadline === opt.value} onToggle={() => onUpdate({ deadline: opt.value })} />
              ))}
            </div>
          </FilterSection>

          <div className="h-px bg-[#1E293B]" />

          {/* ── Modalità speciale ─────────────────────── */}
          <div className="flex flex-wrap gap-2">
            <Toggle label={t.home.filterOnlyRemote} active={draft.onlyRemote} onToggle={() => onUpdate({ onlyRemote: !draft.onlyRemote })} />
            <Toggle label={t.home.filterOnlyAbroad} active={draft.onlyAbroad} onToggle={() => onUpdate({ onlyAbroad: !draft.onlyAbroad })} />
            {tab === 'esplora' && (
              <Toggle label={t.home.filterOnlyNew} active={draft.onlyNew} onToggle={() => onUpdate({ onlyNew: !draft.onlyNew })} />
            )}
          </div>

          <div className="h-px bg-[#1E293B]" />

          {/* ── Tipo / Modalità / Livello ──────────────── */}
          {filterCategories.map((cat) => (
            <FilterSection key={cat.id} label={cat.label}>
              <div className="flex flex-wrap gap-2">
                {cat.options.map((opt) => (
                  <Chip key={opt.value} label={opt.label} active={(draft.badges[cat.id] ?? []).includes(opt.value)} onToggle={() => onToggleBadge(cat.id, opt.value)} />
                ))}
              </div>
            </FilterSection>
          ))}

          <div className="h-px bg-[#1E293B]" />

          {/* ── Inglese richiesto ─────────────────────── */}
          <FilterSection label={t.home.filterEnglishLevel}>
            <div className="flex flex-wrap gap-2">
              {ENGLISH_LEVELS.map((opt) => (
                <Chip key={opt.value} label={opt.label}
                  active={draft.englishLevels.includes(opt.value)}
                  onToggle={() => onUpdate({ englishLevels: draft.englishLevels.includes(opt.value) ? draft.englishLevels.filter((v) => v !== opt.value) : [...draft.englishLevels, opt.value] })}
                />
              ))}
            </div>
          </FilterSection>

          {/* ── Skills / Tag ──────────────────────────── */}
          {allTags.length > 0 && (
            <>
              <div className="h-px bg-[#1E293B]" />
              <FilterSection label={t.home.filterSkillsTags}>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <Chip key={tag} label={tag}
                      active={draft.tags.includes(tag)}
                      onToggle={() => onUpdate({ tags: draft.tags.includes(tag) ? draft.tags.filter((v) => v !== tag) : [...draft.tags, tag] })}
                    />
                  ))}
                </div>
              </FilterSection>
            </>
          )}

        </div>

        <div className="px-5 pt-4 pb-8 border-t border-[#1E293B]">
          <button onClick={onApply} className="w-full bg-primary text-white py-4 rounded-2xl font-semibold text-[15px] active:opacity-90 transition-opacity">
            {`${t.home.applyFilters} (${matchCount})`}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [tab, setTab] = useState<'per-te' | 'esplora'>('per-te');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { savedIds, savedOpps, toggleSave } = useSavedOpportunities();
  const { t } = useLanguage();
  const allOpportunities = getOpportunities(t);
  const filterCategories = getFilterCategories(t);

  // "Per te" — matched opportunities with pagination
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingOpps, setLoadingOpps] = useState(true);
  const [perTePage, setPerTePage] = useState(1);
  const [perTeTotalPages, setPerTeTotalPages] = useState(1);
  const perTeTopRef = useRef<HTMLDivElement>(null);

  const [newOpportunities, setNewOpportunities] = useState<Opportunity[]>([]);
  const [loadingNew, setLoadingNew] = useState(false);
  const newFetched = useRef(false);

  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  useEffect(() => { setSearchHistory(loadHistory()); }, []);

  function addToHistory(term: string) {
    const t = term.trim();
    if (!t) return;
    const updated = [t, ...searchHistory.filter((h) => h !== t)].slice(0, MAX_HISTORY);
    setSearchHistory(updated);
    persistHistory(updated);
  }

  function removeFromHistory(term: string) {
    const updated = searchHistory.filter((h) => h !== term);
    setSearchHistory(updated);
    persistHistory(updated);
  }

  function clearHistory() {
    setSearchHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  const searchContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false); setActiveSuggestionIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function mapOpportunity(opp: any, extras?: Partial<Opportunity>): Opportunity {
    return {
      id: opp.id, title: opp.title,
      company: opp.company || opp.universityName || opp.university?.name || '',
      badge: `${opp.type}${opp.isRemote ? ' \u2022 REMOTE' : ''}`,
      description: opp.description || '', matchScore: opp.matchScore || 0,
      location: opp.location || opp.universityCity || opp.university?.city || '',
      about: opp.about || '', url: opp.url || '', type: opp.type || '',
      remote: opp.isRemote || false, isAbroad: opp.isAbroad || false,
      skills: opp.tags || [], requiredEnglishLevel: opp.requiredEnglishLevel || '',
      matchReason: opp.matchReason || '', deadline: opp.deadline || '',
      source: opp.source || '',
      ...extras,
    };
  }

  const loadPerTePage = (page: number, scrollToTop = false) => {
    setLoadingOpps(true);
    api.get(`/opportunities?matched=true&page=${page}&limit=20`)
      .then(({ data }) => {
        const items = data.data || data;
        const mapped = (Array.isArray(items) ? items : []).map((o: any) => mapOpportunity(o));
        setOpportunities(mapped.length > 0 ? mapped : [...allOpportunities].sort((a, b) => b.matchScore - a.matchScore));
        setPerTeTotalPages(data.totalPages || 1);
        setPerTePage(page);
        if (scrollToTop) {
          setTimeout(() => {
            perTeTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }
      })
      .catch(() => setOpportunities([...allOpportunities].sort((a, b) => b.matchScore - a.matchScore)))
      .finally(() => setLoadingOpps(false));
  };

  useEffect(() => { loadPerTePage(1); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchNewOpportunities = useCallback(() => {
    if (newFetched.current) return;
    newFetched.current = true; setLoadingNew(true);
    api.get('/opportunities?new=true&limit=20')
      .then(({ data }) => {
        const items = data.data || data;
        const mapped = (Array.isArray(items) ? items : []).map((o: any) => mapOpportunity(o, { isNew: o.isNew ?? false }));
        setNewOpportunities(mapped.length > 0 ? mapped : [...allOpportunities].sort((a, b) => b.matchScore - a.matchScore));
      })
      .catch(() => setNewOpportunities([...allOpportunities].sort((a, b) => b.matchScore - a.matchScore)))
      .finally(() => setLoadingNew(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // All unique tags from both datasets
  const allTags = useMemo(() => {
    const set = new Set<string>();
    [...opportunities, ...newOpportunities].forEach((o) => o.skills.forEach((s) => s && set.add(s)));
    return Array.from(set).sort();
  }, [opportunities, newOpportunities]);

  // Filter state — single object for draft + applied
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>({ ...DEFAULT_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFilters>({ ...DEFAULT_FILTERS });

  function updateDraft(partial: Partial<AdvancedFilters>) {
    setDraftFilters((prev) => ({ ...prev, ...partial }));
  }

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

  function applyFilters() {
    setAppliedFilters({ ...draftFilters });
    setFilterOpen(false);
  }

  const hasActiveFilters = hasAnyFilter(appliedFilters);

  function handleTabChange(newTab: 'per-te' | 'esplora') {
    setTab(newTab); setExpandedId(null);
    if (newTab === 'esplora') fetchNewOpportunities();
  }

  const viewedRef = useRef<Set<string>>(new Set());
  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    if (!viewedRef.current.has(id)) { viewedRef.current.add(id); api.post(`/opportunities/${id}/view`).catch(() => {}); }
  }

  function handleSave(opp: Opportunity) {
    toggleSave(opp.id, { title: opp.title, company: opp.company, type: opp.type, description: opp.description, about: opp.about, location: opp.location, isRemote: opp.remote, url: opp.url, deadline: opp.deadline });
  }

  // Smart search — pool limited to opportunities that pass the active filters (query excluded)
  const perTePool = opportunities.filter((o) => matchesAllFilters(o, '', appliedFilters, 'per-te'));
  const esploraPool = newOpportunities.filter((o) => matchesAllFilters(o, '', appliedFilters, 'esplora'));
  const suggestions = getSuggestions(searchQuery, perTePool, esploraPool);
  const showSuggestions = searchFocused && searchQuery.trim().length > 0 && suggestions.length > 0;
  const showHistory = searchFocused && searchQuery.trim().length === 0 && searchHistory.length > 0;

  function handleSuggestionSelect(s: Suggestion) {
    addToHistory(searchQuery);
    setSearchFocused(false); setActiveSuggestionIndex(-1); setSearchQuery('');
    if (tab !== s.tab) { setTab(s.tab); if (s.tab === 'esplora') fetchNewOpportunities(); }
    setTimeout(() => setExpandedId(s.opp.id), 80);
  }

  function handleHistorySelect(term: string) {
    setSearchQuery(term);
    setActiveSuggestionIndex(-1);
    // keep focus so suggestions appear for that term
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

  const q = searchQuery.trim().toLowerCase();

  const perTeFiltered = opportunities.filter((o) => matchesAllFilters(o, q, appliedFilters, 'per-te'));
  const esploraFiltered = newOpportunities.filter((o) => matchesAllFilters(o, q, appliedFilters, 'esplora'));

  // Live count in filter sheet footer
  const activeDataset = tab === 'per-te' ? opportunities : newOpportunities;
  const draftMatchCount = activeDataset.filter((o) => matchesAllFilters(o, q, draftFilters, tab)).length;

  return (
    <>
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#0D1117] px-4 pt-2 pb-5">
        <div className="relative flex items-center justify-center">
          <div className="flex bg-[#161B22] rounded-full p-1">
            <button onClick={() => handleTabChange('per-te')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${tab === 'per-te' ? 'bg-primary text-white' : 'text-gray-500'}`}>
              {t.home.forYou}
            </button>
            <button onClick={() => handleTabChange('esplora')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${tab === 'esplora' ? 'bg-primary text-white' : 'text-gray-500'}`}>
              {t.home.explore}
            </button>
          </div>
        </div>

        <div className="mt-4" ref={searchContainerRef}>
          <div className="relative">
            <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input type="text" placeholder={t.home.searchPlaceholder} value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setActiveSuggestionIndex(-1); }}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={handleSearchKeyDown}
              className="w-full bg-[#161B22] rounded-xl pl-9 pr-12 py-3 text-white placeholder-gray-500 text-sm outline-none" />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchFocused(false); }}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-500 active:opacity-70 w-6 h-6 flex items-center justify-center">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button onClick={openFilterSheet} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg">
              <Filter size={20} strokeWidth={2} className={`transition-colors ${hasActiveFilters ? 'text-primary' : 'text-gray-400'}`} />
              {hasActiveFilters && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary pointer-events-none" />}
            </button>

            {showHistory && (
              <SearchHistoryDropdown history={searchHistory}
                onSelect={handleHistorySelect}
                onRemove={removeFromHistory}
                onClear={clearHistory} />
            )}
            {showSuggestions && (
              <SearchDropdown suggestions={suggestions} query={searchQuery} activeIndex={activeSuggestionIndex}
                onSelect={handleSuggestionSelect} onHover={setActiveSuggestionIndex} />
            )}
          </div>
        </div>
      </div>

      {/* ── Alert scadenze ────────────────────────────────────────── */}
      {(() => {
        const expiring = savedOpps.filter((o) => { if (!o.deadline) return false; const d = getDaysLeft(o.deadline); return d >= 0 && d <= 7; });
        if (!expiring.length) return null;
        const nearest = expiring.reduce((a, b) => getDaysLeft(a.deadline!) <= getDaysLeft(b.deadline!) ? a : b);
        const days = getDaysLeft(nearest.deadline!);
        const color = days <= 2 ? '#FCA5A5' : '#FCD34D';
        const verb = expiring.length === 1 ? 'scade' : 'scadono';
        const time = days <= 0 ? 'oggi' : days === 1 ? 'domani' : `tra ${days} giorni`;
        return (
          <div className="px-4 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-xs font-medium" style={{ color }}>{`${expiring.length} opportunità ${verb} ${time}`}</p>
          </div>
        );
      })()}

      {/* ── Cards ─────────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        {(loadingOpps && !opportunities.length) || (tab === 'esplora' && loadingNew) ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#161B22] rounded-2xl p-5 animate-pulse">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-14 h-14 rounded-xl bg-[#1E293B]" />
                  <div className="flex-1"><div className="h-4 bg-[#1E293B] rounded w-3/4 mb-2" /><div className="h-3 bg-[#1E293B] rounded w-1/2" /></div>
                </div>
                <div className="h-3 bg-[#1E293B] rounded w-1/3 mb-3" />
                <div className="h-3 bg-[#1E293B] rounded w-full mb-1" />
                <div className="h-3 bg-[#1E293B] rounded w-5/6" />
              </div>
            ))}
          </div>
        ) : tab === 'per-te' ? (
          <>
            <div ref={perTeTopRef} style={{ scrollMarginTop: 120 }} />
            {!perTeFiltered.length ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Search size={40} strokeWidth={1.5} className="mb-3" />
                <p className="text-sm font-medium">{t.home.noOpportunities}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {perTeFiltered.map((opp) => (
                  <FullWidthCard key={opp.id} opp={opp} showScore isExpanded={expandedId === opp.id} onToggle={() => handleToggle(opp.id)} isSaved={savedIds.has(opp.id)} onSave={() => handleSave(opp)} />
                ))}
              </div>
            )}
            {perTeTotalPages > 1 && !hasActiveFilters && (
              <Pagination
                currentPage={perTePage}
                totalPages={perTeTotalPages}
                onPageChange={(p) => loadPerTePage(p, true)}
                disabled={loadingOpps}
              />
            )}
          </>
        ) : !esploraFiltered.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Search size={40} strokeWidth={1.5} className="mb-3" />
            <p className="text-sm font-medium">{t.home.noOpportunities}</p>
          </div>
        ) : (
          <EsploraGrid items={esploraFiltered} expandedId={expandedId} onToggle={handleToggle} savedIds={savedIds}
            onSave={(id) => { const o = newOpportunities.find((x) => x.id === id); if (o) handleSave(o); }} />
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
