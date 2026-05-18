'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Star, Globe, Heart, Info } from '@/components/icons';

export default function InfoPage() {
  const router = useRouter();

  const iconWrap = 'w-9 h-9 rounded-[22%] bg-[rgba(97,95,226,0.1)] flex items-center justify-center flex-shrink-0';

  return (
    <div className="min-h-screen bg-[#fbf8ff] pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-[rgba(172,176,206,0.3)] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[#615fe2]" aria-label="Indietro">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[#2c3149] font-bold text-lg">Info</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
          <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider mb-3">App</h4>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className={iconWrap}><Info size={20} color="#615fe2" /></div>
              <span className="text-sm text-[#2c3149]">Versione</span>
            </div>
            <span className="text-sm text-[#747995]">1.0.0</span>
          </div>
          <div className="ml-12 mr-2 h-px bg-[rgba(172,176,206,0.2)]" />
          <button className="w-full flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className={iconWrap}><Star size={20} color="#615fe2" /></div>
              <span className="text-sm text-[#2c3149]">Novità</span>
            </div>
            <ChevronRight size={16} color="#747995" />
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[rgba(172,176,206,0.3)]">
          <h4 className="text-xs font-semibold text-[#747995] uppercase tracking-wider mb-3">Social</h4>
          <a
            href="https://instagram.com/cohaapp"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between py-2"
          >
            <div className="flex items-center gap-3">
              <div className={iconWrap}><Globe size={20} color="#615fe2" /></div>
              <div>
                <span className="text-sm text-[#2c3149]">Instagram</span>
                <p className="text-xs text-[#747995]">@cohaapp</p>
              </div>
            </div>
            <ChevronRight size={16} color="#747995" />
          </a>
        </div>

      </div>

      <div className="flex items-center justify-center gap-1.5 mt-8 text-xs text-[#acb0ce]">
        <span>Made with</span>
        <Heart size={12} color="#EF4444" />
        <span>in Italy</span>
      </div>
    </div>
  );
}
