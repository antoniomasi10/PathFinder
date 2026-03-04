'use client';

import Link from 'next/link';
import { MOCK_COURSES } from '@/lib/mockCourses';

function CircularProgress({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const size = 54;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2A3F54"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="white"
          fontSize="14"
          fontWeight="bold"
        >
          {value}%
        </text>
      </svg>
      <span style={{ fontSize: '11px', color: '#8B8FA8' }}>{label}</span>
    </div>
  );
}

export default function UniversitiesPage() {
  return (
    <div className="px-4 py-4 pb-24">
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
        PathFinder
      </h1>
      <p style={{ fontSize: '16px', color: '#8B8FA8', marginBottom: '16px' }}>
        Scopri i corsi consigliati
      </p>
      <div style={{ height: '1px', backgroundColor: '#2A3F54', marginBottom: '20px' }} />

      <div className="space-y-4">
        {MOCK_COURSES.map((course) => (
          <Link
            key={course.id}
            href={`/universities/course/${course.id}`}
            className="block cursor-pointer"
          >
            <div
              style={{
                backgroundColor: '#1C2F43',
                borderRadius: '16px',
                padding: '20px',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              className="hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 active:scale-[0.98]"
            >
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>
                {course.title}
              </h2>
              <p style={{ fontSize: '14px', color: '#8B8FA8', marginBottom: '10px' }}>
                {course.university}
              </p>
              <p style={{ fontSize: '14px', color: '#D0D4DC', marginBottom: '16px', lineHeight: '1.5' }}>
                {course.description}
              </p>
              <div style={{ height: '1px', backgroundColor: '#2A3F54', marginBottom: '16px' }} />
              <div className="flex justify-between">
                {course.stats.map((stat) => (
                  <CircularProgress
                    key={stat.label}
                    value={stat.value}
                    label={stat.label}
                    color={stat.color}
                  />
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-center mt-6 px-2" style={{ fontSize: '11px', color: '#8B8FA8', lineHeight: '1.5' }}>
        Dati da siti ufficiali delle università e AlmaLaurea. Aggiornati a Marzo 2026.
      </p>
    </div>
  );
}
