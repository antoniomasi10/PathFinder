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
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: '#0a0e1a', color: '#fff' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Qualcosa è andato storto</h2>
          <button
            onClick={reset}
            style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', background: '#4F46E5', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}
