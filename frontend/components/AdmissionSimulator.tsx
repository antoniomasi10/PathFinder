'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronDown, Clock, GraduationCap, Globe, Briefcase, Target } from 'lucide-react';
import { MockCourse } from '@/lib/mockCourses';

// ── Types ──

interface SimulatorInput {
  votoDiLaurea: number;
  statusLaurea: 'in_corso' | 'fuori_corso' | 'laureato' | '';
  livelloInglese: string;
  hasStage: boolean;
  stageDurataMesi: number;
  hasProgetti: boolean;
  hasLavoro: boolean;
  lavoroDurataMesi: number;
  coerenzaPercorso: number;
  campoStudi: string;
}

interface SimulatorResult {
  probabilitaFinale: number;
  dettaglio: {
    accademico: number;
    lingue: number;
    esperienza: number;
    coerenza: number;
  };
  categoria: { label: string; color: string };
  suggerimenti: string[];
}

// ── Algorithm ──

const ENGLISH_SCORES: Record<string, number> = {
  C2: 100, C1: 90, B2: 75, B1: 50, A2: 30,
};

const ENGLISH_ORDER: Record<string, number> = {
  A2: 1, B1: 2, B2: 3, C1: 4, C2: 5,
};

const FIELD_MATCH: Record<string, Record<string, number>> = {
  'Informatica': { 'Computer Science': 100, 'Artificial Intelligence': 100, 'Cybersecurity': 95, 'Marketing': 30, 'Automotive': 35 },
  'Ingegneria': { 'Computer Science': 80, 'Artificial Intelligence': 75, 'Cybersecurity': 70, 'Automotive': 100, 'Marketing': 35 },
  'Matematica': { 'Computer Science': 85, 'Artificial Intelligence': 90, 'Cybersecurity': 60, 'Automotive': 70, 'Marketing': 40 },
  'Economia': { 'Marketing': 100, 'Computer Science': 40, 'Artificial Intelligence': 35, 'Cybersecurity': 25, 'Automotive': 30 },
  'Comunicazione': { 'Marketing': 85, 'Computer Science': 25, 'Artificial Intelligence': 20, 'Cybersecurity': 20, 'Automotive': 20 },
  'Fisica': { 'Computer Science': 75, 'Artificial Intelligence': 80, 'Cybersecurity': 55, 'Automotive': 75, 'Marketing': 25 },
  'Altro': { 'Computer Science': 40, 'Artificial Intelligence': 35, 'Cybersecurity': 30, 'Marketing': 50, 'Automotive': 30 },
};

