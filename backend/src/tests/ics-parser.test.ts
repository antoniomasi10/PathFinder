import { describe, it, expect } from 'vitest';
import { parseIcs } from '../services/import/discovery/ics-parser';

describe('parseIcs', () => {
  it('parses a single VEVENT block', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:ESN Winter Trip',
      'DTSTART:20260110T090000Z',
      'DTEND:20260112T180000Z',
      'LOCATION:Torino',
      'DESCRIPTION:A weekend trip organized by ESN.',
      'URL:https://esn.example.org/winter-trip',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      summary: 'ESN Winter Trip',
      dtstart: '20260110T090000Z',
      dtend: '20260112T180000Z',
      location: 'Torino',
      description: 'A weekend trip organized by ESN.',
      url: 'https://esn.example.org/winter-trip',
    });
  });

  it('parses multiple VEVENT blocks', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT', 'SUMMARY:Event A', 'DTSTART:20260101T000000Z', 'END:VEVENT',
      'BEGIN:VEVENT', 'SUMMARY:Event B', 'DTSTART:20260201T000000Z', 'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    const events = parseIcs(ics);
    expect(events.map(e => e.summary)).toEqual(['Event A', 'Event B']);
  });

  it('un-folds RFC 5545 line continuations', () => {
    const ics = [
      'BEGIN:VEVENT',
      'SUMMARY:A very long summary that',
      ' continues on the next line',
      'DTSTART:20260101T000000Z',
      'END:VEVENT',
    ].join('\r\n');

    const events = parseIcs(ics);
    expect(events[0].summary).toBe('A very long summary thatcontinues on the next line');
  });

  it('unescapes commas, semicolons, backslashes, and newlines in text fields', () => {
    const ics = [
      'BEGIN:VEVENT',
      'SUMMARY:Hackathon\\, Milano\\; Italy',
      'DESCRIPTION:Line one\\nLine two',
      'END:VEVENT',
    ].join('\r\n');

    const events = parseIcs(ics);
    expect(events[0].summary).toBe('Hackathon, Milano; Italy');
    expect(events[0].description).toBe('Line one\nLine two');
  });

  it('skips a VEVENT block with no SUMMARY', () => {
    const ics = ['BEGIN:VEVENT', 'DTSTART:20260101T000000Z', 'END:VEVENT'].join('\r\n');
    expect(parseIcs(ics)).toHaveLength(0);
  });

  it('returns an empty array for text with no VEVENT blocks', () => {
    expect(parseIcs('BEGIN:VCALENDAR\nEND:VCALENDAR')).toEqual([]);
  });
});
