'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import {
  Brain,
  Code,
  Database,
  Smartphone,
  FlaskConical,
  Briefcase,
  TrendingUp,
  Palette,
  Leaf,
  Megaphone,
  Scale,
  Heart,
  ArrowLeft,
  Sparkles,
  ChevronDown,
  X,
  Check,
  Plus,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Skill {
  id: string;
  label: string;
  areaId: string;
}

interface MacroArea {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  skills: Skill[];
}

// ─── Data ───────────────────────────────────────────────────────────────────

const macroAreas: MacroArea[] = [
  {
    id: 'ai',
    label: 'AI & ML',
    icon: Brain,
    skills: [
      { id: 'python_base', label: 'Python base', areaId: 'ai' },
      { id: 'machine_learning', label: 'Machine Learning', areaId: 'ai' },
      { id: 'reti_neurali', label: 'Reti neurali', areaId: 'ai' },
      { id: 'data_analysis', label: 'Data Analysis', areaId: 'ai' },
      { id: 'numpy_pandas', label: 'NumPy/Pandas', areaId: 'ai' },
      { id: 'matematica_applicata', label: 'Matematica applicata', areaId: 'ai' },
      { id: 'statistica', label: 'Statistica', areaId: 'ai' },
      { id: 'computer_science_base', label: 'Computer Science base', areaId: 'ai' },
    ],
  },
  {
    id: 'web',
    label: 'Web Dev',
    icon: Code,
    skills: [
      { id: 'html_css', label: 'HTML/CSS', areaId: 'web' },
      { id: 'javascript_base', label: 'JavaScript base', areaId: 'web' },
      { id: 'react_base', label: 'React base', areaId: 'web' },
      { id: 'sql_base', label: 'SQL base', areaId: 'web' },
      { id: 'git', label: 'Git', areaId: 'web' },
      { id: 'logica_di_programmazione', label: 'Logica di programmazione', areaId: 'web' },
      { id: 'ui_base', label: 'UI base', areaId: 'web' },
      { id: 'no_code_tools', label: 'No-code tools', areaId: 'web' },
    ],
  },
  {
    id: 'data',
    label: 'Data Science',
    icon: Database,
    skills: [
      { id: 'excel', label: 'Excel', areaId: 'data' },
      { id: 'statistica_ds', label: 'Statistica', areaId: 'data' },
      { id: 'python_base_ds', label: 'Python base', areaId: 'data' },
      { id: 'sql_base_ds', label: 'SQL base', areaId: 'data' },
      { id: 'r_base', label: 'R base', areaId: 'data' },
      { id: 'data_visualization', label: 'Data Visualization', areaId: 'data' },
      { id: 'analisi_dei_dati', label: 'Analisi dei dati', areaId: 'data' },
      { id: 'google_sheets', label: 'Google Sheets', areaId: 'data' },
    ],
  },
  {
    id: 'mobile',
    label: 'Mobile',
    icon: Smartphone,
    skills: [
      { id: 'swift_base', label: 'Swift base', areaId: 'mobile' },
      { id: 'kotlin_base', label: 'Kotlin base', areaId: 'mobile' },
      { id: 'react_native_base', label: 'React Native base', areaId: 'mobile' },
      { id: 'flutter_base', label: 'Flutter base', areaId: 'mobile' },
      { id: 'ui_mobile', label: 'UI Mobile', areaId: 'mobile' },
      { id: 'logica_di_programmazione_mobile', label: 'Logica di programmazione', areaId: 'mobile' },
      { id: 'figma_base', label: 'Figma base', areaId: 'mobile' },
      { id: 'no_code_tools_mobile', label: 'No-code tools', areaId: 'mobile' },
    ],
  },
  {
    id: 'research',
    label: 'Ricerca',
    icon: FlaskConical,
    skills: [
      { id: 'metodologia_della_ricerca', label: 'Metodologia della ricerca', areaId: 'research' },
      { id: 'scrittura_accademica', label: 'Scrittura accademica', areaId: 'research' },
      { id: 'statistica_ricerca', label: 'Statistica', areaId: 'research' },
      { id: 'laboratorio_base', label: 'Laboratorio base', areaId: 'research' },
      { id: 'revisione_della_letteratura', label: 'Revisione della letteratura', areaId: 'research' },
      { id: 'r_base_ricerca', label: 'R base', areaId: 'research' },
      { id: 'presentazione_dati', label: 'Presentazione dati', areaId: 'research' },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    icon: Briefcase,
    skills: [
      { id: 'problem_solving', label: 'Problem solving', areaId: 'business' },
      { id: 'powerpoint', label: 'PowerPoint', areaId: 'business' },
      { id: 'analisi_di_mercato', label: 'Analisi di mercato', areaId: 'business' },
      { id: 'project_management_base', label: 'Project management base', areaId: 'business' },
      { id: 'public_speaking', label: 'Public speaking', areaId: 'business' },
      { id: 'business_writing', label: 'Business writing', areaId: 'business' },
      { id: 'teamwork', label: 'Teamwork', areaId: 'business' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: TrendingUp,
    skills: [
      { id: 'contabilita_base', label: 'Contabilit\u00e0 base', areaId: 'finance' },
      { id: 'analisi_finanziaria_base', label: 'Analisi finanziaria base', areaId: 'finance' },
      { id: 'matematica_finanziaria', label: 'Matematica finanziaria', areaId: 'finance' },
      { id: 'economia_aziendale', label: 'Economia aziendale', areaId: 'finance' },
      { id: 'powerpoint_finance', label: 'PowerPoint', areaId: 'finance' },
      { id: 'bloomberg_base', label: 'Bloomberg base', areaId: 'finance' },
      { id: 'python_base_finance', label: 'Python base', areaId: 'finance' },
    ],
  },
  {
    id: 'design',
    label: 'Design',
    icon: Palette,
    skills: [
      { id: 'figma', label: 'Figma', areaId: 'design' },
      { id: 'canva', label: 'Canva', areaId: 'design' },
      { id: 'ui_design_base', label: 'UI Design base', areaId: 'design' },
      { id: 'ux_research_base', label: 'UX Research base', areaId: 'design' },
      { id: 'adobe_suite_base', label: 'Adobe Suite base', areaId: 'design' },
      { id: 'prototipazione', label: 'Prototipazione', areaId: 'design' },
      { id: 'graphic_design_base', label: 'Graphic Design base', areaId: 'design' },
      { id: 'branding_base', label: 'Branding base', areaId: 'design' },
    ],
  },
  {
    id: 'sustainability',
    label: 'Sustainability',
    icon: Leaf,
    skills: [
      { id: 'analisi_ambientale_base', label: 'Analisi ambientale base', areaId: 'sustainability' },
      { id: 'esg', label: 'ESG', areaId: 'sustainability' },
      { id: 'economia_circolare', label: 'Economia circolare', areaId: 'sustainability' },
      { id: 'policy_analysis_base', label: 'Policy analysis base', areaId: 'sustainability' },
      { id: 'ricerca_accademica', label: 'Ricerca accademica', areaId: 'sustainability' },
      { id: 'gis_base', label: 'GIS base', areaId: 'sustainability' },
      { id: 'redazione_report', label: 'Redazione report', areaId: 'sustainability' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    skills: [
      { id: 'social_media_base', label: 'Social Media base', areaId: 'marketing' },
      { id: 'copywriting', label: 'Copywriting', areaId: 'marketing' },
      { id: 'google_analytics_base', label: 'Google Analytics base', areaId: 'marketing' },
      { id: 'content_creation', label: 'Content creation', areaId: 'marketing' },
      { id: 'seo_base', label: 'SEO base', areaId: 'marketing' },
      { id: 'canva_marketing', label: 'Canva', areaId: 'marketing' },
      { id: 'email_marketing_base', label: 'Email marketing base', areaId: 'marketing' },
      { id: 'storytelling', label: 'Storytelling', areaId: 'marketing' },
    ],
  },
  {
    id: 'law',
    label: 'Law & Policy',
    icon: Scale,
    skills: [
      { id: 'ricerca_giuridica', label: 'Ricerca giuridica', areaId: 'law' },
      { id: 'diritto_privato', label: 'Diritto privato', areaId: 'law' },
      { id: 'diritto_pubblico', label: 'Diritto pubblico', areaId: 'law' },
      { id: 'diritto_ue_base', label: 'Diritto UE base', areaId: 'law' },
      { id: 'legal_writing', label: 'Legal writing', areaId: 'law' },
      { id: 'policy_analysis', label: 'Policy analysis', areaId: 'law' },
      { id: 'argomentazione', label: 'Argomentazione', areaId: 'law' },
      { id: 'diritto_internazionale_base', label: 'Diritto internazionale base', areaId: 'law' },
    ],
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    icon: Heart,
    skills: [
      { id: 'biologia_base', label: 'Biologia base', areaId: 'healthcare' },
      { id: 'statistica_healthcare', label: 'Statistica', areaId: 'healthcare' },
      { id: 'ricerca_clinica_base', label: 'Ricerca clinica base', areaId: 'healthcare' },
      { id: 'public_health_base', label: 'Public health base', areaId: 'healthcare' },
      { id: 'scrittura_scientifica', label: 'Scrittura scientifica', areaId: 'healthcare' },
      { id: 'epidemiologia_base', label: 'Epidemiologia base', areaId: 'healthcare' },
      { id: 'python_base_healthcare', label: 'Python base', areaId: 'healthcare' },
    ],
  },
];

function findSkill(skillId: string): Skill | undefined {
  for (const area of macroAreas) {
    const s = area.skills.find((sk) => sk.id === skillId);
    if (s) return s;
  }
  return undefined;
}

// ─── Shared accordion component ─────────────────────────────────────────────

function SkillAccordion({
  activeCategory,
  setActiveCategory,
  selectedIds,
  disabledIds,
  onToggle,
  accentColor,
}: {
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  selectedIds: string[];
  disabledIds: Set<string>;
  onToggle: (id: string) => void;
  accentColor: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentArea = macroAreas.find((a) => a.id === activeCategory)!;
  const CurrentIcon = currentArea.icon;

  return (
    <>
      {/* Category Selector */}
      <div className="px-5 mb-4 relative z-30">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 bg-[#1A1A2E] hover:bg-[#20203A] rounded-2xl transition-all"
        >
          <div className="flex items-center gap-3">
            <CurrentIcon className="w-5 h-5" style={{ color: accentColor }} />
            <span className="text-white font-medium text-sm">{currentArea.label}</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Category Grid Menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="fixed top-0 left-0 right-0 z-50 px-5 pt-20 pb-6 shadow-2xl max-w-lg mx-auto"
            style={{ backgroundColor: '#0D0D1A', animation: 'slideDown 0.3s ease-out' }}
          >
            <div className="grid grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
              {macroAreas.map((area) => {
                const Icon = area.icon;
                const isActive = activeCategory === area.id;
                return (
                  <button
                    key={area.id}
                    onClick={() => { setActiveCategory(area.id); setMenuOpen(false); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200 active:scale-95 ${
                      isActive ? 'bg-[#6B5FE4]' : 'bg-[#1A1A2E] hover:bg-[#20203A]'
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    <span className={`text-xs text-center ${isActive ? 'text-white font-semibold' : 'text-gray-300 font-medium'}`}>
                      {area.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Skills Grid */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {currentArea.skills.map((skill) => {
            const isSelected = selectedIds.includes(skill.id);
            const isDisabled = disabledIds.has(skill.id);
            return (
              <button
                key={skill.id}
                onClick={() => !isDisabled && onToggle(skill.id)}
                disabled={isDisabled}
                className={`relative px-4 py-3 rounded-2xl text-xs text-left transition-all duration-300 active:scale-95 ${
                  isDisabled
                    ? 'bg-[#1A1A2E]/50 text-gray-600 cursor-not-allowed'
                    : isSelected
                      ? 'text-white font-medium shadow-lg shadow-[#6B5FE4]/20'
                      : 'bg-[#1A1A2E] text-white font-normal hover:bg-[#20203A]'
                }`}
                style={isSelected && !isDisabled ? { background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` } : undefined}
              >
                {skill.label}
                {isSelected && !isDisabled && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3" style={{ color: accentColor }} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Animated expand/collapse wrapper ───────────────────────────────────────

function CoreExpandable({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>(expanded ? 'auto' : 0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setHeight(expanded ? 'auto' : 0);
      return;
    }
    if (!contentRef.current) return;
    if (expanded) {
      const scrollH = contentRef.current.scrollHeight;
      setHeight(0);
      requestAnimationFrame(() => {
        setHeight(scrollH);
        setTimeout(() => setHeight('auto'), 300);
      });
    } else {
      const scrollH = contentRef.current.scrollHeight;
      setHeight(scrollH);
      requestAnimationFrame(() => setHeight(0));
    }
  }, [expanded]);

  return (
    <div
      ref={contentRef}
      style={{
        height: height === 'auto' ? 'auto' : `${height}px`,
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        transition: 'height 300ms ease-in-out, opacity 300ms ease-in-out',
      }}
    >
      {children}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CoreSkillsPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Core skills state
  const [coreCategory, setCoreCategory] = useState('ai');
  const [selectedCore, setSelectedCore] = useState<string[]>([]);
  const [isEditCore, setIsEditCore] = useState(false);
  const [coreExpanded, setCoreExpanded] = useState(true); // will be set to false if editing

  // Side skills state
  const [sideCategory, setSideCategory] = useState('ai');
  const [selectedSide, setSelectedSide] = useState<string[]>([]);
  const initialSideRef = useRef<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing skills
  useEffect(() => {
    if (!user?.id) return;
    api.get('/profile/me')
      .then(({ data }) => {
        const skills = data.skills as any;
        if (skills?.core && Array.isArray(skills.core) && skills.core.length === 3) {
          setIsEditCore(true);
          setCoreExpanded(false);
          const ids = skills.core.map((s: { id: string }) => s.id).filter((id: string) => findSkill(id));
          setSelectedCore(ids);
        }
        if (skills?.side && Array.isArray(skills.side)) {
          const sideIds = skills.side.map((s: { id: string }) => s.id).filter((id: string) => findSkill(id));
          setSelectedSide(sideIds);
          initialSideRef.current = sideIds;
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const toggleCore = useCallback((skillId: string) => {
    setSelectedCore((prev) => {
      if (prev.includes(skillId)) return prev.filter((id) => id !== skillId);
      if (prev.length < 3) return [...prev, skillId];
      return [...prev.slice(1), skillId]; // FIFO
    });
    // If added to core, remove from side
    setSelectedSide((prev) => prev.filter((id) => id !== skillId));
  }, []);

  const removeCore = useCallback((skillId: string) => {
    setSelectedCore((prev) => prev.filter((id) => id !== skillId));
  }, []);

  const coreSet = new Set(selectedCore);

  const toggleSide = useCallback((skillId: string) => {
    setSelectedSide((prev) => {
      if (prev.includes(skillId)) return prev.filter((id) => id !== skillId);
      if (prev.length >= 5) return prev; // max 5, do nothing
      return [...prev, skillId];
    });
  }, []);

  const removeSide = useCallback((skillId: string) => {
    setSelectedSide((prev) => prev.filter((id) => id !== skillId));
  }, []);

  const handleConfirm = async () => {
    if (selectedCore.length !== 3 || !user?.id) return;
    setSaving(true);

    const coreSkills = selectedCore.map((id) => {
      const skill = findSkill(id);
      return { id, name: skill!.label };
    });

    try {
      // Save core skills
      if (isEditCore) {
        await api.put(`/v1/users/${user.id}/skills/core`, { coreSkills });
      } else {
        await api.post(`/v1/users/${user.id}/skills/core`, { coreSkills });
      }

      // Save side skills diff
      const prevSide = new Set(initialSideRef.current);
      const nextSide = new Set(selectedSide);

      const toAdd = selectedSide.filter((id) => !prevSide.has(id));
      const toRemove = initialSideRef.current.filter((id) => !nextSide.has(id));

      await Promise.all([
        ...toAdd.map((id) => {
          const skill = findSkill(id);
          return api.post(`/v1/users/${user.id}/skills/side`, { skillId: id, name: skill!.label });
        }),
        ...toRemove.map((id) =>
          api.delete(`/v1/users/${user.id}/skills/side/${id}`)
        ),
      ]);

      router.push('/profile');
    } catch {
      alert('Errore nel salvataggio delle competenze. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  const coreSkillObjects = selectedCore.map((id) => findSkill(id)).filter((s): s is Skill => !!s);
  const sideSkillObjects = selectedSide.map((id) => findSkill(id)).filter((s): s is Skill => !!s);
  const sideRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0D0D1A' }}>
        <div className="animate-pulse text-gray-400">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0D0D1A' }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-[#1A1A2E] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#6B5FE4]" />
          <span className="text-[#6B5FE4] text-sm font-semibold">
            {selectedCore.length} / 3
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Core Skills Section ── */}
        {isEditCore && (
          <button
            onClick={() => setCoreExpanded((v) => !v)}
            className="mx-5 mb-4 w-[calc(100%-2.5rem)] flex items-center justify-between px-5 py-4 bg-[#1A1A2E] hover:bg-[#20203A] rounded-2xl transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-white font-medium text-sm whitespace-nowrap">Le tue competenze</span>
              <div className="flex gap-1.5 overflow-hidden">
                {coreSkillObjects.map((skill) => (
                  <span
                    key={skill.id}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white whitespace-nowrap flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #6B5FE4, #5A4ED3)' }}
                  >
                    {skill.label}
                  </span>
                ))}
              </div>
            </div>
            <ChevronDown
              className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform duration-300 ease-in-out"
              style={{ transform: coreExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        )}

        <CoreExpandable expanded={coreExpanded || !isEditCore}>
          {!isEditCore && (
            <div className="px-5 mb-4">
              <h1 className="text-white text-2xl mb-1">Le tue competenze</h1>
              <p className="text-gray-400 text-sm">Esplora e seleziona le tue skills</p>
            </div>
          )}

          <SkillAccordion
            activeCategory={coreCategory}
            setActiveCategory={setCoreCategory}
            selectedIds={selectedCore}
            disabledIds={new Set()}
            onToggle={toggleCore}
            accentColor="#6B5FE4"
          />
        </CoreExpandable>

        {/* ── Divider ── */}
        <div className="mx-5 my-6 border-t border-[#1A1A2E]" />

        {/* ── Side Skills Section ── */}
        <div ref={sideRef} className="px-5 mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-white text-lg mb-0.5">Competenze secondarie</h2>
            <p className="text-gray-500 text-xs">Opzionali, fino a 5</p>
          </div>
          <span className="text-[#6B5FE4] text-sm font-semibold mt-1">
            {selectedSide.length} / 5
          </span>
        </div>

        <SkillAccordion
          activeCategory={sideCategory}
          setActiveCategory={setSideCategory}
          selectedIds={selectedSide}
          disabledIds={coreSet}
          onToggle={toggleSide}
          accentColor="#6B5FE4"
        />
      </div>

      {/* ── Bottom Section ── */}
      <div className="border-t border-[#1A1A2E] z-30" style={{ backgroundColor: '#0D0D1A' }}>
        {/* Core badges */}
        {coreSkillObjects.length > 0 && (
          <div className="px-5 pt-4 pb-1">
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {coreSkillObjects.map((skill) => (
                <div key={skill.id} className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#6B5FE4] text-white flex-shrink-0">
                  <span className="text-xs font-medium">{skill.label}</span>
                  <button onClick={() => removeCore(skill.id)} className="flex-shrink-0 hover:bg-white/20 rounded-full p-0.5 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Side badges */}
        {sideSkillObjects.length > 0 && (
          <div className="px-5 pt-2 pb-1">
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {sideSkillObjects.map((skill) => (
                <div key={skill.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#6B5FE4]/50 text-white flex-shrink-0">
                  <span className="text-[11px]">{skill.label}</span>
                  <button onClick={() => removeSide(skill.id)} className="flex-shrink-0 hover:bg-white/20 rounded-full p-0.5 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirm Button */}
        <div className="px-5 py-4">
          <button
            onClick={handleConfirm}
            disabled={selectedCore.length !== 3 || saving}
            className={`w-full h-14 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 ${
              selectedCore.length === 3
                ? 'bg-gradient-to-r from-[#6B5FE4] to-[#5A4ED3] hover:shadow-[0_0_30px_rgba(107,95,228,0.5)]'
                : 'bg-[#6B5FE4]/40 cursor-not-allowed'
            }`}
          >
            <span className="text-white font-semibold text-sm">
              {saving
                ? 'Salvataggio...'
                : selectedCore.length === 3
                  ? 'Conferma selezione'
                  : `Seleziona ${3 - selectedCore.length} ${3 - selectedCore.length === 1 ? 'competenza' : 'competenze'}`
              }
            </span>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
