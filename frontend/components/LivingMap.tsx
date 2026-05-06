'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, CloseLg as X, ExternalLink, Bus } from '@/components/icons';
import { getCityData, LivingZone } from '@/lib/cityData';

interface Props {
  city: string;
}

export default function LivingMap({ city }: Props) {
  const data = getCityData(city);
  const [selectedZone, setSelectedZone] = useState<LivingZone | null>(null);

  if (!data) {
    return (
      <div className="rounded-2xl p-5" style={{ backgroundColor: '#1C2F43', border: '1px solid #2A3F54' }}>
        <h2 className="text-lg font-bold text-white mb-4">Dove vivere a {city}</h2>
        <p className="text-sm" style={{ color: '#8B8FA8' }}>Dati non ancora disponibili per questa citta</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-3">
        <h2 className="text-lg font-bold text-white mb-1">Dove vivere a {city}</h2>
        <p className="text-xs" style={{ color: '#8B8FA8' }}>
          Tocca una zona per vedere prezzi e dettagli
        </p>
      </div>

      {/* Legend */}
      <div className="mb-3 flex items-center gap-4">
        <LegendDot color="#22C55E" label="Economico" />
        <LegendDot color="#F59E0B" label="Medio" />
        <LegendDot color="#EF4444" label="Caro" />
      </div>

      {/* Map */}
      <div className="relative" style={{ zIndex: 0 }}>
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A3F54', height: '320px' }}>
          <LeafletMap
            data={data}
            onSelectZone={setSelectedZone}
          />
        </div>
      </div>

      {/* Zone detail bottom sheet */}
      {selectedZone && (
        <ZoneDetail zone={selectedZone} onClose={() => setSelectedZone(null)} />
      )}
    </div>
  );
}

// ---- Leaflet map loaded with next/dynamic (SSR disabled) ----

const LeafletMap = dynamic(() => import('./LeafletMapInner'), {
  ssr: false,
  loading: () => (
    <div
      className="h-full flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #162232, #1C2F43, #2A3F54)' }}
    >
      <div className="text-center">
        <MapPin size={32} color="#4A9EFF" className="mx-auto mb-2" />
        <p className="text-xs" style={{ color: '#8B8FA8' }}>Caricamento mappa...</p>
      </div>
    </div>
  ),
});

// ---- Sub-components ----

function ZoneDetail({ zone, onClose }: { zone: LivingZone; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 300);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{
        backgroundColor: visible && !closing ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        transition: 'background-color 250ms ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{
          backgroundColor: '#0D1117',
          maxHeight: '70vh',
          transform: visible && !closing ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2A3F54' }}>
          <div className="flex items-center gap-3">
            <div className="w-3 h-8 rounded-full" style={{ backgroundColor: zone.color }} />
            <div>
              <h3 className="text-base font-bold text-white">{zone.name}</h3>
              <p className="text-xs" style={{ color: '#8B8FA8' }}>{zone.description}</p>
            </div>
          </div>
          <button onClick={handleClose}>
            <X size={20} color="#8B8FA8" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4" style={{ maxHeight: 'calc(70vh - 80px)' }}>
          {/* Prices */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#1C2F43' }}>
            <h4 className="text-sm font-bold text-white mb-3">Prezzi affitto (stanza singola)</h4>
            <div className="grid grid-cols-3 gap-3">
              <PriceBox label="Minimo" value={`${zone.rentRange[0]}`} />
              <PriceBox label="Medio" value={`${zone.rentAvg}`} highlight />
              <PriceBox label="Massimo" value={`${zone.rentRange[1]}`} />
            </div>
          </div>

          {/* Transport */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#1C2F43' }}>
            <h4 className="text-sm font-bold text-white mb-2">Distanza e trasporti</h4>
            <p className="text-sm mb-2" style={{ color: '#D0D4DC' }}>{zone.timeToUni}</p>
            <div className="space-y-1.5">
              {zone.transport.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Bus size={14} color="#4A9EFF" />
                  <span className="text-xs" style={{ color: '#D0D4DC' }}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Traits */}
          <div className="flex flex-wrap gap-2">
            {zone.traits.map((trait) => (
              <span
                key={trait}
                className="px-3 py-1 rounded-full text-xs"
                style={{ backgroundColor: '#0D1117', color: '#D0D4DC', border: '1px solid #2A3F54' }}
              >
                {trait}
              </span>
            ))}
          </div>

          {/* CTA */}
          <a
            href={zone.immobiliareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold transition-colors"
            style={{ backgroundColor: '#4A9EFF', color: 'white' }}
          >
            <ExternalLink size={16} />
            Cerca alloggi su Immobiliare.it
          </a>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs" style={{ color: '#8B8FA8' }}>{label}</span>
    </div>
  );
}

function PriceBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center p-2 rounded-lg" style={{ backgroundColor: '#0D1117' }}>
      <p className="text-xs mb-0.5" style={{ color: '#8B8FA8' }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: highlight ? '#4A9EFF' : 'white' }}>{value}</p>
    </div>
  );
}
