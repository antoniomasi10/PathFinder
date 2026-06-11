'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useInView, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Target,
  Compass,
  GraduationCap,
  Languages,
  Plane,
  CalendarClock,
  BarChart3,
  Palette,
  Crown,
  Rocket,
  Users,
  PenLine,
  Sparkles,
  Briefcase,
  Building2,
  Mail,
  Send,
  FileText,
  Bookmark,
  type LucideIcon,
} from 'lucide-react';
import { C, Reveal, CTAButton, GhostButton, cx, EASE_OUT, useCountUp, SWASH_PATH } from './shared';
import { CohaLogo } from './CohaLogo';

function ScoreCounter({ target, duration, className, style }: { target: number; duration?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const val = useCountUp(target, inView, duration);
  return (
    <span ref={ref} className={className} style={style}>
      {val}%
    </span>
  );
}

function Heading({
  title,
  sub,
  align = 'left',
  className,
}: {
  title: React.ReactNode;
  sub?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div className={cx(align === 'center' && 'mx-auto text-center', 'max-w-[36rem]', className)}>
      <h2
        className="text-[30px] font-extrabold leading-[1.12] sm:text-[38px]"
        style={{ color: C.ink, letterSpacing: '-0.02em', textWrap: 'balance' } as React.CSSProperties}
      >
        {title}
      </h2>
      {sub && (
        <p className="mt-4 text-[16.5px] leading-relaxed" style={{ color: C.muted }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────── Section divider ───────────────────────── */

const DIVIDER_PATH = 'M 0 40 C 280 10, 520 70, 720 40 C 920 10, 1160 70, 1440 40';

/** Thematic divider: a thin wave that draws itself, with a light pulse traveling along it. */
function SectionDivider({ flip = false }: { flip?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div
      aria-hidden
      className="relative mx-auto h-[72px] w-full max-w-[1100px] px-5 sm:px-8"
      style={{
        transform: flip ? 'scaleX(-1)' : undefined,
        maskImage: 'linear-gradient(90deg, transparent, black 14%, black 86%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, black 14%, black 86%, transparent)',
      }}
    >
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="h-full w-full">
        <motion.path
          d={DIVIDER_PATH}
          fill="none"
          stroke="rgba(124,108,255,0.30)"
          strokeWidth={1.5}
          initial={{ pathLength: reduce ? 1 : 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.7 }}
          transition={{ duration: reduce ? 0 : 1.2, ease: EASE_OUT }}
        />
        {!reduce && (
          <>
            <path d={DIVIDER_PATH} fill="none" pathLength={100} stroke="rgba(124,108,255,0.25)" strokeWidth={6} strokeLinecap="round" strokeDasharray="10 90" strokeOpacity={0}>
              <animate attributeName="stroke-opacity" from="0" to="1" dur="0.4s" begin="1.4s" fill="freeze" />
              <animate attributeName="stroke-dashoffset" from="100" to="0" dur="4.5s" repeatCount="indefinite" begin="1.4s" />
            </path>
            <path d={DIVIDER_PATH} fill="none" pathLength={100} stroke="#7c6cff" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="10 90" strokeOpacity={0}>
              <animate attributeName="stroke-opacity" from="0" to="0.9" dur="0.4s" begin="1.4s" fill="freeze" />
              <animate attributeName="stroke-dashoffset" from="100" to="0" dur="4.5s" repeatCount="indefinite" begin="1.4s" />
            </path>
          </>
        )}
      </svg>
    </div>
  );
}

/* ───────────────────────── The problem (funnel) ───────────────────────── */

/**
 * x/y are coordinates in the 1100x560 funnel stage; r is the messy resting tilt.
 * bg/ink tint each source with its platform flavor (soft pairs already used by
 * the hero chips and profile tiles), against the single violet of the COhA node.
 */
const SOURCES: Array<{ name: string; meta: string; icon: LucideIcon; x: number; y: number; r: number; bg: string; ink: string }> = [
  { name: 'Sito dell’ateneo', meta: 'bandi e avvisi', icon: Building2, x: 105, y: 96, r: -5, bg: '#efecff', ink: '#6151c9' },
  { name: 'Aziende su LinkedIn', meta: 'tirocini', icon: Briefcase, x: 330, y: 16, r: 3, bg: '#e7f0fb', ink: '#2f6aa0' },
  { name: 'Newsletter', meta: 'da leggere', icon: Mail, x: 552, y: 110, r: -2, bg: '#fff2e3', ink: '#c07d2c' },
  { name: 'Gruppi Telegram', meta: 'mille messaggi', icon: Send, x: 778, y: 24, r: 4, bg: '#e7f5fb', ink: '#2f81a0' },
  { name: 'Bandi e MUR', meta: 'borse e scambi', icon: FileText, x: 1000, y: 88, r: -4, bg: '#e9f6ef', ink: '#2f8d5f' },
];

const FUNNEL_END = { x: 550, y: 500 };

function sourcePath(s: (typeof SOURCES)[number]) {
  const sx = s.x;
  const sy = s.y + 58; // starts behind the chip body, so the anchor stays hidden while it floats
  return `M ${sx} ${sy} C ${sx} ${sy + 150}, ${FUNNEL_END.x} ${FUNNEL_END.y - 170}, ${FUNNEL_END.x} ${FUNNEL_END.y}`;
}

function SourceChip({ name, meta, icon: Icon, bg, ink }: Pick<(typeof SOURCES)[number], 'name' | 'meta' | 'icon' | 'bg' | 'ink'>) {
  return (
    <div
      className="flex items-center gap-3 rounded-[18px] bg-white px-4 py-3.5"
      style={{ border: `1px solid ${C.line}`, boxShadow: '0 10px 26px rgba(74,75,215,0.10)' }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: bg }}>
        <Icon className="h-[19px] w-[19px]" style={{ color: ink }} />
      </div>
      <div>
        <p className="whitespace-nowrap text-[14.5px] font-semibold leading-tight" style={{ color: C.ink }}>{name}</p>
        <p className="whitespace-nowrap text-[12.5px]" style={{ color: C.faint }}>{meta}</p>
      </div>
    </div>
  );
}

function CohaNode({ idSuffix }: { idSuffix: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative">
      {/* receiver ripples: rings expanding away from the node as flows arrive */}
      {!reduce &&
        [0, 1.4].map((delay) => (
          <motion.div
            key={delay}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[22px]"
            style={{ border: '1.5px solid rgba(124,108,255,0.55)' }}
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut', delay }}
          />
        ))}
      <motion.div
        animate={reduce ? undefined : { scale: [1, 1.03, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative flex items-center justify-center rounded-[22px] bg-white px-9 py-5"
        style={{ border: `1px solid ${C.line}`, boxShadow: '0 0 44px 12px rgba(124,108,255,0.26), 0 16px 36px rgba(74,75,215,0.14)' }}
      >
        <CohaLogo height={34} idSuffix={idSuffix} />
      </motion.div>
    </div>
  );
}

/** Scattered sources up top, flow lines converging into the COhA node below. */
function FunnelStage() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto mt-6 hidden h-[560px] max-w-[1100px] md:block">
      {/* engineered dot-grid backdrop, fading out toward the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(124,108,255,0.22) 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(58% 52% at 50% 46%, black 25%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(58% 52% at 50% 46%, black 25%, transparent 78%)',
        }}
      />
      <svg viewBox="0 0 1100 560" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        {SOURCES.map((s, i) => {
          const d = sourcePath(s);
          return (
            <g key={s.name}>
              <motion.path
                d={d}
                fill="none"
                stroke="rgba(124,108,255,0.26)"
                strokeWidth={1.5}
                initial={{ pathLength: reduce ? 1 : 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: reduce ? 0 : 1.1, delay: 0.15 + i * 0.12, ease: EASE_OUT }}
              />
              {/* light pulse traveling the path: soft halo + bright comet head */}
              {!reduce && (
                <>
                  <path
                    d={d}
                    fill="none"
                    pathLength={100}
                    stroke="rgba(124,108,255,0.25)"
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray="12 88"
                    strokeOpacity={0}
                  >
                    <animate attributeName="stroke-opacity" from="0" to="1" dur="0.4s" begin={`${1.4 + i * 0.6}s`} fill="freeze" />
                    <animate attributeName="stroke-dashoffset" from="100" to="0" dur="3s" repeatCount="indefinite" begin={`${1.4 + i * 0.6}s`} />
                  </path>
                  <path
                    d={d}
                    fill="none"
                    pathLength={100}
                    stroke="#7c6cff"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeDasharray="12 88"
                    strokeOpacity={0}
                  >
                    <animate attributeName="stroke-opacity" from="0" to="1" dur="0.4s" begin={`${1.4 + i * 0.6}s`} fill="freeze" />
                    <animate attributeName="stroke-dashoffset" from="100" to="0" dur="3s" repeatCount="indefinite" begin={`${1.4 + i * 0.6}s`} />
                  </path>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {SOURCES.map((s, i) => (
        <div
          key={s.name}
          className="absolute"
          style={{ left: `${(s.x / 1100) * 100}%`, top: s.y, transform: 'translateX(-50%)' }}
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -22, rotate: s.r * 2.5 }}
            whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0, rotate: s.r }}
            viewport={{ once: true, amount: 0.4 }}
            transition={reduce ? { duration: 0.4 } : { type: 'spring', stiffness: 130, damping: 13, delay: i * 0.08 }}
          >
            <motion.div
              animate={reduce ? undefined : { y: [0, i % 2 === 0 ? -6 : -4, 0] }}
              transition={{ duration: 4 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.25 }}
              whileHover={reduce ? undefined : { y: -4, rotate: -s.r, scale: 1.03 }}
            >
              <SourceChip name={s.name} meta={s.meta} icon={s.icon} bg={s.bg} ink={s.ink} />
            </motion.div>
          </motion.div>
        </div>
      ))}

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <Reveal delay={0.3}>
          <CohaNode idSuffix="funnel" />
        </Reveal>
      </div>
    </div>
  );
}

/** Mobile fallback: messy chip pile, one vertical flow line, the node. */
function FunnelStack() {
  const reduce = useReducedMotion();
  return (
    <div className="mt-12 md:hidden">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {SOURCES.map((s, i) => (
          <motion.div
            key={s.name}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, rotate: 0 }}
            whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0, rotate: s.r }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: i * 0.07, ease: EASE_OUT }}
          >
            <SourceChip name={s.name} meta={s.meta} icon={s.icon} bg={s.bg} ink={s.ink} />
          </motion.div>
        ))}
      </div>
      <div className="mt-2 flex flex-col items-center">
        <motion.div
          className="relative h-14 w-px"
          style={{ background: `linear-gradient(180deg, transparent, ${C.violet})` }}
          initial={{ opacity: reduce ? 1 : 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {!reduce && (
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full"
              style={{ backgroundColor: '#7c6cff', boxShadow: '0 0 10px 2px rgba(124,108,255,0.55)' }}
              animate={{ y: [0, 46], opacity: [0, 1, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeIn', delay: 0.8 }}
            />
          )}
        </motion.div>
        <div className="mt-3">
          <Reveal delay={0.25}>
            <CohaNode idSuffix="funnel-m" />
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function ProblemSection() {
  return (
    <section className="overflow-hidden py-24 sm:py-28" style={{ backgroundColor: C.bg }}>
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <Reveal>
          <Heading
            align="center"
            title={<>Le opportunità sono ovunque. <span style={{ color: C.violet }}>Tranne in un posto solo.</span></>}
            sub="Sito dell’ateneo, pagine delle aziende, newsletter, gruppi, bandi. Per non perderne una dovresti controllarli tutti, ogni giorno. Nessuno ha il tempo di farlo."
            className="mx-auto !max-w-[40rem]"
          />
        </Reveal>
      </div>
      <FunnelStage />
      <FunnelStack />
    </section>
  );
}

/* ───────────────────────── The solution (matching) ───────────────────────── */

/** earned/max per factor; earned sums to 96, the affinity shown on the card. */
const MATCH_DIMS: Array<{ label: string; earned: number; max: number; icon: LucideIcon }> = [
  { label: 'I tuoi interessi', earned: 30, max: 30, icon: Target },
  { label: 'Il tuo profilo', earned: 25, max: 25, icon: Compass },
  { label: 'Media voti', earned: 13, max: 15, icon: GraduationCap },
  { label: 'Livello di inglese', earned: 15, max: 15, icon: Languages },
  { label: 'Disponibilità a spostarti', earned: 8, max: 10, icon: Plane },
  { label: 'Anno di corso', earned: 5, max: 5, icon: CalendarClock },
];

const ROW_DELAY = 0.32;

function FactorRow({ label, earned, max, icon: Icon, index, active }: (typeof MATCH_DIMS)[number] & { index: number; active: boolean }) {
  const reduce = useReducedMotion();
  const d = 0.3 + index * ROW_DELAY;
  return (
    <motion.div
      className="flex items-center gap-3.5"
      initial={{ opacity: reduce ? 1 : 0.25 }}
      animate={active ? { opacity: 1 } : undefined}
      transition={{ duration: 0.45, delay: reduce ? 0 : d }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: C.chipSoft }}>
        <Icon className="h-[17px] w-[17px]" style={{ color: C.violetDeep }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[14.5px] font-medium" style={{ color: C.ink }}>{label}</span>
          <motion.span
            className="shrink-0 text-[13px] font-bold"
            style={{ color: C.violetDeep }}
            initial={reduce ? undefined : { opacity: 0, scale: 0.5 }}
            animate={active ? { opacity: 1, scale: 1 } : undefined}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 16, delay: d + 0.22 }}
          >
            +{earned}
            <span className="font-semibold" style={{ color: C.faint }}>/{max}</span>
          </motion.span>
        </div>
        <div className="mt-1.5 h-1.5">
          <motion.div
            className="h-full origin-left rounded-full"
            style={{ width: `${(earned / 30) * 100}%`, backgroundColor: C.violet }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={active ? { scaleX: 1 } : undefined}
            transition={{ duration: reduce ? 0 : 0.55, delay: reduce ? 0 : d + 0.12, ease: EASE_OUT }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/** The scoring card computes itself in view: rows light up one by one, the total counts up in sync. */
function MatchingCard() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const active = useInView(ref, { once: true, amount: 0.45 });
  return (
    <div ref={ref} className="relative">
      {/* the rest of the ranked deck, peeking out behind the best match */}
      {[
        { y: -26, r: 2.5, s: 0.94, o: 0.45 },
        { y: -13, r: -2.5, s: 0.97, o: 0.75 },
      ].map(({ y, r, s, o }) => (
        <motion.div
          key={r}
          aria-hidden
          className="absolute inset-0 rounded-[24px] bg-white"
          style={{ border: `1px solid ${C.line}` }}
          initial={reduce ? { opacity: o, y, rotate: r, scale: s } : { opacity: 0, y: 0, rotate: 0, scale: 1 }}
          animate={active && !reduce ? { opacity: o, y, rotate: r, scale: s } : undefined}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT }}
        />
      ))}

      <div className="relative rounded-[24px] bg-white p-6 sm:p-7" style={{ border: `1px solid ${C.line}`, boxShadow: '0 16px 40px rgba(74,75,215,0.10)' }}>
        <div className="flex items-center gap-3 pb-5" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: C.chip }}>
            <Briefcase className="h-5 w-5" style={{ color: C.violetDeep }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold" style={{ color: C.ink }}>Tirocinio in UX Design</p>
            <p className="text-[13px]" style={{ color: C.muted }}>Nexi, Milano</p>
          </div>
          <div className="text-right">
            <ScoreCounter
              target={96}
              duration={0.3 * 1000 + MATCH_DIMS.length * ROW_DELAY * 1000 + 500}
              className="block text-[22px] font-extrabold leading-none"
              style={{ color: C.violetDeep }}
            />
            <div className="text-[11px] font-medium" style={{ color: C.faint }}>affinità</div>
          </div>
        </div>
        <div className="space-y-4 pt-5">
          {MATCH_DIMS.map((dim, i) => (
            <FactorRow key={dim.label} {...dim} index={i} active={active} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchingSection() {
  return (
    <section id="matching" className="relative overflow-hidden py-24 sm:py-28" style={{ background: `radial-gradient(70% 55% at 82% 22%, #efecff 0%, ${C.bg} 60%)` }}>
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <Heading
            title={<>Le uniamo tutte. <span className="block" style={{ color: C.violet }}>E le ordiniamo per te.</span></>}
            sub="COhA raccoglie le opportunità da ogni fonte e assegna a ognuna un punteggio di affinità su 100. Vedi prima quelle giuste per te, e non te ne perdi nemmeno una."
          />
          <div className="mt-9">
            <CTAButton href="/register">Inizia ora</CTAButton>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="pt-7">
          <MatchingCard />
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── Profiles ───────────────────────── */

const PROFILES: Array<{ name: string; line: string; icon: LucideIcon; bg: string; ink: string; unlocks: string[] }> = [
  {
    name: 'Analista',
    line: 'Capisci i dati e trovi l’ordine nelle cose, dove gli altri vedono solo rumore.',
    icon: BarChart3,
    bg: '#eef1ff',
    ink: '#3f54c4',
    unlocks: ['Tirocini in data & consulting', 'Business game', 'Borse per master quantitativi'],
  },
  {
    name: 'Creativo',
    line: 'Vedi soluzioni dove gli altri vedono vincoli.',
    icon: Palette,
    bg: '#fdeef6',
    ink: '#b14e8c',
    unlocks: ['Contest di design', 'Tirocini in UX e comunicazione', 'Laboratori creativi'],
  },
  {
    name: 'Leader',
    line: 'Guidi il gruppo verso un obiettivo.',
    icon: Crown,
    bg: '#fff2e3',
    ink: '#c07d2c',
    unlocks: ['Programmi di leadership', 'Associazioni studentesche', 'Business game'],
  },
  {
    name: 'Imprenditore',
    line: 'Trasformi le idee in qualcosa di concreto.',
    icon: Rocket,
    bg: '#efecff',
    ink: '#6151c9',
    unlocks: ['Startup competition', 'Hackathon', 'Percorsi in incubatori'],
  },
  {
    name: 'Sociale',
    line: 'Crei legami e fai funzionare il gruppo.',
    icon: Users,
    bg: '#e9f6ef',
    ink: '#2f8d5f',
    unlocks: ['Volontariato', 'Eventi di networking', 'Tutoring tra studenti'],
  },
  {
    name: 'Explorer',
    line: 'Cerchi strade e culture nuove, fuori dai percorsi già segnati.',
    icon: Compass,
    bg: '#e7f5fb',
    ink: '#2f81a0',
    unlocks: ['Erasmus e scambi', 'Summer school all’estero', 'Borse di mobilità'],
  },
];

function ProfileStage({ profile }: { profile: (typeof PROFILES)[number] }) {
  const reduce = useReducedMotion();
  const { name, line, icon: Icon, bg, ink, unlocks } = profile;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={name}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
        transition={{ duration: 0.32, ease: EASE_OUT }}
        className="relative flex h-full flex-col overflow-hidden rounded-[26px] p-7 sm:p-9"
        style={{ background: `linear-gradient(150deg, ${bg}, #ffffff 92%)`, border: `1px solid ${ink}24` }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl"
          style={{ background: `${ink}2e` }}
        />
        <Icon
          aria-hidden
          className="pointer-events-none absolute -bottom-8 -right-6 h-48 w-48 -rotate-12"
          style={{ color: `${ink}14` }}
          strokeWidth={1.4}
        />
        <div className="flex items-center gap-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white"
            style={{ boxShadow: `0 10px 24px ${ink}2b` }}
          >
            <Icon className="h-8 w-8" style={{ color: ink }} />
          </div>
          <h3 className="text-[26px] font-extrabold sm:text-[30px]" style={{ color: C.ink, letterSpacing: '-0.02em' }}>
            {name}
          </h3>
        </div>

        <p className="mt-5 max-w-[30rem] text-[16.5px] leading-relaxed" style={{ color: C.muted }}>
          {line}
        </p>

        <div className="mt-auto pt-7">
          <div className="h-px w-full" style={{ backgroundColor: `${ink}1c` }} />
          <p className="mt-5 text-[13px] font-semibold" style={{ color: C.faint }}>
            Con questo profilo vedi prima
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unlocks.map((u, i) => (
              <motion.span
                key={u}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.12 + i * 0.07, ease: EASE_OUT }}
                className="rounded-full bg-white px-3.5 py-1.5 text-[13.5px] font-semibold"
                style={{ color: ink, border: `1px solid ${ink}2b`, boxShadow: `0 4px 12px ${ink}14` }}
              >
                {u}
              </motion.span>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ProfileSection() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [manual, setManual] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { amount: 0.35 });

  // auto-cycle through profiles until the visitor picks one
  useEffect(() => {
    if (manual || reduce || !inView) return;
    const t = setInterval(() => setActive((a) => (a + 1) % PROFILES.length), 3200);
    return () => clearInterval(t);
  }, [manual, reduce, inView]);

  const pick = (i: number) => {
    setManual(true);
    setActive(i);
  };

  return (
    <section id="profilo" className="py-24 sm:py-28" style={{ background: `linear-gradient(180deg, ${C.bg} 0%, #edeefb 100%)` }}>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <Reveal>
          <Heading
            align="center"
            title={<>Non sei solo quello che hai fatto. <span className="block" style={{ color: C.violet }}>Sei quello che vuoi diventare.</span></>}
            sub="Rispondi a poche domande e COhA disegna il tuo profilo: non solo voti ed esami, ma le tue ambizioni. È da lì che parte il matching."
          />
        </Reveal>

        <Reveal delay={0.08} className="mt-12">
          <div ref={stageRef} className="grid grid-cols-1 gap-6 lg:grid-cols-[0.42fr_0.58fr] lg:gap-8">
            {/* mobile: horizontal snap pills */}
            <div className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto px-5 lg:hidden">
              {PROFILES.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => pick(i)}
                  aria-pressed={active === i}
                  className="flex shrink-0 snap-start items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-semibold transition-colors duration-200"
                  style={
                    active === i
                      ? { backgroundColor: p.bg, color: p.ink, border: `1px solid ${p.ink}38` }
                      : { backgroundColor: C.surface, color: C.muted, border: `1px solid ${C.line}` }
                  }
                >
                  <p.icon className="h-4 w-4" />
                  {p.name}
                </button>
              ))}
            </div>

            {/* desktop: vertical selector */}
            <div className="hidden flex-col gap-2 lg:flex">
              {PROFILES.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => pick(i)}
                  aria-pressed={active === i}
                  className="group flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all duration-200"
                  style={
                    active === i
                      ? { backgroundColor: '#ffffff', border: `1px solid ${p.ink}30`, boxShadow: `0 10px 26px ${p.ink}1a` }
                      : { backgroundColor: 'transparent', border: '1px solid transparent' }
                  }
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200"
                    style={{ backgroundColor: active === i ? p.bg : 'rgba(255,255,255,0.6)' }}
                  >
                    <p.icon className="h-5 w-5" style={{ color: active === i ? p.ink : C.muted }} />
                  </div>
                  <span
                    className="text-[16px] font-bold transition-colors duration-200"
                    style={{ color: active === i ? C.ink : C.muted }}
                  >
                    {p.name}
                  </span>
                </button>
              ))}
            </div>

            <div className="min-h-[360px] sm:min-h-[380px]">
              <ProfileStage profile={PROFILES[active]} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── How it works ───────────────────────── */

const STEPS: Array<{ verb: string; body: string; icon: LucideIcon }> = [
  { verb: 'Raccontati', body: 'Rispondi a poche domande e costruisci il tuo profilo.', icon: PenLine },
  { verb: 'Scopri', body: 'Ricevi le opportunità giuste, ordinate per affinità.', icon: Sparkles },
  { verb: 'Non perderne una', body: 'Salva quelle che ti interessano e confrontati con altri studenti.', icon: Bookmark },
];

function HowItWorks() {
  return (
    <section id="come-funziona" className="py-24 sm:py-28" style={{ background: `linear-gradient(180deg, #edeefb 0%, ${C.bg} 100%)` }}>
      <div className="mx-auto grid max-w-[1040px] grid-cols-1 items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
        <Reveal>
          <Heading
            title="Dalla registrazione alla prima opportunità, in pochi minuti."
            sub="Niente moduli infiniti e niente CV da caricare. Il profilo si costruisce rispondendo a poche domande."
          />
        </Reveal>

        <div className="relative">
          {/* vertical rail connecting the steps */}
          <div
            aria-hidden
            className="absolute bottom-10 left-7 top-10 w-px"
            style={{ background: `linear-gradient(180deg, transparent, ${C.chip} 14%, ${C.chip} 86%, transparent)` }}
          />
          <div className="space-y-9">
            {STEPS.map((s, i) => (
              <Reveal key={s.verb} delay={i * 0.1} className="relative flex items-start gap-5">
                <div
                  className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white"
                  style={{ border: `1px solid ${C.line}`, boxShadow: '0 6px 16px rgba(74,75,215,0.10)' }}
                >
                  <s.icon className="h-6 w-6" style={{ color: C.violetDeep }} />
                </div>
                <div className="pt-1">
                  <h3 className="text-[19px] font-bold" style={{ color: C.ink }}>{s.verb}</h3>
                  <p className="mt-1.5 max-w-[24rem] text-[14.5px] leading-relaxed" style={{ color: C.muted }}>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Testimonials ───────────────────────── */

// Placeholder quotes for launch: replace with real student feedback as it arrives.
const QUOTES: Array<{ text: string; name: string; meta: string; bg: string; ink: string; wide?: boolean }> = [
  {
    text: 'Ho trovato il bando per la summer school a Lisbona tre giorni prima della scadenza. Da sola non l’avrei mai visto.',
    name: 'Martina Rinaldi',
    meta: 'Economia · Università di Bologna',
    bg: '#eef1ff',
    ink: '#3f54c4',
    wide: true,
  },
  {
    text: 'Le prime tre opportunità che mi ha proposto erano tutte da salvare. Il punteggio di affinità funziona davvero.',
    name: 'Davide Colombo',
    meta: 'Ingegneria Informatica · Politecnico di Milano',
    bg: '#e9f6ef',
    ink: '#2f8d5f',
  },
  {
    text: 'Prima seguivo cinque newsletter e tre gruppi Telegram. Ora apro COhA.',
    name: 'Aurora Greco',
    meta: 'Lingue · Ca’ Foscari Venezia',
    bg: '#fdeef6',
    ink: '#b14e8c',
  },
];

function QuoteCard({ text, name, meta, bg, ink, wide, className }: (typeof QUOTES)[number] & { className?: string }) {
  const reduce = useReducedMotion();
  const initials = name.split(' ').map((p) => p[0]).join('');
  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -5 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      className={cx('flex flex-col justify-between rounded-[22px] p-6 sm:p-7', wide && 'sm:col-span-2', className)}
      style={
        wide
          ? { background: 'linear-gradient(150deg, #efecff, #ffffff 80%)', border: '1px solid rgba(97,95,226,0.20)', boxShadow: '0 14px 34px rgba(74,75,215,0.10)' }
          : { backgroundColor: '#ffffff', border: `1px solid ${C.line}`, boxShadow: '0 10px 26px rgba(74,75,215,0.06)' }
      }
    >
      <p className={cx('leading-relaxed', wide ? 'text-[17.5px]' : 'text-[15.5px]')} style={{ color: C.ink }}>
        &ldquo;{text}&rdquo;
      </p>
      <div className="mt-6 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold"
          style={{ backgroundColor: bg, color: ink }}
        >
          {initials}
        </div>
        <div>
          <p className="text-[14px] font-semibold leading-tight" style={{ color: C.ink }}>{name}</p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: C.faint }}>{meta}</p>
        </div>
      </div>
    </motion.div>
  );
}

function TestimonialsSection() {
  return (
    <section id="studenti" className="py-24 sm:py-28" style={{ background: `linear-gradient(180deg, ${C.bg} 0%, #ffffff 30%, #ffffff 70%, ${C.bg} 100%)` }}>
      <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
        <Reveal>
          <span
            aria-hidden
            className="block select-none text-[120px] font-extrabold leading-[0.55]"
            style={{ color: 'rgba(124,108,255,0.22)' }}
          >
            &ldquo;
          </span>
          <Heading
            title={<>Chi lo usa, lo racconta <span className="block" style={{ color: C.violet }}>meglio di noi.</span></>}
            sub="Le prime voci dagli atenei dove COhA sta crescendo."
            className="mt-4"
          />
        </Reveal>
        <Reveal delay={0.08}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {QUOTES.map((q, i) => (
              <QuoteCard key={q.name} {...q} className={i === 2 ? 'sm:translate-y-5' : undefined} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'COhA è gratuito?',
    a: 'Sì. Creare il profilo, ricevere le opportunità e salvarle non costa nulla.',
  },
  {
    q: 'Per chi è pensato?',
    a: 'Per chi studia in un’università italiana: triennale, magistrale o dottorato. Il profilo si adatta al tuo corso e al tuo anno.',
  },
  {
    q: 'Come funziona il punteggio di affinità?',
    a: 'Ogni opportunità riceve un punteggio da 0 a 100 in base a interessi, profilo, media voti, livello di inglese, disponibilità a spostarti e anno di corso. Vedi prima quelle con il punteggio più alto.',
  },
  {
    q: 'Da dove arrivano le opportunità?',
    a: 'Da atenei, aziende, enti e bandi pubblici. Le raccogliamo e le organizziamo in un unico posto, così non devi controllare dieci siti ogni giorno.',
  },
  {
    q: 'C’è anche una parte social?',
    a: 'Sì: puoi trovare altri studenti del tuo corso, scambiarti messaggi e confrontarti sulle opportunità che salvi.',
  },
];

function FaqItem({ q, a, open, onToggle, id }: { q: string; a: string; open: boolean; onToggle: () => void; id: string }) {
  const reduce = useReducedMotion();
  return (
    <div
      className="overflow-hidden rounded-[18px] bg-white"
      style={{ border: `1px solid ${C.line}`, boxShadow: open ? '0 10px 26px rgba(74,75,215,0.07)' : 'none' }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
      >
        <span className="text-[15.5px] font-semibold" style={{ color: C.ink }}>{q}</span>
        <ChevronDown
          className="h-[18px] w-[18px] shrink-0 transition-transform duration-200"
          style={{ color: C.violetDeep, transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          >
            <p className="px-5 pb-5 text-[14.5px] leading-relaxed sm:px-6" style={{ color: C.muted }}>
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <section id="faq" className="py-24 sm:py-28" style={{ backgroundColor: C.bg }}>
      <div className="mx-auto max-w-[720px] px-5 sm:px-8">
        <Reveal>
          <Heading align="center" title="Domande frequenti." />
        </Reveal>
        <Reveal delay={0.08} className="mt-12">
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <FaqItem
                key={f.q}
                {...f}
                id={`faq-panel-${i}`}
                open={openIndex === i}
                onToggle={() => setOpenIndex((v) => (v === i ? -1 : i))}
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── Closing CTA ───────────────────────── */

function ClosingSwash({ reduce }: { reduce: boolean }) {
  return (
    <svg
      viewBox="0 0 1070 782"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 hidden h-auto w-[106%] max-w-none -translate-x-1/2 -translate-y-1/2 sm:block"
    >
      <motion.path
        d={SWASH_PATH}
        fill="none"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 0.38 : 0 }}
        whileInView={{ pathLength: 1, opacity: 0.42 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ pathLength: { duration: reduce ? 0 : 2.6, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.6 } }}
      />
    </svg>
  );
}

function ClosingCTA() {
  const reduce = useReducedMotion();
  return (
    <section className="px-5 py-20 sm:px-8" style={{ backgroundColor: C.bg }}>
      <Reveal className="mx-auto max-w-[1100px]">
        <div
          className="relative overflow-hidden rounded-[28px] px-6 py-14 text-center sm:px-12 sm:py-24"
          style={{ background: 'linear-gradient(135deg, #6d5ef0 0%, #564bd6 52%, #44399f 100%)', boxShadow: C.cardGlow }}
        >
          {/* top sheen */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(70% 110% at 50% -10%, rgba(255,255,255,0.30), transparent 55%)' }} />
          {/* drifting aurora */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-24 -top-12 h-80 w-80 rounded-full blur-[90px]"
            style={{ background: 'rgba(255,255,255,0.18)' }}
            animate={reduce ? undefined : { x: [0, 46, 0], y: [0, 30, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 left-1/3 h-80 w-80 rounded-full blur-[90px]"
            style={{ background: 'rgba(176,168,255,0.30)' }}
            animate={reduce ? undefined : { x: [0, -30, 0], y: [0, -22, 0] }}
            transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* self-drawing brand swash, bookending the hero */}
          <ClosingSwash reduce={!!reduce} />

          <div className="relative z-10">
            <h2 className="mx-auto max-w-[20ch] text-[30px] font-extrabold leading-[1.12] text-white sm:text-[50px] sm:leading-[1.08]" style={{ letterSpacing: '-0.025em', textWrap: 'balance' } as React.CSSProperties}>
              Non perderti la prossima opportunità.
            </h2>
            <p className="mx-auto mt-5 max-w-[32rem] text-[16.5px] leading-relaxed text-white/85">
              Bastano pochi minuti per creare il tuo profilo e vedere quelle giuste per te.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-[15px] font-bold shadow-lg transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
                style={{ color: C.violetDeep }}
              >
                Inizia ora
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/45 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors duration-150 ease-out hover:bg-white/10 active:scale-[0.98]"
              >
                Accedi
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ───────────────────────── Company logo marquee ───────────────────────── */

/**
 * Simple Icons glyphs live in a square 24x24 box: wordmarks (SIEMENS, SAMSUNG)
 * only fill a thin horizontal strip of it, symbols (Apple, BMW) fill it all.
 * `h` is a per-logo box height that normalizes the optical size across both.
 */
const COMPANIES: Array<{ slug: string; name: string; h: number }> = [
  { slug: 'google', name: 'Google', h: 28 },
  { slug: 'accenture', name: 'Accenture', h: 26 },
  { slug: 'ferrari', name: 'Ferrari', h: 32 },
  { slug: 'sap', name: 'SAP', h: 48 },
  { slug: 'vodafone', name: 'Vodafone', h: 28 },
  { slug: 'siemens', name: 'Siemens', h: 88 },
  { slug: 'intel', name: 'Intel', h: 44 },
  { slug: 'bmw', name: 'BMW', h: 30 },
  { slug: 'nvidia', name: 'NVIDIA', h: 40 },
  { slug: 'unilever', name: 'Unilever', h: 30 },
  { slug: 'cisco', name: 'Cisco', h: 52 },
  { slug: 'audi', name: 'Audi', h: 56 },
  { slug: 'bosch', name: 'Bosch', h: 30 },
  { slug: 'samsung', name: 'Samsung', h: 88 },
  { slug: 'visa', name: 'Visa', h: 44 },
  { slug: 'apple', name: 'Apple', h: 28 },
];

function LogoGroup() {
  return (
    <div className="flex h-[88px] shrink-0 items-center gap-12 pr-12">
      {COMPANIES.map((c) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={c.slug}
          src={`/logos/${c.slug}.svg`}
          alt={c.name}
          className="w-auto shrink-0 opacity-65 transition-opacity duration-200 hover:opacity-100"
          style={{ height: c.h }}
        />
      ))}
    </div>
  );
}

function CompanyMarquee() {
  return (
    <section className="py-12 sm:py-14">
      <Reveal className="mb-9 px-5 text-center">
        <p className="text-[14.5px] font-medium" style={{ color: C.muted }}>
          Tirocini e progetti dalle aziende che cercano studenti come te
        </p>
      </Reveal>
      <div className="coha-marquee relative flex overflow-hidden">
        <div className="coha-marquee-track flex w-max">
          <LogoGroup />
          <LogoGroup />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-20" style={{ background: `linear-gradient(90deg, ${C.bg}, transparent)` }} />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-20" style={{ background: `linear-gradient(270deg, ${C.bg}, transparent)` }} />
      </div>
    </section>
  );
}

export function LandingSections() {
  return (
    <>
      <CompanyMarquee />
      <SectionDivider />
      <ProblemSection />
      <MatchingSection />
      <ProfileSection />
      <HowItWorks />
      <SectionDivider flip />
      <TestimonialsSection />
      <ClosingCTA />
      <SectionDivider />
      <FaqSection />
    </>
  );
}
