import type { Settings, Verdict } from './types.js';

/**
 * Единственный источник истины о маршрутизации.
 *
 * Сюда — и только сюда — добавляется любая новая логика.
 * Chrome получает её скомпилированной в PAC, Firefox вызывает напрямую.
 */
export function decide(_host: string, _settings: Settings): Verdict {
  throw new Error('not implemented: фаза 1');
}
