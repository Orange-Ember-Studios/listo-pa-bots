import { describe, it, expect } from 'vitest';
import { parseRobots, evaluateAgent } from '../scanner/checks/robots.js';

describe('parseRobots', () => {
  it('groups rules by user-agent', () => {
    const txt = `
User-agent: GPTBot
Disallow: /admin
Allow: /

User-agent: *
Disallow: /private
    `;
    const groups = parseRobots(txt);
    expect(groups).toHaveLength(2);
    expect(groups[0].agent).toBe('GPTBot');
    expect(groups[0].rules).toEqual([
      { type: 'disallow', path: '/admin' },
      { type: 'allow', path: '/' },
    ]);
    expect(groups[1].agent).toBe('*');
  });

  it('ignores comments and empty lines', () => {
    const txt = '# comment\n\nUser-agent: ClaudeBot\n# inline comment\nDisallow: /secret\n';
    const groups = parseRobots(txt);
    expect(groups).toHaveLength(1);
    expect(groups[0].rules).toHaveLength(1);
    expect(groups[0].rules[0]).toEqual({ type: 'disallow', path: '/secret' });
  });

  it('merges duplicate user-agent blocks', () => {
    const txt = `
User-agent: GPTBot
Disallow: /a

User-agent: GPTBot
Disallow: /b
    `;
    const groups = parseRobots(txt);
    expect(groups).toHaveLength(1);
    expect(groups[0].rules).toHaveLength(2);
  });
});

describe('evaluateAgent', () => {
  it('allows access when no rules match', () => {
    const groups = parseRobots('User-agent: GPTBot\nDisallow: /admin\n');
    const result = evaluateAgent(groups, 'ClaudeBot', '/');
    expect(result.allowed).toBe(true);
    expect(result.inherited).toBe(true);
  });

  it('respects exact agent over wildcard', () => {
    const groups = parseRobots(`
User-agent: *
Disallow: /

User-agent: GPTBot
Allow: /
    `);
    expect(evaluateAgent(groups, 'GPTBot', '/').allowed).toBe(true);
    expect(evaluateAgent(groups, 'ClaudeBot', '/').allowed).toBe(false);
  });

  it('prefers more specific rules', () => {
    const groups = parseRobots(`
User-agent: GPTBot
Disallow: /
Allow: /public
    `);
    expect(evaluateAgent(groups, 'GPTBot', '/public').allowed).toBe(true);
    expect(evaluateAgent(groups, 'GPTBot', '/other').allowed).toBe(false);
  });
});
