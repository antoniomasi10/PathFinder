import { describe, it, expect } from 'vitest';
import { isAllowedByRobots } from '../services/import/compliance';

describe('isAllowedByRobots', () => {
  it('blocks a wildcard Disallow pattern (regression: EURAXESS /jobs/*)', () => {
    const robots = 'User-agent: *\nDisallow: /jobs/*\n';
    expect(isAllowedByRobots(robots, '/jobs/search')).toBe(false);
    expect(isAllowedByRobots(robots, '/jobs/')).toBe(false);
  });

  it('allows paths outside a wildcard Disallow pattern', () => {
    const robots = 'User-agent: *\nDisallow: /jobs/*\n';
    expect(isAllowedByRobots(robots, '/about')).toBe(true);
  });

  it('still blocks a bare "/" Disallow (block everything)', () => {
    const robots = 'User-agent: *\nDisallow: /\n';
    expect(isAllowedByRobots(robots, '/anything')).toBe(false);
  });

  it('respects a trailing $ end-anchor', () => {
    const robots = 'User-agent: *\nDisallow: /page.pdf$\n';
    expect(isAllowedByRobots(robots, '/page.pdf')).toBe(false);
    expect(isAllowedByRobots(robots, '/page.pdf.html')).toBe(true);
  });

  it('allows everything when no matching block disallows the path', () => {
    const robots = 'User-agent: *\nDisallow: /admin/\n';
    expect(isAllowedByRobots(robots, '/careers')).toBe(true);
  });

  it('an Allow rule can carve out an exception within a Disallow', () => {
    const robots = 'User-agent: *\nAllow: /jobs/public/*\nDisallow: /jobs/*\n';
    expect(isAllowedByRobots(robots, '/jobs/public/123')).toBe(true);
  });

  it('a more specific later Disallow overrides an earlier broad Allow (regression: euraxess.ec.europa.eu)', () => {
    // Real-world pattern: "Allow: /jobs" (broad) followed later by
    // "Disallow: /jobs/*" (narrower, listed after) — the narrower rule wins
    // per RFC 9309 longest-match, regardless of file order.
    const robots = 'User-agent: *\nAllow: /jobs\nDisallow: /jobs/*\n';
    expect(isAllowedByRobots(robots, '/jobs/search')).toBe(false);
    expect(isAllowedByRobots(robots, '/jobs')).toBe(true);
  });

  it('a blank line inside one User-agent block is spacing, not a group boundary (regression: euraxess.ec.europa.eu)', () => {
    // Real robots.txt files commonly use blank lines to separate rule
    // categories within a single group. Rules after the first blank line
    // must still apply.
    const robots = [
      'User-agent: *',
      'Allow: /core/*.css$',
      '',
      '# Directories',
      'Disallow: /admin/',
      '',
      '# API',
      'Disallow: /jobs/*',
    ].join('\n');
    expect(isAllowedByRobots(robots, '/admin/')).toBe(false);
    expect(isAllowedByRobots(robots, '/jobs/search')).toBe(false);
    expect(isAllowedByRobots(robots, '/careers')).toBe(true);
  });

  it('a comment on its own line inside a block does not break parsing', () => {
    const robots = 'User-agent: *\n# comment\nDisallow: /admin/\n';
    expect(isAllowedByRobots(robots, '/admin/')).toBe(false);
    expect(isAllowedByRobots(robots, '/careers')).toBe(true);
  });
});
