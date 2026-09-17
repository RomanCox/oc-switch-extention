import { ALWAYS_DIRECT, type Rule, type Settings, type Verdict } from './types.js';
import { matchAny } from './match.js';

function patterns(rules: readonly Rule[], list: Rule['list'], strength?: Rule['strength']): string[] {
  return rules
    .filter((rule) => rule.enabled && rule.list === list && (strength === undefined || rule.strength === strength))
    .map((rule) => rule.pattern);
}

/**
 * Единственный источник истины о маршрутизации.
 *
 * Сюда — и только сюда — добавляется любая новая логика.
 * Chrome получает её скомпилированной в PAC, Firefox вызывает напрямую.
 *
 * Порядок проверок:
 *   1. ALWAYS_DIRECT — встроенный список, его не может перекрыть ни одно правило.
 *   2. Строгие («force») правила — побеждают в любом режиме, в том числе
 *      +VPN force работает даже при off, а −VPN force — даже при all.
 *   3. Обычные («soft») правила — участвуют только в своём режиме:
 *      +VPN в include, −VPN в exclude. Вне «своего» режима ведут себя
 *      как любой хост не из списка.
 */
export function decide(host: string, settings: Settings): Verdict {
  if (matchAny(host, ALWAYS_DIRECT)) return 'DIRECT';

  if (matchAny(host, patterns(settings.rules, 'proxy', 'force'))) return 'PROXY';
  if (matchAny(host, patterns(settings.rules, 'direct', 'force'))) return 'DIRECT';

  switch (settings.mode) {
    case 'off':
      return 'DIRECT';
    case 'all':
      return 'PROXY';
    case 'include':
      return matchAny(host, patterns(settings.rules, 'proxy')) ? 'PROXY' : 'DIRECT';
    case 'exclude':
      return matchAny(host, patterns(settings.rules, 'direct')) ? 'DIRECT' : 'PROXY';
  }
}
