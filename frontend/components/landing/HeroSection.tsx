'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Star } from 'lucide-react';
import { C, CTAButton, GhostButton, useCountUp, EASE_OUT, cx } from './shared';

/** Sonar halo: rings born behind the card, expanding outward in a continuous loop. */
function CardHalo() {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2">
        {[470, 640, 810].map((size, i) => (
          <div
            key={size}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: size, height: size, border: `1.5px solid rgba(124,108,255,${0.3 - i * 0.09})` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {[0, 2.7, 5.4].map((delay) => (
        <motion.div
          key={delay}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{ width: 460, height: 460, border: '1.5px solid rgba(124,108,255,0.4)', x: '-50%', y: '-50%' }}
          animate={{ scale: [0.62, 2], opacity: [0, 0.7, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear', delay, times: [0, 0.22, 1] }}
        />
      ))}
    </div>
  );
}

function FloatRing({ className, size, delay = 0 }: { className?: string; size: number; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={cx('pointer-events-none absolute -z-10 hidden rounded-full lg:block', className)}
      style={{ width: size, height: size, border: '1.5px solid rgba(124,108,255,0.16)' }}
      animate={reduce ? undefined : { y: [0, 18, 0], x: [0, 10, 0] }}
      transition={{ duration: 13 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

/** Faithful reproduction of the app's "Opportunity of the day" card. */
function OpportunityOfTheDayCard() {
  const reduce = useReducedMotion();
  const score = useCountUp(96, true);
  return (
    <motion.div
      animate={reduce ? undefined : { y: [0, -10, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="relative w-full max-w-[400px] overflow-hidden rounded-[24px] text-left"
      style={{
        backgroundColor: '#6B6CF5',
        boxShadow: '0 0 48px 18px rgba(220,218,255,0.60), 0 18px 50px rgba(107,108,245,0.45)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-coha-watermark.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{ right: '0%', top: '-5%', width: '100%', height: 'auto', opacity: 0.65 }}
      />

      <div className="relative z-10 flex flex-col p-[27px]">
        <div className="mb-[12px] flex items-center gap-[8px]">
          <Star className="h-3 w-3" fill="rgba(255,255,255,0.9)" strokeWidth={0} />
          <span className="text-[15px] font-semibold uppercase tracking-[0.8px] text-white">
            Opportunity of the day
          </span>
        </div>

        <div className="mt-[8px] flex items-center gap-[16px]">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white sm:h-14 sm:w-14"
            style={{ boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)' }}
          >
            <span className="text-[18px] font-bold" style={{ color: '#4a4bd7' }}>N</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-bold leading-[28px] text-white">Tirocinio in UX Design</p>
            <p className="truncate text-[16px] leading-[24px] text-white/90">Nexi • Milano</p>
          </div>
        </div>

        <div
          className="mt-[13px] grid items-center pt-[13px]"
          style={{ borderTop: '1px solid rgba(255,255,255,0.2)', gridTemplateColumns: '1fr 1fr 1fr' }}
        >
          <div>
            <p className="text-[10px] font-medium lowercase text-white/70">affinità</p>
            <p className="text-[20px] font-bold leading-[28px] text-white">{score}%</p>
          </div>
          <div className="flex justify-center">
            <span className="whitespace-nowrap text-[11px] font-semibold text-white/90 sm:text-[12px]">Scade tra 5 giorni</span>
          </div>
          <div className="flex justify-end">
            <div
              className="rounded-full px-[11px] py-[4px]"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)' }}
            >
              <span className="text-[13px] font-medium text-white">Tirocinio</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** Small opportunity chips drifting around the card. */
function FloatChip({
  label,
  bg,
  ink,
  className,
  delay = 0,
  amp = 12,
}: {
  label: string;
  bg: string;
  ink: string;
  className?: string;
  delay?: number;
  amp?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cx('absolute hidden whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold sm:block', className)}
      style={{ backgroundColor: bg, color: ink, boxShadow: '0 8px 20px rgba(74,75,215,0.12)' }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: [0, -amp, 0] }}
      transition={{
        opacity: { duration: 0.5, delay: 0.4 + delay },
        scale: { duration: 0.5, delay: 0.4 + delay, ease: EASE_OUT },
        y: { duration: 4.5 + delay, repeat: Infinity, ease: 'easeInOut', delay },
      }}
    >
      {label}
    </motion.div>
  );
}

export function HeroSection() {
  const reduce = useReducedMotion();

  // gentle depth: the card stage drifts slower than the copy while the hero scrolls out
  const { scrollY } = useScroll();
  const cardY = useTransform(scrollY, [0, 640], [0, 56]);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } } };
  const item = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } } };

  return (
    <section id="top" className="relative overflow-hidden">
      {/* layered canvas: soft top gradient + drifting violet glows + rings */}
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: `linear-gradient(180deg, #f1eeff 0%, ${C.bg} 55%)` }} />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 -z-10 h-[440px] w-[440px] rounded-full blur-[120px]"
        style={{ background: 'rgba(124,108,255,0.28)' }}
        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, 26, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute right-[-12%] top-[6%] -z-10 h-[420px] w-[420px] rounded-full blur-[120px]"
        style={{ background: 'rgba(160,150,255,0.24)' }}
        animate={reduce ? undefined : { x: [0, -34, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <FloatRing className="left-[6%] top-[20%]" size={150} delay={0} />
      <FloatRing className="left-[40%] bottom-[12%]" size={92} delay={2.5} />

      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:pt-24">
        <div className="relative">
          <motion.div variants={container} initial="hidden" animate="show" className="relative z-10">
          <motion.h1
            variants={item}
            className="text-[42px] font-extrabold leading-[1.05] sm:text-[52px] lg:text-[56px]"
            style={{ color: C.ink, letterSpacing: '-0.03em', textWrap: 'balance' } as React.CSSProperties}
          >
            Tutte le opportunità,{' '}
            <span style={{ color: C.violet }}>in un posto solo.</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-[33rem] text-[17px] leading-relaxed sm:text-[18.5px]"
            style={{ color: C.muted }}
          >
            Tirocini, summer school, scambi e borse. COhA raccoglie le opportunità sparse su
            decine di siti diversi e ti mostra quelle giuste per te.
          </motion.p>

          <motion.div variants={item} className="mt-9 flex flex-wrap items-center gap-3">
            <CTAButton href="/register" className="group gap-2">
              Inizia gratis
              <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </CTAButton>
            <GhostButton href="/login">Accedi</GhostButton>
          </motion.div>
          </motion.div>
        </div>

        {/* card stage: halo rings + floating chips + card */}
        <motion.div className="flex justify-center lg:justify-end" style={{ y: reduce ? undefined : cardY }}>
          <div className="relative w-full max-w-[440px] px-2 py-6">
            <CardHalo />
            <FloatChip label="Evento" bg="#e7f5fb" ink="#2f81a0" className="left-[-6px] top-[2px] z-20" delay={0.0} amp={14} />
            <FloatChip label="Hackathon" bg="#e9f6ef" ink="#2f8d5f" className="right-[-4px] top-[40px] z-20" delay={0.5} amp={10} />
            <FloatChip label="Summer school" bg="#f3eef9" ink="#6a4a8a" className="left-[-14px] bottom-[-4px] z-20" delay={0.9} amp={12} />
            <FloatChip label="Internship" bg="#eef1ff" ink="#3f54c4" className="right-[-10px] bottom-[-10px] z-20" delay={0.3} amp={13} />
            <div className="relative z-10 flex justify-center">
              <OpportunityOfTheDayCard />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
