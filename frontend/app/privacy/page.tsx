'use client';

import { useLanguage } from '@/lib/language';
import { LEGAL, type Section } from '@/lib/legal-content';

function renderSection(section: Section, i: number) {
  return (
    <section key={i} className="mb-8">
      <h2 className="text-xl font-semibold mb-3 text-gray-900">{section.heading}</h2>
      {section.blocks.map((block, j) =>
        block.kind === 'p' ? (
          <p key={j} className="text-sm leading-relaxed text-gray-700 mb-3">{block.text}</p>
        ) : (
          <ul key={j} className="list-disc pl-5 space-y-2 text-sm text-gray-700 mb-3">
            {block.items.map((item, k) => (
              <li key={k}>
                {item.label && <strong>{item.label}</strong>}
                {item.text}
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}

export default function PrivacyPage() {
  const { language } = useLanguage();
  const { title, lastUpdate, sections } = LEGAL[language].privacy;

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mb-10">{lastUpdate}</p>
        {sections.map(renderSection)}
      </div>
    </div>
  );
}
