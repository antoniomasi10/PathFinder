'use client';

import { motion } from 'framer-motion';

export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg, #0a0e1a 0%, #151a2e 100%)' }}>
      {/* Blob 1 — indigo */}
      <motion.div
        className="absolute w-[420px] h-[420px] rounded-full opacity-30 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', top: '-10%', left: '-10%' }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Blob 2 — violet */}
      <motion.div
        className="absolute w-[380px] h-[380px] rounded-full opacity-25 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)', bottom: '-10%', right: '-10%' }}
        animate={{ x: [0, -50, 0], y: [0, -60, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
