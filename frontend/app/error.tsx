'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4">
      <h2 className="text-xl font-semibold text-text-primary">Qualcosa è andato storto</h2>
      <button
        onClick={reset}
        className="btn-primary px-6 py-2"
      >
        Riprova
      </button>
    </div>
  );
}
