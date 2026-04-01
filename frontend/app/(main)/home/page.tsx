'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSavedOpportunities } from '@/lib/savedOpportunities';
import { useLanguage } from '@/lib/language';
import { isValidExternalUrl } from '@/lib/urlValidation';
import api from '@/lib/api';
import {
  GridSmall, Bulb, BookOpen, TrendingUp,
  ChevronDown as ChevronDownIcon,
  Bookmark, MapPin, CalendarIcon, Search, Filter, Bell,
} from '@/components/icons';

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
  skills: string[];
  matchReason: string;
  deadline: string;
}

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
        <circle
          cx={28} cy={28} r={normalizedRadius} fill="transparent"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>
        {score}%
      </span>
    </div>
  );
}

type BaseOpportunity = Omit<Opportunity, 'description' | 'about' | 'location'>;

const BASE_OPPORTUNITIES: BaseOpportunity[] = [
  {
    id: '1',
    title: 'Software Engineer Intern',
    company: 'TechNova Solutions',
    badge: 'FULL-TIME • REMOTE',
    matchScore: 85,
    url: 'https://www.technova.io/careers/software-engineer-intern',
    type: 'full-time',
    remote: true,
    skills: [],
    matchReason: '',
    deadline: '',
  },
  {
    id: '2',
    title: 'Product Design Workshop',
    company: 'Creative Hub Milan',
    badge: 'WORKSHOP • HYBRID',
    matchScore: 62,
    url: 'https://www.creativehubmilan.it/workshop/product-design',
    type: 'workshop',
    remote: false,
    skills: [],
    matchReason: '',
    deadline: '',
  },
  {
    id: '3',
    title: 'Data Analyst Junior',
    company: 'Fintech Alpha',
    badge: 'JUNIOR • IN-PERSON',
    matchScore: 35,
    type: 'junior',
    remote: false,
    skills: [],
    matchReason: '',
    deadline: '',
  },
  {
    id: '4',
    title: 'Master in AI Ethics',
    company: 'Politecnico di Milano',
    badge: 'EDUCATION • PART-TIME',
    matchScore: 92,
    url: 'https://www.polimi.it/formazione/master-e-corsi/master/master-in-ai-ethics',
    type: 'education',
    remote: false,
    skills: [],
    matchReason: '',
    deadline: '',
  },
];

function OpportunityIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes('full-time') || t.includes('intern')) {
    return <GridSmall size={24} className="text-gray-400" />;
  }
  if (t.includes('workshop')) {
    return <Bulb size={24} className="text-gray-400" />;
  }
  if (t.includes('education') || t.includes('master')) {
    return <BookOpen size={24} className="text-gray-400" />;
  }
  return <TrendingUp size={24} className="text-gray-400" />;
}

function getOpportunities(t: ReturnType<typeof useLanguage>['t']): Opportunity[] {
  return BASE_OPPORTUNITIES.map((opp) => ({
    ...opp,
    ...t.opportunitiesContent[opp.id as keyof typeof t.opportunitiesContent],
  }));
}

/* ── Search + filter predicates (module-level, no closure) ──────── */

function matchesSearch(opp: Opportunity, q: string): boolean {
  if (!q) return true;
  return (
    opp.title.toLowerCase().includes(q) ||
    opp.company.toLowerCase().includes(q) ||
    opp.badge.toLowerCase().includes(q)
  );
}

function matchesBadgeFilters(opp: Opportunity, filters: Record<string, string[]>): boolean {
  const badge = opp.badge.toLowerCase();
  for (const values of Object.values(filters)) {
    if (values.length === 0) continue;
    if (!values.some((v) => badge.includes(v))) return false;
  }
  return true;
}

/* ── Filter config ───────────────────────────────────────────────── */

function getFilterCategories(t: ReturnType<typeof useLanguage>['t']) {
  return [
    {
      id: 'tipo',
      label: t.home.filterType,
      options: [
        { label: t.home.filterFullTime,  value: 'full-time' },
        { label: t.home.filterPartTime,  value: 'part-time' },
        { label: t.home.filterWorkshop,  value: 'workshop'  },
        { label: t.home.filterInternship,value: 'intern'    },
        { label: t.home.filterEducation, value: 'education' },
      ],
    },
    {
      id: 'modalita',
      label: t.home.filterMode,
      options: [
        { label: t.home.filterRemote,   value: 'remote'    },
        { label: t.home.filterInPerson, value: 'in-person' },
        { label: t.home.filterHybrid,   value: 'hybrid'    },
      ],
    },
    {
      id: 'livello',
      label: t.home.filterLevel,
      options: [
        { label: t.home.filterJunior, value: 'junior' },
        { label: t.home.filterSenior, value: 'senior' },
      ],
    },
  ];
}