function calcolaProbabilita(input: SimulatorInput, course: MockCourse): SimulatorResult {
  // 1. Accademico (40%)
  let accademico = 0;
  const voto = input.votoDiLaurea;
  if (voto >= 110) accademico = 100;
  else if (voto >= 109) accademico = 95;
  else if (voto >= 106) accademico = 85;
  else if (voto >= 100) accademico = 75;
  else if (voto >= 90) accademico = 60;
  else accademico = 40;

  if (input.statusLaurea === 'in_corso') accademico += 5;
  else if (input.statusLaurea === 'fuori_corso') accademico -= 5;
  accademico = Math.min(100, Math.max(0, accademico));

  // 2. Lingue (25%)
  let lingue = ENGLISH_SCORES[input.livelloInglese] || 50;
  lingue = Math.min(100, lingue);

  // 3. Esperienza (20%)
  let esperienza = 30;
  if (input.hasStage) {
    if (input.stageDurataMesi >= 6) esperienza = 85;
    else if (input.stageDurataMesi >= 3) esperienza = 70;
    else esperienza = 55;
  }
  if (input.hasProgetti) esperienza += 15;
  if (input.hasLavoro) {
    let puntLavoro = 0;
    if (input.lavoroDurataMesi >= 12) puntLavoro = 100;
    else if (input.lavoroDurataMesi >= 6) puntLavoro = 85;
    else puntLavoro = 65;
    esperienza = Math.max(esperienza, puntLavoro);
  }
  esperienza = Math.min(100, esperienza);

  // 4. Coerenza (15%)
  const matchAuto = FIELD_MATCH[input.campoStudi]?.[course.sector] ?? 50;
  const coerenza = Math.round(input.coerenzaPercorso * 0.5 + matchAuto * 0.5);

  // 5. Totale pesato
  let prob = accademico * 0.40 + lingue * 0.25 + esperienza * 0.20 + coerenza * 0.15;

  // 6. Competitività
  if (course.competitiveness > 10) prob -= 10;
  else if (course.competitiveness > 5) prob -= 5;
  else if (course.competitiveness < 3) prob += 5;

  prob = Math.max(5, Math.min(95, Math.round(prob)));

  // Categoria
  let categoria: { label: string; color: string };
  if (prob >= 80) categoria = { label: 'Molto Alta', color: '#22C55E' };
  else if (prob >= 60) categoria = { label: 'Alta', color: '#84CC16' };
  else if (prob >= 35) categoria = { label: 'Moderata', color: '#F59E0B' };
  else categoria = { label: 'Bassa', color: '#EF4444' };

  // Suggerimenti
  const suggerimenti: string[] = [];
  const scores = [
    { key: 'esperienza', val: esperienza, msg: 'Accumula esperienza pratica attraverso stage, tirocini o progetti personali nel settore' },
    { key: 'lingue', val: lingue, msg: 'Migliora la tua certificazione linguistica per superare i requisiti minimi del corso' },
    { key: 'accademico', val: accademico, msg: 'Concentrati sul migliorare il voto di laurea negli esami rimanenti' },
    { key: 'coerenza', val: coerenza, msg: 'Considera corsi preparatori o certificazioni nel settore specifico del master' },
  ];
  scores.sort((a, b) => a.val - b.val);
  for (const s of scores) {
    if (s.val < 75 && suggerimenti.length < 3) suggerimenti.push(s.msg);
  }
  if (suggerimenti.length === 0) {
    suggerimenti.push('Ottimo profilo! Prepara una lettera motivazionale forte per distinguerti');
  }

  return {
    probabilitaFinale: prob,
    dettaglio: { accademico, lingue, esperienza, coerenza },
    categoria,
    suggerimenti,
  };
}

// ── Storage ──

export interface SavedSimulation {
  id: string;
  courseId: number;
  courseTitle: string;
  university: string;
  result: SimulatorResult;
  timestamp: number;
}

function saveSimulation(sim: SavedSimulation) {
  const key = 'pathfinder-simulations';
  const existing: SavedSimulation[] = JSON.parse(localStorage.getItem(key) || '[]');
  // Replace if same course, otherwise append
  const filtered = existing.filter((s) => s.courseId !== sim.courseId);
  filtered.unshift(sim);
  localStorage.setItem(key, JSON.stringify(filtered.slice(0, 20)));
}

export function getSavedSimulations(): SavedSimulation[] {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('pathfinder-simulations') || '[]');
}

// ── Component ──

interface Props {
  course: MockCourse;
  onClose: () => void;
}

