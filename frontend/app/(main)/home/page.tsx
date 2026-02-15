'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Opportunity {
  id: string;
  title: string;
  company: string;
  badge: string;
  description: string;
  matchScore: number;
  icon: React.ReactNode;
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#22C55E';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function CircularProgress({ score }: { score: number }) {
  const radius = 24;
  const stroke = 3.5;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
      <svg width={56} height={56} className="-rotate-90">
        <circle
          cx={28}
          cy={28}
          r={normalizedRadius}
          fill="transparent"
          stroke="#1E293B"
          strokeWidth={stroke}
        />
        <circle
          cx={28}
          cy={28}
          r={normalizedRadius}
          fill="transparent"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-bold"
        style={{ color }}
      >
        {score}%
      </span>
    </div>
  );
}

const opportunities: Opportunity[] = [
  {
    id: '1',
    title: 'Software Engineer Intern',
    company: 'TechNova Solutions',
    badge: 'FULL-TIME • REMOTE',
    description:
      'Siamo alla ricerca di uno studente appassionato di sviluppo web per unirsi al...',
    matchScore: 85,
    icon: (
      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: '2',
    title: 'Product Design Workshop',
    company: 'Creative Hub Milan',
    badge: 'WORKSHOP • HYBRID',
    description:
      'Unisciti a noi per una settimana intensiva di Design Thinking e prototyping applicato al...',
    matchScore: 62,
    icon: (
      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1a3.12 3.12 0 114.41-4.41l.67.67.67-.67a3.12 3.12 0 114.41 4.41l-5.06 5.1z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2" />
      </svg>
    ),
  },
  {
    id: '3',
    title: 'Data Analyst Junior',
    company: 'Fintech Alpha',
    badge: 'JUNIOR • IN-PERSON',
    description:
      "Analisi di dataset complessi per l'ottimizzazione dei processi di credito e...",
    matchScore: 35,
    icon: (
      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h4v11H3zM10 3h4v18h-4zM17 7h4v14h-4z" />
      </svg>
    ),
  },
  {
    id: '4',
    title: 'Master in AI Ethics',
    company: 'Politecnico di Milano',
    badge: 'EDUCATION • PART-TIME',
    description:
      'Un percorso formativo avanzato che esplora le implicazioni etiche dell\'intelligenza artificiale...',
    matchScore: 92,
    icon: (
      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const [tab, setTab] = useState<'per-te' | 'esplora'>('per-te');

  return (
    <div className="px-4 pt-2 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        {/* Filter button */}
        <button className="w-11 h-11 rounded-xl bg-[#161B22] flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M7 12h10M10 18h4" />
          </svg>
        </button>

        {/* Toggle pill */}
        <div className="flex bg-[#161B22] rounded-full p-1">
          <button
            onClick={() => setTab('per-te')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              tab === 'per-te'
                ? 'bg-primary text-white'
                : 'text-gray-500'
            }`}
          >
            Per te
          </button>
          <button
            onClick={() => setTab('esplora')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              tab === 'esplora'
                ? 'bg-primary text-white'
                : 'text-gray-500'
            }`}
          >
            Esplora
          </button>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-3">
          <Link href="/notifications" className="p-1">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </Link>
          <button className="p-1">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Opportunity Cards */}
      <div className="space-y-4">
        {opportunities.map((opp) => (
          <div
            key={opp.id}
            className="bg-[#161B22] rounded-2xl p-5"
          >
            {/* Top row: icon + title/company + score */}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-14 h-14 rounded-xl bg-[#1E293B] flex items-center justify-center flex-shrink-0">
                {opp.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-[17px] leading-tight">
                  {opp.title}
                </h3>
                <p className="text-primary text-sm font-medium mt-0.5">
                  {opp.company}
                </p>
              </div>
              <CircularProgress score={opp.matchScore} />
            </div>

            {/* Badge */}
            <div className="mb-3">
              <span className="inline-block bg-[#1E293B] text-gray-400 text-[11px] font-semibold tracking-wider px-3 py-1.5 rounded-lg">
                {opp.badge}
              </span>
            </div>

            {/* Description */}
            <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">
              {opp.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
