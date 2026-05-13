import Link from 'next/link';

export const metadata = {
  title: 'Pagina non trovata | COhA',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl font-bold text-indigo-600 mb-4">404</p>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Pagina non trovata</h1>
      <p className="text-gray-500 mb-8">La pagina che cerchi non esiste o è stata spostata.</p>
      <Link
        href="/"
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
      >
        Torna alla home
      </Link>
    </div>
  );
}