export default function AdmissionSimulator({ course, onClose }: Props) {
  const [step, setStep] = useState(0); // 0=intro, 1-4=steps, 5=result
  const [input, setInput] = useState<SimulatorInput>({
    votoDiLaurea: 100,
    statusLaurea: '',
    livelloInglese: '',
    hasStage: false,
    stageDurataMesi: 0,
    hasProgetti: false,
    hasLavoro: false,
    lavoroDurataMesi: 0,
    coerenzaPercorso: 50,
    campoStudi: '',
  });
  const [noExperience, setNoExperience] = useState(false);
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next frame
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 300);
  }, [onClose]);

  const canAdvance = () => {
    switch (step) {
      case 1: return input.votoDiLaurea >= 66 && input.statusLaurea !== '';
      case 2: return input.livelloInglese !== '';
      case 3: return noExperience || input.hasStage || input.hasProgetti || input.hasLavoro;
      case 4: return input.campoStudi !== '';
      default: return true;
    }
  };

  const handleCalculate = () => {
    const res = calcolaProbabilita(input, course);
    setResult(res);
    setStep(5);
  };

  const handleSave = () => {
    if (!result) return;
    saveSimulation({
      id: `sim_${course.id}_${Date.now()}`,
      courseId: course.id,
      courseTitle: course.title,
      university: course.university,
      result,
      timestamp: Date.now(),
    });
    setSaved(true);
  };

  const englishMeetsReq = input.livelloInglese
    ? (ENGLISH_ORDER[input.livelloInglese] || 0) >= (ENGLISH_ORDER[course.requiredEnglishLevel] || 0)
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{
        backgroundColor: visible && !closing ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        transition: 'background-color 250ms ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: '#0D1117',
          maxHeight: '92vh',
          transform: visible && !closing ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2A3F54' }}>
          <div className="flex items-center gap-3">
            {step > 0 && step < 5 && (
              <button onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
            )}
            <span className="text-white font-semibold text-base">
              {step === 0 ? 'Simulatore ammissione' : step === 5 ? 'Risultato' : `Step ${step}/4`}
            </span>
          </div>
          <button onClick={handleClose}>
            <X className="w-5 h-5" style={{ color: '#8B8FA8' }} />
          </button>
        </div>

        {/* Progress bar */}
        {step >= 1 && step <= 4 && (
          <div className="px-5 pt-3">
            <div className="h-1.5 rounded-full" style={{ backgroundColor: '#2A3F54' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%`, backgroundColor: '#4A9EFF' }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === 0 && <StepIntro course={course} onStart={() => setStep(1)} />}
          {step === 1 && <Step1Academic input={input} setInput={setInput} />}
          {step === 2 && <Step2Language input={input} setInput={setInput} meetsReq={englishMeetsReq} reqLevel={course.requiredEnglishLevel} />}
          {step === 3 && <Step3Experience input={input} setInput={setInput} noExperience={noExperience} setNoExperience={setNoExperience} />}
          {step === 4 && <Step4Coherence input={input} setInput={setInput} course={course} />}
          {step === 5 && result && <Step5Result result={result} course={course} saved={saved} onSave={handleSave} onClose={handleClose} />}
        </div>

        {/* Footer with navigation */}
        {step >= 1 && step <= 4 && (
          <div className="px-5 py-4" style={{ borderTop: '1px solid #2A3F54' }}>
            <button
              onClick={step === 4 ? handleCalculate : () => setStep(step + 1)}
              disabled={!canAdvance()}
              className="w-full py-3 rounded-xl font-semibold transition-colors"
              style={{
                backgroundColor: canAdvance() ? '#4A9EFF' : '#2A3F54',
                color: canAdvance() ? 'white' : '#8B8FA8',
              }}
            >
              {step === 4 ? 'Calcola probabilità' : 'Avanti'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step Components ──

function StepIntro({ course, onStart }: { course: MockCourse; onStart: () => void }) {
  return (
    <div className="text-center py-6">
      <div
        className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1C2F43, #4A9EFF)' }}
      >
        <GraduationCap className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Simula la tua ammissione</h2>
      <p className="text-sm mb-1" style={{ color: '#D0D4DC' }}>
        Rispondi a poche domande per calcolare la tua probabilità di essere ammesso a:
      </p>
      <p className="text-base font-semibold text-white mt-3">{course.title}</p>
      <p className="text-sm" style={{ color: '#8B8FA8' }}>{course.university}</p>
      <div className="flex items-center justify-center gap-2 mt-5" style={{ color: '#8B8FA8' }}>
        <Clock className="w-4 h-4" />
        <span className="text-sm">Tempo stimato: 2 minuti</span>
      </div>
      <button
        onClick={onStart}
        className="w-full py-3 rounded-xl font-semibold mt-8 transition-colors"
        style={{ backgroundColor: '#4A9EFF', color: 'white' }}
      >
        Inizia simulazione
      </button>
    </div>
  );
}

function Step1Academic({ input, setInput }: { input: SimulatorInput; setInput: (i: SimulatorInput) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <GraduationCap className="w-5 h-5" style={{ color: '#4A9EFF' }} />
        <h3 className="text-lg font-bold text-white">Dati accademici</h3>
      </div>

      <label className="block text-sm font-medium mb-2" style={{ color: '#D0D4DC' }}>
        Voto di laurea atteso/ottenuto
      </label>
      <div className="mb-1">
        <input
          type="range"
          min={66}
          max={110}
          value={input.votoDiLaurea}
          onChange={(e) => setInput({ ...input, votoDiLaurea: Number(e.target.value) })}
          className="w-full accent-[#4A9EFF]"
        />
      </div>
      <div className="flex justify-between mb-6">
        <span className="text-xs" style={{ color: '#8B8FA8' }}>66</span>
        <span className="text-lg font-bold text-white">{input.votoDiLaurea}/110</span>
        <span className="text-xs" style={{ color: '#8B8FA8' }}>110</span>
      </div>
      {input.votoDiLaurea < 90 && (
        <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: '#92400E20', color: '#F59E0B' }}>
          Nota: alcuni corsi hanno requisiti minimi di voto
        </p>
      )}

      <label className="block text-sm font-medium mb-3" style={{ color: '#D0D4DC' }}>
        Status di laurea
      </label>
      <div className="space-y-2">
        {([
          { value: 'in_corso', label: 'Laureando in corso' },
          { value: 'fuori_corso', label: 'Laureando fuori corso' },
          { value: 'laureato', label: 'Già laureato' },
        ] as const).map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
            style={{
              backgroundColor: input.statusLaurea === opt.value ? '#4A9EFF15' : '#1C2F43',
              border: `1px solid ${input.statusLaurea === opt.value ? '#4A9EFF' : '#2A3F54'}`,
            }}
          >
            <div
              className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
              style={{ borderColor: input.statusLaurea === opt.value ? '#4A9EFF' : '#2A3F54' }}
            >
              {input.statusLaurea === opt.value && (
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#4A9EFF' }} />
              )}
            </div>
            <input
              type="radio"
              name="statusLaurea"
              value={opt.value}
              checked={input.statusLaurea === opt.value}
              onChange={() => setInput({ ...input, statusLaurea: opt.value })}
              className="sr-only"
            />
            <span className="text-sm text-white">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Step2Language({
  input, setInput, meetsReq, reqLevel,
}: { input: SimulatorInput; setInput: (i: SimulatorInput) => void; meetsReq: boolean | null; reqLevel: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Globe className="w-5 h-5" style={{ color: '#4A9EFF' }} />
        <h3 className="text-lg font-bold text-white">Competenze linguistiche</h3>
      </div>

      <label className="block text-sm font-medium mb-2" style={{ color: '#D0D4DC' }}>
        Certificazione lingua inglese
      </label>
      <div className="relative mb-4">
        <select
          value={input.livelloInglese}
          onChange={(e) => setInput({ ...input, livelloInglese: e.target.value })}
          className="w-full px-4 py-3 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#4A9EFF]"
          style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54', color: input.livelloInglese ? 'white' : '#8B8FA8' }}
        >
          <option value="">Seleziona livello</option>
          <option value="A2">A2 - Elementary</option>
          <option value="B1">B1 - Intermediate</option>
          <option value="B2">B2 - Upper Intermediate</option>
          <option value="C1">C1 - Advanced</option>
          <option value="C2">C2 - Proficient</option>
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#8B8FA8' }} />
      </div>

      {meetsReq !== null && (
        <div
          className="flex items-start gap-2 p-3 rounded-xl mb-4"
          style={{
            backgroundColor: meetsReq ? '#22C55E15' : '#EF444415',
            border: `1px solid ${meetsReq ? '#22C55E30' : '#EF444430'}`,
          }}
        >
          <span className="text-lg mt-0.5">{meetsReq ? '✅' : '⚠️'}</span>
          <div>
            <p className="text-sm font-medium" style={{ color: meetsReq ? '#22C55E' : '#F59E0B' }}>
              Requisito corso: {reqLevel}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#D0D4DC' }}>
              {meetsReq
                ? 'Il tuo livello soddisfa i requisiti minimi'
                : 'Il tuo livello è sotto i requisiti minimi del corso'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Step3Experience({
  input, setInput, noExperience, setNoExperience,
}: { input: SimulatorInput; setInput: (i: SimulatorInput) => void; noExperience: boolean; setNoExperience: (v: boolean) => void }) {

  const toggleNoExp = () => {
    if (!noExperience) {
      setInput({ ...input, hasStage: false, stageDurataMesi: 0, hasProgetti: false, hasLavoro: false, lavoroDurataMesi: 0 });
    }
    setNoExperience(!noExperience);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Briefcase className="w-5 h-5" style={{ color: '#4A9EFF' }} />
        <h3 className="text-lg font-bold text-white">Esperienze rilevanti</h3>
      </div>
      <p className="text-sm mb-4" style={{ color: '#8B8FA8' }}>
        Seleziona le tue esperienze nel settore di questo corso
      </p>

      <div className="space-y-3">
        {/* Stage */}
        <ExpCheckbox
          checked={input.hasStage}
          disabled={noExperience}
          onChange={(v) => setInput({ ...input, hasStage: v, stageDurataMesi: v ? input.stageDurataMesi : 0 })}
          label="Stage / tirocinio"
        >
          {input.hasStage && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs" style={{ color: '#8B8FA8' }}>Durata:</span>
              <input
                type="number"
                min={1}
                max={36}
                value={input.stageDurataMesi || ''}
                onChange={(e) => setInput({ ...input, stageDurataMesi: Number(e.target.value) })}
                placeholder="mesi"
                className="w-20 px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4A9EFF]"
                style={{ backgroundColor: '#0D1117', border: '1px solid #2A3F54' }}
              />
              <span className="text-xs" style={{ color: '#8B8FA8' }}>mesi</span>
            </div>
          )}
        </ExpCheckbox>

        {/* Progetti */}
        <ExpCheckbox
          checked={input.hasProgetti}
          disabled={noExperience}
          onChange={(v) => setInput({ ...input, hasProgetti: v })}
          label="Progetti personali rilevanti"
        />

        {/* Lavoro */}
        <ExpCheckbox
          checked={input.hasLavoro}
          disabled={noExperience}
          onChange={(v) => setInput({ ...input, hasLavoro: v, lavoroDurataMesi: v ? input.lavoroDurataMesi : 0 })}
          label="Esperienza lavorativa"
        >
          {input.hasLavoro && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs" style={{ color: '#8B8FA8' }}>Durata:</span>
              <input
                type="number"
                min={1}
                max={60}
                value={input.lavoroDurataMesi || ''}
                onChange={(e) => setInput({ ...input, lavoroDurataMesi: Number(e.target.value) })}
                placeholder="mesi"
                className="w-20 px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4A9EFF]"
                style={{ backgroundColor: '#0D1117', border: '1px solid #2A3F54' }}
              />
              <span className="text-xs" style={{ color: '#8B8FA8' }}>mesi</span>
            </div>
          )}
        </ExpCheckbox>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: '#2A3F54' }} />

        {/* Nessuna esperienza */}
        <ExpCheckbox
          checked={noExperience}
          disabled={false}
          onChange={toggleNoExp}
          label="Nessuna esperienza pratica"
        />
      </div>
    </div>
  );
}

function ExpCheckbox({
  checked, disabled, onChange, label, children,
}: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void; label: string; children?: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-3 transition-colors"
      style={{
        backgroundColor: checked ? '#4A9EFF10' : '#1C2F43',
        border: `1px solid ${checked ? '#4A9EFF50' : '#2A3F54'}`,
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0"
          style={{ borderColor: checked ? '#4A9EFF' : '#2A3F54', backgroundColor: checked ? '#4A9EFF' : 'transparent' }}
        >
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <input type="checkbox" checked={checked} onChange={() => onChange(!checked)} className="sr-only" />
        <span className="text-sm text-white">{label}</span>
      </label>
      {children}
    </div>
  );
}

function Step4Coherence({ input, setInput, course }: { input: SimulatorInput; setInput: (i: SimulatorInput) => void; course: MockCourse }) {
  const matchAuto = input.campoStudi ? (FIELD_MATCH[input.campoStudi]?.[course.sector] ?? 50) : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Target className="w-5 h-5" style={{ color: '#4A9EFF' }} />
        <h3 className="text-lg font-bold text-white">Allineamento del percorso</h3>
      </div>

      <label className="block text-sm font-medium mb-2" style={{ color: '#D0D4DC' }}>
        Il tuo campo di studi
      </label>
      <div className="relative mb-5">
        <select
          value={input.campoStudi}
          onChange={(e) => setInput({ ...input, campoStudi: e.target.value })}
          className="w-full px-4 py-3 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#4A9EFF]"
          style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54', color: input.campoStudi ? 'white' : '#8B8FA8' }}
        >
          <option value="">Seleziona</option>
          <option value="Informatica">Informatica</option>
          <option value="Ingegneria">Ingegneria</option>
          <option value="Matematica">Matematica / Statistica</option>
          <option value="Fisica">Fisica</option>
          <option value="Economia">Economia / Business</option>
          <option value="Comunicazione">Comunicazione / Lingue</option>
          <option value="Altro">Altro</option>
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#8B8FA8' }} />
      </div>

      {matchAuto !== null && (
        <div
          className="flex items-center gap-3 p-3 rounded-xl mb-5"
          style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{
              backgroundColor: matchAuto >= 70 ? '#22C55E20' : matchAuto >= 40 ? '#F59E0B20' : '#EF444420',
              color: matchAuto >= 70 ? '#22C55E' : matchAuto >= 40 ? '#F59E0B' : '#EF4444',
            }}
          >
            {matchAuto}%
          </div>
          <div>
            <p className="text-sm font-medium text-white">Match automatico</p>
            <p className="text-xs" style={{ color: '#8B8FA8' }}>{input.campoStudi} → {course.sector}</p>
          </div>
        </div>
      )}

      <label className="block text-sm font-medium mb-2" style={{ color: '#D0D4DC' }}>
        Quanto è allineato il tuo percorso con questo corso?
      </label>
      <input
        type="range"
        min={0}
        max={100}
        value={input.coerenzaPercorso}
        onChange={(e) => setInput({ ...input, coerenzaPercorso: Number(e.target.value) })}
        className="w-full accent-[#4A9EFF] mb-1"
      />
      <div className="flex justify-between">
        <span className="text-xs" style={{ color: '#8B8FA8' }}>Poco allineato</span>
        <span className="text-sm font-bold text-white">{input.coerenzaPercorso}%</span>
        <span className="text-xs" style={{ color: '#8B8FA8' }}>Molto allineato</span>
      </div>

      <div className="mt-5 p-3 rounded-xl" style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}>
        <p className="text-xs font-medium mb-1" style={{ color: '#4A9EFF' }}>💡 Considera:</p>
        <ul className="text-xs space-y-0.5" style={{ color: '#D0D4DC' }}>
          <li>• Materie già studiate nel tuo percorso</li>
          <li>• Progetti e tesi attinenti</li>
          <li>• Interessi e competenze personali</li>
        </ul>
      </div>
    </div>
  );
}

function Step5Result({
  result, course, saved, onSave, onClose,
}: { result: SimulatorResult; course: MockCourse; saved: boolean; onSave: () => void; onClose: () => void }) {
  const bars = [
    { label: 'Preparazione accademica', value: result.dettaglio.accademico },
    { label: 'Competenze linguistiche', value: result.dettaglio.lingue },
    { label: 'Esperienza pratica', value: result.dettaglio.esperienza },
    { label: 'Coerenza percorso', value: result.dettaglio.coerenza },
  ];

  return (
    <div className="pb-4">
      {/* Big percentage */}
      <div className="text-center mb-6">
        <div
          className="w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ border: `4px solid ${result.categoria.color}`, backgroundColor: `${result.categoria.color}15` }}
        >
          <span className="text-4xl font-bold" style={{ color: result.categoria.color }}>
            {result.probabilitaFinale}%
          </span>
        </div>
        <p className="text-lg font-bold" style={{ color: result.categoria.color }}>
          {result.categoria.label} probabilità
        </p>
        <p className="text-sm" style={{ color: '#8B8FA8' }}>di ammissione</p>
      </div>

      {/* Detail bars */}
      <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}>
        <h4 className="text-sm font-bold text-white mb-3">Dettaglio punteggi</h4>
        <div className="space-y-3">
          {bars.map((bar) => (
            <div key={bar.label}>
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: '#D0D4DC' }}>{bar.label}</span>
                <span className="text-xs font-bold text-white">{bar.value}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ backgroundColor: '#0D1117' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${bar.value}%`,
                    backgroundColor: bar.value >= 75 ? '#22C55E' : bar.value >= 50 ? '#F59E0B' : '#EF4444',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}>
        <h4 className="text-sm font-bold text-white mb-2">💡 Come migliorare</h4>
        <ul className="space-y-2">
          {result.suggerimenti.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span style={{ color: '#4A9EFF' }}>•</span>
              <span className="text-xs" style={{ color: '#D0D4DC' }}>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs mb-5 px-2" style={{ color: '#8B8FA8' }}>
        Questa è una stima basata su criteri generali. La decisione finale dipende dalla commissione universitaria.
      </p>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={onSave}
          disabled={saved}
          className="w-full py-3 rounded-xl font-semibold transition-colors"
          style={{
            backgroundColor: saved ? '#22C55E20' : '#4A9EFF',
            color: saved ? '#22C55E' : 'white',
            border: saved ? '1px solid #22C55E50' : 'none',
          }}
        >
          {saved ? '✓ Simulazione salvata' : 'Salva risultato'}
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-medium transition-colors"
          style={{ border: '1px solid #2A3F54', color: '#D0D4DC' }}
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}
