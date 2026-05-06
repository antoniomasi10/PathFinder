const TYPE_COLORS: Record<string, string> = {
  internship:      '#bcbcff',
  summership:      '#c2e8ff',
  'summer program':'#ebe0f4',
  'summer school': '#ebe0f4',
  event:           '#f1f4e0',
  hackathon:       '#e0f4e1',
  stage:           '#f4e0e8',
  extracurricular: '#f4e8e0',
  fellowship:      '#f4e0f1',
  competition:     '#f4e0e0',
  exchange:        '#e0f4f0',
  erasmus:         '#e0f4f0',
  volunteering:    '#ffe6d2',
  conference:      '#ffd9fc',
  bootcamp:        '#ffcaca',
  research:        '#babeff',
  scholarship:     '#babeff',
  project:         '#e0f4e1',
  corso:           '#ffd9fc',
};

const DEFAULT_COLOR = '#e1e1f2';

export function getOpportunityTypeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase().trim()] ?? DEFAULT_COLOR;
}
