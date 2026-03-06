'use client';

import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polygon, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CityLivingData, LivingZone } from '@/lib/cityData';

// Fix default marker icon (Leaflet + webpack issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  data: CityLivingData;
  onSelectZone: (zone: LivingZone) => void;
}

export default function LeafletMapInner({ data, onSelectZone }: Props) {
  return (
    <>
      <MapContainer
        center={data.campus}
        zoom={13}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {/* Campus marker */}
        <Marker position={data.campus}>
          <Popup>
            <div style={{ color: '#000', fontSize: '12px' }}>
              <strong>{data.campusName}</strong>
            </div>
          </Popup>
        </Marker>

        {/* Zone polygons */}
        {data.zones.map((zone) => (
          <Polygon
            key={zone.id}
            positions={zone.polygon}
            pathOptions={{
              color: zone.color,
              fillColor: zone.color,
              fillOpacity: 0.25,
              weight: 2,
            }}
            eventHandlers={{ click: () => onSelectZone(zone) }}
          >
            <Tooltip permanent direction="center" className="zone-label">
              <span style={{ fontSize: '10px', fontWeight: 'bold' }}>
                {zone.name}<br />{zone.rentAvg}
              </span>
            </Tooltip>
          </Polygon>
        ))}
      </MapContainer>

      {/* Dark theme overrides */}
      <style>{`
        .leaflet-container { background: #0D1117 !important; z-index: 0 !important; }
        .leaflet-pane { z-index: 0 !important; }
        .zone-label { background: transparent !important; border: none !important; box-shadow: none !important; color: white !important; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
        .zone-label::before { display: none !important; }
        .leaflet-popup-content-wrapper { background: #1C2F43 !important; color: white !important; border-radius: 12px !important; }
        .leaflet-popup-tip { background: #1C2F43 !important; }
        .leaflet-popup-content { margin: 8px 12px !important; }
        .leaflet-popup-content strong { color: white !important; }
      `}</style>
    </>
  );
}
