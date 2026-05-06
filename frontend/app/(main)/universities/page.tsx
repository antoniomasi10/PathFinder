'use client';

export default function UniversitiesPage() {
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
        @keyframes floatC {
          0%, 100% { transform: translate(0px, 0px); }
          50%       { transform: translate(-10px, -20px); }
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
        @keyframes logoBreath {
          0%, 100% { opacity: 0.52; }
          50%       { opacity: 0.75; }
        }
        .uni-fadeup-1 { animation: fadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
        .uni-fadeup-2 { animation: fadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.32s both; }
        .uni-fadeup-3 { animation: fadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.48s both; }
      `}</style>

      <div
        style={{
          minHeight: 'calc(100dvh - 64px)',
          position: 'relative',
          overflow: 'hidden',
          background: '#fbf8ff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 28px',
        }}
      >
        {/* ── Layer 2: h mark full-screen watermark ─────────────────── */}
        <svg
          aria-hidden
          width="390"
          height="700"
          viewBox="0 0 390 700"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            height: '100%',
            mixBlendMode: 'screen' as const,
            animation: 'logoBreath 6s ease-in-out infinite',
            zIndex: 2,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <path fillRule="evenodd" clipRule="evenodd" d="M-394 327.67C-378.712 361.342 -372.715 371.03 -352.534 393.33C-352.534 393.33 -331.687 411.85 -302.501 432.053C-273.315 452.256 -266.365 455.624 -235.789 465.725C-205.213 475.827 -192.705 479.194 -166.299 480.878C-166.299 480.878 -135.723 484.245 -94.028 482.561C-52.3334 480.878 -25.8512 474.221 14.3779 460.675C54.607 447.128 63.6704 443.638 88.0383 430.37C112.406 417.101 124.451 407.06 142.241 383.229L125.563 292.314C118.241 241.11 118.164 211.881 121.394 159.31C131.212 104.785 142.479 75.1256 178.377 24.622C215.902 -15.7844 258.986 -7.3664 275.664 56.6103C286.782 122.271 285.1 155.354 256.206 223.287C224.915 291.194 203.636 327.306 158.919 388.28C166.654 430.927 174.216 454.713 186.715 492.663C189.866 476.95 191.813 469.523 206.173 458.991C223.493 451.994 232.693 448.678 253.427 450.573C281.223 457.307 299.506 467.249 325.697 482.561C368.077 512.192 392.769 526.08 438.273 546.538C471.013 560.873 489.599 563.683 523.052 561.691C558.714 561.264 580.437 555.065 612 531.386V647.554C609.476 665.938 606.063 675.932 595.322 693.012C580.842 712.331 570.406 719.654 546.679 725H525.831C525.831 725 458.494 673.207 420.205 632.402L339.596 553.273C304.39 519.853 287.66 503.44 247.867 479.194C232.791 471.686 215.902 464.042 204.783 472.46C193.664 485.929 191.747 492.535 192.275 511.183C208.568 567.557 221.203 594.21 247.867 645.871C265.936 679.955 282.362 699.025 310.409 725H261.766H213.122C197.205 680.368 188.727 652.354 178.377 603.781L145.021 400.065C115.533 430.56 95.6165 447.898 60.2419 474.143C18.8789 502.329 -5.6539 516.481 -52.3334 538.12C-97.0493 559.928 -124.452 568.044 -174.637 580.21C-225.873 593.69 -253.184 595.976 -299.721 591.995C-341.925 585.733 -359.325 575.019 -394 546.538V437.104V327.67ZM136.682 223.287C134.839 280.9 138.323 312.994 154.75 369.76C187.778 327.419 203.405 301.222 224.241 248.541C241.867 209.596 245.088 189.615 242.308 147.525C232.579 108.802 221.101 95.9066 178.377 115.536C152.556 133.434 142.173 153.846 136.682 223.287Z" fill="white" fillOpacity="0.8"/>
        </svg>

        {/* ── Layer 2: aurora gradient overlay (semi-transparent) ───── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            opacity: 0.82,
            background:
              'linear-gradient(135deg, #fbf8ff 0%, #edeaff 16%, #d4d0ff 32%, #b0acf5 50%, #8884eb 65%, #7370e5 82%, #615fe2 100%)',
            backgroundSize: '350% 350%',
            animation: 'aurora 14s ease infinite',
            pointerEvents: 'none',
          }}
        />

        {/* ── Layer 3: orbs ─────────────────────────────────────────── */}
        <div style={{ position: 'absolute', top: '30%', left: '-10%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,177,255,0.5) 0%, transparent 65%)', filter: 'blur(24px)', animation: 'floatA 10s ease-in-out infinite', zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '18%', right: '-8%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(150,145,240,0.45) 0%, transparent 65%)', filter: 'blur(20px)', animation: 'floatB 13s ease-in-out infinite', zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '10%', right: '15%', width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,196,255,0.35) 0%, transparent 70%)', filter: 'blur(16px)', animation: 'floatC 9s ease-in-out infinite', zIndex: 2, pointerEvents: 'none' }} />

        {/* ── Layer 4: rings + glow ──────────────────────────────────── */}
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)', animation: 'ringPulse 4s ease-in-out infinite', zIndex: 3, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.08)', animation: 'ringPulse 4s ease-in-out 1.3s infinite', zIndex: 3, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)', animation: 'glowPulse 5s ease-in-out infinite', zIndex: 3, pointerEvents: 'none' }} />

        {/* ── Layer 5: content ──────────────────────────────────────── */}
        <div style={{ position: 'relative', zIndex: 4, textAlign: 'center' }}>

          {/* Pill */}
          <div className="uni-fadeup-1" style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.9)',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.28)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: 999,
              padding: '5px 16px',
            }}>
              Prossimamente
            </span>
          </div>

          {/* Title */}
          <h1 className="uni-fadeup-2" style={{
            fontSize: 26,
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.25,
            marginBottom: 14,
            letterSpacing: '-0.02em',
          }}>
            Nuove funzionalità<br />in arrivo
          </h1>

          {/* Subtitle */}
          <p className="uni-fadeup-3" style={{
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
