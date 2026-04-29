'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import {
  Brain, Code, Database, Smartphone, FlaskConical, Briefcase,
  TrendingUp, Palette, Leaf, Megaphone, Scale, Heart,
  ChevronDown, X,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Skill { id: string; label: string; areaId: string; }
interface MacroArea {
  id: string; label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  skills: Skill[];
}

// ─── Data ────────────────────────────────────────────────────────────────────

const macroAreas: MacroArea[] = [
  { id: 'ai', label: 'AI & ML', icon: Brain, skills: [
    { id: 'python_base', label: 'Python base', areaId: 'ai' },
    { id: 'machine_learning', label: 'Machine Learning', areaId: 'ai' },
    { id: 'reti_neurali', label: 'Reti neurali', areaId: 'ai' },
    { id: 'data_analysis', label: 'Data Analysis', areaId: 'ai' },
    { id: 'numpy_pandas', label: 'NumPy/Pandas', areaId: 'ai' },
    { id: 'matematica_applicata', label: 'Matematica applicata', areaId: 'ai' },
    { id: 'statistica', label: 'Statistica', areaId: 'ai' },
    { id: 'computer_science_base', label: 'Computer Science base', areaId: 'ai' },
  ]},
  { id: 'web', label: 'Web Dev', icon: Code, skills: [
    { id: 'html_css', label: 'HTML/CSS', areaId: 'web' },
    { id: 'javascript_base', label: 'JavaScript base', areaId: 'web' },
    { id: 'react_base', label: 'React base', areaId: 'web' },
    { id: 'sql_base', label: 'SQL base', areaId: 'web' },
    { id: 'git', label: 'Git', areaId: 'web' },
    { id: 'logica_di_programmazione', label: 'Logica di programmazione', areaId: 'web' },
    { id: 'ui_base', label: 'UI base', areaId: 'web' },
    { id: 'no_code_tools', label: 'No-code tools', areaId: 'web' },
  ]},
  { id: 'data', label: 'Data Science', icon: Database, skills: [
    { id: 'excel', label: 'Excel', areaId: 'data' },
    { id: 'statistica_ds', label: 'Statistica', areaId: 'data' },
    { id: 'python_base_ds', label: 'Python base', areaId: 'data' },
    { id: 'sql_base_ds', label: 'SQL base', areaId: 'data' },
    { id: 'r_base', label: 'R base', areaId: 'data' },
    { id: 'data_visualization', label: 'Data Visualization', areaId: 'data' },
    { id: 'analisi_dei_dati', label: 'Analisi dei dati', areaId: 'data' },
    { id: 'google_sheets', label: 'Google Sheets', areaId: 'data' },
  ]},
  { id: 'mobile', label: 'Mobile', icon: Smartphone, skills: [
    { id: 'swift_base', label: 'Swift base', areaId: 'mobile' },
    { id: 'kotlin_base', label: 'Kotlin base', areaId: 'mobile' },
    { id: 'react_native_base', label: 'React Native base', areaId: 'mobile' },
    { id: 'flutter_base', label: 'Flutter base', areaId: 'mobile' },
    { id: 'ui_mobile', label: 'UI Mobile', areaId: 'mobile' },
    { id: 'logica_di_programmazione_mobile', label: 'Logica di programmazione', areaId: 'mobile' },
    { id: 'figma_base', label: 'Figma base', areaId: 'mobile' },
    { id: 'no_code_tools_mobile', label: 'No-code tools', areaId: 'mobile' },
  ]},
  { id: 'research', label: 'Ricerca', icon: FlaskConical, skills: [
    { id: 'metodologia_della_ricerca', label: 'Metodologia della ricerca', areaId: 'research' },
    { id: 'scrittura_accademica', label: 'Scrittura accademica', areaId: 'research' },
    { id: 'statistica_ricerca', label: 'Statistica', areaId: 'research' },
    { id: 'laboratorio_base', label: 'Laboratorio base', areaId: 'research' },
    { id: 'revisione_della_letteratura', label: 'Revisione della letteratura', areaId: 'research' },
    { id: 'r_base_ricerca', label: 'R base', areaId: 'research' },
    { id: 'presentazione_dati', label: 'Presentazione dati', areaId: 'research' },
  ]},
  { id: 'business', label: 'Business', icon: Briefcase, skills: [
    { id: 'problem_solving', label: 'Problem solving', areaId: 'business' },
    { id: 'powerpoint', label: 'PowerPoint', areaId: 'business' },
    { id: 'analisi_di_mercato', label: 'Analisi di mercato', areaId: 'business' },
    { id: 'project_management_base', label: 'Project management base', areaId: 'business' },
    { id: 'public_speaking', label: 'Public speaking', areaId: 'business' },
    { id: 'business_writing', label: 'Business writing', areaId: 'business' },
    { id: 'teamwork', label: 'Teamwork', areaId: 'business' },
  ]},
  { id: 'finance', label: 'Finance', icon: TrendingUp, skills: [
    { id: 'contabilita_base', label: 'Contabilità base', areaId: 'finance' },
    { id: 'analisi_finanziaria_base', label: 'Analisi finanziaria base', areaId: 'finance' },
    { id: 'matematica_finanziaria', label: 'Matematica finanziaria', areaId: 'finance' },
    { id: 'economia_aziendale', label: 'Economia aziendale', areaId: 'finance' },
    { id: 'powerpoint_finance', label: 'PowerPoint', areaId: 'finance' },
    { id: 'bloomberg_base', label: 'Bloomberg base', areaId: 'finance' },
    { id: 'python_base_finance', label: 'Python base', areaId: 'finance' },
  ]},
  { id: 'design', label: 'Design', icon: Palette, skills: [
    { id: 'figma', label: 'Figma', areaId: 'design' },
    { id: 'canva', label: 'Canva', areaId: 'design' },
    { id: 'ui_design_base', label: 'UI Design base', areaId: 'design' },
    { id: 'ux_research_base', label: 'UX Research base', areaId: 'design' },
    { id: 'adobe_suite_base', label: 'Adobe Suite base', areaId: 'design' },
    { id: 'prototipazione', label: 'Prototipazione', areaId: 'design' },
    { id: 'graphic_design_base', label: 'Graphic Design base', areaId: 'design' },
    { id: 'branding_base', label: 'Branding base', areaId: 'design' },
  ]},
  { id: 'sustainability', label: 'Sustainability', icon: Leaf, skills: [
    { id: 'analisi_ambientale_base', label: 'Analisi ambientale base', areaId: 'sustainability' },
    { id: 'esg', label: 'ESG', areaId: 'sustainability' },
    { id: 'economia_circolare', label: 'Economia circolare', areaId: 'sustainability' },
    { id: 'policy_analysis_base', label: 'Policy analysis base', areaId: 'sustainability' },
    { id: 'ricerca_accademica', label: 'Ricerca accademica', areaId: 'sustainability' },
    { id: 'gis_base', label: 'GIS base', areaId: 'sustainability' },
    { id: 'redazione_report', label: 'Redazione report', areaId: 'sustainability' },
  ]},
  { id: 'marketing', label: 'Marketing', icon: Megaphone, skills: [
    { id: 'social_media_base', label: 'Social Media base', areaId: 'marketing' },
    { id: 'copywriting', label: 'Copywriting', areaId: 'marketing' },
    { id: 'google_analytics_base', label: 'Google Analytics base', areaId: 'marketing' },
    { id: 'content_creation', label: 'Content creation', areaId: 'marketing' },
    { id: 'seo_base', label: 'SEO base', areaId: 'marketing' },
    { id: 'canva_marketing', label: 'Canva', areaId: 'marketing' },
    { id: 'email_marketing_base', label: 'Email marketing base', areaId: 'marketing' },
    { id: 'storytelling', label: 'Storytelling', areaId: 'marketing' },
  ]},
  { id: 'law', label: 'Law & Policy', icon: Scale, skills: [
    { id: 'ricerca_giuridica', label: 'Ricerca giuridica', areaId: 'law' },
    { id: 'diritto_privato', label: 'Diritto privato', areaId: 'law' },
    { id: 'diritto_pubblico', label: 'Diritto pubblico', areaId: 'law' },
    { id: 'diritto_ue_base', label: 'Diritto UE base', areaId: 'law' },
    { id: 'legal_writing', label: 'Legal writing', areaId: 'law' },
    { id: 'policy_analysis', label: 'Policy analysis', areaId: 'law' },
    { id: 'argomentazione', label: 'Argomentazione', areaId: 'law' },
    { id: 'diritto_internazionale_base', label: 'Diritto internazionale base', areaId: 'law' },
  ]},
  { id: 'healthcare', label: 'Healthcare', icon: Heart, skills: [
    { id: 'biologia_base', label: 'Biologia base', areaId: 'healthcare' },
    { id: 'statistica_healthcare', label: 'Statistica', areaId: 'healthcare' },
    { id: 'ricerca_clinica_base', label: 'Ricerca clinica base', areaId: 'healthcare' },
    { id: 'public_health_base', label: 'Public health base', areaId: 'healthcare' },
    { id: 'scrittura_scientifica', label: 'Scrittura scientifica', areaId: 'healthcare' },
    { id: 'epidemiologia_base', label: 'Epidemiologia base', areaId: 'healthcare' },
    { id: 'python_base_healthcare', label: 'Python base', areaId: 'healthcare' },
  ]},
];

