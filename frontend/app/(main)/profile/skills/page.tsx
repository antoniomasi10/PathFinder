'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';
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
  { id: 'design', label: 'Design & UX', icon: Palette, skills: [
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
    <div
      ref={ref}
      style={{
        height: height === 'auto' ? 'auto' : `${height}px`,
        overflow: 'hidden',
        transition: 'height 300ms ease-in-out, opacity 300ms ease-in-out',
        opacity: expanded ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
}

// ─── Category accordion list ──────────────────────────────────────────────────

function SkillAccordion({
  selectedIds,
  disabledIds,
  onToggle,
  defaultOpen,
}: {
  selectedIds: string[];
  disabledIds: Set<string>;
  onToggle: (id: string) => void;
  defaultOpen?: string | null;
}) {
  const [expandedArea, setExpandedArea] = useState<string | null>(defaultOpen ?? macroAreas[0].id);

  return (
    <div className="flex flex-col gap-3">
      {macroAreas.map((area) => {
        const Icon = area.icon;
        const isExpanded = expandedArea === area.id;
        return (
          <div
            key={area.id}
            className="bg-white border border-[#e1e1f2] rounded-[24px] overflow-hidden"
            style={{ boxShadow: '0px 1px 1px rgba(0,0,0,0.05)' }}
          >
            <button
              className="w-full flex items-center justify-between p-[17px]"
              onClick={() => setExpandedArea(isExpanded ? null : area.id)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="rounded-full bg-[#f3f3fd] flex items-center justify-center flex-shrink-0"
                  style={{ width: 34, height: 34 }}
                >
                  <Icon className="w-5 h-5 text-[#615fe2]" />
                </div>
                <span
                  className="font-semibold text-[#191b27]"
                  style={{ fontFamily: 'var(--font-plus-jakarta)', fontSize: 20, lineHeight: '30px' }}
                >
                  {area.label}
                </span>
              </div>
              <ChevronDown
                className={`text-[#595e78] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                style={{ width: 12, height: 12 }}
              />
            </button>

            <Expandable expanded={isExpanded}>
              <div className="px-[17px] pb-[17px] border-t border-[#e1e1f2] pt-[17px]">
                <div className="flex flex-wrap gap-2">
                  {area.skills.map((skill) => {
                    const isSelected = selectedIds.includes(skill.id);
                    const isDisabled = disabledIds.has(skill.id);
                    return (
                      <button
                        key={skill.id}
                        onClick={() => !isDisabled && onToggle(skill.id)}
                        disabled={isDisabled}
                        className={`rounded-full border transition-all duration-200 active:scale-95 ${
                          isDisabled
                            ? 'bg-[#f3f3fd] border-[rgba(199,196,214,0.3)] text-[#acb0ce] cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#615fe2] border-[#615fe2] text-white font-medium'
                            : 'bg-[#e0e1f4] border-[rgba(199,196,214,0.3)] text-[#616373] hover:bg-[#d4d5ef]'
                        }`}
                        style={{
                          fontFamily: 'var(--font-plus-jakarta)',
                          fontSize: 14,
                          lineHeight: '20px',
                          paddingLeft: 13,
                          paddingRight: 13,
                          paddingTop: 7,
                          paddingBottom: 7,
                        }}
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
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoreSkillsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [selectedCore, setSelectedCore] = useState<string[]>([]);
  const [isEditCore, setIsEditCore] = useState(false);
  const [coreExpanded, setCoreExpanded] = useState(true);

  const [selectedSide, setSelectedSide] = useState<string[]>([]);
  const initialSideRef = useRef<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    api.get('/profile/me')
      .then(({ data }) => {
        const skills = data.skills as any;
        if (skills?.core && Array.isArray(skills.core) && skills.core.length > 0) {
          setIsEditCore(true);
          if (skills.core.length === 3) setCoreExpanded(false);
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
      // Fetch fresh DB state — initialSideRef may be stale if the page has been
      // open a while or a previous save attempt partially modified the data.
      const { data: fresh } = await api.get('/profile/me');
      const currentSideIds: string[] = ((fresh.skills?.side as any[]) ?? [])
        .filter((s: any) => typeof s?.id === 'string')
        .map((s: any) => s.id as string);

      const currentSideSet = new Set(currentSideIds);
      const targetSideSet = new Set(selectedSide);

      const toRemove = currentSideIds.filter((id) => !targetSideSet.has(id));
      const toAdd = selectedSide.filter((id) => !currentSideSet.has(id));

      // Sequential deletes — Prisma stores skills as a single JSON field.
      // Parallel writes race and overwrite each other (last write wins).
      for (const id of toRemove) {
        await api.delete(`/v1/users/${user.id}/skills/side/${id}`);
      }

      // Core update after side is clean — backend enforces no overlap.
      if (isEditCore) {
        await api.put(`/v1/users/${user.id}/skills/core`, { coreSkills });
      } else {
        await api.post(`/v1/users/${user.id}/skills/core`, { coreSkills });
      }

      // Sequential adds — same race condition reason.
      for (const id of toAdd) {
        await api.post(`/v1/users/${user.id}/skills/side`, {
          skillId: id,
          name: findSkill(id)!.label,
        });
      }

      router.push('/profile');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Errore sconosciuto';
      alert(`Errore nel salvataggio: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const coreSkillObjects = selectedCore.map((id) => findSkill(id)).filter((s): s is Skill => !!s);
  const sideSkillObjects = selectedSide.map((id) => findSkill(id)).filter((s): s is Skill => !!s);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#fbf8ff' }}>
        <div className="animate-pulse text-[#595e78]" style={{ fontFamily: 'var(--font-plus-jakarta)' }}>{t.skills.loading}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fbf8ff', fontFamily: 'var(--font-plus-jakarta)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4"
        style={{
          height: 64,
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          borderBottom: '1px solid rgba(172,176,206,0.2)',
        }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center rounded-full hover:bg-[#e6e7f8] transition-colors"
          style={{ width: 40, height: 40, flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#595e78" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* COhA Logo centrato */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg width="129" height="37" viewBox="0 0 129 37" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="COhA">
            <path d="M71.4712 25.1531C70.7006 23.029 70.2645 21.7405 69.7296 19.7567C69.4798 20.0067 69.2177 20.2587 68.9286 20.5282L69.9375 25.1531L71.2156 31.1483C71.7336 33.6313 72.0648 34.9232 73.1752 36.9722H79.1393C76.8634 34.9814 75.5636 33.7184 74.1976 31.1483C73.1431 29.2076 72.518 27.9747 71.8426 26.1809C71.7213 25.8588 71.5985 25.5187 71.4712 25.1531Z" fill="#615FE2"/>
            <path d="M69.5115 18.9309C69.2759 19.1653 69.0214 19.41 68.7417 19.6718L68.9286 20.5282C69.2177 20.2587 69.4798 20.0067 69.7296 19.7567C69.659 19.4948 69.5866 19.2207 69.5115 18.9309Z" fill="#615FE2"/>
            <path d="M71.4712 25.1531C71.5985 25.5187 71.7213 25.8588 71.8426 26.1809C72.0364 24.163 72.6335 23.7809 74.368 24.1254C76.6938 24.7753 79.4442 26.9168 85.1034 31.6622L92.2604 36.9722C94.1412 37.0883 95.0542 36.7716 96.4352 35.5163C97.2204 34.6023 97.4273 34.0246 97.6281 32.9469V27.0373C95.4037 28.3877 94.0469 28.6879 91.4935 28.6646C87.9516 28.5053 85.6712 27.6997 81.1842 25.2387C79.009 23.8835 77.7959 23.5366 75.6461 23.0976C73.1617 22.747 71.994 23.0185 71.4712 25.1531Z" fill="#615FE2"/>
            <path d="M68.9286 20.5282L68.7417 19.6718C65.0295 22.409 62.8021 23.2432 58.691 24.0665C52.769 24.8945 49.5694 24.8594 44.2067 23.3814C39.9966 21.8445 38.3941 20.1557 35.9421 16.701V27.9206C38.7186 30.0067 40.7534 30.4547 45.0587 30.233C51.5311 29.5949 54.7311 28.7638 59.6282 26.379C63.4523 24.4414 65.5381 23.2498 68.9286 20.5282Z" fill="#615FE2"/>
            <path d="M69.5115 18.9309C68.9802 17.0008 68.8074 15.9253 68.5743 14.1048C68.0183 10.2861 68.1597 7.99173 71.1304 5.88275C72.9099 5.11587 73.6604 5.16552 74.4532 6.31098C75.8991 8.74632 74.9366 10.9931 72.4084 15.3895C71.4843 16.7174 70.8203 17.586 69.8437 18.5944C69.737 18.7047 69.6265 18.8166 69.5115 18.9309C69.5866 19.2207 69.659 19.4948 69.7296 19.7567C70.5076 18.9782 71.1665 18.2196 72.1528 17.0167C78.562 8.58743 78.5444 5.55711 76.1573 1.25787C76.1573 1.25787 75.5609 0.31576 74.2828 0.0588259C73.0048 -0.198108 71.9375 0.420356 71.0451 1.25787C67.1847 5.69408 66.2893 8.71045 67.8075 15.3895L68.7417 19.6718C69.0214 19.41 69.2759 19.1653 69.5115 18.9309Z" fill="#615FE2"/>
            <mask id="mask0_skills" style={{maskType:'alpha'}} maskUnits="userSpaceOnUse" x="35" y="0" width="63" height="37">
              <path d="M71.4712 25.1531C70.7006 23.029 70.2645 21.7405 69.7296 19.7567C69.4798 20.0067 69.2177 20.2587 68.9286 20.5282L69.9375 25.1531L71.2156 31.1483C71.7336 33.6313 72.0648 34.9232 73.1752 36.9722H79.1393C76.8634 34.9814 75.5636 33.7184 74.1976 31.1483C73.1431 29.2076 72.518 27.9747 71.8426 26.1809C71.7213 25.8588 71.5985 25.5187 71.4712 25.1531Z" fill="#615FE2"/>
              <path d="M69.5115 18.9309C69.2759 19.1653 69.0215 19.41 68.7417 19.6718L68.9286 20.5282C69.2177 20.2587 69.4798 20.0067 69.7296 19.7567C69.659 19.4948 69.5866 19.2207 69.5115 18.9309Z" fill="#615FE2"/>
              <path d="M71.4712 25.1531C71.5985 25.5187 71.7213 25.8588 71.8426 26.1809C72.0364 24.163 72.6335 23.7809 74.368 24.1254C76.6938 24.7753 79.4442 26.9168 85.1034 31.6622L92.2604 36.9722C94.1412 37.0883 95.0542 36.7716 96.4352 35.5163C97.2204 34.6023 97.4273 34.0246 97.6281 32.9469V27.0373C95.4037 28.3877 94.0469 28.6879 91.4935 28.6646C87.9516 28.5053 85.6712 27.6997 81.1842 25.2387C79.009 23.8835 77.7959 23.5366 75.6461 23.0976C73.1617 22.747 71.994 23.0185 71.4712 25.1531Z" fill="#615FE2"/>
              <path d="M68.9286 20.5282L68.7417 19.6718C65.0295 22.409 62.8021 23.2432 58.691 24.0665C52.769 24.8945 49.5694 24.8594 44.2067 23.3814C39.9966 21.8445 38.3941 20.1557 35.9421 16.701V27.9206C38.7186 30.0067 40.7534 30.4547 45.0587 30.233C51.5311 29.5949 54.7311 28.7638 59.6282 26.379C63.4523 24.4414 65.5381 23.2498 68.9286 20.5282Z" fill="#615FE2"/>
              <path d="M69.5115 18.9309C68.9802 17.0008 68.8074 15.9253 68.5743 14.1048C68.0183 10.2861 68.1597 7.99173 71.1304 5.88275C72.9099 5.11587 73.6604 5.16552 74.4532 6.31098C75.8991 8.74632 74.9366 10.9931 72.4084 15.3895C71.4843 16.7174 70.8203 17.586 69.8437 18.5944C69.737 18.7047 69.6265 18.8166 69.5115 18.9309C69.5866 19.2207 69.659 19.4948 69.7296 19.7567C70.5076 18.9782 71.1665 18.2196 72.1528 17.0167C78.562 8.58743 78.5444 5.55711 76.1573 1.25787C76.1573 1.25787 75.5609 0.31576 74.2828 0.0588259C73.0048 -0.198108 71.9375 0.420356 71.0451 1.25787C67.1847 5.69408 66.2893 8.71045 67.8075 15.3895L68.7417 19.6718C69.0215 19.41 69.2759 19.1653 69.5115 18.9309Z" fill="#615FE2"/>
            </mask>
            <g mask="url(#mask0_skills)">
              <rect x="21.1184" y="8.70459" width="46.8622" height="28.2899" fill="url(#skills_g0)"/>
              <rect x="69.215" y="18.6378" width="49.7354" height="29.6082" fill="url(#skills_g1)"/>
              <rect x="64.48" y="23.0285" width="17.4359" height="37.5037" fill="url(#skills_g2)"/>
              <rect x="65.8629" y="-9.88831" width="25.4121" height="27.3988" fill="url(#skills_g3)" fillOpacity="0.75"/>
            </g>
            <path d="M38.29 30.9597C36.9907 30.9597 35.7808 30.7242 34.6601 30.2532C33.5558 29.7822 32.5894 29.1245 31.7612 28.28C30.9329 27.4354 30.2833 26.4448 29.8123 25.3079C29.3575 24.171 29.1302 22.9286 29.1302 21.5806C29.1302 20.2326 29.3575 18.9902 29.8123 17.8534C30.267 16.7003 30.9085 15.7096 31.7368 14.8813C32.5651 14.0368 33.5314 13.3872 34.6358 12.9324C35.7564 12.4614 36.9745 12.2259 38.29 12.2259C39.6055 12.2259 40.7829 12.4452 41.8223 12.8837C42.878 13.3222 43.7712 13.9069 44.5021 14.6377C45.2329 15.3685 45.7526 16.1806 46.0612 17.0738L42.7237 18.6817C42.4151 17.8046 41.8711 17.0819 41.0915 16.5135C40.3282 15.9288 39.3943 15.6365 38.29 15.6365C37.2181 15.6365 36.2761 15.8882 35.4641 16.3917C34.652 16.8952 34.0186 17.5935 33.5639 18.4868C33.1254 19.3638 32.9061 20.3951 32.9061 21.5806C32.9061 22.7662 33.1254 23.8056 33.5639 24.6989C34.0186 25.5921 34.652 26.2905 35.4641 26.7939C36.2761 27.2974 37.2181 27.5491 38.29 27.5491C39.3943 27.5491 40.3282 27.2649 41.0915 26.6965C41.8711 26.1118 42.4151 25.381 42.7237 24.504L46.0612 26.1118C45.7526 27.0051 45.2329 27.8171 44.5021 28.5479C43.7712 29.2788 42.878 29.8634 41.8223 30.3019C40.7829 30.7404 39.6055 30.9597 38.29 30.9597ZM56.9619 30.9597C55.5976 30.9597 54.3309 30.7242 53.1615 30.2532C51.9922 29.7822 50.969 29.1245 50.092 28.28C49.2312 27.4192 48.5573 26.4204 48.07 25.2835C47.5828 24.1467 47.3392 22.9124 47.3392 21.5806C47.3392 20.2489 47.5747 19.0146 48.0457 17.8777C48.5329 16.7409 49.2069 15.7502 50.0676 14.9057C50.9447 14.0611 51.9678 13.4034 53.1372 12.9324C54.3065 12.4614 55.5814 12.2259 56.9619 12.2259C58.3423 12.2259 59.6172 12.4614 60.7866 12.9324C61.9559 13.4034 62.971 14.0611 63.8317 14.9057C64.7087 15.7502 65.3827 16.7409 65.8537 17.8777C66.3409 19.0146 66.5845 20.2489 66.5845 21.5806C66.5845 22.9124 66.3409 24.1467 65.8537 25.2835C65.3665 26.4204 64.6844 27.4192 63.8074 28.28C62.9466 29.1245 61.9316 29.7822 60.7622 30.2532C59.5929 30.7242 58.3261 30.9597 56.9619 30.9597ZM56.9619 27.5491C57.7901 27.5491 58.5535 27.403 59.2518 27.1106C59.9664 26.8183 60.5917 26.4123 61.1276 25.8926C61.6636 25.3566 62.0777 24.7232 62.3701 23.9924C62.6624 23.2616 62.8086 22.4576 62.8086 21.5806C62.8086 20.7036 62.6624 19.9078 62.3701 19.1932C62.0777 18.4624 61.6636 17.829 61.1276 17.2931C60.5917 16.7571 59.9664 16.3511 59.2518 16.075C58.5535 15.7827 57.7901 15.6365 56.9619 15.6365C56.1336 15.6365 55.3621 15.7827 54.6476 16.075C53.9492 16.3511 53.332 16.7571 52.7961 17.2931C52.2602 17.829 51.846 18.4624 51.5537 19.1932C51.2613 19.9078 51.1152 20.7036 51.1152 21.5806C51.1152 22.4576 51.2613 23.2616 51.5537 23.9924C51.846 24.7232 52.2602 25.3566 52.7961 25.8926C53.332 26.4123 53.9492 26.8183 54.6476 27.1106C55.3621 27.403 56.1336 27.5491 56.9619 27.5491ZM82.3872 30.6674L88.5262 12.5183H93.5446L99.6836 30.6674H95.5666L94.3485 26.9645H87.6979L86.4798 30.6674H82.3872ZM88.7454 23.6757H93.301L90.5238 15.1006H91.547L88.7454 23.6757Z" fill="#2C3149"/>
            <defs>
              <linearGradient id="skills_g0" x1="90.8031" y1="24.4817" x2="17.1625" y2="24.4817" gradientUnits="userSpaceOnUse">
                <stop offset="0.240385" stopColor="#615FE2" stopOpacity="0.52"/>
                <stop offset="0.602697" stopColor="#FBF8FF"/>
              </linearGradient>
              <linearGradient id="skills_g1" x1="143.172" y1="35.1501" x2="65.0165" y2="35.1501" gradientUnits="userSpaceOnUse">
                <stop offset="0.649865" stopColor="#FBF8FF"/>
                <stop offset="0.941702" stopColor="#615FE2" stopOpacity="0.52"/>
              </linearGradient>
              <linearGradient id="skills_g2" x1="73.0335" y1="20.1116" x2="73.2974" y2="60.5316" gradientUnits="userSpaceOnUse">
                <stop stopColor="#615FE2" stopOpacity="0.46"/>
                <stop offset="0.447379" stopColor="#FBF8FF" stopOpacity="0.49"/>
              </linearGradient>
              <linearGradient id="skills_g3" x1="87.6447" y1="-10.9698" x2="66.1891" y2="12.2683" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FBF8FF"/>
                <stop offset="0.870192" stopColor="#615FE2"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div style={{ width: 40, flexShrink: 0 }} />
      </header>

      {/* Scrollable content — pb accounts for confirm button (88px) + bottom nav (64px) */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 160 }}>
        <div className="px-6 pt-6 flex flex-col gap-8 max-w-lg mx-auto">

          {/* ── Header section ── */}
          <div className="flex flex-col gap-2">
            <h1
              className="font-bold text-[#191b27]"
              style={{ fontSize: 32, lineHeight: '40px' }}
            >
              {t.skills.pageTitle}
            </h1>
            <p className="text-[#464554]" style={{ fontSize: 14, lineHeight: '20px' }}>
              {t.skills.pageSubtitle}
            </p>
          </div>

          {/* ── Principali ── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[#191b27]" style={{ fontSize: 24, lineHeight: '32px' }}>
                {t.skills.coreSkills}
              </h2>
              <span
                className="font-medium text-[#4844c8] rounded-full"
                style={{
                  background: 'rgba(97,95,226,0.2)',
                  fontSize: 12,
                  lineHeight: '16px',
                  letterSpacing: '0.5px',
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 4,
                  paddingBottom: 4,
                }}
              >
                {selectedCore.length}/3
              </span>
            </div>

            {/* Selected core tags */}
            {coreSkillObjects.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coreSkillObjects.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center gap-1 bg-[#e6e7f8] border border-[#c7c4d6] rounded-full"
                    style={{ paddingLeft: 17, paddingRight: 17, paddingTop: 9, paddingBottom: 9 }}
                  >
                    <span className="text-[#191b27]" style={{ fontSize: 14, lineHeight: '20px' }}>
                      {skill.label}
                    </span>
                    <button onClick={() => removeCore(skill.id)} className="ml-1 hover:opacity-70 transition-opacity">
                      <X className="w-[10.5px] h-[10.5px] text-[#595e78]" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Expandable expanded={coreExpanded || !isEditCore}>
              <SkillAccordion
                selectedIds={selectedCore}
                disabledIds={new Set()}
                onToggle={toggleCore}
                defaultOpen="ai"
              />
            </Expandable>

            {isEditCore && (
              <button
                onClick={() => setCoreExpanded((v) => !v)}
                className="text-[#615fe2] font-medium hover:underline text-left"
                style={{ fontSize: 14 }}
              >
                {coreExpanded ? t.skills.closeSelection : t.skills.editCore}
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[#e1e1f2]" />

          {/* ── Competenze secondarie ── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[#191b27]" style={{ fontSize: 24, lineHeight: '32px' }}>
                {t.skills.sideSkills}
              </h2>
              <span
                className="font-medium text-[#4844c8] rounded-full"
                style={{
                  background: 'rgba(97,95,226,0.2)',
                  fontSize: 12,
                  lineHeight: '16px',
                  letterSpacing: '0.5px',
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 4,
                  paddingBottom: 4,
                }}
              >
                {selectedSide.length}/5
              </span>
            </div>

            {/* Selected side tags */}
            {sideSkillObjects.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sideSkillObjects.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center gap-1 bg-[#e6e7f8] border border-[#c7c4d6] rounded-full"
                    style={{ paddingLeft: 17, paddingRight: 17, paddingTop: 9, paddingBottom: 9 }}
                  >
                    <span className="text-[#191b27]" style={{ fontSize: 14, lineHeight: '20px' }}>
                      {skill.label}
                    </span>
                    <button onClick={() => removeSide(skill.id)} className="ml-1 hover:opacity-70 transition-opacity">
                      <X className="w-[10.5px] h-[10.5px] text-[#595e78]" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <SkillAccordion
              selectedIds={selectedSide}
              disabledIds={coreSet}
              onToggle={toggleSide}
              defaultOpen={null}
            />
          </div>
        </div>
      </div>

      {/* Confirm button — positioned above bottom nav (64px) */}
      <div
        className="fixed left-0 right-0 z-30 bg-white border-t border-[#ecedff] px-6 py-4 max-w-lg mx-auto"
        style={{ bottom: 64, boxShadow: '0px -4px 6px rgba(0,0,0,0.05)' }}
      >
        <button
          onClick={handleConfirm}
          disabled={selectedCore.length !== 3 || saving}
          className="w-full h-14 rounded-full flex items-center justify-center font-semibold text-white transition-all duration-300 active:scale-95 disabled:opacity-50"
          style={{
            fontSize: 14,
            background: selectedCore.length === 3 ? '#615fe2' : 'rgba(97,95,226,0.4)',
          }}
        >
          {saving
            ? t.skills.saving
            : selectedCore.length === 3
            ? t.skills.confirmSelection
            : (3 - selectedCore.length === 1
                ? t.skills.selectMore.replace('{n}', String(3 - selectedCore.length))
                : t.skills.selectMorePlural.replace('{n}', String(3 - selectedCore.length)))}
        </button>
      </div>
    </div>
  );
}
