'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useScroll, useMotionValueEvent } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { C, CTAButton, cx, EASE_OUT } from './shared';
import { CohaLogo } from './CohaLogo';

const NAV_LINKS = [
  { label: 'Opportunità', href: '#matching' },
  { label: 'Profilo', href: '#profilo' },
  { label: 'Come funziona', href: '#come-funziona' },
  { label: 'Chi siamo', href: '#chi-siamo' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 8));
  useEffect(() => setScrolled(scrollY.get() > 8), [scrollY]);

  return (
    <header className="sticky top-0 z-40">
      <div
        className="transition-colors duration-200"
        style={{
          backgroundColor: scrolled ? 'rgba(255,255,255,0.85)' : 'rgba(251,248,255,0.0)',
          backdropFilter: scrolled ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(10px)' : 'none',
          borderBottom: `1px solid ${scrolled ? C.lineSoft : 'transparent'}`,
        }}
      >
        <div className="mx-auto flex h-[64px] max-w-[1200px] items-center justify-between px-5 sm:px-8">
          {/* logo, top-left */}
          <a href="#top" aria-label="COhA" className="flex items-center">
            <CohaLogo height={30} idSuffix="nav" />
          </a>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="coha-navlink text-[14.5px] font-medium transition-colors hover:text-[#2c3149]"
                style={{ color: C.muted }}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <button
            type="button"
            aria-label="Apri menu"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
            style={{ color: C.ink, backgroundColor: C.surface, border: `1px solid ${C.line}` }}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="mx-4 mt-2 overflow-hidden rounded-3xl p-2 lg:hidden"
            style={{ backgroundColor: C.surface, border: `1px solid ${C.line}`, boxShadow: '0 12px 30px rgba(74,75,215,0.10)' }}
          >
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 text-[15px] font-medium"
                style={{ color: C.ink }}
              >
                {l.label}
              </a>
            ))}
            <div className="mt-1 grid grid-cols-2 gap-2 p-1">
              <a
                href="/login"
                className="rounded-full px-4 py-3 text-center text-[15px] font-semibold"
                style={{ color: C.violetDeep, border: `1px solid ${C.line}` }}
              >
                Accedi
              </a>
              <CTAButton href="/register" className="w-full px-4 py-3">
                Inizia gratis
              </CTAButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t" style={{ borderColor: C.lineSoft, backgroundColor: C.bg }}>
      <div className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <CohaLogo height={30} idSuffix="footer" />
            <p className="mt-4 text-[14px] leading-relaxed" style={{ color: C.muted }}>
              Tutte le opportunità per studenti universitari italiani, raccolte in un posto
              solo e scelte per te.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3">
            <FooterCol
              title="Prodotto"
              links={[
                { label: 'Opportunità', href: '#matching' },
                { label: 'Il tuo profilo', href: '#profilo' },
                { label: 'Come funziona', href: '#come-funziona' },
                { label: 'Chi siamo', href: '#chi-siamo' },
              ]}
            />
            <FooterCol
              title="Account"
              links={[
                { label: 'Accedi', href: '/login' },
                { label: 'Registrati', href: '/register' },
              ]}
            />
            <FooterCol
              title="Legale"
              links={[
                { label: 'Privacy', href: '/privacy' },
                { label: 'Termini', href: '/terms' },
              ]}
            />
          </div>
        </div>

        <div
          className="mt-12 flex flex-col gap-3 border-t pt-7 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: C.lineSoft }}
        >
          <p className="text-[13px]" style={{ color: C.faint }}>
            COhA {new Date().getFullYear()}
          </p>
          <p className="text-[13px] font-medium" style={{ color: C.violet }}>
            University is not enough.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h4 className="text-[13px] font-semibold" style={{ color: C.ink }}>
        {title}
      </h4>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="text-[14.5px] transition-colors hover:text-[#4a4bd7]"
              style={{ color: C.muted }}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
