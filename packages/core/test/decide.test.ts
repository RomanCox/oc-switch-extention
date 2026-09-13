import { describe, it, expect } from 'vitest';
import { decide } from '../src/decide.js';
import { buildPacScript } from '../src/pac.js';
import { DEFAULT_SETTINGS, type Mode, type Settings, type Verdict } from '../src/types.js';
import { runPac } from './pac-harness.js';

const MODES: Mode[] = ['off', 'all', 'include', 'exclude'];

function settingsFor(mode: Mode): Settings {
  return {
    ...DEFAULT_SETTINGS,
    mode,
    rules: [
      { pattern: 'jira.corp.example.com', enabled: true },
      { pattern: '*.internal.example.com', enabled: true },
    ],
  };
}

/** Таблица решений из PLAN.md. Менять только вместе с планом. */
const TABLE: Array<[string, Record<Mode, Verdict>]> = [
  ['jira.corp.example.com',     { off: 'DIRECT', all: 'PROXY',  include: 'PROXY',  exclude: 'DIRECT' }],
  ['wiki.internal.example.com', { off: 'DIRECT', all: 'PROXY',  include: 'PROXY',  exclude: 'DIRECT' }],
  ['github.com',                { off: 'DIRECT', all: 'PROXY',  include: 'DIRECT', exclude: 'PROXY'  }],
  ['127.0.0.1',                 { off: 'DIRECT', all: 'DIRECT', include: 'DIRECT', exclude: 'DIRECT' }],
  ['localhost',                 { off: 'DIRECT', all: 'DIRECT', include: 'DIRECT', exclude: 'DIRECT' }],
  ['printer.local',             { off: 'DIRECT', all: 'DIRECT', include: 'DIRECT', exclude: 'DIRECT' }],
];

describe('decide', () => {
  for (const [host, expected] of TABLE) {
    for (const mode of MODES) {
      it(`${mode}: ${host} → ${expected[mode]}`, () => {
        expect(decide(host, settingsFor(mode))).toBe(expected[mode]);
      });
    }
  }

  it('отключённое правило не участвует в матчинге', () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      mode: 'include',
      rules: [{ pattern: 'github.com', enabled: false }],
    };
    expect(decide('github.com', s)).toBe('DIRECT');
  });
});

/**
 * Тест-близнец. PAC живёт в песочнице браузера и не видит decide(),
 * поэтому логика там дублируется. Этот тест ловит расхождение двух
 * реализаций — без него оно всплывёт через месяц на одном домене.
 * Удалять нельзя.
 */
describe('PAC повторяет decide', () => {
  for (const mode of MODES) {
    it(`режим ${mode}`, () => {
      const s = settingsFor(mode);
      const pac = buildPacScript(s);
      for (const [host] of TABLE) {
        expect(runPac(pac, `https://${host}/`, host), `${mode}: ${host}`).toBe(decide(host, s));
      }
    });
  }

  it('использует SOCKS5, а не SOCKS4', () => {
    const pac = buildPacScript(settingsFor('all'));
    expect(pac).toContain('SOCKS5');
    expect(pac).not.toMatch(/\bSOCKS\s+\d/);
  });
});
