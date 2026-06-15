'use client';

import { parseDeadlineDate } from '@/lib/dateUtils';

export function getDaysLeft(deadline: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = parseDeadlineDate(deadline);
  if (!d) return Infinity;
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function deadlineUrgency(days: number): 'green' | 'yellow' | 'red' {
  return days <= 2 ? 'red' : days <= 14 ? 'yellow' : 'green';
}

export function OpenLabel({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
  return null;
}

export default function DeadlineLabel({ deadline, size = 'sm' }: { deadline: string; size?: 'sm' | 'xs' }) {
  const daysLeft = getDaysLeft(deadline);
  const urgency = deadlineUrgency(daysLeft);
  const parsed = parseDeadlineDate(deadline);
  const dateStr = parsed ? parsed.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : deadline;
  const colors = { green: { bg: '#f0fdf4', text: '#16a34a' }, yellow: { bg: '#fffbeb', text: '#d97706' }, red: { bg: '#fef2f2', text: '#dc2626' } };
  const { bg, text } = colors[urgency];
  const label = daysLeft <= 0 ? 'Scaduta' : daysLeft === 1 ? 'Scade domani' : dateStr;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}
      style={{ backgroundColor: bg, color: text }}>
      <svg className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
      {label}
    </span>
  );
}
