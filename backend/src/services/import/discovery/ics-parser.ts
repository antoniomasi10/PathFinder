/**
 * Minimal ICS (RFC 5545) VEVENT parser — 0 LLM, no external dependency.
 *
 * Same principle already used for RSS (utils.ts::parseRSSFeed): the format is
 * simple enough (line-based KEY[;PARAM]:value) that a hand-rolled parser beats
 * pulling in a library for the handful of fields we map.
 */

export interface IcsEvent {
  summary: string;
  dtstart?: string;
  dtend?: string;
  location?: string;
  description?: string;
  url?: string;
}

/** Un-folds RFC 5545 line continuations (a line starting with space/tab extends the previous one). */
function unfoldLines(text: string): string[] {
  const rawLines = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Splits "KEY;PARAM=X:value" into { key: "KEY", value: "value" }. */
function parseLine(line: string): { key: string; value: string } | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;
  const rawKey = line.slice(0, colonIdx);
  const key = rawKey.split(';')[0].toUpperCase();
  const value = line.slice(colonIdx + 1).trim();
  return { key, value };
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Parses every VEVENT block in an ICS calendar. Malformed blocks are skipped, not fatal. */
export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  const lines = unfoldLines(text);

  let inEvent = false;
  let current: Partial<IcsEvent> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      if (inEvent && current.summary) events.push(current as IcsEvent);
      inEvent = false;
      current = {};
      continue;
    }
    if (!inEvent) continue;

    const parsed = parseLine(line);
    if (!parsed) continue;

    switch (parsed.key) {
      case 'SUMMARY': current.summary = unescapeIcsText(parsed.value); break;
      case 'DTSTART': current.dtstart = parsed.value; break;
      case 'DTEND': current.dtend = parsed.value; break;
      case 'LOCATION': current.location = unescapeIcsText(parsed.value); break;
      case 'DESCRIPTION': current.description = unescapeIcsText(parsed.value); break;
      case 'URL': current.url = parsed.value; break;
      default: break;
    }
  }

  return events;
}
