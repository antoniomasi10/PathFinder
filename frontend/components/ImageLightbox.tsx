'use client';

import { useState, useEffect, useCallback } from 'react';
import { isValidImageUrl } from '@/lib/urlValidation';
import { CloseLg, ChevronLeft, ChevronRight } from '@/components/icons';

interface ImageLightboxProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

export default function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps) {
  const [current, setCurrent] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const prev = useCallback(() => setCurrent((c) => (c > 0 ? c - 1 : c)), []);
  const next = useCallback(() => setCurrent((c) => (c < images.length - 1 ? c + 1 : c)), [images.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
      >
        <CloseLg size={24} strokeWidth={2} />
      </button>

      {/* Previous arrow */}
      {current > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-3 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
      )}

      {/* Next arrow */}
      {current < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-3 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ChevronRight size={24} strokeWidth={2} />
        </button>
      )}

      {/* Image */}
      {isValidImageUrl(images[current]) ? (
      <img
        src={images[current]}
        alt=""
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStart === null) return;
          const diff = e.changedTouches[0].clientX - touchStart;
          if (diff > 50) prev();
          if (diff < -50) next();
          setTouchStart(null);
        }}
      />
      ) : (
        <div
          className="max-w-[90vw] max-h-[85vh] flex items-center justify-center text-white/50 text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          Immagine non disponibile
        </div>
      )}

      {/* Dots indicator */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
