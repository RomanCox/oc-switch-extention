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
export function matchHost(host: string, pattern: string): boolean {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();

  if (p.startsWith('*.')) {
    // "*.example.com" — только поддомены, сам example.com не матчится.
    const suffix = p.slice(1); // ".example.com"
    return h.length > suffix.length && h.endsWith(suffix);
  }

  // "example.com" — сам домен и любые его поддомены.
  return h === p || h.endsWith(`.${p}`);
}

/** Совпал ли хост хотя бы с одним шаблоном. */
export function matchAny(host: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchHost(host, pattern));
}
