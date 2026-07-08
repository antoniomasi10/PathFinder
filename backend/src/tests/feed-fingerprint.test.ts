import { describe, it, expect } from 'vitest';
import { fingerprintFeed } from '../services/import/discovery/feed-fingerprint';

const PAGE_URL = 'https://esnmilano.it/events';

describe('fingerprintFeed', () => {
  it('detects jsonld when a schema.org Event is embedded', () => {
    const html = `<html><head><script type="application/ld+json">
      {"@type":"Event","name":"Welcome Week"}
    </script></head><body></body></html>`;
    expect(fingerprintFeed(html, PAGE_URL)).toEqual({ kind: 'jsonld' });
  });

  it('detects ics from a text/calendar link tag and resolves a relative href', () => {
    const html = `<html><head><link rel="alternate" type="text/calendar" href="/events.ics"></head></html>`;
    expect(fingerprintFeed(html, PAGE_URL)).toEqual({
      kind: 'ics',
      feedUrl: 'https://esnmilano.it/events.ics',
    });
  });

  it('detects rss from an application/rss+xml link tag', () => {
    const html = `<html><head><link rel="alternate" type="application/rss+xml" href="https://esnmilano.it/feed"></head></html>`;
    expect(fingerprintFeed(html, PAGE_URL)).toEqual({
      kind: 'rss',
      feedUrl: 'https://esnmilano.it/feed',
    });
  });

  it('detects atom feeds via application/atom+xml', () => {
    const html = `<link rel="alternate" type="application/atom+xml" href="/feed.atom">`;
    expect(fingerprintFeed(html, PAGE_URL).kind).toBe('rss');
  });

  it('falls back to html-static when static markup has event/job-like signals', () => {
    const html = '<html><body><h1>Upcoming events</h1><p>Apply now for our next hackathon and workshop.</p></body></html>';
    expect(fingerprintFeed(html, PAGE_URL)).toEqual({ kind: 'html-static' });
  });

  it('falls back to html-js for a near-empty SPA shell', () => {
    const html = '<html><body><div id="root"></div></body></html>';
    expect(fingerprintFeed(html, PAGE_URL)).toEqual({ kind: 'html-js' });
  });

  it('prefers jsonld over an also-present rss link', () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="/feed">
      <script type="application/ld+json">{"@type":"Event","name":"X"}</script>`;
    expect(fingerprintFeed(html, PAGE_URL).kind).toBe('jsonld');
  });
});
