/**
 * Совпадает ли хост с шаблоном.
 *
 * Поддерживаются:
 *   example.com       — сам домен и все его поддомены
 *   *.example.com     — только поддомены
 *   127.0.0.1         — точное совпадение
 *
 * Матчинг только по хосту: Chrome отдаёт в PAC для https
 * лишь scheme://host:port, пути там нет.
 */
export function matchHost(_host: string, _pattern: string): boolean {
  throw new Error('not implemented: фаза 1');
}

/** Совпал ли хост хотя бы с одним шаблоном. */
export function matchAny(_host: string, _patterns: readonly string[]): boolean {
  throw new Error('not implemented: фаза 1');
}
