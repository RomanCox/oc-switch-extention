/** Режимы взаимоисключающие: это переключатель на четыре положения. */
export type Mode = 'off' | 'all' | 'include' | 'exclude';

export type Verdict = 'PROXY' | 'DIRECT';

/** Какому списку принадлежит правило: «+VPN» (через прокси) или «−VPN» (мимо). */
export type RuleList = 'proxy' | 'direct';

/**
 * force — правило побеждает в любом режиме, включая off (для proxy)
 *         и all (для direct). Единственное, что его перекрывает, — ALWAYS_DIRECT.
 * soft  — правило участвует только в «своём» режиме: proxy-правила в include,
 *         direct-правила в exclude. В остальных режимах ведёт себя как обычный хост.
 */
export type RuleStrength = 'force' | 'soft';

export interface Rule {
  /** Хост или маска: example.com, *.example.com */
  pattern: string;
  enabled: boolean;
  list: RuleList;
  strength: RuleStrength;
  note?: string;
}

export interface ProxyTarget {
  host: string;
  port: number;
}

/** Настройки синхронизации списков правил через собственный сервер. */
export interface SyncSettings {
  url: string;
  token: string;
  enabled: boolean;
}

export interface Settings {
  mode: Mode;
  rules: Rule[];
  proxy: ProxyTarget;
  /** Время последнего локального изменения rules (мс, Date.now()) — для «побеждает последний». */
  rulesUpdatedAt: number;
  sync: SyncSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'off',
  rules: [],
  proxy: { host: '127.0.0.1', port: 11080 },
  rulesUpdatedAt: 0,
  sync: { url: '', token: '', enabled: false },
};

/**
 * Всегда DIRECT, в любом режиме. Без этого получается петля
 * и отваливается локальная разработка.
 */
export const ALWAYS_DIRECT: readonly string[] = [
  'localhost',
  '127.0.0.1',
  '::1',
  '*.local',
  '*.localhost',
];
