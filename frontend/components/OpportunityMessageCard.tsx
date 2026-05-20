'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getOpportunityTypeColor } from '@/lib/opportunityColors';

interface OpportunityPreview {
  id: string;
  title: string;
  company: string;
  type: string;
  location: string;
  matchScore: number;
}

interface Props {
  opportunityId: string;
  isMine: boolean;
}

export default function OpportunityMessageCard({ opportunityId }: Props) {
  const router = useRouter();
  const [opp, setOpp] = useState<OpportunityPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/opportunities/${opportunityId}`)
      .then(({ data }) => {
        setOpp({
          id: data.id,
          title: data.titleIt || data.title,
          company: data.company || data.organizer || '',
          type: data.type || '',
          location: data.location || data.city || '',
          matchScore: data.matchScore || 0,
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [opportunityId]);

  if (loading) {
    return (
      <div
        className="animate-pulse flex flex-col gap-3 p-[17px] rounded-[24px]"
        style={{ width: 280, backgroundColor: 'white', border: '1px solid #ecedff', boxShadow: '0px 2px 4px rgba(0,0,0,0.02)' }}
      >
        <div className="flex items-center gap-3">
          <div style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#e4e7ff', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 14, backgroundColor: '#e4e7ff', borderRadius: 6, width: '80%', marginBottom: 6 }} />
            <div style={{ height: 11, backgroundColor: '#e4e7ff', borderRadius: 6, width: '55%' }} />
          </div>
        </div>
        <div className="flex items-center justify-between pt-[5px]" style={{ borderTop: '1px solid #f3f2ff' }}>
          <div style={{ height: 28, width: 48, backgroundColor: '#e4e7ff', borderRadius: 8 }} />
          <div style={{ height: 22, width: 64, backgroundColor: '#e4e7ff', borderRadius: 99 }} />
        </div>
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div
        className="flex flex-col gap-3 p-[17px] rounded-[24px]"
        style={{ width: 280, backgroundColor: 'white', border: '1px solid #ecedff', opacity: 0.6, fontFamily: 'var(--font-plus-jakarta)' }}
      >
        <div className="flex items-center gap-3">
          <div style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#f0f0f6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20, color: '#acb0ce' }}>?</span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#acb0ce', margin: 0 }}>Opportunità non disponibile</p>
            <p style={{ fontSize: 12, color: '#c8cae0', margin: '2px 0 0' }}>Il link potrebbe essere scaduto</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => router.push(`/opportunities/${opp.id}`)}
      className="text-left active:opacity-75 transition-opacity"
      style={{ display: 'block', width: 280 }}
    >
      <div
        className="flex flex-col gap-3 p-[17px] rounded-[24px]"
        style={{ backgroundColor: 'white', border: '1px solid #ecedff', boxShadow: '0px 2px 4px rgba(0,0,0,0.02)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 flex items-center justify-center overflow-hidden"
            style={{ width: 48, height: 48, backgroundColor: '#e4e7ff', border: '1px solid #ecedff', borderRadius: 16 }}
          >
            <span className="text-[16px] font-bold" style={{ color: '#4a4bd7' }}>
              {opp.company.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[16px] leading-[24px] truncate" style={{ color: '#2c3149', fontFamily: 'var(--font-plus-jakarta)' }}>
              {opp.title}
            </p>
            <p className="text-[13px] leading-[24px] truncate" style={{ color: '#595e78', fontFamily: 'var(--font-plus-jakarta)' }}>
              {opp.company}{opp.location ? ` • ${opp.location}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-[5px]" style={{ borderTop: '1px solid #f3f2ff' }}>
          <div>
            <p className="text-[11px] font-medium" style={{ color: '#595e78', fontFamily: 'var(--font-plus-jakarta)' }}>Affinità</p>
            <p className="text-[16px] font-bold leading-[28px]" style={{ color: '#4a4bd7', fontFamily: 'var(--font-plus-jakarta)' }}>{opp.matchScore}%</p>
          </div>
          <div
            className="rounded-full px-[10px] py-[4px]"
            style={{ backgroundColor: getOpportunityTypeColor(opp.type) }}
          >
            <span className="text-[13px] font-medium" style={{ color: '#4f5160', fontFamily: 'var(--font-plus-jakarta)' }}>
              {opp.type}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
