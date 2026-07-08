import { describe, it, expect } from 'vitest';
import { extractJsonLdEvents } from '../services/import/discovery/jsonld-parser';

describe('extractJsonLdEvents', () => {
  it('extracts a single Event node', () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Event","name":"AI Summer School",
       "startDate":"2026-09-01","endDate":"2026-09-05","description":"A summer school on AI.",
       "url":"https://example.org/ai-summer-school",
       "location":{"@type":"Place","name":"Politecnico di Milano"},
       "organizer":{"@type":"Organization","name":"ESN Milano"},
       "offers":{"@type":"Offer","price":"150"}}
    </script></head><body></body></html>`;

    const events = extractJsonLdEvents(html);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: 'AI Summer School',
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      locationName: 'Politecnico di Milano',
      organizerName: 'ESN Milano',
      offerPrice: 150,
    });
  });

  it('flattens events nested in @graph', () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebPage","name":"Homepage"},
        {"@type":"Event","name":"Hackathon Roma"},
        {"@type":"Event","name":"Career Day"}
      ]}
    </script>`;

    const events = extractJsonLdEvents(html);
    expect(events.map(e => e.name)).toEqual(['Hackathon Roma', 'Career Day']);
  });

  it('accepts Event subtypes (e.g. EducationEvent) via @type array', () => {
    const html = `<script type="application/ld+json">
      {"@type":["EducationEvent"],"name":"Open Day"}
    </script>`;
    expect(extractJsonLdEvents(html)).toHaveLength(1);
  });

  it('ignores non-Event nodes', () => {
    const html = `<script type="application/ld+json">
      {"@type":"Organization","name":"Not an event"}
    </script>`;
    expect(extractJsonLdEvents(html)).toHaveLength(0);
  });

  it('skips malformed JSON blocks without throwing', () => {
    const html = `<script type="application/ld+json">{not valid json</script>
      <script type="application/ld+json">{"@type":"Event","name":"Valid Event"}</script>`;
    const events = extractJsonLdEvents(html);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('Valid Event');
  });

  it('returns an empty array when there are no ld+json script tags', () => {
    expect(extractJsonLdEvents('<html><body>no data</body></html>')).toEqual([]);
  });
});