/* ── Shared primitives ───────────────────────────────────────────── */

function ChevronDown({ rotated }: { rotated: boolean }) {
  return (
    <ChevronDownIcon
      size={16}
      strokeWidth={2}
      className={`text-gray-500 flex-shrink-0 transition-transform duration-300 ${rotated ? 'rotate-180' : ''}`}
    />
  );
}

// CSS grid-template-rows trick: animates to/from natural content height with no
// JS measurement needed.
function Accordion({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

/* ── BookmarkIcon ────────────────────────────────────────────────── */

function BookmarkIcon({ filled, className }: { filled: boolean; className?: string }) {
  return <Bookmark filled={filled} strokeWidth={1.8} className={className} />;
}

/* ── FullWidthCard ───────────────────────────────────────────────── */

function FullWidthCard({
  opp,
  showScore,
  isExpanded,
  onToggle,
  isSaved,
  onSave,
}: {
  opp: Opportunity;
  showScore?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isSaved: boolean;
  onSave: () => void;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isExpanded) {
      const t = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isExpanded]);

  return (
    <div ref={ref} className="bg-[#161B22] rounded-2xl overflow-hidden" style={{ scrollMarginTop: 80 }}>
      {/* Tappable header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left p-5 active:opacity-75 transition-opacity"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="w-14 h-14 rounded-xl bg-[#1E293B] flex items-center justify-center flex-shrink-0">
            <OpportunityIcon type={opp.type} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-[17px] leading-tight">{opp.title}</h3>
            <p className="text-primary text-sm font-medium mt-0.5">{opp.company}</p>
          </div>
          {/* Top-right slot: crossfade score ↔ chevron (Per te); hide/show chevron (Esplora) */}
          <div className="flex-shrink-0">
            {showScore ? (
              // Score and chevron share the same 56×56 box and crossfade between states
              <div className="relative" style={{ width: 56, height: 56 }}>
                <div className={`absolute inset-0 transition-opacity duration-300 ${isExpanded ? 'opacity-0' : 'opacity-100'}`}>
                  <CircularProgress score={opp.matchScore} />
                </div>
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                  <ChevronDown rotated={isExpanded} />
                </div>
              </div>
            ) : (
              <span className={isExpanded ? 'visible' : 'invisible'}>
                <ChevronDown rotated={isExpanded} />
              </span>
            )}
          </div>
        </div>

        <div className="mb-3">
          <span className="inline-block bg-[#1E293B] text-gray-400 text-[11px] font-semibold tracking-wider px-3 py-1.5 rounded-lg">
            {opp.badge}
          </span>
        </div>

        {/* Description: teaser when collapsed, full when expanded */}
        <p className={`text-gray-400 text-sm leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
          {opp.description}
        </p>
      </button>

      {/* Expandable section */}
      <Accordion open={isExpanded}>
        <div className="px-5 pb-5 space-y-4">
          <div className="h-px bg-[#1E293B]" />

          {/* Location + date chips */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-[#0D1117] rounded-xl px-3 py-2">
              <MapPin size={14} strokeWidth={1.8} className="text-gray-400 flex-shrink-0" />
              <span className="text-gray-300 text-xs">{opp.location}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#0D1117] rounded-xl px-3 py-2">
              <CalendarIcon size={14} strokeWidth={1.8} className="text-gray-400 flex-shrink-0" />
              <span className="text-gray-300 text-xs">{t.home.publishedDaysAgo}</span>
            </div>
          </div>

          <div className="h-px bg-[#1E293B]" />

          {/* Company section */}
          <div>
            <p className="text-white font-semibold text-sm mb-2">{opp.company}</p>
            <p className="text-gray-400 text-sm leading-relaxed">{opp.about}</p>
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <button
              onClick={() => opp.url && isValidExternalUrl(opp.url) && window.open(opp.url, '_blank', 'noopener,noreferrer')}
              disabled={!opp.url || !isValidExternalUrl(opp.url)}
              className={`flex-1 py-3.5 rounded-2xl font-semibold text-[15px] transition-opacity ${
                opp.url && isValidExternalUrl(opp.url)
                  ? 'bg-primary text-white active:opacity-90'
                  : 'bg-[#1E293B] text-gray-500 cursor-not-allowed'
              }`}
            >
              {opp.url ? t.home.goToOpportunity : t.home.linkUnavailable}
            </button>
            <button
              onClick={onSave}
              className={`w-12 h-12 bg-[#0D1117] rounded-2xl flex items-center justify-center flex-shrink-0 active:opacity-75 transition-all ${
                isSaved ? 'text-primary' : 'text-gray-400'
              }`}
            >
              <BookmarkIcon filled={isSaved} className="w-5 h-5" />
            </button>
          </div>
        </div>
      </Accordion>
    </div>
  );
}

/* ── HalfWidthCard ───────────────────────────────────────────────── */

function HalfWidthCard({
  opp,
  isExpanded,
  onToggle,
  isSaved,
  onSave,
}: {
  opp: Opportunity;
  isExpanded: boolean;
  onToggle: () => void;
  isSaved: boolean;
  onSave: () => void;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isExpanded) {
      const t = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isExpanded]);

  return (
    <div ref={ref} className="bg-[#161B22] rounded-2xl overflow-hidden" style={{ scrollMarginTop: 80 }}>
      {/* Tappable header */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 active:opacity-75 transition-opacity"
      >
        <div className="flex items-start gap-2.5 mb-1.5">
          <div className="w-9 h-9 rounded-lg bg-[#1E293B] flex items-center justify-center flex-shrink-0">
            <OpportunityIcon type={opp.type} />
          </div>
          <h3 className="text-white font-semibold text-[13px] leading-snug flex-1 min-w-0 line-clamp-2">
            {opp.title}
          </h3>
          <span className={isExpanded ? 'visible' : 'invisible'}>
            <ChevronDown rotated={isExpanded} />
          </span>
        </div>
        <p className="text-primary text-[11px] font-medium line-clamp-1">{opp.company}</p>
        <span className="inline-block bg-[#1E293B] text-gray-400 text-[10px] font-semibold tracking-wider px-2 py-1 rounded-lg mt-3">
          {opp.badge.split(' • ')[0]}
        </span>
      </button>

      {/* Expandable section */}
      <Accordion open={isExpanded}>
        <div className="px-4 pb-4 space-y-3">
          <div className="h-px bg-[#1E293B]" />

          {/* Full description */}
          <p className="text-gray-400 text-[12px] leading-relaxed">{opp.description}</p>

          {/* Location chip */}
          <div className="flex items-center gap-1.5 bg-[#0D1117] rounded-xl px-2.5 py-1.5 self-start w-fit">
            <MapPin size={12} strokeWidth={1.8} className="text-gray-400 flex-shrink-0" />
            <span className="text-gray-300 text-[11px]">{opp.location}</span>
          </div>

          <div className="h-px bg-[#1E293B]" />

          {/* Company section */}
          <div>
            <p className="text-white font-semibold text-[12px] mb-1.5">{opp.company}</p>
            <p className="text-gray-400 text-[11px] leading-relaxed">{opp.about}</p>
          </div>

          {/* CTA — scaled down to fit the narrow column */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => opp.url && isValidExternalUrl(opp.url) && window.open(opp.url, '_blank', 'noopener,noreferrer')}
              disabled={!opp.url || !isValidExternalUrl(opp.url)}
              className={`flex-1 py-3 rounded-xl font-semibold text-[12px] transition-opacity ${
                opp.url && isValidExternalUrl(opp.url)
                  ? 'bg-primary text-white active:opacity-90'
                  : 'bg-[#1E293B] text-gray-500 cursor-not-allowed'
              }`}
            >
              {opp.url ? t.home.goToOpportunity : t.home.linkUnavailable}
            </button>
            <button
              onClick={onSave}
              className={`w-10 h-10 bg-[#0D1117] rounded-xl flex items-center justify-center flex-shrink-0 active:opacity-75 transition-all ${
                isSaved ? 'text-primary' : 'text-gray-400'
              }`}
            >
              <BookmarkIcon filled={isSaved} className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Accordion>
    </div>
  );
}

/* ── PairRow ─────────────────────────────────────────────────────── */

// When one card is expanded:
//   1. Its column grows from 1fr → full width (grid-template-columns animates).
//   2. The sibling's column shrinks to 0fr (clipped by overflow:hidden on the cell).
//   3. A second row opens below via the same grid-template-rows accordion trick,
//      revealing the sibling card — it never disappears from the user.
// Collapsing reverses all three animations simultaneously.
function PairRow({
  items,
  expandedId,
  onToggle,
  savedIds,
  onSave,
}: {
  items: Opportunity[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  savedIds: Set<string>;
  onSave: (id: string) => void;
}) {
  const expandedIndex = items.findIndex((o) => o.id === expandedId);
  const anyExpanded = expandedIndex !== -1;
  const hasPair = items.length > 1;

  // Latch the sibling so the bottom zone can still render its card while the
  // close animation (grid-template-rows: 1fr → 0fr) is playing out — without
  // the card vanishing from the DOM before the zone finishes collapsing.
  const latchedSiblingRef = useRef<Opportunity | null>(null);
  if (anyExpanded && hasPair) {
    latchedSiblingRef.current = items.find((o) => o.id !== expandedId) ?? null;
  }
  const displayedSibling = latchedSiblingRef.current;

  const gridTemplateColumns =
    expandedIndex === 0 ? '1fr 0fr' :
    expandedIndex === 1 ? '0fr 1fr' :
    '1fr 1fr';

  const showSiblingBelow = anyExpanded && hasPair;

  return (
    <div>
      {/* Main row: expanded card grows to full width, sibling column → 0 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns,
          gap: anyExpanded ? 0 : 16,
          alignItems: 'start',
          transition: 'grid-template-columns 0.32s cubic-bezier(0.4, 0, 0.2, 1), gap 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {items.map((opp) => (
          // overflow:hidden clips the sibling card as its column narrows to 0
          <div key={opp.id} style={{ overflow: 'hidden' }}>
            <HalfWidthCard
              opp={opp}
              isExpanded={expandedId === opp.id}
              onToggle={() => onToggle(opp.id)}
              isSaved={savedIds.has(opp.id)}
              onSave={() => onSave(opp.id)}
            />
          </div>
        ))}
      </div>

      {/* Sibling zone: slides open below the expanded card */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: showSiblingBelow ? '1fr' : '0fr',
          marginTop: showSiblingBelow ? 16 : 0,
          transition: 'grid-template-rows 0.32s cubic-bezier(0.4, 0, 0.2, 1), margin-top 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {displayedSibling && (
            <HalfWidthCard
              opp={displayedSibling}
              isExpanded={false}
              onToggle={() => onToggle(displayedSibling.id)}
              isSaved={savedIds.has(displayedSibling.id)}
              onSave={() => onSave(displayedSibling.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── EsploraGrid ─────────────────────────────────────────────────── */

function EsploraGrid({
  items,
  expandedId,
  onToggle,
  savedIds,
  onSave,
}: {
  items: Opportunity[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  savedIds: Set<string>;
  onSave: (id: string) => void;
}) {
  const chunks: Array<{ type: 'full' | 'pair'; items: Opportunity[] }> = [];
  let i = 0;
  while (i < items.length) {
    chunks.push({ type: 'full', items: [items[i]] });
    i++;
    if (i < items.length) {
      const pairItems = items.slice(i, Math.min(i + 2, items.length));
      chunks.push({ type: 'pair', items: pairItems });
      i += pairItems.length;
    }
  }

  return (
    <div className="space-y-4">
      {chunks.map((chunk) =>
        chunk.type === 'full' ? (
          <FullWidthCard
            key={chunk.items[0].id}
            opp={chunk.items[0]}
            isExpanded={expandedId === chunk.items[0].id}
            onToggle={() => onToggle(chunk.items[0].id)}
            isSaved={savedIds.has(chunk.items[0].id)}
            onSave={() => onSave(chunk.items[0].id)}
          />
        ) : (
          <PairRow
            key={chunk.items.map((o) => o.id).join('-')}
            items={chunk.items}
            expandedId={expandedId}
            onToggle={onToggle}
            savedIds={savedIds}
            onSave={onSave}
          />
        )
      )}
    </div>
  );
}

/* ── FilterSheet ─────────────────────────────────────────────────── */

function FilterSheet({
  open,
  draft,
  matchCount,
  filterCategories,
  labelFilters,
  labelReset,
  labelApplyFilters,
  onToggleOption,
  onReset,
  onApply,
  onClose,
}: {
  open: boolean;
  draft: Record<string, string[]>;
  matchCount: number;
  filterCategories: ReturnType<typeof getFilterCategories>;
  labelFilters: string;
  labelReset: string;
  labelApplyFilters: string;
  onToggleOption: (catId: string, value: string) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
}) {

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto bg-[#161B22] rounded-t-3xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#2D3748]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4">
          <h2 className="text-white font-bold text-lg">{labelFilters}</h2>
          <button
            onClick={onReset}
            className="text-primary text-sm font-semibold active:opacity-70 transition-opacity"
          >
            {labelReset}
          </button>
        </div>

        {/* Categories — scrollable if content is tall */}
        <div className="px-5 pb-4 space-y-6 max-h-[55vh] overflow-y-auto no-scrollbar">
          {filterCategories.map((cat) => {
            const selectedValues = draft[cat.id] ?? [];
            return (
              <div key={cat.id}>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
                  {cat.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {cat.options.map((opt) => {
                    const isSelected = selectedValues.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => onToggleOption(cat.id, opt.value)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all active:opacity-75 ${
                          isSelected
                            ? 'bg-primary text-white'
                            : 'bg-[#0D1117] text-gray-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pt-4 pb-8 border-t border-[#1E293B]">
          <button
            onClick={onApply}
            className="w-full bg-primary text-white py-4 rounded-2xl font-semibold text-[15px] active:opacity-90 transition-opacity"
          >
            {`${labelApplyFilters} (${matchCount})`}
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { savedIds, toggleSave } = useSavedOpportunities();
  const { t } = useLanguage();
  const allOpportunities = getOpportunities(t);
  const filterCategories = getFilterCategories(t);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingOpps, setLoadingOpps] = useState(true);

  useEffect(() => {
    api.get('/opportunities?matched=true&limit=20')
      .then(({ data }) => {
        const items = data.data || data;
        const mapped = (Array.isArray(items) ? items : []).map((opp: any) => ({
          id: opp.id,
          title: opp.title,
          company: opp.company || opp.university?.name || '',
          badge: `${opp.type}${opp.isRemote ? ' \u2022 REMOTE' : ''}`,
          description: opp.description || '',
          matchScore: opp.matchScore || 0,
          location: opp.location || opp.university?.city || '',
          about: opp.about || '',
          url: opp.url || '',
          type: opp.type || '',
          remote: opp.isRemote || false,
          skills: opp.tags || [],
          matchReason: opp.matchReason || '',
          deadline: opp.deadline || '',
        }));
        setOpportunities(mapped.length > 0 ? mapped : [...allOpportunities].sort((a, b) => b.matchScore - a.matchScore));
      })
      .catch(() => {
        setOpportunities([...allOpportunities].sort((a, b) => b.matchScore - a.matchScore));
      })
      .finally(() => setLoadingOpps(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter sheet state
  const [filterOpen, setFilterOpen] = useState(false);
  // draft = what's currently selected inside the open sheet (uncommitted)
  const [draftFilters, setDraftFilters] = useState<Record<string, string[]>>({});
  // applied = committed filters that actually drive the card list
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string[]>>({});

  const hasActiveFilters = Object.values(appliedFilters).some((arr) => arr.length > 0);

  function handleTabChange(newTab: 'per-te' | 'esplora') {
    setTab(newTab);
    setExpandedId(null); // collapse any open card on tab switch
  }

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleSave(opp: Opportunity) {
    toggleSave(opp.id, {
      title: opp.title,
      company: opp.company,
      type: opp.type,
      description: opp.description,
      about: opp.about,
      location: opp.location,
      isRemote: opp.remote,
      url: opp.url,
      deadline: opp.deadline,
    });
  }

  function openFilterSheet() {
    // Seed the draft from the currently applied filters so edits are non-destructive
    setDraftFilters(
      Object.fromEntries(
        Object.entries(appliedFilters).map(([k, v]) => [k, [...v]])
      )
    );
    setFilterOpen(true);
  }

  function toggleDraftOption(catId: string, value: string) {
    setDraftFilters((prev) => {
      const current = prev[catId] ?? [];
      return {
        ...prev,
        [catId]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }

  function applyFilters() {
    setAppliedFilters({ ...draftFilters });
    setFilterOpen(false);
  }

  const q = searchQuery.trim().toLowerCase();

  // Filtered list for the Esplora tab (search + active filters combined)
  const esploraFiltered = opportunities.filter(
    (opp) => matchesSearch(opp, q) && matchesBadgeFilters(opp, appliedFilters)
  );

  // Count shown live in the filter sheet button (draft filters + current search)
  const draftMatchCount = opportunities.filter(
    (opp) => matchesSearch(opp, q) && matchesBadgeFilters(opp, draftFilters)
  ).length;

  return (
    <>
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#0D1117] px-4 pt-2 pb-5">
        {/* Tab pill — centered; notification pinned right */}
        <div className="relative flex items-center justify-center">
          <div className="flex bg-[#161B22] rounded-full p-1">
            <button
              onClick={() => handleTabChange('per-te')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                tab === 'per-te' ? 'bg-primary text-white' : 'text-gray-500'
              }`}
            >
              {t.home.forYou}
            </button>
            <button
              onClick={() => handleTabChange('esplora')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                tab === 'esplora' ? 'bg-primary text-white' : 'text-gray-500'
              }`}
            >
              {t.home.explore}
            </button>
          </div>
          <div className="absolute right-0">
            <Link href="/notifications" className="p-1 block">
              <Bell size={24} strokeWidth={1.8} className="text-gray-400" />
            </Link>
          </div>
        </div>

        {/* Search bar + filter button — Esplora only */}
        {tab === 'esplora' && (
          <div className="mt-4">
            <div className="relative">
              {/* Magnifying glass icon — left side */}
              <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder={t.home.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#161B22] rounded-xl pl-9 pr-12 py-3 text-white placeholder-gray-500 text-sm outline-none"
              />
              {/* Filter icon button — opens the filter sheet */}
              <button
                onClick={openFilterSheet}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: hasActiveFilters ? '#4F46E5' : undefined }}
              >
                <Filter
                  size={20}
                  strokeWidth={2}
                  className={`transition-colors ${hasActiveFilters ? 'text-primary' : 'text-gray-400'}`}
                />
                {/* Active indicator dot */}
                {hasActiveFilters && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary pointer-events-none" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cards ─────────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        {loadingOpps && opportunities.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#161B22] rounded-2xl p-5 animate-pulse">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-14 h-14 rounded-xl bg-[#1E293B]" />
                  <div className="flex-1">
                    <div className="h-4 bg-[#1E293B] rounded w-3/4 mb-2" />
                    <div className="h-3 bg-[#1E293B] rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-[#1E293B] rounded w-1/3 mb-3" />
                <div className="h-3 bg-[#1E293B] rounded w-full mb-1" />
                <div className="h-3 bg-[#1E293B] rounded w-5/6" />
              </div>
            ))}
          </div>
        ) : tab === 'per-te' ? (
          <div className="space-y-4">
            {opportunities.map((opp) => (
              <FullWidthCard
                key={opp.id}
                opp={opp}
                showScore
                isExpanded={expandedId === opp.id}
                onToggle={() => handleToggle(opp.id)}
                isSaved={savedIds.has(opp.id)}
                onSave={() => handleSave(opp)}
              />
            ))}
          </div>
        ) : esploraFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Search size={40} strokeWidth={1.5} className="mb-3" />
            <p className="text-sm font-medium">{t.home.noOpportunities}</p>
          </div>
        ) : (
          <EsploraGrid
            items={esploraFiltered}
            expandedId={expandedId}
            onToggle={handleToggle}
            savedIds={savedIds}
            onSave={(id) => {
              const opp = opportunities.find((o) => o.id === id);
              if (opp) handleSave(opp);
            }}
          />
        )}
      </div>

      {/* ── Filter sheet ──────────────────────────────────────────── */}
      <FilterSheet
        open={filterOpen}
        draft={draftFilters}
        matchCount={draftMatchCount}
        filterCategories={filterCategories}
        labelFilters={t.home.filters}
        labelReset={t.home.reset}
        labelApplyFilters={t.home.applyFilters}
        onToggleOption={toggleDraftOption}
        onReset={() => setDraftFilters({})}
        onApply={applyFilters}
        onClose={() => setFilterOpen(false)}
      />
    </>
  );
}
