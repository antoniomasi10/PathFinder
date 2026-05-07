'use client';

export default function CourseDetailPage() {
  return (
    <>
      <style>{`
        @keyframes aurora {
          0%   { background-position: 20% 80%; }
          25%  { background-position: 80% 20%; }
          50%  { background-position: 60% 90%; }
          75%  { background-position: 10% 40%; }
          100% { background-position: 20% 80%; }
        }
        @keyframes floatA {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          35%       { transform: translate(22px, -28px) scale(1.08); }
          70%       { transform: translate(-14px, 16px) scale(0.94); }
        }
        @keyframes floatB {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          40%       { transform: translate(-20px, 24px) scale(1.12); }
          75%       { transform: translate(18px, -10px) scale(0.92); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%       { opacity: 0.70; transform: scale(1.06); }
        }
        @keyframes ringPulse {
          0%   { transform: scale(0.92); opacity: 0.2; }
          50%  { transform: scale(1.08); opacity: 0.06; }
          100% { transform: scale(0.92); opacity: 0.2; }
        }
        .course-fadeup-1 { animation: fadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
        .course-fadeup-2 { animation: fadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.32s both; }
        .course-fadeup-3 { animation: fadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.48s both; }
      `}</style>

      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg, #0a0a12 0%, #0d0d1a 40%, #0a0a12 100%)',
        backgroundSize: '200% 200%',
        animation: 'aurora 14s ease infinite',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Glow blobs */}
        <div style={{
          position: 'absolute', top: '18%', left: '50%',
          transform: 'translateX(-50%)',
          width: 320, height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.28) 0%, transparent 70%)',
          animation: 'glowPulse 5s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '12%', left: '20%',
          width: 200, height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
          animation: 'floatA 9s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', right: '15%',
          width: 180, height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)',
          animation: 'floatB 11s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* Ring */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 420, height: 420,
          borderRadius: '50%',
          border: '1px solid rgba(79,70,229,0.12)',
          animation: 'ringPulse 6s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{ textAlign: 'center', padding: '0 32px', position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <div className="course-fadeup-1" style={{ marginBottom: 20 }}>
            <span style={{
              display: 'inline-block',
              background: 'rgba(79,70,229,0.18)',
              border: '1px solid rgba(79,70,229,0.35)',
              borderRadius: 100,
              color: 'rgba(167,154,255,0.9)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '5px 16px',
            }}>
              Prossimamente
            </span>
          </div>

          {/* Title */}
          <h1 className="course-fadeup-2" style={{
            fontSize: 26,
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.25,
            marginBottom: 14,
            letterSpacing: '-0.02em',
          }}>
            Dettaglio corso<br />in arrivo
          </h1>

          {/* Subtitle */}
          <p className="course-fadeup-3" style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.7,
            maxWidth: 270,
            margin: '0 auto',
          }}>
            Stiamo costruendo qualcosa di speciale per te. Resta connesso per scoprire tutto quello che abbiamo in serbo.
          </p>
        </div>
      </div>
    </>
  );
}
