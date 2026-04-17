'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="it" className="dark">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', background: '#0a0e1a', color: '#fff' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Qualcosa è andato storto</h2>
          <button
            onClick={reset}
            style={{ padding: '10px 24px', borderRadius: '12px', background: '#4F46E5', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}
