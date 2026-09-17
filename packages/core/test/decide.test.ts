import { describe, it, expect } from 'vitest';
import { decide } from '../src/decide.js';
import { buildPacScript } from '../src/pac.js';
import { DEFAULT_SETTINGS, type Mode, type Rule, type Settings, type Verdict } from '../src/types.js';
import { runPac } from './pac-harness.js';

const MODES: Mode[] = ['off', 'all', 'include', 'exclude'];

/**
 * Правила из PLAN.md:
 *   +VPN мягкое:  jira.corp.example.com   — работает только в include
 *   +VPN строгое: force-proxy.example.com — VPN всегда, даже при off
 *   −VPN мягкое:  *.internal.example.com  — работает только в exclude
 *   −VPN строгое: force-direct.example.com — мимо VPN всегда, даже при all
 */
const RULES: Rule[] = [
  { pattern: 'jira.corp.example.com', enabled: true, list: 'proxy', strength: 'soft' },
  { pattern: 'force-proxy.example.com', enabled: true, list: 'proxy', strength: 'force' },
  { pattern: '*.internal.example.com', enabled: true, list: 'direct', strength: 'soft' },
  { pattern: 'force-direct.example.com', enabled: true, list: 'direct', strength: 'force' },
];

function settingsFor(mode: Mode): Settings {
  return { ...DEFAULT_SETTINGS, mode, rules: RULES };
}

/** Таблица решений из PLAN.md. Менять только вместе с планом. */
const TABLE: Array<[string, Record<Mode, Verdict>]> = [
  ['jira.corp.example.com',        { off: 'DIRECT', all: 'PROXY',  include: 'PROXY',  exclude: 'PROXY'  }],
  ['force-proxy.example.com',      { off: 'PROXY',  all: 'PROXY',  include: 'PROXY',  exclude: 'PROXY'  }],
  ['wiki.internal.example.com',    { off: 'DIRECT', all: 'PROXY',  include: 'DIRECT', exclude: 'DIRECT' }],
  ['force-direct.example.com',     { off: 'DIRECT', all: 'DIRECT', include: 'DIRECT', exclude: 'DIRECT' }],
  ['github.com',                   { off: 'DIRECT', all: 'PROXY',  include: 'DIRECT', exclude: 'PROXY'  }],
  ['127.0.0.1',                    { off: 'DIRECT', all: 'DIRECT', include: 'DIRECT', exclude: 'DIRECT' }],
  ['localhost',                    { off: 'DIRECT', all: 'DIRECT', include: 'DIRECT', exclude: 'DIRECT' }],
  ['printer.local',                { off: 'DIRECT', all: 'DIRECT', include: 'DIRECT', exclude: 'DIRECT' }],
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
      rules: [{ pattern: 'github.com', enabled: false, list: 'proxy', strength: 'soft' }],
    };
    expect(decide('github.com', s)).toBe('DIRECT');
  });

  it('отключённое force-правило не перекрывает off/all', () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      mode: 'off',
      rules: [{ pattern: 'github.com', enabled: false, list: 'proxy', strength: 'force' }],
    };
    expect(decide('github.com', s)).toBe('DIRECT');
  });

  it('ALWAYS_DIRECT перекрывает даже force +VPN', () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      mode: 'all',
      rules: [{ pattern: 'localhost', enabled: true, list: 'proxy', strength: 'force' }],
    };
    expect(decide('localhost', s)).toBe('DIRECT');
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
