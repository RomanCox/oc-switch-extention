import { describe, it, expect } from 'vitest';
import { findMatchingRule, isValidPattern } from '../src/match.js';
import type { Rule } from '../src/types.js';

describe('isValidPattern', () => {
  const valid = ['example.com', '*.example.com', 'localhost', 'printer.local', '127.0.0.1', 'a.b.c.example.com'];
  const invalid = ['', '   ', '*.', '*', 'example .com', 'exa mple.com', 'example.com/path', 'https://example.com', '-example.com', 'example-.com'];

  for (const p of valid) {
    it(`валиден: ${JSON.stringify(p)}`, () => {
      expect(isValidPattern(p)).toBe(true);
    });
  }

  for (const p of invalid) {
    it(`невалиден: ${JSON.stringify(p)}`, () => {
      expect(isValidPattern(p)).toBe(false);
    });
  }
});

describe('findMatchingRule', () => {
  const rules: Rule[] = [
    { pattern: 'github.com', enabled: true, list: 'proxy', strength: 'soft' },
    { pattern: '*.internal.example.com', enabled: true, list: 'direct', strength: 'soft' },
    { pattern: 'disabled.example.com', enabled: false, list: 'proxy', strength: 'soft' },
  ];

  it('возвращает первое сматчившее включённое правило', () => {
    expect(findMatchingRule('github.com', rules)).toEqual(rules[0]);
    expect(findMatchingRule('wiki.internal.example.com', rules)).toEqual(rules[1]);
  });

  it('игнорирует отключённые правила', () => {
    expect(findMatchingRule('disabled.example.com', rules)).toBeUndefined();
  });

  it('undefined, если ничего не совпало', () => {
    expect(findMatchingRule('unmatched.com', rules)).toBeUndefined();
  });
});
