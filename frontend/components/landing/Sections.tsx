'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useInView } from 'framer-motion';
import {
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

function ScoreCounter({ target, className, style }: { target: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const val = useCountUp(target, inView);
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

/* ───────────────────────── The problem ───────────────────────── */

const SOURCES: Array<{ name: string; meta: string; icon: LucideIcon; rotate: string }> = [
  { name: 'Sito dell’ateneo', meta: 'bandi e avvisi', icon: Building2, rotate: '-3deg' },
  { name: 'Aziende su LinkedIn', meta: 'tirocini', icon: Briefcase, rotate: '2deg' },
  { name: 'Newsletter', meta: 'da leggere', icon: Mail, rotate: '-1.5deg' },
  { name: 'Gruppi Telegram', meta: 'mille messaggi', icon: Send, rotate: '2.5deg' },
  { name: 'Bandi e MUR', meta: 'borse e scambi', icon: FileText, rotate: '-2deg' },
];

function ProblemSection() {
  const reduce = useReducedMotion();
  return (
    <section className="py-24 sm:py-28" style={{ backgroundColor: C.bg }}>
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <Reveal>
          <Heading
            align="center"
            title={<>Le opportunità sono ovunque. <span style={{ color: C.violet }}>Tranne in un posto solo.</span></>}
            sub="Sito dell’ateneo, pagine delle aziende, newsletter, gruppi, bandi. Per non perderne una dovresti controllarli tutti, ogni giorno. Nessuno ha il tempo di farlo."
            className="mx-auto !max-w-[40rem]"
          />
        </Reveal>

        <Reveal delay={0.08} className="mt-14">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {SOURCES.map((s, i) => (
              <motion.div
                key={s.name}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, rotate: 0 }}
                whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0, rotate: s.rotate }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: EASE_OUT }}
              >
                <motion.div
                  animate={reduce ? undefined : { y: [0, i % 2 === 0 ? -7 : -4, 0] }}
                  transition={{ duration: 4 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.25 }}
                  whileHover={reduce ? undefined : { y: -5, rotate: 0, scale: 1.03 }}
                  className="flex items-center gap-3 rounded-[18px] bg-white px-4 py-3.5"
                  style={{ border: `1px solid ${C.line}`, boxShadow: '0 10px 26px rgba(74,75,215,0.08)' }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: C.chipSoft }}>
                    <s.icon className="h-[19px] w-[19px]" style={{ color: C.muted }} />
                  </div>
                  <div>
                    <p className="text-[14.5px] font-semibold leading-tight" style={{ color: C.ink }}>{s.name}</p>
                    <p className="text-[12.5px]" style={{ color: C.faint }}>{s.meta}</p>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── The solution (matching) ───────────────────────── */

const MATCH_DIMS: Array<{ label: string; pts: number; icon: LucideIcon }> = [
  { label: 'I tuoi interessi', pts: 30, icon: Target },
  { label: 'Il tuo profilo', pts: 25, icon: Compass },
  { label: 'Media voti', pts: 15, icon: GraduationCap },
  { label: 'Livello di inglese', pts: 15, icon: Languages },
  { label: 'Disponibilità a spostarti', pts: 10, icon: Plane },
  { label: 'Anno di corso', pts: 5, icon: CalendarClock },
];

function FactorRow({ label, pts, icon: Icon, index }: (typeof MATCH_DIMS)[number] & { index: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center gap-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: C.chipSoft }}>
        <Icon className="h-[17px] w-[17px]" style={{ color: C.violetDeep }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[14.5px] font-medium" style={{ color: C.ink }}>{label}</span>
          <span className="shrink-0 text-[13px] font-bold" style={{ color: C.violetDeep }}>+{pts}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: '#eceaf8' }}>
          <motion.div
            className="h-full origin-left rounded-full"
            style={{ width: `${(pts / 30) * 100}%`, backgroundColor: C.violet }}
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.8, delay: 0.05 + index * 0.07, ease: EASE_OUT }}
          />
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
            title={<>Le uniamo tutte. <span style={{ color: C.violet }}>E le ordiniamo per te.</span></>}
            sub="COhA raccoglie le opportunità da ogni fonte e assegna a ognuna un punteggio di affinità su 100. Vedi prima quelle giuste per te, e non te ne perdi nemmeno una."
          />
          <div className="mt-9">
            <CTAButton href="/register">Inizia ora</CTAButton>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="rounded-[24px] bg-white p-6 sm:p-7" style={{ border: `1px solid ${C.line}`, boxShadow: '0 16px 40px rgba(74,75,215,0.08)' }}>
            <div className="flex items-center gap-3 pb-5" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: C.chip }}>
                <Briefcase className="h-5 w-5" style={{ color: C.violetDeep }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold" style={{ color: C.ink }}>Tirocinio in UX Design</p>
                <p className="text-[13px]" style={{ color: C.muted }}>Nexi, Milano</p>
              </div>
              <div className="text-right">
                <ScoreCounter target={96} className="block text-[20px] font-extrabold leading-none" style={{ color: C.violetDeep }} />
                <div className="text-[11px] font-medium" style={{ color: C.faint }}>affinità</div>
              </div>
            </div>
            <div className="space-y-4 pt-5">
              {MATCH_DIMS.map((d, i) => (
                <FactorRow key={d.label} {...d} index={i} />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── Profiles ───────────────────────── */

const PROFILES: Array<{ name: string; line: string; icon: LucideIcon; bg: string; ink: string; wide?: boolean }> = [
  { name: 'Analista', line: 'Capisci i dati e trovi l’ordine nelle cose, dove gli altri vedono solo rumore.', icon: BarChart3, bg: '#eef1ff', ink: '#3f54c4', wide: true },
  { name: 'Creativo', line: 'Vedi soluzioni nuove.', icon: Palette, bg: '#fdeef6', ink: '#b14e8c' },
  { name: 'Leader', line: 'Guidi verso un obiettivo.', icon: Crown, bg: '#fff2e3', ink: '#c07d2c' },
  { name: 'Imprenditore', line: 'Trasformi le idee in concreto.', icon: Rocket, bg: '#efecff', ink: '#6151c9' },
  { name: 'Sociale', line: 'Crei legami nel gruppo.', icon: Users, bg: '#e9f6ef', ink: '#2f8d5f' },
  { name: 'Explorer', line: 'Cerchi strade e culture nuove, fuori dai percorsi già segnati.', icon: Compass, bg: '#e7f5fb', ink: '#2f81a0', wide: true },
];

function ProfileTile({ name, line, icon: Icon, bg, ink, wide }: (typeof PROFILES)[number]) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -6 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      className={cx('group relative overflow-hidden rounded-[22px] p-6', wide ? 'sm:col-span-2' : '')}
      style={{ background: `linear-gradient(155deg, ${bg}, #ffffff 95%)`, border: `1px solid ${ink}1f` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-90"
        style={{ background: `${ink}33` }}
      />
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white transition-transform duration-300 group-hover:-rotate-6"
        style={{ boxShadow: `0 6px 16px ${ink}22` }}
      >
        <Icon className="h-[22px] w-[22px]" style={{ color: ink }} />
      </div>
      <h3 className="relative mt-4 text-[19px] font-bold" style={{ color: C.ink }}>{name}</h3>
      <p className="relative mt-1.5 text-[14.5px] leading-relaxed" style={{ color: C.muted }}>{line}</p>
    </motion.div>
  );
}

function ProfileSection() {
  return (
    <section id="profilo" className="py-24 sm:py-28" style={{ background: 'linear-gradient(180deg, #f5f4fd 0%, #edeefb 100%)' }}>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <Reveal>
          <Heading
            align="center"
            title={<>Sei più di una <span style={{ color: C.violet }}>media voti.</span></>}
            sub="Il matching parte da chi sei. Rispondi a poche domande e COhA disegna il tuo profilo: sei uno di sei, e questo cambia le opportunità che vedi."
          />
        </Reveal>
        <Reveal delay={0.08} className="mt-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROFILES.map((p) => (
              <ProfileTile key={p.name} {...p} />
            ))}
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
    <section id="come-funziona" className="py-24 sm:py-28" style={{ backgroundColor: C.tintBg }}>
      <div className="mx-auto max-w-[1040px] px-5 sm:px-8">
        <Reveal>
          <Heading align="center" title="Dalla registrazione alla prima opportunità, in pochi minuti." />
        </Reveal>
        <div className="relative mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-7 hidden h-px sm:block"
            style={{ background: `linear-gradient(90deg, transparent, ${C.chip} 18%, ${C.chip} 82%, transparent)` }}
          />
          {STEPS.map((s, i) => (
            <Reveal key={s.verb} delay={i * 0.1} className="relative text-center">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white" style={{ border: `1px solid ${C.line}`, boxShadow: '0 6px 16px rgba(74,75,215,0.10)' }}>
                  <s.icon className="h-6 w-6" style={{ color: C.violetDeep }} />
                </div>
              </div>
              <h3 className="mt-5 text-[20px] font-bold" style={{ color: C.ink }}>{s.verb}</h3>
              <p className="mx-auto mt-2 max-w-[15rem] text-[14.5px] leading-relaxed" style={{ color: C.muted }}>{s.body}</p>
            </Reveal>
          ))}
        </div>
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
      className="pointer-events-none absolute right-[-3%] top-1/2 h-[165%] w-auto max-w-none"
      style={{ transform: 'translateY(-50%) scaleX(1.12)' }}
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
          className="relative overflow-hidden rounded-[28px] px-6 py-24 text-center sm:px-12"
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
            <h2 className="mx-auto max-w-[20ch] text-[34px] font-extrabold leading-[1.08] text-white sm:text-[50px]" style={{ letterSpacing: '-0.025em', textWrap: 'balance' } as React.CSSProperties}>
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
            <p className="mt-9 text-[14px] font-medium text-white/70">University is not enough.</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ───────────────────────── Company logo marquee ───────────────────────── */

const COMPANIES: Array<{ slug: string; name: string }> = [
  { slug: 'google', name: 'Google' },
  { slug: 'accenture', name: 'Accenture' },
  { slug: 'ferrari', name: 'Ferrari' },
  { slug: 'sap', name: 'SAP' },
  { slug: 'vodafone', name: 'Vodafone' },
  { slug: 'siemens', name: 'Siemens' },
  { slug: 'intel', name: 'Intel' },
  { slug: 'bmw', name: 'BMW' },
  { slug: 'nvidia', name: 'NVIDIA' },
  { slug: 'unilever', name: 'Unilever' },
  { slug: 'cisco', name: 'Cisco' },
  { slug: 'audi', name: 'Audi' },
  { slug: 'bosch', name: 'Bosch' },
  { slug: 'samsung', name: 'Samsung' },
  { slug: 'visa', name: 'Visa' },
  { slug: 'apple', name: 'Apple' },
];

function LogoGroup() {
  return (
    <div className="flex shrink-0 items-center gap-12 pr-12">
      {COMPANIES.map((c) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={c.slug}
          src={`/logos/${c.slug}.svg`}
          alt={c.name}
          className="h-6 w-auto shrink-0 opacity-65 transition-opacity duration-200 hover:opacity-100 sm:h-7"
          style={{ maxWidth: 116 }}
        />
      ))}
    </div>
  );
}

function CompanyMarquee() {
  return (
    <section className="border-y py-12 sm:py-14" style={{ borderColor: C.lineSoft, backgroundColor: C.surface }}>
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
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-20" style={{ background: `linear-gradient(90deg, ${C.surface}, transparent)` }} />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-20" style={{ background: `linear-gradient(270deg, ${C.surface}, transparent)` }} />
      </div>
    </section>
  );
}

export function LandingSections() {
  return (
    <>
      <CompanyMarquee />
      <ProblemSection />
      <MatchingSection />
      <ProfileSection />
      <HowItWorks />
      <ClosingCTA />
    </>
  );
}
