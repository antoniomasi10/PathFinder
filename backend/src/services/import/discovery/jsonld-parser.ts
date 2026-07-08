/**
 * JSON-LD schema.org/Event extraction — 0 LLM.
 *
 * Same principle already validated for devfolio.import.ts's __NEXT_DATA__ parsing:
 * regex to find embedded <script> blocks, JSON.parse each, no external library.
 */

export interface JsonLdEvent {
  name: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  url?: string;
  locationName?: string;
  organizerName?: string;
  offerPrice?: number;
}

function isEventType(type: unknown): boolean {
  if (typeof type === 'string') return /event/i.test(type);
  if (Array.isArray(type)) return type.some(t => typeof t === 'string' && /event/i.test(t));
  return false;
}

function extractLocationName(location: any): string | undefined {
  if (!location) return undefined;
  if (typeof location === 'string') return location;
  if (typeof location.name === 'string') return location.name;
  if (typeof location.address === 'string') return location.address;
  if (location.address && typeof location.address.addressLocality === 'string') {
    return location.address.addressLocality;
  }
  return undefined;
}

function extractOrganizerName(organizer: any): string | undefined {
  if (!organizer) return undefined;
  if (typeof organizer === 'string') return organizer;
  if (typeof organizer.name === 'string') return organizer.name;
  return undefined;
}

function extractOfferPrice(offers: any): number | undefined {
  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!offer) return undefined;
  const price = typeof offer.price === 'string' ? parseFloat(offer.price) : offer.price;
  return typeof price === 'number' && !isNaN(price) ? price : undefined;
}

function toEvent(node: any): JsonLdEvent | null {
  if (!node || typeof node !== 'object' || !isEventType(node['@type']) || typeof node.name !== 'string') {
    return null;
  }
  return {
    name: node.name,
    startDate: typeof node.startDate === 'string' ? node.startDate : undefined,
    endDate: typeof node.endDate === 'string' ? node.endDate : undefined,
    description: typeof node.description === 'string' ? node.description : undefined,
    url: typeof node.url === 'string' ? node.url : undefined,
    locationName: extractLocationName(node.location),
    organizerName: extractOrganizerName(node.organizer),
    offerPrice: extractOfferPrice(node.offers),
  };
}

/** Flattens a parsed JSON-LD blob (single node, array, or {@graph:[...]}) into a node list. */
function flattenNodes(parsed: any): any[] {
  if (Array.isArray(parsed)) return parsed.flatMap(flattenNodes);
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed['@graph'])) return parsed['@graph'].flatMap(flattenNodes);
    return [parsed];
  }
  return [];
}

/**
 * Scans HTML for <script type="application/ld+json"> blocks and returns every
 * schema.org Event (or subtype, e.g. EducationEvent) found. Malformed JSON
 * blocks are skipped, not fatal.
 */
export function extractJsonLdEvents(html: string): JsonLdEvent[] {
  const events: JsonLdEvent[] = [];
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const block of blocks) {
    let parsed: any;
    try {
      parsed = JSON.parse(block[1]);
    } catch {
      continue;
    }
    for (const node of flattenNodes(parsed)) {
      const event = toEvent(node);
      if (event) events.push(event);
    }
  }

  return events;
}
