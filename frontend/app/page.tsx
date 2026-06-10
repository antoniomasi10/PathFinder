import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'COhA - Tutte le opportunità in un posto solo',
  description:
    'Tirocini, summer school, scambi e borse sono sparsi su mille siti. COhA li raccoglie in un posto solo e ti mostra quelli giusti per te, con un punteggio di affinità.',
  openGraph: {
    title: 'COhA - Tutte le opportunità in un posto solo',
    description:
      'Smetti di controllare mille siti. COhA raccoglie le opportunità per studenti universitari e te le ordina per affinità.',
    type: 'website',
  },
};

// Marketing landing for visitors. AuthProvider redirects authenticated users
// to /home (or /onboarding if their profile is incomplete) once the session refreshes.
export default function RootPage() {
  return <LandingPage />;
}