function findSkill(skillId: string): Skill | undefined {
  for (const area of macroAreas) {
    const s = area.skills.find((sk) => sk.id === skillId);
    if (s) return s;
  }
}

// ─── Accordion expand/collapse ────────────────────────────────────────────────

function Expandable({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>(expanded ? 'auto' : 0);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; setHeight(expanded ? 'auto' : 0); return; }
    if (!ref.current) return;
    if (expanded) {
      const h = ref.current.scrollHeight;
      setHeight(0);
      requestAnimationFrame(() => { setHeight(h); setTimeout(() => setHeight('auto'), 300); });
    } else {
      const h = ref.current.scrollHeight;
      setHeight(h);
      requestAnimationFrame(() => setHeight(0));
    }
  }, [expanded]);

  return (
    <div ref={ref} style={{ height: height === 'auto' ? 'auto' : `${height}px`, overflow: 'hidden', transition: 'height 300ms ease-in-out, opacity 300ms ease-in-out', opacity: expanded ? 1 : 0 }}>
      {children}
    </div>
  );
}

// ─── Category selector accordion ─────────────────────────────────────────────

function SkillAccordion({
  activeCategory, setActiveCategory, selectedIds, disabledIds, onToggle,
}: {
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  selectedIds: string[];
  disabledIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedArea, setExpandedArea] = useState<string | null>(activeCategory);
  const currentArea = macroAreas.find((a) => a.id === activeCategory)!;
  const CurrentIcon = currentArea.icon;

  return (
    <div>
      {/* Category selector */}
      <div className="mb-3">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 bg-white border border-[#e1e1f2] rounded-[24px] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] transition-all hover:bg-[#f8f8fd]"
        >
          <div className="flex items-center gap-3">
            <CurrentIcon className="w-5 h-5 text-[#615fe2]" />
            <span className="text-[#191b27] font-medium text-sm" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
              {currentArea.label}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#595e78] transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Category grid menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-16 pb-6 bg-white shadow-xl max-w-lg mx-auto rounded-b-3xl">
            <div className="grid grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
              {macroAreas.map((area) => {
                const Icon = area.icon;
                const isActive = activeCategory === area.id;
                return (
                  <button
                    key={area.id}
                    onClick={() => { setActiveCategory(area.id); setExpandedArea(area.id); setMenuOpen(false); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200 active:scale-95 ${isActive ? 'bg-[#615fe2]' : 'bg-[#f3f3fd] hover:bg-[#e6e7f8]'}`}
                  >
                    <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-[#615fe2]'}`} />
                    <span className={`text-xs text-center ${isActive ? 'text-white font-semibold' : 'text-[#464554] font-medium'}`} style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
                      {area.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Expandable categories */}
      <div className="flex flex-col gap-3">
        {macroAreas.map((area) => {
          const Icon = area.icon;
          const isExpanded = expandedArea === area.id;
          return (
            <div key={area.id} className="bg-white border border-[#e1e1f2] rounded-[24px] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-[17px]"
                onClick={() => setExpandedArea(isExpanded ? null : area.id)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[#f3f3fd] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#615fe2]" />
                  </div>
                  <span className="text-xl font-semibold text-[#191b27]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
                    {area.label}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#595e78] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              <Expandable expanded={isExpanded}>
                <div className="px-4 pb-4 border-t border-[#e1e1f2] pt-4">
                  <div className="flex flex-wrap gap-2">
                    {area.skills.map((skill) => {
                      const isSelected = selectedIds.includes(skill.id);
                      const isDisabled = disabledIds.has(skill.id);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => !isDisabled && onToggle(skill.id)}
                          disabled={isDisabled}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-all duration-200 active:scale-95 ${
                            isDisabled
                              ? 'bg-[#f3f3fd] border-[rgba(199,196,214,0.3)] text-[#acb0ce] cursor-not-allowed'
                              : isSelected
                              ? 'bg-[#615fe2] border-[#615fe2] text-white font-medium'
                              : 'bg-[#e0e1f4] border-[rgba(199,196,214,0.3)] text-[#616373] hover:bg-[#d4d5ef]'
                          }`}
                          style={{ fontFamily: 'var(--font-plus-jakarta)' }}
                        >
                          {skill.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Expandable>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoreSkillsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [coreCategory, setCoreCategory] = useState('ai');
  const [selectedCore, setSelectedCore] = useState<string[]>([]);
  const [isEditCore, setIsEditCore] = useState(false);
  const [coreExpanded, setCoreExpanded] = useState(true);

  const [sideCategory, setSideCategory] = useState('ai');
  const [selectedSide, setSelectedSide] = useState<string[]>([]);
  const initialSideRef = useRef<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    api.get('/profile/me')
      .then(({ data }) => {
        const skills = data.skills as any;
        if (skills?.core && Array.isArray(skills.core) && skills.core.length === 3) {
          setIsEditCore(true);
          setCoreExpanded(false);
          setSelectedCore(skills.core.map((s: { id: string }) => s.id).filter((id: string) => findSkill(id)));
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
      return [...prev.slice(1), skillId];
    });
    setSelectedSide((prev) => prev.filter((id) => id !== skillId));
  }, []);

  const removeCore = useCallback((skillId: string) => setSelectedCore((prev) => prev.filter((id) => id !== skillId)), []);
  const coreSet = new Set(selectedCore);

  const toggleSide = useCallback((skillId: string) => {
    setSelectedSide((prev) => {
      if (prev.includes(skillId)) return prev.filter((id) => id !== skillId);
      if (prev.length >= 5) return prev;
      return [...prev, skillId];
    });
  }, []);

  const removeSide = useCallback((skillId: string) => setSelectedSide((prev) => prev.filter((id) => id !== skillId)), []);

  const handleConfirm = async () => {
    if (selectedCore.length !== 3 || !user?.id) return;
    setSaving(true);
    const coreSkills = selectedCore.map((id) => ({ id, name: findSkill(id)!.label }));
    try {
      if (isEditCore) {
        await api.put(`/v1/users/${user.id}/skills/core`, { coreSkills });
      } else {
        await api.post(`/v1/users/${user.id}/skills/core`, { coreSkills });
      }
      const prevSide = new Set(initialSideRef.current);
      const nextSide = new Set(selectedSide);
      const toAdd = selectedSide.filter((id) => !prevSide.has(id));
      const toRemove = initialSideRef.current.filter((id) => !nextSide.has(id));
      await Promise.all([
        ...toAdd.map((id) => api.post(`/v1/users/${user.id}/skills/side`, { skillId: id, name: findSkill(id)!.label })),
        ...toRemove.map((id) => api.delete(`/v1/users/${user.id}/skills/side/${id}`)),
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#fbf8ff' }}>
        <div className="animate-pulse text-[#595e78]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-jakarta" style={{ background: '#fbf8ff' }}>
      {/* Header */}
      <div className="backdrop-blur-md bg-white/80 border-b border-[#ecedff] flex items-center h-16 px-4 sticky top-0 z-30 shadow-[0px_-4px_6px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center rounded-full hover:bg-[#e6e7f8] transition-colors mr-auto"
          style={{ width: 40, height: 40 }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 4l-6 6 6 6" stroke="#595e78" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {/* Logo COhA centrato */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center" style={{ height: 37 }}>
          <div className="relative flex items-center justify-center" style={{ width: 128, height: 37 }}>
            <img src="/logo-coha-swash.svg" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            <span className="relative z-10 font-extrabold text-[#2c3149] text-center select-none"
              style={{ fontSize: 24, letterSpacing: '-0.61px', lineHeight: 1, fontFamily: 'var(--font-plus-jakarta)' }}>
              CO&nbsp;&nbsp;A
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-40">
        <div className="px-6 pt-6 flex flex-col gap-8 max-w-lg mx-auto">

          {/* Header section */}
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] font-bold text-[#191b27] leading-10" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
              Le tue competenze
            </h1>
            <p className="text-sm text-[#464554]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
              Gestisci le competenze che ti rappresentano meglio.
            </p>
          </div>

          {/* ── Principali ── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-[#191b27]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>Principali</h2>
              <span className="bg-[rgba(97,95,226,0.2)] text-[#4844c8] text-xs font-medium px-3 py-1 rounded-full tracking-[0.5px]"
                style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
                {selectedCore.length}/3
              </span>
            </div>

            {/* Tag selezionati */}
            {coreSkillObjects.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coreSkillObjects.map((skill) => (
                  <div key={skill.id} className="flex items-center gap-1 bg-[#e6e7f8] border border-[#c7c4d6] rounded-full px-[17px] py-[9px]">
                    <span className="text-sm text-[#191b27]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>{skill.label}</span>
                    <button onClick={() => removeCore(skill.id)} className="ml-1 hover:opacity-70 transition-opacity">
                      <X className="w-3 h-3 text-[#595e78]" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Expandable expanded={coreExpanded || !isEditCore}>
              <SkillAccordion
                activeCategory={coreCategory}
                setActiveCategory={setCoreCategory}
                selectedIds={selectedCore}
                disabledIds={new Set()}
                onToggle={toggleCore}
              />
            </Expandable>

            {isEditCore && (
              <button
                onClick={() => setCoreExpanded((v) => !v)}
                className="text-sm text-[#615fe2] font-medium hover:underline text-left"
                style={{ fontFamily: 'var(--font-plus-jakarta)' }}
              >
                {coreExpanded ? 'Chiudi selezione' : 'Modifica competenze principali'}
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[#e1e1f2]" />

          {/* ── Secondarie ── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-[#191b27]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
                Competenze secondarie
              </h2>
              <span className="bg-[rgba(97,95,226,0.2)] text-[#4844c8] text-xs font-medium px-3 py-1 rounded-full tracking-[0.5px]"
                style={{ fontFamily: 'var(--font-plus-jakarta)' }}>
                {selectedSide.length}/5
              </span>
            </div>

            {/* Tag selezionati side */}
            {sideSkillObjects.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sideSkillObjects.map((skill) => (
                  <div key={skill.id} className="flex items-center gap-1 bg-[#e6e7f8] border border-[#c7c4d6] rounded-full px-[17px] py-[9px]">
                    <span className="text-sm text-[#191b27]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>{skill.label}</span>
                    <button onClick={() => removeSide(skill.id)} className="ml-1 hover:opacity-70 transition-opacity">
                      <X className="w-3 h-3 text-[#595e78]" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <SkillAccordion
              activeCategory={sideCategory}
              setActiveCategory={setSideCategory}
              selectedIds={selectedSide}
              disabledIds={coreSet}
              onToggle={toggleSide}
            />
          </div>
        </div>
      </div>

      {/* Bottom confirm */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#ecedff] shadow-[0px_-4px_6px_rgba(0,0,0,0.05)] px-6 py-4 max-w-lg mx-auto">
        <button
          onClick={handleConfirm}
          disabled={selectedCore.length !== 3 || saving}
          className="w-full h-14 rounded-full flex items-center justify-center font-semibold text-sm text-white transition-all duration-300 active:scale-95 disabled:opacity-50"
          style={{
            background: selectedCore.length === 3 ? '#615fe2' : 'rgba(97,95,226,0.4)',
            fontFamily: 'var(--font-plus-jakarta)',
          }}
        >
          {saving
            ? 'Salvataggio...'
            : selectedCore.length === 3
            ? 'Conferma selezione'
            : `Seleziona ${3 - selectedCore.length} ${3 - selectedCore.length === 1 ? 'competenza' : 'competenze'}`}
        </button>
      </div>
    </div>
  );
}
