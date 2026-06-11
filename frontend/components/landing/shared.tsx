'use client';

import { useEffect, useState, ReactNode } from 'react';
import { motion, useReducedMotion, useMotionValue, useSpring } from 'framer-motion';

/**
 * Light, app-native tokens. These mirror the real COhA app surfaces
 * (TopBar / home feed): #fbf8ff canvas, white cards with #ecedff borders,
 * ink #2c3149, muted #595e78, violet #615FE2 / #4a4bd7.
 */
export const C = {
  bg: '#fbf8ff',
  surface: '#ffffff',
  tintBg: '#f4f3fd',
  ink: '#2c3149',
  muted: '#595e78',
  faint: '#8b8fab',
  line: '#ecedff',
  lineSoft: 'rgba(172,176,206,0.22)',
  chip: '#e4e7ff',
  chipSoft: '#f0f1f8',
  violet: '#615FE2',
  violetDeep: '#4a4bd7',
  violetCard: '#6b6cf5',
  cardGlow: '0 0 48px 18px rgba(220,218,255,0.55), 0 4px 24px rgba(107,108,245,0.30)',
};

// emil's strong ease-out. Built-in CSS easings are too weak.
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// The COhA swash path (from logo-coha-watermark.svg, viewBox 0 0 1070 782).
export const SWASH_PATH =
  'M0 353.432C16.2606 389.751 22.6386 400.2 44.1038 424.254C44.1038 424.254 66.2773 444.23 97.3203 466.021C128.363 487.813 135.754 491.445 168.276 502.341C200.797 513.237 214.101 516.869 242.187 518.685C242.187 518.685 274.709 522.317 319.056 520.501C363.403 518.685 391.57 511.505 434.358 496.893C477.147 482.281 486.787 478.518 512.705 464.206C538.623 449.894 551.433 439.064 570.356 413.359L552.617 315.296C544.829 260.066 544.746 228.54 548.182 171.835C558.626 113.023 570.609 81.032 608.79 26.5578C648.702 -17.0253 694.528 -7.94555 712.267 61.0611C724.093 131.884 722.304 167.568 691.571 240.842C658.289 314.088 635.656 353.039 588.095 418.806C596.321 464.807 604.365 490.462 617.659 531.397C621.01 514.448 623.081 506.438 638.355 495.077C656.776 487.53 666.562 483.953 688.615 485.997C718.18 493.261 737.626 503.984 765.483 520.501C810.559 552.461 836.821 567.441 885.22 589.507C920.044 604.969 939.812 608 975.393 605.851C1013.32 605.391 1036.43 598.704 1070 573.164V698.465C1067.32 718.294 1063.69 729.074 1052.26 747.497C1036.86 768.335 1025.76 776.234 1000.52 782H978.349C978.349 782 906.728 726.135 866.003 682.122L780.266 596.771C742.821 560.724 725.026 543.021 682.702 516.869C666.666 508.77 648.702 500.525 636.877 509.605C625.051 524.133 623.012 531.259 623.572 551.372C640.903 612.179 654.341 640.927 682.702 696.649C701.92 733.414 719.391 753.982 749.223 782H697.484H645.746C628.816 733.859 619.799 703.643 608.79 651.25L573.312 431.518C541.949 464.411 520.765 483.112 483.14 511.421C439.146 541.823 413.052 557.087 363.403 580.428C315.842 603.949 286.697 612.704 233.318 625.827C178.823 640.366 149.775 642.832 100.277 638.539C55.3875 631.784 36.8815 620.228 0 589.508V471.47V353.432ZM564.443 240.842C562.483 302.984 566.189 337.602 583.66 398.831C618.789 353.161 635.41 324.904 657.572 268.081C676.319 226.074 679.745 204.523 676.789 159.123C666.441 117.356 654.233 103.447 608.79 124.62C581.327 143.924 570.284 165.941 564.443 240.842Z';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/** Restrained scroll reveal. Crossfade-only under reduced motion. */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: reduce ? 0.4 : 0.6, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Primary CTA: solid violet, white text (6.3:1), press feedback.
 * Magnetic on mouse: pulls a few px toward the cursor via spring motion
 * values (no React state per frame). Static under reduced motion / touch.
 */
export function CTAButton({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 260, damping: 20, mass: 0.5 });
  const y = useSpring(my, { stiffness: 260, damping: 20, mass: 0.5 });

  const onPointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - (r.left + r.width / 2)) * 0.16);
    my.set((e.clientY - (r.top + r.height / 2)) * 0.24);
  };
  const reset = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.a
      href={href}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      whileTap={{ scale: 0.97 }}
      className={cx(
        'inline-flex items-center justify-center rounded-full px-7 py-3.5 text-[15px] font-semibold text-white',
        'transition-colors duration-150 ease-out hover:bg-[#4140c4] whitespace-nowrap',
        className,
      )}
      style={{ backgroundColor: C.violetDeep, x, y }}
    >
      {children}
    </motion.a>
  );
}

/** Secondary CTA: quiet, app-native. */
export function GhostButton({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cx(
        'inline-flex items-center justify-center rounded-full px-6 py-3.5 text-[15px] font-semibold',
        'border transition-colors duration-150 ease-out active:scale-[0.98] whitespace-nowrap',
        className,
      )}
      style={{ color: C.violetDeep, borderColor: C.line, backgroundColor: C.surface }}
    >
      {children}
    </a>
  );
}

/** Eased count-up once in view. Static under reduced motion. */
export function useCountUp(target: number, inView: boolean, duration = 1100) {
  const reduce = useReducedMotion();
  const [val, setVal] = useState(reduce ? target : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setVal(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration, reduce]);

  return val;
}
