'use client';

import { LandingNav, LandingFooter } from './LandingChrome';
import { HeroSection } from './HeroSection';
import { LandingSections } from './Sections';
import { C } from './shared';

export default function LandingPage() {
  return (
    <div
      className="coha-landing relative min-h-[100dvh] overflow-x-hidden font-jakarta antialiased"
      style={{ backgroundColor: C.bg, color: C.ink }}
    >
      <LandingNav />
      <main>
        <HeroSection />
        <LandingSections />
      </main>
      <LandingFooter />
    </div>
  );
}
