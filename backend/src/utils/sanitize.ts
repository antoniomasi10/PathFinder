import sanitizeHtml from 'sanitize-html';

/**
 * Strip ALL HTML tags from user input. Returns plain text only.
 */
export function sanitizeText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}
