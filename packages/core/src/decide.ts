import { ALWAYS_DIRECT, type Settings, type Verdict } from './types.js';
import { matchAny } from './match.js';

/**
 * Единственный источник истины о маршрутизации.
 *
 * Сюда — и только сюда — добавляется любая новая логика.
 * Chrome получает её скомпилированной в PAC, Firefox вызывает напрямую.
 */
export function decide(host: string, settings: Settings): Verdict {
  if (matchAny(host, ALWAYS_DIRECT)) return 'DIRECT';

  const patterns = settings.rules.filter((rule) => rule.enabled).map((rule) => rule.pattern);
  const matched = matchAny(host, patterns);

  switch (settings.mode) {
    case 'off':
      return 'DIRECT';
    case 'all':
      return 'PROXY';
    case 'include':
      return matched ? 'PROXY' : 'DIRECT';
    case 'exclude':
      return matched ? 'DIRECT' : 'PROXY';
  }
}
