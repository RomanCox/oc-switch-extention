import type { Verdict } from '../src/types.js';

/**
 * Исполняет сгенерированный PAC-скрипт в песочнице, подставляя те же
 * помощники, что даёт браузер. Нужен, чтобы сверить PAC с decide().
 */
export function runPac(pacSource: string, url: string, host: string): Verdict {
  const shExpMatch = (str: string, shexp: string): boolean => {
    const rx = new RegExp(
      '^' +
        shexp
          .split('')
          .map((ch) =>
            ch === '*' ? '.*' : ch === '?' ? '.' : ch.replace(/[.+^${}()|[\]\\]/g, '\\$&'),
          )
          .join('') +
        '$',
    );
    return rx.test(str);
  };

  const dnsDomainIs = (h: string, domain: string): boolean =>
    h.length >= domain.length && h.slice(h.length - domain.length) === domain;

  const isPlainHostName = (h: string): boolean => !h.includes('.');

  const factory = new Function(
    'shExpMatch',
    'dnsDomainIs',
    'isPlainHostName',
    `${pacSource}; return FindProxyForURL;`,
  ) as (
    a: typeof shExpMatch,
    b: typeof dnsDomainIs,
    c: typeof isPlainHostName,
  ) => (url: string, host: string) => string;

  const result = factory(shExpMatch, dnsDomainIs, isPlainHostName)(url, host);
  return result.trim().toUpperCase().startsWith('DIRECT') ? 'DIRECT' : 'PROXY';
}
